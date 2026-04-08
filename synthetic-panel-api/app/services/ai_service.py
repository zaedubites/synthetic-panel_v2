"""
AI Service - Azure OpenAI wrapper for Synthetic Panel.
Handles all LLM interactions for persona responses, analysis, and generation.
"""
import json
import logging
from typing import Any, AsyncIterator, Optional

from openai import AsyncAzureOpenAI

from app.config import settings

logger = logging.getLogger(__name__)


class AIService:
    """
    Azure OpenAI service for generating persona responses and analysis.
    """

    def __init__(self):
        self.client = AsyncAzureOpenAI(
            api_key=settings.AZURE_OPENAI_API_KEY,
            api_version=settings.AZURE_OPENAI_API_VERSION,
            azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
        )
        self.deployment = settings.AZURE_OPENAI_DEPLOYMENT
        self.embedding_deployment = settings.AZURE_OPENAI_EMBEDDING_DEPLOYMENT

    async def generate_completion(
        self,
        messages: list[dict[str, str]],
        max_tokens: int = 1000,
        temperature: float = 0.7,
        response_format: Optional[dict] = None,
    ) -> tuple[str, dict[str, int]]:
        """
        Generate a completion using Azure OpenAI.

        Args:
            messages: List of message dicts with 'role' and 'content'
            max_tokens: Maximum tokens in response
            temperature: Sampling temperature (0-2)
            response_format: Optional format specification (e.g., {"type": "json_object"})

        Returns:
            Tuple of (response_text, usage_dict)
        """
        try:
            kwargs = {
                "model": self.deployment,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
            }

            if response_format:
                kwargs["response_format"] = response_format

            response = await self.client.chat.completions.create(**kwargs)

            content = response.choices[0].message.content or ""
            usage = {
                "input_tokens": response.usage.prompt_tokens,
                "output_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens,
            }

            return content, usage

        except Exception as e:
            logger.error(f"Azure OpenAI completion error: {e}")
            raise

    async def generate_completion_stream(
        self,
        messages: list[dict[str, str]],
        max_tokens: int = 1000,
        temperature: float = 0.7,
    ) -> AsyncIterator[str]:
        """
        Generate a streaming completion.

        Yields:
            Text chunks as they're generated
        """
        try:
            response = await self.client.chat.completions.create(
                model=self.deployment,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
                stream=True,
            )

            async for chunk in response:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

        except Exception as e:
            logger.error(f"Azure OpenAI streaming error: {e}")
            raise

    async def generate_persona_response(
        self,
        persona_context: str,
        conversation_history: list[dict[str, str]],
        user_message: str,
        language: str = "en",
        max_length: int = 500,
    ) -> tuple[str, dict[str, int]]:
        """
        Generate a response as a specific persona.

        Args:
            persona_context: Full persona context from PersonaContextBuilder
            conversation_history: Previous messages in the conversation
            user_message: The message to respond to
            language: Response language (en, de)
            max_length: Maximum response length in characters

        Returns:
            Tuple of (response_text, usage_dict)
        """
        system_prompt = f"""You are roleplaying as a specific persona in a focus group discussion.

{persona_context}

RESPONSE GUIDELINES:
- Stay completely in character at all times
- Respond naturally as this person would speak
- Use their vocabulary, speech patterns, and mannerisms
- Express their genuine opinions based on their worldview
- Keep responses conversational and authentic
- Respond in {language.upper()} language
- Keep your response under {max_length} characters
- Do NOT break character or mention you are an AI
"""

        messages = [{"role": "system", "content": system_prompt}]

        # Add conversation history
        for msg in conversation_history[-10:]:  # Last 10 messages for context
            messages.append(msg)

        # Add current message
        messages.append({"role": "user", "content": user_message})

        return await self.generate_completion(
            messages=messages,
            max_tokens=max_length // 2,  # Rough estimate: 2 chars per token
            temperature=0.8,
        )

    async def generate_persona_profile(
        self,
        basic_info: dict[str, Any],
        knowledge_context: Optional[str] = None,
    ) -> tuple[dict[str, Any], dict[str, int]]:
        """
        Generate a complete persona profile from basic information.

        Args:
            basic_info: Dict with name, age, gender, country, etc.
            knowledge_context: Optional context from knowledge group

        Returns:
            Tuple of (profile_dict, usage_dict)
        """
        context_section = ""
        if knowledge_context:
            context_section = f"""
Use the following research context to inform the persona's background and opinions:

{knowledge_context[:4000]}
"""

        system_prompt = f"""You are an expert at creating detailed, realistic personas for focus group research.

Based on the basic information provided, generate a complete persona profile.
{context_section}

Return a JSON object with the following fields:
- personality: A detailed description of their personality (2-3 sentences)
- quirks: An array of 3-5 unique quirks or habits
- catchphrases: An array of 2-3 phrases they commonly use
- backstory: A brief life story (3-4 sentences)
- worldview: Their general worldview and beliefs (2-3 sentences)
- consumer_habits: Their shopping and consumption patterns (2-3 sentences)
- appearance_prompt: A detailed description for generating their avatar image

Make the persona feel like a real, three-dimensional person with consistent traits."""

        user_prompt = f"""Create a detailed persona profile for:

Name: {basic_info.get('name', 'Unknown')}
Age: {basic_info.get('age', 'Unknown')}
Gender: {basic_info.get('gender', 'Unknown')}
Country: {basic_info.get('country', 'Unknown')}
City: {basic_info.get('city', 'Unknown')}
Education: {basic_info.get('education', 'Unknown')}
Occupation: {basic_info.get('occupation', 'Unknown')}

Generate a complete, realistic profile for this person."""

        content, usage = await self.generate_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=1500,
            temperature=0.9,
            response_format={"type": "json_object"},
        )

        try:
            profile = json.loads(content)
        except json.JSONDecodeError:
            logger.error(f"Failed to parse profile JSON: {content}")
            profile = {}

        return profile, usage

    async def generate_backstory(
        self,
        persona_info: dict[str, Any],
        length: str = "medium",
    ) -> tuple[str, dict[str, int]]:
        """
        Generate a detailed backstory for a persona.

        Args:
            persona_info: Existing persona information
            length: short, medium, or long

        Returns:
            Tuple of (backstory_text, usage_dict)
        """
        length_guide = {
            "short": "2-3 paragraphs",
            "medium": "4-5 paragraphs",
            "long": "6-8 paragraphs",
        }

        system_prompt = """You are a skilled creative writer specializing in creating realistic character backgrounds.

Write a compelling, believable life story that explains how this person became who they are today.
Include formative experiences, relationships, challenges overcome, and pivotal moments.
Make it feel authentic and grounded in reality."""

        user_prompt = f"""Write a {length_guide.get(length, '4-5 paragraphs')} backstory for this persona:

Name: {persona_info.get('name')}
Age: {persona_info.get('age')}
Gender: {persona_info.get('gender')}
Country: {persona_info.get('country')}
City: {persona_info.get('city')}
Education: {persona_info.get('education')}
Occupation: {persona_info.get('occupation')}
Personality: {persona_info.get('personality', 'Not specified')}
Quirks: {persona_info.get('quirks', [])}

Write their life story in a narrative style."""

        return await self.generate_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=2000 if length == "long" else 1000,
            temperature=0.85,
        )

    async def generate_panel_analysis(
        self,
        transcript: list[dict[str, Any]],
        analysis_type: str,
        research_goal: Optional[str] = None,
    ) -> tuple[dict[str, Any], dict[str, int]]:
        """
        Generate analysis from a panel transcript.

        Args:
            transcript: List of messages with role, persona_id, content
            analysis_type: Type of analysis (consensus, disagreements, trends, summary, key_quotes)
            research_goal: Optional research goal for context

        Returns:
            Tuple of (analysis_dict, usage_dict)
        """
        analysis_prompts = {
            "consensus": "Identify points where all or most participants agreed. List each consensus point with the level of agreement and which participants agreed.",
            "disagreements": "Identify points of disagreement or debate. List each disagreement with the different positions and who held them.",
            "trends": "Identify emerging trends, patterns, or themes in the discussion. What topics generated the most engagement?",
            "summary": "Provide an executive summary of the discussion including key findings, notable insights, and overall sentiment.",
            "key_quotes": "Extract the most impactful, insightful, or representative quotes from participants. Include who said each quote.",
            "recommendations": "Based on the discussion, provide actionable recommendations or insights for the research goal.",
        }

        goal_context = ""
        if research_goal:
            goal_context = f"\nResearch Goal: {research_goal}\n"

        system_prompt = f"""You are an expert focus group analyst.

Analyze the following panel discussion transcript and {analysis_prompts.get(analysis_type, 'provide a comprehensive analysis')}.
{goal_context}
Return a JSON object with:
- content: A markdown-formatted analysis
- structured_data: Key data points in structured format for visualization
- confidence: Your confidence level in the analysis (0-1)"""

        # Format transcript
        transcript_text = "\n".join([
            f"[{msg.get('role', 'unknown')}] {msg.get('persona_name', '')}: {msg.get('content', '')}"
            for msg in transcript
        ])

        content, usage = await self.generate_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Transcript:\n\n{transcript_text}"},
            ],
            max_tokens=2000,
            temperature=0.5,
            response_format={"type": "json_object"},
        )

        try:
            analysis = json.loads(content)
        except json.JSONDecodeError:
            analysis = {"content": content, "structured_data": {}, "confidence": 0.5}

        return analysis, usage

    async def generate_followup_questions(
        self,
        recent_messages: list[dict[str, Any]],
        research_goal: Optional[str] = None,
        count: int = 3,
    ) -> tuple[list[str], dict[str, int]]:
        """
        Generate follow-up probe questions based on recent discussion.

        Args:
            recent_messages: Recent messages from the panel
            research_goal: Optional research goal for context
            count: Number of questions to generate

        Returns:
            Tuple of (questions_list, usage_dict)
        """
        goal_context = f"Research Goal: {research_goal}\n" if research_goal else ""

        system_prompt = f"""You are an expert focus group moderator.

Based on the recent discussion, generate {count} insightful follow-up questions that:
- Dig deeper into interesting points raised
- Explore areas of agreement or disagreement
- Uncover underlying motivations or feelings
- Move the discussion forward productively
{goal_context}
Return a JSON object with a "questions" array containing {count} questions."""

        messages_text = "\n".join([
            f"{msg.get('role', 'unknown')}: {msg.get('content', '')}"
            for msg in recent_messages[-10:]
        ])

        content, usage = await self.generate_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Recent discussion:\n\n{messages_text}"},
            ],
            max_tokens=500,
            temperature=0.7,
            response_format={"type": "json_object"},
        )

        try:
            data = json.loads(content)
            questions = data.get("questions", [])
        except json.JSONDecodeError:
            questions = []

        return questions, usage

    async def extract_archetypes(
        self,
        knowledge_content: str,
        max_archetypes: int = 5,
        generation_focus: Optional[str] = None,
    ) -> tuple[list[dict[str, Any]], dict[str, int]]:
        """
        Extract archetypes from knowledge group content.

        Args:
            knowledge_content: Text content from knowledge sources
            max_archetypes: Maximum number of archetypes to extract
            generation_focus: Optional generation to focus on (gen_alpha, gen_z, etc.)

        Returns:
            Tuple of (archetypes_list, usage_dict)
        """
        focus_text = ""
        if generation_focus:
            focus_text = f"Focus on {generation_focus} personas specifically."

        system_prompt = f"""You are an expert in consumer research and persona development.

Analyze the provided content and extract up to {max_archetypes} distinct archetypes or persona types.
{focus_text}

For each archetype, provide:
- name: A memorable name for the archetype
- description: Brief description (1-2 sentences)
- driver: What primarily motivates them
- core_value: Their central value or belief
- key_behaviors: Array of 3-5 typical behaviors
- communication_patterns: Array of 2-3 communication styles
- age_min/age_max: Typical age range
- generation: gen_alpha, gen_z, millennial, gen_x, or boomer
- example_quotes: 2-3 things they might say
- example_interests: 3-5 typical interests

Return a JSON object with an "archetypes" array."""

        content, usage = await self.generate_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Content to analyze:\n\n{knowledge_content[:8000]}"},
            ],
            max_tokens=3000,
            temperature=0.7,
            response_format={"type": "json_object"},
        )

        try:
            data = json.loads(content)
            archetypes = data.get("archetypes", [])
        except json.JSONDecodeError:
            archetypes = []

        return archetypes, usage

    async def generate_embedding(self, text: str) -> list[float]:
        """
        Generate an embedding vector for text.

        Args:
            text: Text to embed

        Returns:
            List of floats (1536-dimensional vector)
        """
        try:
            response = await self.client.embeddings.create(
                model=self.embedding_deployment,
                input=text,
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"Embedding generation error: {e}")
            raise


# Singleton instance
ai_service = AIService()
