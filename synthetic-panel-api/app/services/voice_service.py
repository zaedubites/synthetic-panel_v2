"""
Voice Service - ElevenLabs Integration

Handles text-to-speech generation for persona responses.
"""

import httpx
from typing import Optional
from uuid import UUID

from app.config import settings


class VoiceService:
    """
    ElevenLabs voice synthesis service for generating audio responses.
    """

    BASE_URL = "https://api.elevenlabs.io/v1"

    def __init__(self):
        self.api_key = settings.ELEVENLABS_API_KEY
        self.default_model = "eleven_multilingual_v2"

    async def generate_speech(
        self,
        text: str,
        voice_id: str,
        model_id: Optional[str] = None,
        stability: float = 0.5,
        similarity_boost: float = 0.75,
        style: float = 0.0,
        use_speaker_boost: bool = True
    ) -> bytes:
        """
        Generate speech audio from text.

        Args:
            text: The text to convert to speech
            voice_id: ElevenLabs voice ID
            model_id: Model to use (default: eleven_multilingual_v2)
            stability: Voice stability (0-1)
            similarity_boost: Similarity to original voice (0-1)
            style: Style exaggeration (0-1)
            use_speaker_boost: Enhance speaker clarity

        Returns:
            Audio bytes (MP3 format)
        """
        if not self.api_key:
            raise ValueError("ELEVENLABS_API_KEY not configured")

        url = f"{self.BASE_URL}/text-to-speech/{voice_id}"

        headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg"
        }

        payload = {
            "text": text,
            "model_id": model_id or self.default_model,
            "voice_settings": {
                "stability": stability,
                "similarity_boost": similarity_boost,
                "style": style,
                "use_speaker_boost": use_speaker_boost
            }
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            return response.content

    async def generate_speech_stream(
        self,
        text: str,
        voice_id: str,
        model_id: Optional[str] = None
    ):
        """
        Stream speech audio generation for real-time playback.

        Yields:
            Audio chunks as bytes
        """
        if not self.api_key:
            raise ValueError("ELEVENLABS_API_KEY not configured")

        url = f"{self.BASE_URL}/text-to-speech/{voice_id}/stream"

        headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg"
        }

        payload = {
            "text": text,
            "model_id": model_id or self.default_model,
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75
            }
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", url, headers=headers, json=payload) as response:
                response.raise_for_status()
                async for chunk in response.aiter_bytes(chunk_size=1024):
                    yield chunk

    async def list_voices(self) -> list[dict]:
        """
        Get list of available voices.

        Returns:
            List of voice objects with id, name, labels, etc.
        """
        if not self.api_key:
            raise ValueError("ELEVENLABS_API_KEY not configured")

        url = f"{self.BASE_URL}/voices"

        headers = {
            "xi-api-key": self.api_key
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data.get("voices", [])

    async def get_voice(self, voice_id: str) -> dict:
        """
        Get details for a specific voice.

        Returns:
            Voice object with full details
        """
        if not self.api_key:
            raise ValueError("ELEVENLABS_API_KEY not configured")

        url = f"{self.BASE_URL}/voices/{voice_id}"

        headers = {
            "xi-api-key": self.api_key
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            return response.json()

    async def clone_voice(
        self,
        name: str,
        files: list[bytes],
        description: Optional[str] = None,
        labels: Optional[dict] = None
    ) -> dict:
        """
        Clone a voice from audio samples.

        Args:
            name: Name for the cloned voice
            files: List of audio file bytes (MP3, WAV, etc.)
            description: Optional description
            labels: Optional labels dict (e.g., {"accent": "american"})

        Returns:
            Created voice object
        """
        if not self.api_key:
            raise ValueError("ELEVENLABS_API_KEY not configured")

        url = f"{self.BASE_URL}/voices/add"

        headers = {
            "xi-api-key": self.api_key
        }

        # Build multipart form data
        files_data = [
            ("files", (f"sample_{i}.mp3", file_bytes, "audio/mpeg"))
            for i, file_bytes in enumerate(files)
        ]

        data = {"name": name}
        if description:
            data["description"] = description
        if labels:
            import json
            data["labels"] = json.dumps(labels)

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, headers=headers, data=data, files=files_data)
            response.raise_for_status()
            return response.json()

    async def delete_voice(self, voice_id: str) -> bool:
        """
        Delete a cloned voice.

        Returns:
            True if deleted successfully
        """
        if not self.api_key:
            raise ValueError("ELEVENLABS_API_KEY not configured")

        url = f"{self.BASE_URL}/voices/{voice_id}"

        headers = {
            "xi-api-key": self.api_key
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.delete(url, headers=headers)
            response.raise_for_status()
            return True

    # ========================================
    # Browse ElevenLabs Shared Library
    # ========================================

    async def browse_shared_voices(
        self,
        query: str | None = None,
        page: int = 1,
        page_size: int = 100,
    ) -> dict:
        """
        Browse the ElevenLabs shared voice library.

        Returns:
            Dict with 'voices', 'has_more' keys
        """
        if not self.api_key:
            raise ValueError("ELEVENLABS_API_KEY not configured")

        url = f"{self.BASE_URL}/shared-voices"
        headers = {"xi-api-key": self.api_key}
        params = {
            "page_size": page_size,
            "page": page - 1,  # ElevenLabs uses 0-based pages
        }
        if query:
            params["search"] = query

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=headers, params=params)
            response.raise_for_status()
            data = response.json()

        raw_voices = data.get("voices", [])
        voices = []
        for v in raw_voices:
            labels = v.get("labels", {}) or {}
            voices.append({
                "voice_id": v.get("voice_id", v.get("public_owner_id", "")),
                "name": v.get("name", ""),
                "description": v.get("description", ""),
                "preview_url": v.get("preview_url", ""),
                "category": v.get("category", ""),
                "labels": labels,
                "gender": labels.get("gender"),
                "age": labels.get("age"),
                "accent": labels.get("accent"),
                "use_case": labels.get("use_case"),
                "cloned_by_count": v.get("cloned_by_count", 0),
                "rate": v.get("rate", 0),
                "language": v.get("language", "en"),
                "locale": v.get("locale"),
                "verified_languages": [
                    lang.get("language", "") for lang in (v.get("verified_languages") or [])
                ],
                "is_multilingual": len(v.get("verified_languages") or []) > 1,
            })

        return {
            "voices": voices,
            "has_more": data.get("has_more", len(raw_voices) >= page_size),
        }

    # ========================================
    # Voice Library CRUD (DB-backed)
    # ========================================

    async def add_to_library(self, org_id: str | None, data: dict) -> dict:
        """
        Add a voice to the organization's library.

        For now this uses an in-memory store. Swap in your DB/Supabase
        client once the voice_library table is created.
        """
        import uuid
        voice = {
            "id": str(uuid.uuid4()),
            "organization_id": org_id,
            **data,
            "is_approved": True,
        }
        # TODO: persist to database (voice_library table)
        return voice

    async def update_library_voice(self, org_id: str | None, voice_id: str, data: dict) -> dict | None:
        """
        Update a library voice record.

        Stub -- returns the merged data. Replace with DB update.
        """
        # TODO: fetch from DB, merge, save
        return {"id": voice_id, "organization_id": org_id, **data}

    async def delete_library_voice(self, org_id: str | None, voice_id: str) -> bool:
        """
        Delete a library voice record.

        Stub -- always returns True. Replace with DB delete.
        """
        # TODO: delete from DB
        return True

    def get_recommended_voices(self, language: str = "en") -> list[dict]:
        """
        Get recommended voice IDs for different persona types.

        Returns preset voice configurations suitable for focus groups.
        """
        # ElevenLabs stock voices suitable for different personas
        voices = {
            "en": [
                {
                    "voice_id": "21m00Tcm4TlvDq8ikWAM",
                    "name": "Rachel",
                    "gender": "female",
                    "age": "young-adult",
                    "accent": "american",
                    "description": "Calm, professional female voice"
                },
                {
                    "voice_id": "AZnzlk1XvdvUeBnXmlld",
                    "name": "Domi",
                    "gender": "female",
                    "age": "young-adult",
                    "accent": "american",
                    "description": "Energetic, youthful female voice"
                },
                {
                    "voice_id": "EXAVITQu4vr4xnSDxMaL",
                    "name": "Bella",
                    "gender": "female",
                    "age": "adult",
                    "accent": "american",
                    "description": "Soft, warm female voice"
                },
                {
                    "voice_id": "ErXwobaYiN019PkySvjV",
                    "name": "Antoni",
                    "gender": "male",
                    "age": "young-adult",
                    "accent": "american",
                    "description": "Well-rounded, conversational male voice"
                },
                {
                    "voice_id": "VR6AewLTigWG4xSOukaG",
                    "name": "Arnold",
                    "gender": "male",
                    "age": "middle-aged",
                    "accent": "american",
                    "description": "Deep, authoritative male voice"
                },
                {
                    "voice_id": "pNInz6obpgDQGcFmaJgB",
                    "name": "Adam",
                    "gender": "male",
                    "age": "adult",
                    "accent": "american",
                    "description": "Clear, neutral male voice"
                },
            ],
            "de": [
                {
                    "voice_id": "onwK4e9ZLuTAKqWW03F9",
                    "name": "German Male 1",
                    "gender": "male",
                    "age": "adult",
                    "accent": "german",
                    "description": "Clear German male voice"
                },
                {
                    "voice_id": "XB0fDUnXU5powFXDhCwa",
                    "name": "German Female 1",
                    "gender": "female",
                    "age": "adult",
                    "accent": "german",
                    "description": "Professional German female voice"
                },
            ]
        }

        return voices.get(language, voices["en"])

    def select_voice_for_persona(
        self,
        gender: Optional[str] = None,
        age_range: Optional[str] = None,
        language: str = "en"
    ) -> Optional[str]:
        """
        Select an appropriate voice ID based on persona characteristics.

        Args:
            gender: "male", "female", or None
            age_range: Age description or None
            language: Language code

        Returns:
            Voice ID or None
        """
        voices = self.get_recommended_voices(language)

        # Filter by gender if specified
        if gender:
            gender_lower = gender.lower()
            voices = [v for v in voices if v.get("gender") == gender_lower]

        # Filter by age if we can match
        if age_range and voices:
            age_lower = age_range.lower()
            if "young" in age_lower or "20" in age_lower or "teen" in age_lower:
                age_matched = [v for v in voices if v.get("age") == "young-adult"]
                if age_matched:
                    voices = age_matched
            elif "middle" in age_lower or "40" in age_lower or "50" in age_lower:
                age_matched = [v for v in voices if v.get("age") == "middle-aged"]
                if age_matched:
                    voices = age_matched

        if voices:
            import random
            return random.choice(voices)["voice_id"]

        return None
