"""
Panel Conversation Engine

Orchestrates the flow of conversation in a panel session,
managing turn-taking, response generation, and moderation.
"""

import asyncio
import random
from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.panel import Panel, PanelStatus
from app.models.panel_message import PanelMessage, MessageRole
from app.models.persona import Persona
from app.models.moderator import Moderator
from app.models.discussion_guide import DiscussionGuide
from app.services.ai_service import AIService
from app.services.persona_context_builder import PersonaContextBuilder


class PanelConversationEngine:
    """
    Orchestrates panel conversations including:
    - Processing user questions
    - Selecting responding personas
    - Generating contextual responses
    - Managing moderator interventions
    - Handling discussion guide flow
    """

    def __init__(self, db: AsyncSession, organization_id: UUID):
        self.db = db
        self.organization_id = organization_id
        self.ai_service = AIService()
        self.context_builder = PersonaContextBuilder(db, organization_id)

    async def process_user_message(
        self,
        panel_id: UUID,
        user_message: str,
        max_responders: int = 3,
        include_moderator: bool = True
    ) -> dict:
        """
        Process a user message and generate panel responses.

        Returns:
            dict with user_message and responses list
        """
        # Get panel with participants
        panel = await self._get_panel(panel_id)
        if not panel:
            raise ValueError(f"Panel {panel_id} not found")

        if panel.status != PanelStatus.ACTIVE:
            raise ValueError(f"Panel is not active (status: {panel.status})")

        # Get personas participating in this panel
        personas = await self._get_panel_personas(panel.participant_ids)
        if not personas:
            raise ValueError("No personas found for this panel")

        # Get conversation history
        history = await self._get_conversation_history(panel_id, limit=20)

        # Save user message
        user_msg = await self._save_message(
            panel_id=panel_id,
            role=MessageRole.USER,
            content=user_message
        )

        responses = []

        # Check if moderator should introduce or guide
        moderator = None
        if include_moderator and panel.moderator_id:
            moderator = await self._get_moderator(panel.moderator_id)

        if moderator and panel.moderation_mode == "ai":
            # Check if moderator should speak first
            moderator_response = await self._generate_moderator_response(
                panel=panel,
                moderator=moderator,
                user_message=user_message,
                history=history,
                is_introduction=len(history) == 0
            )
            if moderator_response:
                mod_msg = await self._save_message(
                    panel_id=panel_id,
                    role=MessageRole.MODERATOR,
                    content=moderator_response,
                    moderator_id=moderator.id
                )
                responses.append(mod_msg)

        # Select which personas should respond
        responding_personas = await self._select_responders(
            personas=personas,
            user_message=user_message,
            history=history,
            max_responders=max_responders
        )

        # Generate responses for each selected persona
        for persona in responding_personas:
            response = await self._generate_persona_response(
                panel=panel,
                persona=persona,
                user_message=user_message,
                history=history,
                other_responses=[r.content for r in responses if r.role == MessageRole.PERSONA]
            )

            persona_msg = await self._save_message(
                panel_id=panel_id,
                role=MessageRole.PERSONA,
                content=response,
                persona_id=persona.id
            )
            responses.append(persona_msg)

            # Small delay between responses for realism
            await asyncio.sleep(0.1)

        # Moderator follow-up if needed
        if moderator and panel.moderation_mode == "ai" and len(responses) > 1:
            followup = await self._generate_moderator_followup(
                panel=panel,
                moderator=moderator,
                user_message=user_message,
                responses=[r.content for r in responses if r.role == MessageRole.PERSONA],
                history=history
            )
            if followup:
                followup_msg = await self._save_message(
                    panel_id=panel_id,
                    role=MessageRole.MODERATOR,
                    content=followup,
                    moderator_id=moderator.id
                )
                responses.append(followup_msg)

        await self.db.commit()

        return {
            "user_message": self._message_to_dict(user_msg),
            "responses": [self._message_to_dict(r) for r in responses]
        }

    async def get_next_guide_question(self, panel_id: UUID) -> Optional[dict]:
        """
        Get the next question from the discussion guide if one is configured.
        """
        panel = await self._get_panel(panel_id)
        if not panel or not panel.discussion_guide_id:
            return None

        guide = await self._get_discussion_guide(panel.discussion_guide_id)
        if not guide or not guide.sections:
            return None

        # Get current progress
        history = await self._get_conversation_history(panel_id)
        user_messages = [m for m in history if m.role == MessageRole.USER]
        current_index = len(user_messages)

        # Flatten all questions from sections
        all_questions = []
        for section in guide.sections:
            for q in section.get("questions", []):
                all_questions.append({
                    "question": q,
                    "section": section.get("title", "")
                })

        if current_index >= len(all_questions):
            return None

        return {
            "question": all_questions[current_index]["question"],
            "section": all_questions[current_index]["section"],
            "progress": {
                "current": current_index + 1,
                "total": len(all_questions)
            }
        }

    async def generate_panel_summary(self, panel_id: UUID) -> str:
        """Generate a summary of the panel conversation."""
        history = await self._get_conversation_history(panel_id, limit=100)

        if not history:
            return "No conversation to summarize."

        # Format conversation for summarization
        conversation_text = self._format_conversation_for_ai(history)

        panel = await self._get_panel(panel_id)
        research_goal = panel.research_goal if panel else None

        summary = await self.ai_service.generate_completion(
            system_prompt="""You are a qualitative research analyst.
            Summarize the focus group discussion, highlighting:
            1. Key themes and insights
            2. Areas of agreement and disagreement
            3. Notable quotes
            4. Recommendations for further exploration""",
            user_prompt=f"""Research Goal: {research_goal or 'General feedback'}

Conversation:
{conversation_text}

Please provide a comprehensive summary.""",
            max_tokens=1500
        )

        return summary

    # Private helper methods

    async def _get_panel(self, panel_id: UUID) -> Optional[Panel]:
        result = await self.db.execute(
            select(Panel).where(
                Panel.id == panel_id,
                Panel.organization_id == self.organization_id
            )
        )
        return result.scalar_one_or_none()

    async def _get_panel_personas(self, persona_ids: list[UUID]) -> list[Persona]:
        if not persona_ids:
            return []
        result = await self.db.execute(
            select(Persona).where(
                Persona.id.in_(persona_ids),
                Persona.organization_id == self.organization_id
            )
        )
        return list(result.scalars().all())

    async def _get_moderator(self, moderator_id: UUID) -> Optional[Moderator]:
        result = await self.db.execute(
            select(Moderator).where(
                Moderator.id == moderator_id,
                Moderator.organization_id == self.organization_id
            )
        )
        return result.scalar_one_or_none()

    async def _get_discussion_guide(self, guide_id: UUID) -> Optional[DiscussionGuide]:
        result = await self.db.execute(
            select(DiscussionGuide).where(
                DiscussionGuide.id == guide_id,
                DiscussionGuide.organization_id == self.organization_id
            )
        )
        return result.scalar_one_or_none()

    async def _get_conversation_history(
        self,
        panel_id: UUID,
        limit: int = 50
    ) -> list[PanelMessage]:
        result = await self.db.execute(
            select(PanelMessage)
            .where(PanelMessage.panel_id == panel_id)
            .order_by(PanelMessage.created_at.desc())
            .limit(limit)
        )
        messages = list(result.scalars().all())
        messages.reverse()  # Chronological order
        return messages

    async def _save_message(
        self,
        panel_id: UUID,
        role: MessageRole,
        content: str,
        persona_id: Optional[UUID] = None,
        moderator_id: Optional[UUID] = None
    ) -> PanelMessage:
        message = PanelMessage(
            panel_id=panel_id,
            role=role,
            content=content,
            persona_id=persona_id,
            moderator_id=moderator_id
        )
        self.db.add(message)
        await self.db.flush()
        return message

    async def _select_responders(
        self,
        personas: list[Persona],
        user_message: str,
        history: list[PanelMessage],
        max_responders: int
    ) -> list[Persona]:
        """
        Select which personas should respond based on:
        - Relevance to the question
        - Diversity of perspectives
        - Recent participation (avoid same responders)
        """
        if len(personas) <= max_responders:
            return personas

        # Get recent responders to deprioritize
        recent_persona_ids = set()
        for msg in history[-10:]:
            if msg.persona_id:
                recent_persona_ids.add(msg.persona_id)

        # Score personas
        scored = []
        for persona in personas:
            score = random.random()  # Base randomness

            # Deprioritize recent responders
            if persona.id in recent_persona_ids:
                score -= 0.3

            # Could add relevance scoring based on persona traits vs question
            # For now, we use weighted randomness

            scored.append((score, persona))

        # Sort by score descending and take top N
        scored.sort(key=lambda x: x[0], reverse=True)
        return [p for _, p in scored[:max_responders]]

    async def _generate_persona_response(
        self,
        panel: Panel,
        persona: Persona,
        user_message: str,
        history: list[PanelMessage],
        other_responses: list[str]
    ) -> str:
        """Generate a contextual response from a persona."""
        # Build persona context
        context = await self.context_builder.build_context(
            persona=persona,
            panel=panel,
            recent_messages=history[-10:],
            knowledge_group_ids=panel.knowledge_group_ids
        )

        # Format conversation history
        history_text = self._format_conversation_for_ai(history[-10:])

        # Include other responses in this round
        others_text = ""
        if other_responses:
            others_text = f"\n\nOther participants have already responded:\n" + "\n".join(
                f"- {r}" for r in other_responses
            )

        response = await self.ai_service.generate_persona_response(
            persona_context=context,
            conversation_history=history_text + others_text,
            current_question=user_message,
            language=panel.language or "en"
        )

        return response

    async def _generate_moderator_response(
        self,
        panel: Panel,
        moderator: Moderator,
        user_message: str,
        history: list[PanelMessage],
        is_introduction: bool = False
    ) -> Optional[str]:
        """Generate moderator response if appropriate."""
        style_instructions = {
            "professional": "Maintain a professional, focused tone. Keep introductions brief.",
            "friendly": "Be warm and welcoming. Use encouraging language.",
            "neutral": "Stay neutral and objective. Focus on facilitating discussion."
        }

        style = style_instructions.get(moderator.moderation_style, style_instructions["professional"])

        if is_introduction:
            prompt = f"""You are {moderator.name}, a focus group moderator.
Style: {style}

The researcher has asked: "{user_message}"

Provide a brief introduction that:
1. Welcomes participants
2. Frames the question for the group
3. Encourages open sharing

Keep it to 1-2 sentences. Language: {panel.language or 'en'}"""
        else:
            # Only interject if needed (e.g., to redirect, clarify, or probe deeper)
            # For now, return None to let personas respond directly
            return None

        return await self.ai_service.generate_completion(
            system_prompt=f"You are {moderator.name}, a focus group moderator. {style}",
            user_prompt=prompt,
            max_tokens=200
        )

    async def _generate_moderator_followup(
        self,
        panel: Panel,
        moderator: Moderator,
        user_message: str,
        responses: list[str],
        history: list[PanelMessage]
    ) -> Optional[str]:
        """Generate a moderator follow-up to summarize or probe deeper."""
        # Only generate follow-up occasionally or when there's disagreement
        if random.random() > 0.3:  # 30% chance of follow-up
            return None

        style_instructions = {
            "professional": "analytical and focused",
            "friendly": "warm and encouraging",
            "neutral": "balanced and objective"
        }
        style = style_instructions.get(moderator.moderation_style, "professional")

        prompt = f"""The researcher asked: "{user_message}"

Participants responded:
{chr(10).join(f'- {r}' for r in responses)}

As a {style} moderator, provide a brief follow-up that either:
1. Summarizes key points of agreement/disagreement
2. Probes deeper on an interesting point
3. Invites quieter participants to share

Keep it to 1 sentence. Only respond if there's something valuable to add.
If not needed, respond with just "SKIP".

Language: {panel.language or 'en'}"""

        response = await self.ai_service.generate_completion(
            system_prompt=f"You are {moderator.name}, a focus group moderator.",
            user_prompt=prompt,
            max_tokens=150
        )

        if response.strip().upper() == "SKIP":
            return None

        return response

    def _format_conversation_for_ai(self, messages: list[PanelMessage]) -> str:
        """Format conversation history for AI context."""
        lines = []
        for msg in messages:
            if msg.role == MessageRole.USER:
                lines.append(f"Researcher: {msg.content}")
            elif msg.role == MessageRole.MODERATOR:
                lines.append(f"Moderator: {msg.content}")
            elif msg.role == MessageRole.PERSONA:
                lines.append(f"Participant: {msg.content}")
        return "\n".join(lines)

    def _message_to_dict(self, msg: PanelMessage) -> dict:
        """Convert message to API response format."""
        return {
            "id": str(msg.id),
            "role": msg.role.value,
            "content": msg.content,
            "persona_id": str(msg.persona_id) if msg.persona_id else None,
            "moderator_id": str(msg.moderator_id) if msg.moderator_id else None,
            "created_at": msg.created_at.isoformat() if msg.created_at else None
        }
