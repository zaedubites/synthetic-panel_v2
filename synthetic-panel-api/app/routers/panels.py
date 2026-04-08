"""
Panel CRUD and session endpoints.
"""
import logging
import random
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import OrganizationFilter, TokenPayload, get_current_user, get_organization_filter
from app.config import settings
from app.database import get_db
from app.models import Panel, PanelAnalysis, PanelMessage, Persona
from app.services.ai_service import ai_service
from app.schemas import (
    MessageResponse,
    PanelAnalysisListResponse,
    PanelAnalysisResponse,
    PanelCreate,
    PanelEndRequest,
    PanelEndResponse,
    PanelGenerateFollowupsRequest,
    PanelGenerateFollowupsResponse,
    PanelListResponse,
    PanelMessageResponse,
    PanelPrepareRequest,
    PanelPrepareResponse,
    PanelRegenerateAnalysisRequest,
    PanelResponse,
    PanelSendMessageRequest,
    PanelSendMessageResponse,
    PanelStartRequest,
    PanelStartResponse,
    PanelTranscriptResponse,
    PanelUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/panels", tags=["Panels"])


# ============================================
# CRUD Endpoints
# ============================================

@router.post("", response_model=PanelResponse, status_code=status.HTTP_201_CREATED)
async def create_panel(
    data: PanelCreate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """
    Create a new panel session.
    """
    if org_filter.organization_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization context required to create panel",
        )

    panel_data = data.model_dump(exclude_unset=True)

    # Map frontend field names to model field names
    if "persona_ids" in panel_data:
        panel_data["participant_ids"] = panel_data.pop("persona_ids")
    panel_data.pop("target_duration_minutes", None)  # Not in model yet

    # Auto-generate name from research_goal if not provided
    if not panel_data.get("name"):
        panel_data["name"] = (panel_data.get("research_goal") or "Untitled Panel")[:255]

    panel = Panel(
        organization_id=org_filter.organization_id,
        created_by=current_user.user_id,
        **panel_data,
    )

    db.add(panel)
    await db.flush()
    await db.refresh(panel)

    logger.info(f"Created panel {panel.id} for org {org_filter.organization_id}")
    return panel


@router.get("", response_model=PanelListResponse)
async def list_panels(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    search: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """
    List panels with optional filtering.
    """
    query = select(Panel)

    # Apply organization filter
    if org_filter.should_filter():
        query = query.where(Panel.organization_id == org_filter.organization_id)

        # Apply cohort filter if not org-wide
        # User can only see org-wide panels OR panels they have cohort access to
        if org_filter.cohort_ids:
            query = query.where(
                (Panel.is_org_wide == True) |
                (Panel.cohort_ids.overlap(org_filter.cohort_ids))
            )

    # Apply additional filters
    if status_filter:
        query = query.where(Panel.status == status_filter)

    if search:
        search_term = f"%{search}%"
        query = query.where(Panel.name.ilike(search_term))

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(Panel.created_at.desc())

    result = await db.execute(query)
    panels = result.scalars().all()

    return PanelListResponse(
        items=[PanelResponse.model_validate(p) for p in panels],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{panel_id}", response_model=PanelResponse)
async def get_panel(
    panel_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """
    Get a specific panel by ID.
    """
    query = select(Panel).where(Panel.id == panel_id)

    if org_filter.should_filter():
        query = query.where(Panel.organization_id == org_filter.organization_id)

    result = await db.execute(query)
    panel = result.scalar_one_or_none()

    if not panel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Panel not found",
        )

    return panel


@router.put("/{panel_id}", response_model=PanelResponse)
async def update_panel(
    panel_id: UUID,
    data: PanelUpdate,
    db: AsyncSession = Depends(get_db),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """
    Update a panel configuration.
    Only allowed when panel is in draft or ready status.
    """
    query = select(Panel).where(Panel.id == panel_id)

    if org_filter.should_filter():
        query = query.where(Panel.organization_id == org_filter.organization_id)

    result = await db.execute(query)
    panel = result.scalar_one_or_none()

    if not panel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Panel not found",
        )

    if panel.status not in ["draft", "ready"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot update panel in {panel.status} status",
        )

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(panel, field, value)

    await db.flush()
    await db.refresh(panel)

    logger.info(f"Updated panel {panel_id}")
    return panel


@router.delete("/{panel_id}", response_model=MessageResponse)
async def delete_panel(
    panel_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """
    Delete a panel and all its messages.
    """
    query = select(Panel).where(Panel.id == panel_id)

    if org_filter.should_filter():
        query = query.where(Panel.organization_id == org_filter.organization_id)

    result = await db.execute(query)
    panel = result.scalar_one_or_none()

    if not panel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Panel not found",
        )

    await db.delete(panel)

    logger.info(f"Deleted panel {panel_id}")
    return MessageResponse(message="Panel deleted successfully")


# ============================================
# Session Endpoints
# ============================================

@router.post("/{panel_id}/prepare", response_model=PanelPrepareResponse)
async def prepare_panel(
    panel_id: UUID,
    request: PanelPrepareRequest,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """
    Prepare panel session - load persona contexts and knowledge.
    """
    query = select(Panel).where(Panel.id == panel_id)
    if org_filter.should_filter():
        query = query.where(Panel.organization_id == org_filter.organization_id)

    result = await db.execute(query)
    panel = result.scalar_one_or_none()

    if not panel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Panel not found")

    if panel.status not in ["draft", "ready"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot prepare panel in {panel.status} status",
        )

    # TODO: Load persona contexts and knowledge
    # This will be implemented in Phase 2

    panel.status = "ready"
    await db.flush()

    return PanelPrepareResponse(
        panel_id=panel.id,
        status=panel.status,
        participants_loaded=len(panel.participant_ids) if panel.participant_ids else 0,
        knowledge_loaded=request.load_knowledge,
    )


@router.post("/{panel_id}/start", response_model=PanelStartResponse)
async def start_panel(
    panel_id: UUID,
    request: PanelStartRequest,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """
    Start a panel session.
    """
    query = select(Panel).where(Panel.id == panel_id)
    if org_filter.should_filter():
        query = query.where(Panel.organization_id == org_filter.organization_id)

    result = await db.execute(query)
    panel = result.scalar_one_or_none()

    if not panel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Panel not found")

    if panel.status not in ["draft", "ready"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Panel must be in draft or ready status to start, currently: {panel.status}",
        )

    panel.status = "active"
    panel.started_at = datetime.utcnow()
    await db.flush()

    # TODO: Generate WebSocket URL for real-time updates

    return PanelStartResponse(
        panel_id=panel.id,
        status=panel.status,
        started_at=panel.started_at,
        websocket_url=f"/ws/panel/{panel.id}",
    )


@router.post("/{panel_id}/end", response_model=PanelEndResponse)
async def end_panel(
    panel_id: UUID,
    request: PanelEndRequest,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """
    End a panel session.
    """
    query = select(Panel).where(Panel.id == panel_id)
    if org_filter.should_filter():
        query = query.where(Panel.organization_id == org_filter.organization_id)

    result = await db.execute(query)
    panel = result.scalar_one_or_none()

    if not panel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Panel not found")

    if panel.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Panel must be active to end, currently: {panel.status}",
        )

    panel.status = "completed"
    panel.ended_at = datetime.utcnow()
    await db.flush()

    # Count messages
    count_query = select(func.count()).where(PanelMessage.panel_id == panel_id)
    count_result = await db.execute(count_query)
    message_count = count_result.scalar() or 0

    # TODO: Trigger analysis generation if requested

    return PanelEndResponse(
        panel_id=panel.id,
        status=panel.status,
        ended_at=panel.ended_at,
        total_messages=message_count,
    )


@router.post("/{panel_id}/message", response_model=PanelSendMessageResponse)
async def send_message(
    panel_id: UUID,
    request: PanelSendMessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """
    Send a message to the panel (non-streaming).
    Returns responses from personas.
    """
    query = select(Panel).where(Panel.id == panel_id)
    if org_filter.should_filter():
        query = query.where(Panel.organization_id == org_filter.organization_id)

    result = await db.execute(query)
    panel = result.scalar_one_or_none()

    if not panel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Panel not found")

    # Auto-start panel on first message if still in draft/ready
    if panel.status in ["draft", "ready"]:
        panel.status = "active"
        panel.started_at = datetime.utcnow()
        await db.flush()
    elif panel.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Panel must be active to send messages, currently: {panel.status}",
        )

    # Get next sequence number
    seq_query = select(func.coalesce(func.max(PanelMessage.sequence_number), 0) + 1).where(
        PanelMessage.panel_id == panel_id
    )
    seq_result = await db.execute(seq_query)
    next_seq = seq_result.scalar()

    # Create user message
    user_message = PanelMessage(
        panel_id=panel_id,
        role="user",
        content=request.message,
        sequence_number=next_seq,
    )
    db.add(user_message)
    await db.flush()
    await db.refresh(user_message)

    # Fetch participant personas
    persona_query = select(Persona).where(Persona.id.in_(panel.participant_ids or []))
    persona_result = await db.execute(persona_query)
    personas = persona_result.scalars().all()

    # Get conversation history for context
    history_query = (
        select(PanelMessage)
        .where(PanelMessage.panel_id == panel_id)
        .order_by(PanelMessage.sequence_number)
    )
    history_result = await db.execute(history_query)
    history = history_result.scalars().all()

    # Build a lookup of persona names for history
    persona_map = {p.id: p for p in personas}

    # Select 2-3 random responders (or all if fewer)
    if request.target_persona_ids:
        responders = [p for p in personas if p.id in request.target_persona_ids]
    else:
        responders = random.sample(list(personas), min(len(personas), random.randint(2, 3))) if personas else []

    responses = []
    current_seq = next_seq

    for persona in responders:
        try:
            # Build system prompt for this persona
            system_prompt = f"""You are {persona.name}, a {persona.age or 'unknown age'}-year-old {persona.gender or ''} from {persona.city or persona.country or 'unknown location'}.
Occupation: {persona.occupation or 'N/A'}
Education: {persona.education or 'N/A'}
Personality: {persona.personality or 'friendly and engaged'}
Backstory: {persona.backstory or 'A typical person of their age group'}
Worldview: {persona.worldview or ''}
Consumer habits: {persona.consumer_habits or 'Average consumer'}

You are participating in a focus group discussion. Respond naturally and in character.
Keep responses conversational, 2-4 sentences. Be authentic to your personality and background.
Do NOT prefix your response with your name or any label.
The research topic is: {panel.research_goal or 'general discussion'}"""

            # Build messages for AI
            ai_messages = [
                {"role": "system", "content": system_prompt}
            ]

            # Add conversation history (last 10 messages)
            for msg in history[-10:]:
                if msg.role == "user":
                    ai_messages.append({"role": "user", "content": msg.content})
                elif msg.role == "persona":
                    msg_persona = persona_map.get(msg.persona_id)
                    msg_persona_name = msg_persona.name if msg_persona else "Participant"
                    ai_messages.append({"role": "assistant", "content": f"[{msg_persona_name}]: {msg.content}"})

            # Add the current user message
            ai_messages.append({"role": "user", "content": request.message})

            response_text, usage = await ai_service.generate_completion(
                messages=ai_messages,
                max_tokens=300,
                temperature=0.8,
            )

            # Save persona response
            current_seq += 1
            persona_message = PanelMessage(
                panel_id=panel_id,
                role="persona",
                persona_id=persona.id,
                content=response_text.strip(),
                sequence_number=current_seq,
                message_metadata={
                    "persona_name": persona.name,
                    "tokens_used": usage,
                    "voice_id": persona.voice_id,
                },
            )
            db.add(persona_message)
            await db.flush()
            await db.refresh(persona_message)

            responses.append(persona_message)

        except Exception as e:
            logger.error(f"Failed to generate response for persona {persona.id}: {e}")
            continue

    return PanelSendMessageResponse(
        user_message=PanelMessageResponse.model_validate(user_message),
        responses=[PanelMessageResponse.model_validate(m) for m in responses],
    )


@router.get("/{panel_id}/transcript", response_model=PanelTranscriptResponse)
async def get_transcript(
    panel_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """
    Get full panel transcript.
    """
    query = select(Panel).where(Panel.id == panel_id)
    if org_filter.should_filter():
        query = query.where(Panel.organization_id == org_filter.organization_id)

    result = await db.execute(query)
    panel = result.scalar_one_or_none()

    if not panel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Panel not found")

    # Get messages
    messages_query = (
        select(PanelMessage)
        .where(PanelMessage.panel_id == panel_id)
        .order_by(PanelMessage.sequence_number)
    )
    messages_result = await db.execute(messages_query)
    messages = messages_result.scalars().all()

    return PanelTranscriptResponse(
        panel_id=panel_id,
        messages=[PanelMessageResponse.model_validate(m) for m in messages],
        total_messages=len(messages),
    )


# ============================================
# Analysis Endpoints
# ============================================

@router.get("/{panel_id}/analysis", response_model=PanelAnalysisListResponse)
async def get_panel_analysis(
    panel_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """
    Get all analyses for a panel.
    """
    # Verify panel access
    query = select(Panel).where(Panel.id == panel_id)
    if org_filter.should_filter():
        query = query.where(Panel.organization_id == org_filter.organization_id)

    result = await db.execute(query)
    panel = result.scalar_one_or_none()

    if not panel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Panel not found")

    # Get analyses
    analyses_query = select(PanelAnalysis).where(PanelAnalysis.panel_id == panel_id)
    analyses_result = await db.execute(analyses_query)
    analyses = analyses_result.scalars().all()

    return PanelAnalysisListResponse(
        panel_id=panel_id,
        analyses=[PanelAnalysisResponse.model_validate(a) for a in analyses],
    )


@router.post("/{panel_id}/analyze", response_model=PanelAnalysisListResponse)
async def generate_panel_analysis(
    panel_id: UUID,
    request: PanelRegenerateAnalysisRequest,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
    org_filter: OrganizationFilter = Depends(get_organization_filter),
):
    """
    Generate or regenerate analysis for a panel.
    """
    query = select(Panel).where(Panel.id == panel_id)
    if org_filter.should_filter():
        query = query.where(Panel.organization_id == org_filter.organization_id)

    result = await db.execute(query)
    panel = result.scalar_one_or_none()

    if not panel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Panel not found")

    if panel.status not in ["completed"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Panel must be completed to generate analysis",
        )

    # TODO: Generate analysis using AI service
    # This will be implemented in Phase 2

    # Return existing analyses for now
    analyses_query = select(PanelAnalysis).where(PanelAnalysis.panel_id == panel_id)
    analyses_result = await db.execute(analyses_query)
    analyses = analyses_result.scalars().all()

    return PanelAnalysisListResponse(
        panel_id=panel_id,
        analyses=[PanelAnalysisResponse.model_validate(a) for a in analyses],
    )
