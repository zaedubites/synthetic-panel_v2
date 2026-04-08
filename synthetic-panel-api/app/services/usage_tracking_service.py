"""
Usage Tracking Service

Tracks API usage, token consumption, and billing metrics
for the synthetic panel service.
"""

from datetime import datetime, date
from typing import Optional
from uuid import UUID, uuid4
from enum import Enum

from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession


class UsageType(str, Enum):
    """Types of usage to track."""
    AI_COMPLETION = "ai_completion"
    VOICE_SYNTHESIS = "voice_synthesis"
    AVATAR_GENERATION = "avatar_generation"
    PANEL_SESSION = "panel_session"
    KNOWLEDGE_QUERY = "knowledge_query"


class UsageTrackingService:
    """
    Service for tracking and reporting usage metrics.

    Integrates with the platform's billing and usage systems.
    """

    def __init__(self, db: AsyncSession, organization_id: UUID):
        self.db = db
        self.organization_id = organization_id

    async def track_usage(
        self,
        usage_type: UsageType,
        quantity: int = 1,
        tokens_used: Optional[int] = None,
        cost_cents: Optional[int] = None,
        metadata: Optional[dict] = None,
        user_id: Optional[UUID] = None,
        panel_id: Optional[UUID] = None
    ) -> str:
        """
        Record a usage event.

        Args:
            usage_type: Type of usage (AI, voice, avatar, etc.)
            quantity: Number of units used
            tokens_used: Token count for AI completions
            cost_cents: Estimated cost in cents
            metadata: Additional context
            user_id: User who triggered the usage
            panel_id: Associated panel if applicable

        Returns:
            Usage record ID
        """
        usage_id = str(uuid4())

        insert_query = text("""
            INSERT INTO synthetic_panel.usage_records (
                id, organization_id, usage_type, quantity,
                tokens_used, cost_cents, metadata,
                user_id, panel_id, created_at
            ) VALUES (
                :id, :org_id, :usage_type, :quantity,
                :tokens_used, :cost_cents, :metadata,
                :user_id, :panel_id, NOW()
            )
        """)

        await self.db.execute(
            insert_query,
            {
                "id": usage_id,
                "org_id": str(self.organization_id),
                "usage_type": usage_type.value,
                "quantity": quantity,
                "tokens_used": tokens_used,
                "cost_cents": cost_cents,
                "metadata": metadata,
                "user_id": str(user_id) if user_id else None,
                "panel_id": str(panel_id) if panel_id else None
            }
        )

        await self.db.commit()
        return usage_id

    async def track_ai_usage(
        self,
        prompt_tokens: int,
        completion_tokens: int,
        model: str,
        user_id: Optional[UUID] = None,
        panel_id: Optional[UUID] = None
    ) -> str:
        """Track AI API usage with token details."""
        total_tokens = prompt_tokens + completion_tokens

        # Estimate cost based on model (approximate)
        cost_per_1k_tokens = {
            "gpt-4o": 15,  # $0.015 per 1k tokens
            "gpt-4o-mini": 0.6,  # $0.0006 per 1k tokens
            "gpt-4-turbo": 30,  # $0.03 per 1k tokens
        }

        cost_rate = cost_per_1k_tokens.get(model, 10)
        cost_cents = int((total_tokens / 1000) * cost_rate)

        return await self.track_usage(
            usage_type=UsageType.AI_COMPLETION,
            quantity=1,
            tokens_used=total_tokens,
            cost_cents=cost_cents,
            metadata={
                "model": model,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens
            },
            user_id=user_id,
            panel_id=panel_id
        )

    async def track_voice_usage(
        self,
        characters: int,
        voice_id: str,
        user_id: Optional[UUID] = None,
        panel_id: Optional[UUID] = None
    ) -> str:
        """Track ElevenLabs voice synthesis usage."""
        # ElevenLabs charges per character
        # Approximate: $0.30 per 1000 characters
        cost_cents = int((characters / 1000) * 30)

        return await self.track_usage(
            usage_type=UsageType.VOICE_SYNTHESIS,
            quantity=characters,
            cost_cents=cost_cents,
            metadata={"voice_id": voice_id},
            user_id=user_id,
            panel_id=panel_id
        )

    async def track_avatar_usage(
        self,
        model: str,
        num_images: int = 1,
        user_id: Optional[UUID] = None
    ) -> str:
        """Track Replicate avatar generation usage."""
        # Approximate Replicate costs per image
        cost_per_image = {
            "sdxl": 2,  # ~$0.02 per image
            "realistic-vision": 1,  # ~$0.01 per image
        }

        cost_cents = cost_per_image.get(model, 2) * num_images

        return await self.track_usage(
            usage_type=UsageType.AVATAR_GENERATION,
            quantity=num_images,
            cost_cents=cost_cents,
            metadata={"model": model},
            user_id=user_id
        )

    async def track_panel_session(
        self,
        panel_id: UUID,
        duration_minutes: int,
        message_count: int,
        participant_count: int,
        user_id: Optional[UUID] = None
    ) -> str:
        """Track a completed panel session."""
        return await self.track_usage(
            usage_type=UsageType.PANEL_SESSION,
            quantity=1,
            metadata={
                "duration_minutes": duration_minutes,
                "message_count": message_count,
                "participant_count": participant_count
            },
            user_id=user_id,
            panel_id=panel_id
        )

    async def get_usage_summary(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> dict:
        """
        Get usage summary for the organization.

        Returns aggregated usage by type with totals.
        """
        if not start_date:
            # Default to current month
            today = date.today()
            start_date = date(today.year, today.month, 1)
        if not end_date:
            end_date = date.today()

        summary_query = text("""
            SELECT
                usage_type,
                COUNT(*) as count,
                SUM(quantity) as total_quantity,
                SUM(COALESCE(tokens_used, 0)) as total_tokens,
                SUM(COALESCE(cost_cents, 0)) as total_cost_cents
            FROM synthetic_panel.usage_records
            WHERE organization_id = :org_id
            AND created_at >= :start_date
            AND created_at < :end_date + INTERVAL '1 day'
            GROUP BY usage_type
            ORDER BY usage_type
        """)

        result = await self.db.execute(
            summary_query,
            {
                "org_id": str(self.organization_id),
                "start_date": start_date,
                "end_date": end_date
            }
        )

        rows = result.fetchall()

        by_type = {}
        total_cost = 0
        total_tokens = 0

        for row in rows:
            by_type[row.usage_type] = {
                "count": row.count,
                "total_quantity": row.total_quantity,
                "total_tokens": row.total_tokens,
                "total_cost_cents": row.total_cost_cents
            }
            total_cost += row.total_cost_cents or 0
            total_tokens += row.total_tokens or 0

        return {
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            },
            "by_type": by_type,
            "totals": {
                "cost_cents": total_cost,
                "cost_dollars": total_cost / 100,
                "tokens": total_tokens
            }
        }

    async def get_daily_usage(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        usage_type: Optional[UsageType] = None
    ) -> list[dict]:
        """
        Get daily usage breakdown.

        Returns list of daily usage records.
        """
        if not start_date:
            today = date.today()
            start_date = date(today.year, today.month, 1)
        if not end_date:
            end_date = date.today()

        type_filter = ""
        if usage_type:
            type_filter = "AND usage_type = :usage_type"

        daily_query = text(f"""
            SELECT
                DATE(created_at) as usage_date,
                usage_type,
                COUNT(*) as count,
                SUM(quantity) as total_quantity,
                SUM(COALESCE(tokens_used, 0)) as total_tokens,
                SUM(COALESCE(cost_cents, 0)) as total_cost_cents
            FROM synthetic_panel.usage_records
            WHERE organization_id = :org_id
            AND created_at >= :start_date
            AND created_at < :end_date + INTERVAL '1 day'
            {type_filter}
            GROUP BY DATE(created_at), usage_type
            ORDER BY usage_date DESC, usage_type
        """)

        params = {
            "org_id": str(self.organization_id),
            "start_date": start_date,
            "end_date": end_date
        }
        if usage_type:
            params["usage_type"] = usage_type.value

        result = await self.db.execute(daily_query, params)
        rows = result.fetchall()

        return [
            {
                "date": row.usage_date.isoformat(),
                "usage_type": row.usage_type,
                "count": row.count,
                "total_quantity": row.total_quantity,
                "total_tokens": row.total_tokens,
                "total_cost_cents": row.total_cost_cents
            }
            for row in rows
        ]

    async def get_panel_usage(self, panel_id: UUID) -> dict:
        """
        Get usage breakdown for a specific panel.
        """
        panel_query = text("""
            SELECT
                usage_type,
                COUNT(*) as count,
                SUM(quantity) as total_quantity,
                SUM(COALESCE(tokens_used, 0)) as total_tokens,
                SUM(COALESCE(cost_cents, 0)) as total_cost_cents
            FROM synthetic_panel.usage_records
            WHERE organization_id = :org_id
            AND panel_id = :panel_id
            GROUP BY usage_type
        """)

        result = await self.db.execute(
            panel_query,
            {
                "org_id": str(self.organization_id),
                "panel_id": str(panel_id)
            }
        )

        rows = result.fetchall()

        by_type = {}
        total_cost = 0
        total_tokens = 0

        for row in rows:
            by_type[row.usage_type] = {
                "count": row.count,
                "total_quantity": row.total_quantity,
                "total_tokens": row.total_tokens,
                "total_cost_cents": row.total_cost_cents
            }
            total_cost += row.total_cost_cents or 0
            total_tokens += row.total_tokens or 0

        return {
            "panel_id": str(panel_id),
            "by_type": by_type,
            "totals": {
                "cost_cents": total_cost,
                "cost_dollars": total_cost / 100,
                "tokens": total_tokens
            }
        }

    async def check_usage_limits(
        self,
        usage_type: UsageType,
        requested_quantity: int = 1
    ) -> dict:
        """
        Check if organization has available usage quota.

        Returns limit status and remaining quota.
        """
        # Get organization's usage limits from platform
        limits_query = text("""
            SELECT
                monthly_ai_tokens_limit,
                monthly_voice_characters_limit,
                monthly_avatar_generations_limit,
                monthly_panel_sessions_limit
            FROM platform.organization_settings
            WHERE organization_id = :org_id
        """)

        result = await self.db.execute(
            limits_query, {"org_id": str(self.organization_id)}
        )
        limits = result.fetchone()

        if not limits:
            # No limits configured, allow unlimited
            return {
                "allowed": True,
                "limit": None,
                "used": 0,
                "remaining": None
            }

        # Get current month usage
        today = date.today()
        month_start = date(today.year, today.month, 1)

        usage_query = text("""
            SELECT
                SUM(quantity) as total_quantity,
                SUM(COALESCE(tokens_used, 0)) as total_tokens
            FROM synthetic_panel.usage_records
            WHERE organization_id = :org_id
            AND usage_type = :usage_type
            AND created_at >= :month_start
        """)

        usage_result = await self.db.execute(
            usage_query,
            {
                "org_id": str(self.organization_id),
                "usage_type": usage_type.value,
                "month_start": month_start
            }
        )
        usage = usage_result.fetchone()

        current_usage = 0
        limit_value = None

        if usage_type == UsageType.AI_COMPLETION:
            current_usage = usage.total_tokens or 0
            limit_value = limits.monthly_ai_tokens_limit
        elif usage_type == UsageType.VOICE_SYNTHESIS:
            current_usage = usage.total_quantity or 0
            limit_value = limits.monthly_voice_characters_limit
        elif usage_type == UsageType.AVATAR_GENERATION:
            current_usage = usage.total_quantity or 0
            limit_value = limits.monthly_avatar_generations_limit
        elif usage_type == UsageType.PANEL_SESSION:
            current_usage = usage.total_quantity or 0
            limit_value = limits.monthly_panel_sessions_limit

        if limit_value is None:
            return {
                "allowed": True,
                "limit": None,
                "used": current_usage,
                "remaining": None
            }

        remaining = max(0, limit_value - current_usage)
        allowed = remaining >= requested_quantity

        return {
            "allowed": allowed,
            "limit": limit_value,
            "used": current_usage,
            "remaining": remaining
        }
