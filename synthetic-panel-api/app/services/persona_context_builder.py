"""
Persona Context Builder - Builds comprehensive context for persona responses.
"""
import logging
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Archetype, Framework, Persona

logger = logging.getLogger(__name__)


class PersonaContextBuilder:
    """
    Builds comprehensive context strings for persona responses.
    Ensures consistent persona behavior across all interactions.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def build_context(
        self,
        persona_id: UUID,
        include_knowledge: bool = True,
        knowledge_query: Optional[str] = None,
    ) -> str:
        """
        Build a complete context string for a persona.

        Args:
            persona_id: UUID of the persona
            include_knowledge: Whether to include knowledge context
            knowledge_query: Optional query to filter relevant knowledge

        Returns:
            Formatted context string for LLM prompts
        """
        # Fetch persona with related data
        result = await self.db.execute(
            select(Persona).where(Persona.id == persona_id)
        )
        persona = result.scalar_one_or_none()

        if not persona:
            raise ValueError(f"Persona {persona_id} not found")

        # Build context sections
        sections = []

        # Basic identity
        sections.append(self._build_identity_section(persona))

        # Personality
        if persona.personality or persona.quirks or persona.catchphrases:
            sections.append(self._build_personality_section(persona))

        # Worldview and background
        if persona.backstory or persona.worldview:
            sections.append(self._build_background_section(persona))

        # Consumer habits
        if persona.consumer_habits:
            sections.append(self._build_consumer_section(persona))

        # Archetype context
        if persona.archetype_id:
            archetype_section = await self._build_archetype_section(persona.archetype_id)
            if archetype_section:
                sections.append(archetype_section)

        # Framework context
        if persona.psychological_framework_id:
            framework_section = await self._build_framework_section(
                persona.psychological_framework_id
            )
            if framework_section:
                sections.append(framework_section)

        # Knowledge context
        if include_knowledge and persona.knowledge_group_id:
            knowledge_section = await self._build_knowledge_section(
                persona.knowledge_group_id,
                knowledge_query,
            )
            if knowledge_section:
                sections.append(knowledge_section)

        return "\n\n".join(sections)

    def _build_identity_section(self, persona: Persona) -> str:
        """Build the identity section of the context."""
        lines = ["## YOUR IDENTITY"]

        lines.append(f"You are {persona.name}.")

        if persona.age:
            lines.append(f"Age: {persona.age}")

        if persona.gender:
            lines.append(f"Gender: {persona.gender}")

        if persona.city and persona.country:
            lines.append(f"Location: {persona.city}, {persona.country}")
        elif persona.country:
            lines.append(f"Country: {persona.country}")

        if persona.education:
            lines.append(f"Education: {persona.education}")

        if persona.occupation:
            lines.append(f"Occupation: {persona.occupation}")

        return "\n".join(lines)

    def _build_personality_section(self, persona: Persona) -> str:
        """Build the personality section of the context."""
        lines = ["## YOUR PERSONALITY"]

        if persona.personality:
            lines.append(persona.personality)

        if persona.quirks:
            quirks_text = ", ".join(persona.quirks[:5])
            lines.append(f"\nYour quirks and habits: {quirks_text}")

        if persona.catchphrases:
            phrases_text = '" | "'.join(persona.catchphrases[:3])
            lines.append(f'\nPhrases you often use: "{phrases_text}"')

        return "\n".join(lines)

    def _build_background_section(self, persona: Persona) -> str:
        """Build the background/worldview section."""
        lines = ["## YOUR BACKGROUND & WORLDVIEW"]

        if persona.backstory:
            lines.append(f"Your life story: {persona.backstory}")

        if persona.worldview:
            lines.append(f"\nHow you see the world: {persona.worldview}")

        return "\n".join(lines)

    def _build_consumer_section(self, persona: Persona) -> str:
        """Build the consumer habits section."""
        return f"""## YOUR CONSUMER BEHAVIOR

