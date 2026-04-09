"""
WebSocket Router for Real-time Panel Updates

Handles real-time communication for live panel sessions,
including auto-continuation for AI-moderated panels.
"""

import json
import asyncio
import random
import logging
from datetime import datetime
from typing import Dict, Set, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, get_db_context
from app.auth import verify_ws_token, TokenPayload
from app.services.ai_service import ai_service
from app.services.voice_service import VoiceService
from app.models import Panel, Persona, PanelMessage, Moderator

_voice_service = VoiceService()

logger = logging.getLogger(__name__)

router = APIRouter()


class ConnectionManager:
    """Manages WebSocket connections for panel sessions."""

    def __init__(self):
        # Map of panel_id -> set of connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # Map of websocket -> user info
        self.connection_info: Dict[WebSocket, dict] = {}

    async def connect(
        self,
        websocket: WebSocket,
        panel_id: str,
        user_id: str,
        organization_id: str
    ):
        await websocket.accept()

        if panel_id not in self.active_connections:
            self.active_connections[panel_id] = set()

        self.active_connections[panel_id].add(websocket)
        self.connection_info[websocket] = {
            "user_id": user_id,
            "organization_id": organization_id,
            "panel_id": panel_id,
            "connected_at": datetime.utcnow().isoformat()
        }

        # Notify others that someone joined
        await self.broadcast(
            panel_id,
            {
                "type": "user_joined",
                "user_id": user_id,
                "timestamp": datetime.utcnow().isoformat()
            },
            exclude=websocket
        )

    def disconnect(self, websocket: WebSocket, panel_id: str):
        if panel_id in self.active_connections:
            self.active_connections[panel_id].discard(websocket)
            if not self.active_connections[panel_id]:
                del self.active_connections[panel_id]

        user_info = self.connection_info.pop(websocket, None)

        # Could broadcast user_left here if needed
        return user_info

    async def broadcast(
        self,
        panel_id: str,
        message: dict,
        exclude: WebSocket = None
    ):
        """Broadcast message to all connections in a panel."""
        if panel_id not in self.active_connections:
            return

        disconnected = []
        for connection in self.active_connections[panel_id]:
            if connection == exclude:
                continue
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)

        # Clean up disconnected
        for conn in disconnected:
            self.disconnect(conn, panel_id)

    async def send_to_connection(self, websocket: WebSocket, message: dict):
        """Send message to a specific connection."""
        try:
            await websocket.send_json(message)
        except Exception:
            pass

    def get_panel_connections(self, panel_id: str) -> int:
        """Get number of active connections for a panel."""
        return len(self.active_connections.get(panel_id, set()))


# Global connection manager
manager = ConnectionManager()


# ---------------------------------------------------------------------------
# Helper: get next sequence number
# ---------------------------------------------------------------------------
async def _next_sequence(db: AsyncSession, panel_id) -> int:
    seq_query = select(
        func.coalesce(func.max(PanelMessage.sequence_number), 0) + 1
    ).where(PanelMessage.panel_id == panel_id)
    result = await db.execute(seq_query)
    return result.scalar()


