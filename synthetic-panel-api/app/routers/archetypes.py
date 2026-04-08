"""
Archetype CRUD endpoints.
"""
import json
import logging
import uuid as uuid_mod
from typing import Optional
from uuid import UUID

import redis
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import OrganizationFilter, TokenPayload, get_current_user, get_organization_filter
from app.config import settings
from app.database import get_db
from app.models import Archetype
from app.schemas import (
    ArchetypeCreate,
    ArchetypeExtractRequest,
    ArchetypeExtractResponse,
    ArchetypeGenerateResponse,
    ArchetypeListResponse,
    ArchetypeResponse,
    ArchetypeUpdate,
    ExtractedArchetype,
    MessageResponse,
    TaskDispatchResponse,
    TaskStatusResponse,
)
from app.services.ai_service import ai_service


# ── Lightweight Celery task dispatch (no celery dependency needed) ──

_redis_client = None


def _get_redis():
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(settings.redis_connection_url)
    return _redis_client


def _send_celery_task(task_name: str, args: list) -> str:
    """Send a task to celery via Redis matching kombu's expected message format."""
    import base64

    task_id = str(uuid_mod.uuid4())

    # Kombu expects body as (args, kwargs, embed) tuple
    body_tuple = (args, {}, {"callbacks": None, "errbacks": None, "chain": None, "chord": None})
    body_json = json.dumps(body_tuple)
    body_b64 = base64.b64encode(body_json.encode("utf-8")).decode("utf-8")

    headers = {
        "lang": "py",
        "task": task_name,
        "id": task_id,
        "root_id": task_id,
        "parent_id": None,
        "group": None,
        "origin": "synthetic-panel-api",
    }
    properties = {
        "correlation_id": task_id,
        "reply_to": "",
        "delivery_mode": 2,
        "delivery_info": {"exchange": "", "routing_key": "simulations"},
        "body_encoding": "base64",
        "delivery_tag": task_id,
    }
    message = json.dumps({
        "body": body_b64,
        "content-encoding": "utf-8",
        "content-type": "application/json",
        "headers": headers,
        "properties": properties,
    })
    r = _get_redis()
    r.lpush("simulations", message)
    return task_id


def _get_task_status(task_id: str) -> dict:
    """Check celery task result from Redis backend."""
    r = _get_redis()
    key = f"celery-task-meta-{task_id}"
    data = r.get(key)
    if not data:
        return {"task_id": task_id, "status": "processing"}
    result = json.loads(data)
    state = result.get("status", "PENDING")
    if state == "SUCCESS":
        return {"task_id": task_id, "status": "completed", "result": result.get("result")}
    elif state == "FAILURE":
        error = str(result.get("result", "Unknown error"))
        return {"task_id": task_id, "status": "failed", "error": error}
    else:
        return {"task_id": task_id, "status": "processing"}

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/archetypes", tags=["Archetypes"])


