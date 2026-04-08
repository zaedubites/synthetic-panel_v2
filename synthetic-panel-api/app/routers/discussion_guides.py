"""
Discussion Guide CRUD endpoints.
"""
import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import OrganizationFilter, TokenPayload, get_current_user, get_organization_filter
from app.database import get_db
from app.models import DiscussionGuide
from app.schemas import (
    DiscussionGuideCreate,
    DiscussionGuideListResponse,
    DiscussionGuideResponse,
    DiscussionGuideUpdate,
    MessageResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/discussion-guides", tags=["Discussion Guides"])


@router.post("", response_model=DiscussionGuideResponse, status_code=status.HTTP_201_CREATED)
async def create_discussion_guide(
    data: DiscussionGuideCreate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """Create a new discussion guide."""
    if org_filter.organization_id is None:
        raise HTTPException(status_code=400, detail="Organization context required")

    guide = DiscussionGuide(
        organization_id=org_filter.organization_id,
        created_by=current_user.user_id,
        **data.model_dump(exclude_unset=True),
    )

    db.add(guide)
    await db.flush()
    await db.refresh(guide)

    return guide


@router.get("", response_model=DiscussionGuideListResponse)
async def list_discussion_guides(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    is_active: Optional[bool] = Query(default=None),
    language: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """List discussion guides."""
    query = select(DiscussionGuide)

    if org_filter.should_filter():
        query = query.where(DiscussionGuide.organization_id == org_filter.organization_id)

    if is_active is not None:
        query = query.where(DiscussionGuide.is_active == is_active)

    if language:
        query = query.where(DiscussionGuide.language == language)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(DiscussionGuide.created_at.desc())

    result = await db.execute(query)
    guides = result.scalars().all()

    return DiscussionGuideListResponse(
        items=[DiscussionGuideResponse.model_validate(g) for g in guides],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{guide_id}", response_model=DiscussionGuideResponse)
async def get_discussion_guide(
    guide_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """Get a discussion guide by ID."""
    query = select(DiscussionGuide).where(DiscussionGuide.id == guide_id)

    if org_filter.should_filter():
        query = query.where(DiscussionGuide.organization_id == org_filter.organization_id)

    result = await db.execute(query)
    guide = result.scalar_one_or_none()

    if not guide:
        raise HTTPException(status_code=404, detail="Discussion guide not found")

    return guide


@router.put("/{guide_id}", response_model=DiscussionGuideResponse)
async def update_discussion_guide(
    guide_id: UUID,
    data: DiscussionGuideUpdate,
    db: AsyncSession = Depends(get_db),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """Update a discussion guide."""
    query = select(DiscussionGuide).where(DiscussionGuide.id == guide_id)

    if org_filter.should_filter():
        query = query.where(DiscussionGuide.organization_id == org_filter.organization_id)

    result = await db.execute(query)
    guide = result.scalar_one_or_none()

    if not guide:
        raise HTTPException(status_code=404, detail="Discussion guide not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(guide, field, value)

    await db.flush()
    await db.refresh(guide)

    return guide


@router.delete("/{guide_id}", response_model=MessageResponse)
async def delete_discussion_guide(
    guide_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """Delete a discussion guide."""
    query = select(DiscussionGuide).where(DiscussionGuide.id == guide_id)

    if org_filter.should_filter():
        query = query.where(DiscussionGuide.organization_id == org_filter.organization_id)

    result = await db.execute(query)
    guide = result.scalar_one_or_none()

    if not guide:
        raise HTTPException(status_code=404, detail="Discussion guide not found")

    await db.delete(guide)
    return MessageResponse(message="Discussion guide deleted successfully")