# ---------------------------------------------------------------------------
# Helper: save a message to DB and return it as a dict for the client
# ---------------------------------------------------------------------------
async def _save_and_format_message(
    db: AsyncSession,
    panel_id,
    role: str,
    content: str,
    sequence_number: int,
    persona: Optional[Persona] = None,
    moderator: Optional[Moderator] = None,
) -> dict:
    """Persist a PanelMessage and return a client-ready dict."""
    metadata = {}
    persona_id = None
    persona_name = None
    voice_id = None
    avatar_url = None

    if role == "persona" and persona:
        persona_id = persona.id
        persona_name = persona.name
        voice_id = persona.voice_id
        avatar_url = persona.avatar_url
        # Auto-assign voice if persona doesn't have one
        if not voice_id:
            try:
                voice_id = _voice_service.select_voice_for_persona(
                    gender=persona.gender,
                    age_range=str(persona.age) if persona.age else None,
                    language=persona.language or "en",
                )
            except Exception:
                pass
        metadata = {
            "persona_name": persona.name,
            "voice_id": voice_id,
        }
    elif role == "moderator" and moderator:
        persona_name = moderator.name
        voice_id = getattr(moderator, 'voice_id', None)
        avatar_url = moderator.avatar_url
        # Auto-assign voice for moderator if none
        if not voice_id:
            try:
                voice_id = _voice_service.select_voice_for_persona(
                    gender=getattr(moderator, 'gender', None),
                    language="en",
                )
            except Exception:
                pass
        metadata = {
            "persona_name": moderator.name,
            "voice_id": voice_id,
        }

    msg = PanelMessage(
        panel_id=panel_id,
        role=role,
        persona_id=persona_id,
        content=content,
        sequence_number=sequence_number,
        message_metadata=metadata,
    )
    db.add(msg)
    await db.flush()
    await db.refresh(msg)

    return {
        "id": str(msg.id),
        "role": role,
        "content": content,
        "persona_id": str(persona_id) if persona_id else None,
        "persona_name": persona_name,
        "voice_id": voice_id,
        "avatar_url": avatar_url,
        "sequence_number": sequence_number,
        "message_metadata": metadata,
    }


# ---------------------------------------------------------------------------
# Helper: build system prompt for a persona
# ---------------------------------------------------------------------------
LANG_NAMES = {"en": "English", "de": "German", "es": "Spanish", "fr": "French", "it": "Italian"}


def _persona_system_prompt(persona: Persona, research_goal: str, language: str = "en") -> str:
    lang_instruction = ""
    if language and language != "en":
        lang_name = LANG_NAMES.get(language, language)
        lang_instruction = f"\nIMPORTANT: You MUST respond in {lang_name}. All your responses must be in {lang_name}.\n"

    return (
        f"You are {persona.name}, a {persona.age or 'unknown age'}-year-old "
        f"{persona.gender or ''} from {persona.city or persona.country or 'unknown location'}.\n"
        f"Occupation: {persona.occupation or 'N/A'}\n"
        f"Education: {persona.education or 'N/A'}\n"
        f"Personality: {persona.personality or 'friendly and engaged'}\n"
        f"Backstory: {persona.backstory or 'A typical person of their age group'}\n"
        f"Worldview: {persona.worldview or ''}\n"
        f"Consumer habits: {persona.consumer_habits or 'Average consumer'}\n\n"
        "You are participating in a focus group discussion. Respond naturally and in character.\n"
        "Keep responses conversational, 2-4 sentences. Be authentic to your personality and background.\n"
        "Do NOT prefix your response with your name or any label.\n"
        f"The research topic is: {research_goal or 'general discussion'}"
        f"{lang_instruction}"
    )


