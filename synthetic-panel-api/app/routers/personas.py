"""
Persona CRUD endpoints.
"""
import json
import logging
import uuid as uuid_mod
from typing import Optional
from uuid import UUID

import redis
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import OrganizationFilter, TokenPayload, get_current_user, get_organization_filter
from app.config import settings
from app.database import get_db
from app.models import Persona
from app.schemas import (
    BatchGenerateRequest,
    BatchGenerateResponse,
    MessageResponse,
    PersonaCreate,
    PersonaListResponse,
    PersonaResponse,
    PersonaUpdate,
    PreviewPersonasRequest,
    TaskDispatchResponse,
    TaskStatusResponse,
)

logger = logging.getLogger(__name__)


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

router = APIRouter(prefix="/personas", tags=["Personas"])


# ── Preview Personas (must be before /{persona_id} routes) ──


@router.post("/preview", response_model=TaskDispatchResponse, status_code=status.HTTP_202_ACCEPTED)
async def preview_personas(
    request: PreviewPersonasRequest,
    current_user: TokenPayload = Depends(get_current_user),
):
    """
    Generate AI persona previews from demographics and archetypes.
    Dispatches a celery task and returns the task ID.
    """
    params = {
        "archetypes": request.archetypes,
        "demographics": request.demographics,
        "variations_per_archetype": request.variations_per_archetype,
        "knowledge_group_ids": request.knowledge_group_ids,
        "knowledge_source_ids": request.knowledge_source_ids,
    }

    task_id = _send_celery_task("simulations.preview_personas", [params])
    logger.info(f"Dispatched preview_personas task: {task_id}")
    return TaskDispatchResponse(task_id=task_id, status="processing")