{persona.consumer_habits}"""

    async def _build_archetype_section(self, archetype_id: UUID) -> Optional[str]:
        """Build context from archetype."""
        result = await self.db.execute(
            select(Archetype).where(Archetype.id == archetype_id)
        )
        archetype = result.scalar_one_or_none()

        if not archetype:
            return None

        lines = [f"## ARCHETYPE: {archetype.name}"]

        if archetype.description:
            lines.append(archetype.description)

        if archetype.driver:
            lines.append(f"\nWhat drives you: {archetype.driver}")

        if archetype.core_value:
            lines.append(f"Your core value: {archetype.core_value}")

        if archetype.key_behaviors:
            behaviors = ", ".join(archetype.key_behaviors[:5])
            lines.append(f"Typical behaviors: {behaviors}")

        if archetype.communication_patterns:
            patterns = ", ".join(archetype.communication_patterns[:3])
            lines.append(f"Communication style: {patterns}")

        return "\n".join(lines)

    async def _build_framework_section(self, framework_id: UUID) -> Optional[str]:
        """Build context from psychological framework."""
        result = await self.db.execute(
            select(Framework).where(Framework.id == framework_id)
        )
        framework = result.scalar_one_or_none()

        if not framework or not framework.dimensions:
            return None

        lines = [f"## PSYCHOLOGICAL PROFILE ({framework.name})"]

        for dimension, config in framework.dimensions.items():
            if isinstance(config, dict) and "value" in config:
                lines.append(f"- {dimension}: {config['value']}")

        return "\n".join(lines)

    async def _build_knowledge_section(
        self,
        knowledge_group_id: UUID,
        query: Optional[str] = None,
    ) -> Optional[str]:
        """
        Build context from knowledge group.
        Queries the platform schema for relevant knowledge.
        """
        try:
            # Query platform.knowledge_group_analyses for executive summary
            analysis_query = text("""
                SELECT content
                FROM platform.knowledge_group_analyses
                WHERE group_id = :group_id
                AND analysis_type = 'EXECUTIVE_SUMMARY'
                LIMIT 1
            """)

            result = await self.db.execute(
                analysis_query,
                {"group_id": str(knowledge_group_id)}
            )
            analysis = result.scalar_one_or_none()

            if analysis:
                return f"""## KNOWLEDGE CONTEXT

Based on research and data you're familiar with:

{analysis[:2000]}"""

            # Fallback: Get group description
            group_query = text("""
                SELECT name, description
                FROM platform.knowledge_groups
                WHERE id = :group_id
            """)

            result = await self.db.execute(
                group_query,
                {"group_id": str(knowledge_group_id)}
            )
            group = result.first()

            if group and group.description:
                return f"""## KNOWLEDGE CONTEXT

Your knowledge area: {group.name}

{group.description[:1000]}"""

            return None

        except Exception as e:
            logger.warning(f"Failed to fetch knowledge context: {e}")
            return None

    async def build_panel_context(
        self,
        persona_ids: list[UUID],
        panel_knowledge_group_ids: Optional[list[UUID]] = None,
    ) -> dict[UUID, str]:
        """
        Build context for all personas in a panel.

        Args:
            persona_ids: List of persona UUIDs
            panel_knowledge_group_ids: Additional knowledge groups for the panel

        Returns:
            Dict mapping persona_id to context string
        """
        contexts = {}

        for persona_id in persona_ids:
            try:
                context = await self.build_context(
                    persona_id=persona_id,
                    include_knowledge=True,
                )
                contexts[persona_id] = context
            except Exception as e:
                logger.error(f"Failed to build context for persona {persona_id}: {e}")
                contexts[persona_id] = f"You are a participant in a focus group discussion."

        return contexts


async def get_persona_context_builder(db: AsyncSession) -> PersonaContextBuilder:
    """Dependency to get a PersonaContextBuilder instance."""
    return PersonaContextBuilder(db)