# ---------------------------------------------------------------------------
# Auto-continuation background task
# ---------------------------------------------------------------------------
async def _auto_continuation(
    websocket: WebSocket,
    panel_id: str,
    stop_event: asyncio.Event,
    pause_event: asyncio.Event,
):
    """
    Background task that drives AI-moderated conversation automatically.

    Phases:
      1. Opening: moderator intro + each persona self-introduction
      2. Discussion rounds: pick 2-3 personas per round, moderator interjects every 3-4 rounds
      3. Ends on stop_event or after max rounds (20)
    """
    MAX_ROUNDS = 20

    logger.info(f"[AutoCont] Starting auto-continuation for panel {panel_id}")

    try:
        # ---- Load panel data ----
        async with get_db_context() as db:
            panel = await db.get(Panel, UUID(panel_id))
            if not panel:
                await manager.send_to_connection(websocket, {
                    "type": "error",
                    "message": "Panel not found",
                })
                return

            # Activate panel if still draft/ready
            if panel.status in ("draft", "ready"):
                panel.status = "active"
                panel.started_at = datetime.utcnow()
                await db.flush()

            research_goal = panel.research_goal or "general discussion"
            panel_language = panel.language or "en"
            moderator_id = panel.moderator_id
            participant_ids = panel.participant_ids or []

            # Load personas
            persona_query = select(Persona).where(Persona.id.in_(participant_ids))
            result = await db.execute(persona_query)
            personas = list(result.scalars().all())

            # Load moderator
            moderator = None
            if moderator_id:
                moderator = await db.get(Moderator, moderator_id)

        if not personas:
            await manager.send_to_connection(websocket, {
                "type": "error",
                "message": "No participants configured for this panel",
            })
            return

        # Helper to send a message to the client + save to DB
        async def send_message(role, content, persona=None):
            if stop_event.is_set():
                return None
            async with get_db_context() as db:
                seq = await _next_sequence(db, UUID(panel_id))
                msg_dict = await _save_and_format_message(
                    db, UUID(panel_id), role, content, seq,
                    persona=persona, moderator=moderator,
                )
                await db.commit()
            await manager.broadcast(panel_id, {"type": "message", "message": msg_dict})
            return msg_dict

        # Collect conversation history (kept in memory for AI context)
        conversation_history: list[dict] = []

        def add_to_history(role_label: str, name: str, content: str):
            conversation_history.append({"name": name, "content": content, "role_label": role_label})
            # Keep last 20 entries
            if len(conversation_history) > 20:
                conversation_history.pop(0)

        def history_as_text() -> str:
            lines = []
            for h in conversation_history:
                lines.append(f"[{h['name']}]: {h['content']}")
            return "\n".join(lines)

        # ========== PHASE 1: Opening ==========
        # Moderator welcome
        mod_name = moderator.name if moderator else "Moderator"
        persona_names = ", ".join(p.name for p in personas)
        lang_name = LANG_NAMES.get(panel_language, "English")
        mod_lang_instruction = f" Respond in {lang_name}." if panel_language != "en" else ""

        if panel_language != "en":
            try:
                opening_text, _ = await ai_service.generate_completion(
                    messages=[
                        {"role": "system", "content": f"You are {mod_name}, a professional focus group moderator. Respond in {lang_name}."},
                        {"role": "user", "content": f"Welcome the panel members ({persona_names}) and introduce the research topic: {research_goal}. Ask them to briefly introduce themselves. 2-3 sentences in {lang_name}."},
                    ],
                    max_tokens=200, temperature=0.7,
                )
                opening_text = opening_text.strip()
            except Exception:
                opening_text = f"Welcome everyone. Today we'll be discussing: {research_goal}. Let me introduce: {persona_names}. Please introduce yourselves."
        else:
            opening_text = (
                f"Welcome everyone. Today we'll be discussing: {research_goal}. "
                f"Let me introduce our panel members: {persona_names}. "
                "Let's start by having each of you briefly introduce yourselves."
            )
        await send_message("moderator", opening_text)
        add_to_history("moderator", mod_name, opening_text)

        if stop_event.is_set():
            return

        await asyncio.sleep(1.5)

        # Each persona introduces themselves
        for persona in personas:
            if stop_event.is_set():
                return

            # Wait if paused (user is asking a question)
            while pause_event.is_set() and not stop_event.is_set():
                await asyncio.sleep(0.5)

            intro_messages = [
                {"role": "system", "content": _persona_system_prompt(persona, research_goal, panel_language)},
                {
                    "role": "user",
                    "content": (
                        "The moderator has asked you to briefly introduce yourself to the group. "
                        "Share your name, a little about your background, and why this topic interests you. "
                        "Keep it to 2-3 sentences."
                    ),
                },
            ]
            try:
                logger.info(f"[AutoCont] Generating intro for persona {persona.name}")
                text, _usage = await ai_service.generate_completion(
                    messages=intro_messages, max_tokens=200, temperature=0.8
                )
                text = text.strip()
                logger.info(f"[AutoCont] Persona {persona.name} intro: {text[:80]}...")
            except Exception as e:
                logger.error(f"[AutoCont] Intro generation FAILED for {persona.name}: {e}", exc_info=True)
                text = f"Hi everyone, I'm {persona.name}. Happy to be here and looking forward to our discussion."

            await send_message("persona", text, persona=persona)
            add_to_history("persona", persona.name, text)
            await asyncio.sleep(random.uniform(1.0, 2.0))

        if stop_event.is_set():
            return

        # Moderator transition
        if panel_language != "en":
            try:
                transition_text, _ = await ai_service.generate_completion(
                    messages=[
                        {"role": "system", "content": f"You are {mod_name}, a moderator. Respond in {lang_name}."},
                        {"role": "user", "content": f"Thank the panel for their introductions and transition to the discussion. 1 sentence in {lang_name}."},
                    ],
                    max_tokens=80, temperature=0.7,
                )
                transition_text = transition_text.strip()
            except Exception:
                transition_text = "Thank you all. Let's begin our discussion."
        else:
            transition_text = "Thank you all for those introductions. Let's dive into our discussion."
        await send_message("moderator", transition_text)
        add_to_history("moderator", mod_name, transition_text)
        await asyncio.sleep(2.0)

        # ========== PHASE 2: Discussion Rounds ==========
        if panel_language != "en":
            # Generate questions in target language
            try:
                q_text, _ = await ai_service.generate_completion(
                    messages=[
                        {"role": "system", "content": f"Generate 7 focus group discussion questions in {lang_name} about the topic. Return one question per line, no numbering."},
                        {"role": "user", "content": f"Topic: {research_goal}"},
                    ],
                    max_tokens=400, temperature=0.7,
                )
                moderator_questions = [q.strip() for q in q_text.strip().split("\n") if q.strip()]
                if not moderator_questions:
                    raise ValueError("Empty")
            except Exception:
                moderator_questions = [
                    f"What are your initial thoughts on {research_goal}?",
                    "Can anyone share a personal experience related to this?",
                    "How does this affect your daily life or decisions?",
                ]
        else:
            moderator_questions = [
                f"What are your initial thoughts on {research_goal}?",
                "Can anyone share a personal experience related to this?",
                "How does this affect your daily life or decisions?",
                "Does anyone have a different perspective on this?",
                "What do you think is the most important aspect we haven't discussed yet?",
                "How do you see this changing in the future?",
                "What would you recommend or suggest regarding this topic?",
            ]
        question_idx = 0

        for round_num in range(MAX_ROUNDS):
            if stop_event.is_set():
                break

            # Wait if paused
            while pause_event.is_set() and not stop_event.is_set():
                await asyncio.sleep(0.5)

            if stop_event.is_set():
                break

            # Every 3-4 rounds (or at the start), moderator asks a question
            if round_num % 3 == 0:
                if question_idx < len(moderator_questions):
                    mod_question = moderator_questions[question_idx]
                    question_idx += 1
                else:
                    # Generate a follow-up question
                    try:
                        mod_ai_messages = [
                            {
                                "role": "system",
                                "content": (
                                    f"You are {mod_name}, a professional focus group moderator. "
                                    f"The research topic is: {research_goal}. "
                                    "Based on the conversation so far, ask a thoughtful follow-up question "
                                    f"to deepen the discussion. Keep it to one sentence.{mod_lang_instruction}"
                                ),
                            },
                            {"role": "user", "content": f"Conversation so far:\n{history_as_text()}\n\nAsk a follow-up question:"},
                        ]
                        mod_text, _ = await ai_service.generate_completion(
                            messages=mod_ai_messages, max_tokens=150, temperature=0.7
                        )
                        mod_question = mod_text.strip()
                    except Exception:
                        mod_question = "Let's explore this topic from another angle. What else comes to mind?"

                await send_message("moderator", mod_question)
                add_to_history("moderator", mod_name, mod_question)
                await asyncio.sleep(random.uniform(1.5, 2.5))

            # Pick 2-3 random personas for this round
            num_responders = min(len(personas), random.randint(2, 3))
            responders = random.sample(personas, num_responders)

            for persona in responders:
                if stop_event.is_set():
                    break

                while pause_event.is_set() and not stop_event.is_set():
                    await asyncio.sleep(0.5)

                if stop_event.is_set():
                    break

                ai_messages = [
                    {"role": "system", "content": _persona_system_prompt(persona, research_goal, panel_language)},
                ]

                # Add conversation history
                for h in conversation_history:
                    if h["role_label"] == "persona" and h["name"] == persona.name:
                        ai_messages.append({"role": "assistant", "content": h["content"]})
                    else:
                        ai_messages.append({"role": "user", "content": f"[{h['name']}]: {h['content']}"})

                ai_messages.append({
                    "role": "user",
                    "content": "Continue the discussion naturally. Respond to what was just said or share your own perspective. 2-4 sentences.",
                })

                try:
                    logger.info(f"[AutoCont] Generating response for persona {persona.name} (round {round_num})")
                    text, _usage = await ai_service.generate_completion(
                        messages=ai_messages, max_tokens=300, temperature=0.8
                    )
                    text = text.strip()
                    logger.info(f"[AutoCont] Persona {persona.name} responded: {text[:80]}...")
                except Exception as e:
                    logger.error(f"[AutoCont] AI generation FAILED for persona {persona.name} ({persona.id}): {e}", exc_info=True)
                    # Use a fallback response instead of skipping
                    text = f"I think that's an interesting point. From my perspective, I'd add that it really depends on individual circumstances."

                await send_message("persona", text, persona=persona)
                add_to_history("persona", persona.name, text)
                await asyncio.sleep(random.uniform(1.0, 2.0))

            # Pause between rounds
            await asyncio.sleep(random.uniform(2.0, 3.0))

        # ========== PHASE 3: Closing ==========
        if not stop_event.is_set():
            if panel_language != "en":
                try:
                    closing_text, _ = await ai_service.generate_completion(
                        messages=[
                            {"role": "system", "content": f"You are {mod_name}, a moderator. Respond in {lang_name}."},
                            {"role": "user", "content": f"Thank the panel members for their discussion and close the session. 2 sentences in {lang_name}."},
                        ],
                        max_tokens=100, temperature=0.7,
                    )
                    closing_text = closing_text.strip()
                except Exception:
                    closing_text = "Thank you all for this discussion. That concludes our panel."
            else:
                closing_text = (
                    "Thank you all for such a rich and insightful discussion. "
                    "Your perspectives have been incredibly valuable. That concludes our panel for today."
                )
            await send_message("moderator", closing_text)

        await manager.send_to_connection(websocket, {"type": "session_ended"})

        # Mark panel as completed
        async with get_db_context() as db:
            panel = await db.get(Panel, UUID(panel_id))
            if panel and panel.status == "active":
                panel.status = "completed"
                panel.ended_at = datetime.utcnow()
                await db.commit()

    except asyncio.CancelledError:
        logger.info(f"Auto-continuation cancelled for panel {panel_id}")
        await manager.send_to_connection(websocket, {"type": "session_ended"})
    except Exception as e:
        logger.error(f"Auto-continuation error for panel {panel_id}: {e}", exc_info=True)
        await manager.send_to_connection(websocket, {
            "type": "error",
            "message": "Session encountered an error and was stopped.",
        })
        await manager.send_to_connection(websocket, {"type": "session_ended"})


