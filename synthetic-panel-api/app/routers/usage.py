"""
Usage API Router

Endpoints for tracking and reporting API usage metrics.
"""

from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_user, TokenPayload, require_roles
from app.services.usage_tracking_service import UsageTrackingService, UsageType

router = APIRouter(prefix="/usage", tags=["usage"])


@router.get("/summary")
async def get_usage_summary(
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    current_user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get usage summary for the organization.

    Returns aggregated usage by type with totals.
    """
    if not current_user.organization_id:
        raise HTTPException(status_code=400, detail="Organization context required")

    service = UsageTrackingService(db, UUID(current_user.organization_id))
    summary = await service.get_usage_summary(start_date, end_date)

    return summary


@router.get("/daily")
async def get_daily_usage(
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    usage_type: Optional[str] = Query(None, description="Filter by usage type"),
    current_user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get daily usage breakdown.

    Returns list of daily usage records.
    """
    if not current_user.organization_id:
        raise HTTPException(status_code=400, detail="Organization context required")

    # Parse usage type if provided
    usage_type_enum = None
    if usage_type:
        try:
            usage_type_enum = UsageType(usage_type)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid usage type. Valid types: {[t.value for t in UsageType]}"
            )

    service = UsageTrackingService(db, UUID(current_user.organization_id))
    daily = await service.get_daily_usage(start_date, end_date, usage_type_enum)

    return {"daily_usage": daily}


@router.get("/panels/{panel_id}")
async def get_panel_usage(
    panel_id: UUID,
    current_user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get usage breakdown for a specific panel.
    """
    if not current_user.organization_id:
        raise HTTPException(status_code=400, detail="Organization context required")

    service = UsageTrackingService(db, UUID(current_user.organization_id))
    usage = await service.get_panel_usage(panel_id)

    return usage


@router.get("/limits")
async def check_usage_limits(
    usage_type: str = Query(..., description="Usage type to check"),
    quantity: int = Query(1, description="Requested quantity"),
    current_user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Check if organization has available usage quota.

    Returns limit status and remaining quota.
    """
    if not current_user.organization_id:
        raise HTTPException(status_code=400, detail="Organization context required")

    try:
        usage_type_enum = UsageType(usage_type)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid usage type. Valid types: {[t.value for t in UsageType]}"
        )

    service = UsageTrackingService(db, UUID(current_user.organization_id))
    limits = await service.check_usage_limits(usage_type_enum, quantity)

    return limits


@router.get("/types")
async def get_usage_types(
    current_user: TokenPayload = Depends(get_current_user)
):
    """
    Get list of available usage types.
    """
    return {
        "types": [
            {"value": t.value, "name": t.name}
            for t in UsageType
        ]
    }