@router.get("/preview/{task_id}/status", response_model=TaskStatusResponse)
async def get_preview_personas_status(
    task_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    """Check the status of a persona preview generation task."""
    result = _get_task_status(task_id)
    return TaskStatusResponse(**result)


@router.post("", response_model=PersonaResponse, status_code=status.HTTP_201_CREATED)
async def create_persona(
    data: PersonaCreate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """
    Create a new persona.
    """
    if org_filter.organization_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization context required to create persona",
        )

    persona = Persona(
        organization_id=org_filter.organization_id,
        created_by=current_user.user_id,
        **data.model_dump(exclude_unset=True),
    )

    db.add(persona)
    await db.flush()
    await db.refresh(persona)

    logger.info(f"Created persona {persona.id} for org {org_filter.organization_id}")
    return persona


@router.get("", response_model=PersonaListResponse)
async def list_personas(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    is_active: Optional[bool] = Query(default=None),
    search: Optional[str] = Query(default=None),
    archetype_id: Optional[UUID] = Query(default=None),
    knowledge_group_id: Optional[UUID] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """
    List personas with optional filtering.
    """
    # Base query
    query = select(Persona)

    # Apply organization filter
    if org_filter.should_filter():
        query = query.where(Persona.organization_id == org_filter.organization_id)

    # Apply additional filters
    if is_active is not None:
        query = query.where(Persona.is_active == is_active)

    if search:
        search_term = f"%{search}%"
        query = query.where(Persona.name.ilike(search_term))

    if archetype_id:
        query = query.where(Persona.archetype_id == archetype_id)

    if knowledge_group_id:
        query = query.where(Persona.knowledge_group_id == knowledge_group_id)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(Persona.created_at.desc())

    # Execute query
    result = await db.execute(query)
    personas = result.scalars().all()

    return PersonaListResponse(
        items=[PersonaResponse.model_validate(p) for p in personas],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{persona_id}", response_model=PersonaResponse)
async def get_persona(
    persona_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """
    Get a specific persona by ID.
    """
    query = select(Persona).where(Persona.id == persona_id)

    if org_filter.should_filter():
        query = query.where(Persona.organization_id == org_filter.organization_id)

    result = await db.execute(query)
    persona = result.scalar_one_or_none()

    if not persona:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Persona not found",
        )

    return persona


@router.put("/{persona_id}", response_model=PersonaResponse)
async def update_persona(
    persona_id: UUID,
    data: PersonaUpdate,
    db: AsyncSession = Depends(get_db),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """
    Update a persona.
    """
    query = select(Persona).where(Persona.id == persona_id)

    if org_filter.should_filter():
        query = query.where(Persona.organization_id == org_filter.organization_id)

    result = await db.execute(query)
    persona = result.scalar_one_or_none()

    if not persona:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Persona not found",
        )

    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(persona, field, value)

    await db.flush()
    await db.refresh(persona)

    logger.info(f"Updated persona {persona_id}")
    return persona


@router.delete("/{persona_id}", response_model=MessageResponse)
async def delete_persona(
    persona_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """
    Delete a persona.
    """
    query = select(Persona).where(Persona.id == persona_id)

    if org_filter.should_filter():
        query = query.where(Persona.organization_id == org_filter.organization_id)

    result = await db.execute(query)
    persona = result.scalar_one_or_none()

    if not persona:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Persona not found",
        )

    await db.delete(persona)

    logger.info(f"Deleted persona {persona_id}")
    return MessageResponse(message="Persona deleted successfully")


# ── AI Generation Endpoints ──


@router.post("/batch-generate", response_model=BatchGenerateResponse, status_code=status.HTTP_202_ACCEPTED)
async def batch_generate_personas(
    request: BatchGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """
    Batch-create personas from previews and dispatch celery tasks to generate
    full profiles (personality, backstory, avatar) for each one.
    """
    if org_filter.organization_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization context required to create personas",
        )

    task_ids = []
    persona_ids = []

    for preview in request.previews:
        # 1. Create the persona record with basic fields
        persona = Persona(
            organization_id=org_filter.organization_id,
            created_by=current_user.user_id,
            name=preview.name,
            age=preview.age,
            gender=preview.gender,
            country=preview.country,
            city=preview.city,
            education=preview.education,
            occupation=preview.occupation,
            archetype_id=preview.archetype_id,
            language=preview.language,
        )
        db.add(persona)
        await db.flush()
        await db.refresh(persona)

        persona_id_str = str(persona.id)
        persona_ids.append(persona_id_str)

        # 2. Dispatch celery task for full generation
        kg_ids = [str(g) for g in request.knowledge_group_ids] if request.knowledge_group_ids else None

        task_id = _send_celery_task(
            "simulations.generate_full_persona",
            [
                persona_id_str,          # persona_id
                preview.name,            # name
                preview.age,             # age
                preview.gender,          # gender
                preview.country,         # country
                preview.city,            # city
                preview.education,       # education
                preview.occupation,      # occupation
                preview.archetype_name,  # archetype_name
                preview.archetype_driver,  # archetype_driver
                preview.archetype_core_value,  # archetype_core_value
                kg_ids,                  # knowledge_group_ids
                request.generate_backstories,  # generate_backstory
                request.generate_avatars,      # generate_avatar
            ],
        )
        task_ids.append(task_id)
        logger.info(f"Dispatched generate_full_persona task: {task_id} for persona {persona_id_str}")

    logger.info(f"Batch-generated {len(persona_ids)} personas with {len(task_ids)} tasks")

    return BatchGenerateResponse(
        task_ids=task_ids,
        persona_ids=persona_ids,
        status="processing",
    )


@router.get("/batch-generate/{task_id}/status", response_model=TaskStatusResponse)
async def get_batch_generate_task_status(
    task_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    """Check the status of a persona generation task."""
    result = _get_task_status(task_id)
    return TaskStatusResponse(**result)


@router.post("/{persona_id}/generate-profile", response_model=TaskDispatchResponse, status_code=status.HTTP_202_ACCEPTED)
async def generate_persona_profile(
    persona_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """
    Generate full profile for a persona using AI.
    Dispatches a celery task and returns the task ID.
    """
    query = select(Persona).where(Persona.id == persona_id)
    if org_filter.should_filter():
        query = query.where(Persona.organization_id == org_filter.organization_id)

    result = await db.execute(query)
    persona = result.scalar_one_or_none()

    if not persona:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Persona not found",
        )

    # Fetch archetype info if available
    archetype_name = None
    archetype_driver = None
    archetype_core_value = None
    if persona.archetype_id:
        from app.models import Archetype
        arch_result = await db.execute(
            select(Archetype).where(Archetype.id == persona.archetype_id)
        )
        archetype = arch_result.scalar_one_or_none()
        if archetype:
            archetype_name = archetype.name
            archetype_driver = getattr(archetype, "driver", None)
            archetype_core_value = getattr(archetype, "core_value", None)

    kg_ids = [str(persona.knowledge_group_id)] if persona.knowledge_group_id else None

    task_id = _send_celery_task(
        "simulations.generate_full_persona",
        [
            str(persona.id),
            persona.name,
            persona.age,
            persona.gender,
            persona.country,
            persona.city,
            persona.education,
            persona.occupation,
            archetype_name,
            archetype_driver,
            archetype_core_value,
            kg_ids,
            True,   # generate_backstory
            False,  # generate_avatar
        ],
    )

    logger.info(f"Dispatched generate_full_persona (profile) task: {task_id} for persona {persona_id}")
    return TaskDispatchResponse(task_id=task_id, status="processing")


@router.post("/{persona_id}/generate-backstory", response_model=TaskDispatchResponse, status_code=status.HTTP_202_ACCEPTED)
async def generate_persona_backstory(
    persona_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """
    Generate backstory for a persona using AI.
    Dispatches a celery task and returns the task ID.
    """
    query = select(Persona).where(Persona.id == persona_id)
    if org_filter.should_filter():
        query = query.where(Persona.organization_id == org_filter.organization_id)

    result = await db.execute(query)
    persona = result.scalar_one_or_none()

    if not persona:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Persona not found",
        )

    archetype_name = None
    archetype_driver = None
    archetype_core_value = None
    if persona.archetype_id:
        from app.models import Archetype
        arch_result = await db.execute(
            select(Archetype).where(Archetype.id == persona.archetype_id)
        )
        archetype = arch_result.scalar_one_or_none()
        if archetype:
            archetype_name = archetype.name
            archetype_driver = getattr(archetype, "driver", None)
            archetype_core_value = getattr(archetype, "core_value", None)

    kg_ids = [str(persona.knowledge_group_id)] if persona.knowledge_group_id else None

    task_id = _send_celery_task(
        "simulations.generate_full_persona",
        [
            str(persona.id),
            persona.name,
            persona.age,
            persona.gender,
            persona.country,
            persona.city,
            persona.education,
            persona.occupation,
            archetype_name,
            archetype_driver,
            archetype_core_value,
            kg_ids,
            True,   # generate_backstory
            False,  # generate_avatar
        ],
    )

    logger.info(f"Dispatched generate_full_persona (backstory) task: {task_id} for persona {persona_id}")
    return TaskDispatchResponse(task_id=task_id, status="processing")


@router.post("/{persona_id}/generate-avatar", response_model=TaskDispatchResponse, status_code=status.HTTP_202_ACCEPTED)
async def generate_persona_avatar(
    persona_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """
    Generate avatar for a persona using AI.
    Dispatches a celery task and returns the task ID.
    """
    query = select(Persona).where(Persona.id == persona_id)
    if org_filter.should_filter():
        query = query.where(Persona.organization_id == org_filter.organization_id)

    result = await db.execute(query)
    persona = result.scalar_one_or_none()

    if not persona:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Persona not found",
        )

    archetype_name = None
    if persona.archetype_id:
        from app.models import Archetype
        arch_result = await db.execute(
            select(Archetype).where(Archetype.id == persona.archetype_id)
        )
        archetype = arch_result.scalar_one_or_none()
        if archetype:
            archetype_name = archetype.name

    task_id = _send_celery_task(
        "simulations.generate_full_persona",
        [
            str(persona.id),
            persona.name,
            persona.age,
            persona.gender,
            persona.country,
            persona.city,
            persona.education,
            persona.occupation,
            archetype_name,
            None,   # archetype_driver
            None,   # archetype_core_value
            None,   # knowledge_group_ids
            False,  # generate_backstory
            True,   # generate_avatar
        ],
    )

    logger.info(f"Dispatched generate_full_persona (avatar) task: {task_id} for persona {persona_id}")
    return TaskDispatchResponse(task_id=task_id, status="processing")