# ---------------------------------------------------------------------------
# Handle user question during auto-continuation
# ---------------------------------------------------------------------------
async def _handle_user_question(
    websocket: WebSocket,
    panel_id: str,
    content: str,
    pause_event: asyncio.Event,
):
    """
    Pauses auto-continuation, generates moderator acknowledgment + persona responses,
    then resumes.
    """
    pause_event.set()  # Pause auto-continuation
    try:
        async with get_db_context() as db:
            panel = await db.get(Panel, UUID(panel_id))
            if not panel:
                return

            research_goal = panel.research_goal or "general discussion"
            panel_language = panel.language or "en"
            moderator_id = panel.moderator_id
            participant_ids = panel.participant_ids or []

            # Load moderator
            moderator = None
            if moderator_id:
                moderator = await db.get(Moderator, moderator_id)

            # Load personas
            persona_query = select(Persona).where(Persona.id.in_(participant_ids))
            result = await db.execute(persona_query)
            personas = list(result.scalars().all())

            # Save user message
            seq = await _next_sequence(db, UUID(panel_id))
            user_msg = await _save_and_format_message(
                db, UUID(panel_id), "user", content, seq,
            )
            await db.commit()

        await manager.broadcast(panel_id, {"type": "message", "message": user_msg})
        await asyncio.sleep(1.0)

        # Moderator acknowledges
        mod_name = moderator.name if moderator else "Moderator"
        mod_ack = f"Great question. Let's hear what our panelists think about that."
        async with get_db_context() as db:
            seq = await _next_sequence(db, UUID(panel_id))
            mod_msg = await _save_and_format_message(
                db, UUID(panel_id), "moderator", mod_ack, seq,
                moderator=moderator,
            )
            await db.commit()
        await manager.broadcast(panel_id, {"type": "message", "message": mod_msg})
        await asyncio.sleep(1.5)

        # 2-3 personas respond
        num_responders = min(len(personas), random.randint(2, 3))
        responders = random.sample(personas, num_responders) if personas else []

        # Get recent history for context
        async with get_db_context() as db:
            history_query = (
                select(PanelMessage)
                .where(PanelMessage.panel_id == UUID(panel_id))
                .order_by(PanelMessage.sequence_number)
            )
            history_result = await db.execute(history_query)
            history = history_result.scalars().all()
            persona_map = {p.id: p for p in personas}

        for persona in responders:
            ai_messages = [
                {"role": "system", "content": _persona_system_prompt(persona, research_goal, panel_language)},
            ]
            for msg in history[-10:]:
                if msg.role == "user":
                    ai_messages.append({"role": "user", "content": msg.content})
                elif msg.role == "persona":
                    p_name = persona_map.get(msg.persona_id)
                    p_label = p_name.name if p_name else "Participant"
                    ai_messages.append({"role": "assistant", "content": f"[{p_label}]: {msg.content}"})
                elif msg.role == "moderator":
                    ai_messages.append({"role": "user", "content": f"[Moderator]: {msg.content}"})

            ai_messages.append({"role": "user", "content": content})

            try:
                text, _usage = await ai_service.generate_completion(
                    messages=ai_messages, max_tokens=300, temperature=0.8,
                )
                text = text.strip()
            except Exception as e:
                logger.error(f"AI generation failed for persona {persona.id}: {e}")
                continue

            async with get_db_context() as db:
                seq = await _next_sequence(db, UUID(panel_id))
                msg_dict = await _save_and_format_message(
                    db, UUID(panel_id), "persona", text, seq,
                    persona=persona,
                )
                await db.commit()
            await manager.broadcast(panel_id, {"type": "message", "message": msg_dict})
            await asyncio.sleep(random.uniform(1.0, 2.0))

    except Exception as e:
        logger.error(f"Error handling user question for panel {panel_id}: {e}", exc_info=True)
        await manager.send_to_connection(websocket, {
            "type": "error",
            "message": "Failed to process your question.",
        })
    finally:
        pause_event.clear()  # Resume auto-continuation