@router.post("", response_model=ArchetypeResponse, status_code=status.HTTP_201_CREATED)
async def create_archetype(
    data: ArchetypeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """Create a new archetype."""
    archetype = Archetype(
        organization_id=org_filter.organization_id,  # Can be None for global
        **data.model_dump(exclude_unset=True),
    )

    db.add(archetype)
    await db.flush()
    await db.refresh(archetype)

    return archetype


@router.get("", response_model=ArchetypeListResponse)
async def list_archetypes(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    is_active: Optional[bool] = Query(default=None),
    generation: Optional[str] = Query(default=None),
    include_global: bool = Query(default=True),
    db: AsyncSession = Depends(get_db),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """List archetypes (org-specific and optionally global)."""
    query = select(Archetype)

    # Filter by org + optionally include global archetypes
    if org_filter.should_filter():
        if include_global:
            query = query.where(
                or_(
                    Archetype.organization_id == org_filter.organization_id,
                    Archetype.organization_id.is_(None),
                )
            )
        else:
            query = query.where(Archetype.organization_id == org_filter.organization_id)

    if is_active is not None:
        query = query.where(Archetype.is_active == is_active)

    if generation:
        query = query.where(Archetype.generation == generation)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(Archetype.created_at.desc())

    result = await db.execute(query)
    archetypes = result.scalars().all()

    return ArchetypeListResponse(
        items=[ArchetypeResponse.model_validate(a) for a in archetypes],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{archetype_id}", response_model=ArchetypeResponse)
async def get_archetype(
    archetype_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """Get an archetype by ID."""
    query = select(Archetype).where(Archetype.id == archetype_id)

    # Allow access to global or own org's archetypes
    if org_filter.should_filter():
        query = query.where(
            or_(
                Archetype.organization_id == org_filter.organization_id,
                Archetype.organization_id.is_(None),
            )
        )

    result = await db.execute(query)
    archetype = result.scalar_one_or_none()

    if not archetype:
        raise HTTPException(status_code=404, detail="Archetype not found")

    return archetype


@router.put("/{archetype_id}", response_model=ArchetypeResponse)
async def update_archetype(
    archetype_id: UUID,
    data: ArchetypeUpdate,
    db: AsyncSession = Depends(get_db),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """Update an archetype (only org-owned, not global)."""
    query = select(Archetype).where(Archetype.id == archetype_id)

    # Can only update org-owned archetypes
    if org_filter.should_filter():
        query = query.where(Archetype.organization_id == org_filter.organization_id)

    result = await db.execute(query)
    archetype = result.scalar_one_or_none()

    if not archetype:
        raise HTTPException(status_code=404, detail="Archetype not found or not editable")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(archetype, field, value)

    await db.flush()
    await db.refresh(archetype)

    return archetype


@router.delete("/{archetype_id}", response_model=MessageResponse)
async def delete_archetype(
    archetype_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """Delete an archetype (only org-owned)."""
    query = select(Archetype).where(Archetype.id == archetype_id)

    if org_filter.should_filter():
        query = query.where(Archetype.organization_id == org_filter.organization_id)

    result = await db.execute(query)
    archetype = result.scalar_one_or_none()

    if not archetype:
        raise HTTPException(status_code=404, detail="Archetype not found or not deletable")

    await db.delete(archetype)
    return MessageResponse(message="Archetype deleted successfully")


async def _fetch_knowledge_content(
    db: AsyncSession,
    org_id: Optional[UUID],
    knowledge_group_id: Optional[UUID] = None,
    source_ids: Optional[list[UUID]] = None,
) -> tuple[str, int]:
    """
    Fetch knowledge content from platform schema tables.

    Returns:
        Tuple of (combined_content, sources_analyzed_count)
    """
    content_parts: list[str] = []
    sources_count = 0

    if knowledge_group_id:
        # Fetch all sources in the knowledge group via junction table
        params = {"group_id": str(knowledge_group_id)}

        if org_id:
            query = text("""
                SELECT
                    ks.id,
                    ks.title,
                    array_agg(kc.content ORDER BY kc.chunk_number) as chunks
                FROM platform.knowledge_sources ks
                JOIN platform.knowledge_group_sources kgs ON kgs.knowledge_source_id = ks.id
                JOIN platform.knowledge_groups kg ON kg.id = kgs.group_id
                LEFT JOIN platform.knowledge_chunks kc ON kc.knowledge_source_id = ks.id
                WHERE kgs.group_id = :group_id
                AND kg.organization_id = :org_id
                GROUP BY ks.id, ks.title
                ORDER BY ks.title
            """)
            params["org_id"] = str(org_id)
        else:
            query = text("""
                SELECT
                    ks.id,
                    ks.title,
                    array_agg(kc.content ORDER BY kc.chunk_number) as chunks
                FROM platform.knowledge_sources ks
                JOIN platform.knowledge_group_sources kgs ON kgs.knowledge_source_id = ks.id
                LEFT JOIN platform.knowledge_chunks kc ON kc.knowledge_source_id = ks.id
                WHERE kgs.group_id = :group_id
                GROUP BY ks.id, ks.title
                ORDER BY ks.title
            """)

        result = await db.execute(query, params)
        rows = result.fetchall()

        for row in rows:
            sources_count += 1
            chunks = [c for c in (row.chunks or []) if c is not None]
            doc_content = "\n\n".join(chunks)
            if doc_content.strip():
                content_parts.append(f"--- Document: {row.title} ---\n{doc_content}")

    if source_ids:
        # Fetch specific sources by their IDs
        source_id_strs = [str(sid) for sid in source_ids]
        query = text("""
            SELECT
                ks.id,
                ks.title,
                array_agg(kc.content ORDER BY kc.chunk_number) as chunks
            FROM platform.knowledge_sources ks
            LEFT JOIN platform.knowledge_chunks kc ON kc.knowledge_source_id = ks.id
            WHERE ks.id = ANY(:source_ids)
            GROUP BY ks.id, ks.title
            ORDER BY ks.title
        """)

        result = await db.execute(query, {"source_ids": source_id_strs})
        rows = result.fetchall()

        for row in rows:
            sources_count += 1
            chunks = [c for c in (row.chunks or []) if c is not None]
            doc_content = "\n\n".join(chunks)
            if doc_content.strip():
                content_parts.append(f"--- Document: {row.title} ---\n{doc_content}")

    combined = "\n\n".join(content_parts)
    return combined, sources_count


@router.post("/extract", response_model=TaskDispatchResponse, status_code=status.HTTP_202_ACCEPTED)
async def extract_archetypes(
    request: ArchetypeExtractRequest,
    current_user: TokenPayload = Depends(get_current_user),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """Dispatch archetype extraction to background worker."""
    if not request.knowledge_group_id and not request.source_ids:
        raise HTTPException(
            status_code=400,
            detail="Either knowledge_group_id or source_ids must be provided",
        )

    params_dict = {
        "knowledge_group_id": str(request.knowledge_group_id) if request.knowledge_group_id else None,
        "source_ids": [str(sid) for sid in request.source_ids] if request.source_ids else None,
        "target_generations": request.target_generations,
        "target_age_range": request.target_age_range,
        "extraction_focus": request.extraction_focus,
        "max_archetypes": request.max_archetypes,
        "organization_id": str(org_filter.organization_id) if org_filter.organization_id else None,
    }

    task_id = _send_celery_task("simulations.extract_archetypes", [params_dict])
    logger.info(f"Dispatched extract_archetypes task: {task_id}")

    return TaskDispatchResponse(task_id=task_id, status="processing")


@router.get("/extract/{task_id}/status", response_model=TaskStatusResponse)
async def get_extract_task_status(
    task_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    """Check the status of an archetype extraction task."""
    result = _get_task_status(task_id)
    return TaskStatusResponse(**result)


@router.post("/{archetype_id}/generate", response_model=TaskDispatchResponse, status_code=status.HTTP_202_ACCEPTED)
async def generate_archetype_profile(
    archetype_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """Dispatch archetype profile generation to background worker."""
    # Fetch the archetype to build context for the task
    query = select(Archetype).where(Archetype.id == archetype_id)
    if org_filter.should_filter():
        query = query.where(
            or_(
                Archetype.organization_id == org_filter.organization_id,
                Archetype.organization_id.is_(None),
            )
        )

    result = await db.execute(query)
    archetype = result.scalar_one_or_none()

    if not archetype:
        raise HTTPException(status_code=404, detail="Archetype not found")

    # Build archetype data dict for the celery task
    archetype_data = {
        "archetype_id": str(archetype.id),
        "name": archetype.name,
        "description": archetype.description,
        "generation": archetype.generation,
        "age_min": archetype.age_min,
        "age_max": archetype.age_max,
        "demographic_tags": archetype.demographic_tags or [],
        "driver": archetype.driver,
        "core_value": archetype.core_value,
        "key_behaviors": archetype.key_behaviors or [],
    }

    task_id = _send_celery_task("simulations.generate_archetype_profile", [archetype_data])
    logger.info(f"Dispatched generate_archetype_profile task: {task_id} for archetype {archetype_id}")

    return TaskDispatchResponse(task_id=task_id, status="processing")


@router.get("/generate/{task_id}/status", response_model=TaskStatusResponse)
async def get_generate_task_status(
    task_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    """Check the status of an archetype profile generation task."""
    result = _get_task_status(task_id)
    return TaskStatusResponse(**result)
