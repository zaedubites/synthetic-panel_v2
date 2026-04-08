"""
Moderator CRUD endpoints.
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
from app.models import Moderator
from app.schemas import (
    GenerateAvatarRequest,
    MessageResponse,
    ModeratorCreate,
    ModeratorListResponse,
    ModeratorResponse,
    ModeratorUpdate,
    TaskDispatchResponse,
    TaskStatusResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/moderators", tags=["Moderators"])


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


@router.post("", response_model=ModeratorResponse, status_code=status.HTTP_201_CREATED)
async def create_moderator(
    data: ModeratorCreate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """Create a new moderator."""
    if org_filter.organization_id is None:
        raise HTTPException(status_code=400, detail="Organization context required")

    moderator = Moderator(
        organization_id=org_filter.organization_id,
        created_by=current_user.user_id,
        **data.model_dump(exclude_unset=True),
    )

    db.add(moderator)
    await db.flush()
    await db.refresh(moderator)

    return moderator


@router.get("", response_model=ModeratorListResponse)
async def list_moderators(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    is_active: Optional[bool] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """List moderators."""
    query = select(Moderator)

    if org_filter.should_filter():
        query = query.where(Moderator.organization_id == org_filter.organization_id)

    if is_active is not None:
        query = query.where(Moderator.is_active == is_active)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(Moderator.created_at.desc())

    result = await db.execute(query)
    moderators = result.scalars().all()

    return ModeratorListResponse(
        items=[ModeratorResponse.model_validate(m) for m in moderators],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/generate-avatar/{task_id}/status", response_model=TaskStatusResponse)
async def get_generate_avatar_status(task_id: str):
    """Poll status of a moderator avatar generation task."""
    result = _get_task_status(task_id)
    return result


@router.get("/{moderator_id}", response_model=ModeratorResponse)
async def get_moderator(
    moderator_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """Get a moderator by ID."""
    query = select(Moderator).where(Moderator.id == moderator_id)

    if org_filter.should_filter():
        query = query.where(Moderator.organization_id == org_filter.organization_id)

    result = await db.execute(query)
    moderator = result.scalar_one_or_none()

    if not moderator:
        raise HTTPException(status_code=404, detail="Moderator not found")

    return moderator


@router.put("/{moderator_id}", response_model=ModeratorResponse)
async def update_moderator(
    moderator_id: UUID,
    data: ModeratorUpdate,
    db: AsyncSession = Depends(get_db),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """Update a moderator."""
    query = select(Moderator).where(Moderator.id == moderator_id)

    if org_filter.should_filter():
        query = query.where(Moderator.organization_id == org_filter.organization_id)

    result = await db.execute(query)
    moderator = result.scalar_one_or_none()

    if not moderator:
        raise HTTPException(status_code=404, detail="Moderator not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(moderator, field, value)

    await db.flush()
    await db.refresh(moderator)

    return moderator


@router.delete("/{moderator_id}", response_model=MessageResponse)
async def delete_moderator(
    moderator_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """Delete a moderator."""
    query = select(Moderator).where(Moderator.id == moderator_id)

    if org_filter.should_filter():
        query = query.where(Moderator.organization_id == org_filter.organization_id)

    result = await db.execute(query)
    moderator = result.scalar_one_or_none()

    if not moderator:
        raise HTTPException(status_code=404, detail="Moderator not found")

    await db.delete(moderator)
    return MessageResponse(message="Moderator deleted successfully")


@router.post("/{moderator_id}/set-default", response_model=ModeratorResponse)
async def set_default_moderator(
    moderator_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """Set a moderator as the default for the organization."""
    query = select(Moderator).where(Moderator.id == moderator_id)

    if org_filter.should_filter():
        query = query.where(Moderator.organization_id == org_filter.organization_id)

    result = await db.execute(query)
    moderator = result.scalar_one_or_none()

    if not moderator:
        raise HTTPException(status_code=404, detail="Moderator not found")

    # Unset all other defaults for this org
    from sqlalchemy import update
    await db.execute(
        update(Moderator)
        .where(Moderator.organization_id == moderator.organization_id)
        .values(is_default=False)
    )

    moderator.is_default = True
    await db.flush()
    await db.refresh(moderator)

    return moderator


@router.post(
    "/{moderator_id}/generate-avatar",
    response_model=TaskDispatchResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def generate_moderator_avatar(
    moderator_id: UUID,
    data: GenerateAvatarRequest,
    db: AsyncSession = Depends(get_db),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """Dispatch a celery task to generate a moderator avatar."""
    query = select(Moderator).where(Moderator.id == moderator_id)

    if org_filter.should_filter():
        query = query.where(Moderator.organization_id == org_filter.organization_id)

    result = await db.execute(query)
    moderator = result.scalar_one_or_none()

    if not moderator:
        raise HTTPException(status_code=404, detail="Moderator not found")

    params = {
        "moderator_id": str(moderator.id),
        "name": moderator.name,
        "type": moderator.type or "professional",
        "gender": moderator.gender,
        "personality": moderator.personality or {},
        "custom_prompt": data.custom_prompt,
    }

    task_id = _send_celery_task("simulations.generate_moderator_avatar", [params])
    logger.info(f"Dispatched generate_moderator_avatar task {task_id} for moderator {moderator_id}")

    return TaskDispatchResponse(task_id=task_id, status="processing")