# ---------------------------------------------------------------------------
# Handle raise hand during auto-continuation
# ---------------------------------------------------------------------------
async def _handle_raise_hand(
    websocket: WebSocket,
    panel_id: str,
    pause_event: asyncio.Event,
):
    """Moderator acknowledges the raised hand."""
    pause_event.set()
    try:
        async with get_db_context() as db:
            panel = await db.get(Panel, UUID(panel_id))
            if not panel:
                return
            moderator = None
            if panel.moderator_id:
                moderator = await db.get(Moderator, panel.moderator_id)

            mod_name = moderator.name if moderator else "Moderator"
            ack_text = "I see we have a question from the audience. Please go ahead."

            seq = await _next_sequence(db, UUID(panel_id))
            msg_dict = await _save_and_format_message(
                db, UUID(panel_id), "moderator", ack_text, seq,
                moderator=moderator,
            )
            await db.commit()

        await manager.broadcast(panel_id, {"type": "message", "message": msg_dict})
        # Keep paused so user can type their question
        # pause_event will be cleared when send_message comes in
    except Exception as e:
        logger.error(f"Error handling raise hand for panel {panel_id}: {e}", exc_info=True)
        pause_event.clear()


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------
@router.websocket("/ws/panels/{panel_id}")
async def websocket_panel(
    websocket: WebSocket,
    panel_id: str,
    token: str = Query(...),
):
    """
    WebSocket endpoint for real-time panel updates.

    Query params:
        token: JWT access token

    Messages from client:
        - {"type": "start_session"}
        - {"type": "send_message", "content": "..."}
        - {"type": "raise_hand"}
        - {"type": "stop_session"}
        - {"type": "ping"}

    Messages to client:
        - {"type": "connected", ...}
        - {"type": "session_started", ...}
        - {"type": "session_ended"}
        - {"type": "message", "message": {...}}
        - {"type": "error", ...}
        - {"type": "pong"}
    """
    # Verify token
    try:
        payload = await verify_ws_token(token)
    except Exception as e:
        await websocket.close(code=4001, reason="Invalid token")
        return

    user_id = payload.sub
    organization_id = payload.organization_id

    # Connect
    await manager.connect(
        websocket=websocket,
        panel_id=panel_id,
        user_id=user_id,
        organization_id=organization_id
    )

    # Send connection confirmation
    await manager.send_to_connection(websocket, {
        "type": "connected",
        "panel_id": panel_id,
        "active_users": manager.get_panel_connections(panel_id)
    })

    # Background task tracking
    auto_task: Optional[asyncio.Task] = None
    stop_event = asyncio.Event()
    pause_event = asyncio.Event()  # When set, auto-continuation pauses

    try:
        while True:
            # Receive message
            data = await websocket.receive_json()
            message_type = data.get("type")

            if message_type == "ping":
                await manager.send_to_connection(websocket, {"type": "pong"})

            elif message_type == "start_session":
                if auto_task and not auto_task.done():
                    await manager.send_to_connection(websocket, {
                        "type": "error",
                        "message": "Session already running",
                    })
                    continue

                stop_event.clear()
                pause_event.clear()

                await manager.send_to_connection(websocket, {
                    "type": "session_started",
                    "panel_id": panel_id,
                })

                auto_task = asyncio.create_task(
                    _auto_continuation(websocket, panel_id, stop_event, pause_event)
                )

            elif message_type == "send_message":
                content = data.get("content", "").strip()
                if not content:
                    await manager.send_to_connection(websocket, {
                        "type": "error",
                        "message": "Message content is required",
                    })
                    continue

                # Handle as an inline question during auto-continuation
                asyncio.create_task(
                    _handle_user_question(websocket, panel_id, content, pause_event)
                )

            elif message_type == "raise_hand":
                asyncio.create_task(
                    _handle_raise_hand(websocket, panel_id, pause_event)
                )

            elif message_type == "stop_session":
                stop_event.set()
                if auto_task and not auto_task.done():
                    auto_task.cancel()
                    try:
                        await auto_task
                    except asyncio.CancelledError:
                        pass
                await manager.send_to_connection(websocket, {"type": "session_ended"})

            elif message_type == "typing":
                # Broadcast typing indicator to others
                await manager.broadcast(
                    panel_id,
                    {
                        "type": "typing_indicator",
                        "user_id": user_id,
                        "is_typing": data.get("is_typing", False)
                    },
                    exclude=websocket
                )

            else:
                await manager.send_to_connection(websocket, {
                    "type": "error",
                    "message": f"Unknown message type: {message_type}"
                })

    except WebSocketDisconnect:
        # Stop auto-continuation on disconnect
        stop_event.set()
        if auto_task and not auto_task.done():
            auto_task.cancel()

        user_info = manager.disconnect(websocket, panel_id)

        # Broadcast that user left
        if user_info:
            await manager.broadcast(
                panel_id,
                {
                    "type": "user_left",
                    "user_id": user_info["user_id"],
                    "timestamp": datetime.utcnow().isoformat()
                }
            )

    except Exception as e:
        logger.error(f"WebSocket error for panel {panel_id}: {e}", exc_info=True)
        stop_event.set()
        if auto_task and not auto_task.done():
            auto_task.cancel()
        manager.disconnect(websocket, panel_id)
        try:
            await websocket.close(code=1011, reason="Internal error")
        except Exception:
            pass
