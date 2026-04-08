"""
Phrase Collection (Dictionary) CRUD endpoints.
"""
import json
import logging
import uuid as uuid_mod
from typing import Optional
from uuid import UUID

import redis
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import OrganizationFilter, TokenPayload, get_current_user, get_organization_filter
from app.config import settings
from app.database import get_db
from app.models import PhraseCollection
from app.schemas.phrase_collection import (
    PhraseCollectionCreate,
    PhraseCollectionListResponse,
    PhraseCollectionResponse,
    PhraseCollectionUpdate,
    PhraseCreate,
    PhraseGenerateRequest,
)
from app.schemas import MessageResponse, TaskDispatchResponse, TaskStatusResponse


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

router = APIRouter(prefix="/phrase-collections", tags=["Phrase Collections"])


# ── CRUD ──


@router.post("", response_model=PhraseCollectionResponse, status_code=status.HTTP_201_CREATED)
async def create_phrase_collection(
    data: PhraseCollectionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """Create a new phrase collection."""
    collection = PhraseCollection(
        organization_id=org_filter.organization_id,
        phrases=[],
        **data.model_dump(exclude_unset=True),
    )

    db.add(collection)
    await db.flush()
    await db.refresh(collection)

    return collection


@router.get("", response_model=PhraseCollectionListResponse)
async def list_phrase_collections(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    language: Optional[str] = Query(default=None),
    generation: Optional[str] = Query(default=None),
    is_active: Optional[bool] = Query(default=None),
    include_global: bool = Query(default=True),
    db: AsyncSession = Depends(get_db),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """List phrase collections with pagination and filters."""
    query = select(PhraseCollection)

    # Filter by org + optionally include global
    if org_filter.should_filter():
        if include_global:
            query = query.where(
                or_(
                    PhraseCollection.organization_id == org_filter.organization_id,
                    PhraseCollection.organization_id.is_(None),
                )
            )
        else:
            query = query.where(PhraseCollection.organization_id == org_filter.organization_id)

    if language:
        query = query.where(PhraseCollection.language == language)

    if generation:
        query = query.where(PhraseCollection.generation == generation)

    if is_active is not None:
        query = query.where(PhraseCollection.is_active == is_active)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(PhraseCollection.created_at.desc())

    result = await db.execute(query)
    collections = result.scalars().all()

    return PhraseCollectionListResponse(
        items=[PhraseCollectionResponse.model_validate(c) for c in collections],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{collection_id}", response_model=PhraseCollectionResponse)
async def get_phrase_collection(
    collection_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """Get a phrase collection by ID."""
    query = select(PhraseCollection).where(PhraseCollection.id == collection_id)

    if org_filter.should_filter():
        query = query.where(
            or_(
                PhraseCollection.organization_id == org_filter.organization_id,
                PhraseCollection.organization_id.is_(None),
            )
        )

    result = await db.execute(query)
    collection = result.scalar_one_or_none()

    if not collection:
        raise HTTPException(status_code=404, detail="Phrase collection not found")

    return collection


@router.put("/{collection_id}", response_model=PhraseCollectionResponse)
async def update_phrase_collection(
    collection_id: UUID,
    data: PhraseCollectionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """Update a phrase collection."""
    query = select(PhraseCollection).where(PhraseCollection.id == collection_id)

    if org_filter.should_filter():
        query = query.where(PhraseCollection.organization_id == org_filter.organization_id)

    result = await db.execute(query)
    collection = result.scalar_one_or_none()

    if not collection:
        raise HTTPException(status_code=404, detail="Phrase collection not found or not editable")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(collection, field, value)

    await db.flush()
    await db.refresh(collection)

    return collection


@router.delete("/{collection_id}", response_model=MessageResponse)
async def delete_phrase_collection(
    collection_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """Delete a phrase collection."""
    query = select(PhraseCollection).where(PhraseCollection.id == collection_id)

    if org_filter.should_filter():
        query = query.where(PhraseCollection.organization_id == org_filter.organization_id)

    result = await db.execute(query)
    collection = result.scalar_one_or_none()

    if not collection:
        raise HTTPException(status_code=404, detail="Phrase collection not found or not deletable")

    await db.delete(collection)
    return MessageResponse(message="Phrase collection deleted successfully")


# ── Phrase management (within JSONB array) ──


@router.post("/{collection_id}/phrases", response_model=PhraseCollectionResponse)
async def add_phrase(
    collection_id: UUID,
    data: PhraseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """Add a phrase to a collection's JSONB phrases array."""
    query = select(PhraseCollection).where(PhraseCollection.id == collection_id)

    if org_filter.should_filter():
        query = query.where(PhraseCollection.organization_id == org_filter.organization_id)

    result = await db.execute(query)
    collection = result.scalar_one_or_none()

    if not collection:
        raise HTTPException(status_code=404, detail="Phrase collection not found")

    # Build phrase dict
    phrase_dict = data.model_dump(exclude_unset=True)

    # Append to JSONB array (must reassign for SQLAlchemy to detect change)
    current_phrases = list(collection.phrases or [])
    current_phrases.append(phrase_dict)
    collection.phrases = current_phrases

    await db.flush()
    await db.refresh(collection)

    return collection


@router.delete("/{collection_id}/phrases/{phrase_index}", response_model=PhraseCollectionResponse)
async def remove_phrase(
    collection_id: UUID,
    phrase_index: int,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """Remove a phrase from a collection by index."""
    query = select(PhraseCollection).where(PhraseCollection.id == collection_id)

    if org_filter.should_filter():
        query = query.where(PhraseCollection.organization_id == org_filter.organization_id)

    result = await db.execute(query)
    collection = result.scalar_one_or_none()

    if not collection:
        raise HTTPException(status_code=404, detail="Phrase collection not found")

    current_phrases = list(collection.phrases or [])

    if phrase_index < 0 or phrase_index >= len(current_phrases):
        raise HTTPException(status_code=404, detail="Phrase index out of range")

    current_phrases.pop(phrase_index)
    collection.phrases = current_phrases

    await db.flush()
    await db.refresh(collection)

    return collection


# ── AI Generation ──


@router.post("/{collection_id}/generate", response_model=TaskDispatchResponse, status_code=status.HTTP_202_ACCEPTED)
async def generate_phrases(
    collection_id: UUID,
    request: Optional[PhraseGenerateRequest] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """Dispatch AI phrase generation to background worker."""
    query = select(PhraseCollection).where(PhraseCollection.id == collection_id)

    if org_filter.should_filter():
        query = query.where(
            or_(
                PhraseCollection.organization_id == org_filter.organization_id,
                PhraseCollection.organization_id.is_(None),
            )
        )

    result = await db.execute(query)
    collection = result.scalar_one_or_none()

    if not collection:
        raise HTTPException(status_code=404, detail="Phrase collection not found")

    params_dict = {
        "collection_id": str(collection.id),
        "name": collection.name,
        "language": collection.language,
        "generation": collection.generation,
        "age_range": getattr(collection, "age_range", None),
        "region": getattr(collection, "region", None),
        "city": getattr(collection, "city", None),
        "description": collection.description,
        "count": request.count if request else 20,
    }

    task_id = _send_celery_task("simulations.generate_phrases", [params_dict])
    logger.info(f"Dispatched generate_phrases task: {task_id} for collection {collection_id}")

    return TaskDispatchResponse(task_id=task_id, status="processing")


@router.get("/generate/{task_id}/status", response_model=TaskStatusResponse)
async def get_generate_task_status(
    task_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    """Check the status of a phrase generation task."""
    result = _get_task_status(task_id)
    return TaskStatusResponse(**result)
