"""
Avatar Service - Replicate Integration

Handles AI avatar generation for personas using Replicate's API.
"""

import httpx
import asyncio
from typing import Optional
from uuid import UUID

from app.config import settings


class AvatarService:
    """
    Replicate-based avatar generation service.
    Uses SDXL and other models for realistic persona avatars.
    """

    BASE_URL = "https://api.replicate.com/v1"

    # Model versions for avatar generation
    MODELS = {
        "sdxl": "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
        "realistic-vision": "lucataco/realistic-vision-v5.1:2c8e954decbf70b7607a4414e5785ef9e4de4b8c51d50fb8b8b349160e0ef6bb",
        "photomaker": "tencentarc/photomaker:ddfc2b08d209f9fa8c1uj70e7d5b",
    }

    def __init__(self):
        self.api_key = settings.REPLICATE_API_KEY
        self.default_model = "realistic-vision"

    async def generate_avatar(
        self,
        prompt: str,
        negative_prompt: Optional[str] = None,
        model: Optional[str] = None,
        width: int = 512,
        height: int = 512,
        num_outputs: int = 1,
        guidance_scale: float = 7.5,
        seed: Optional[int] = None
    ) -> list[str]:
        """
        Generate avatar images from a text prompt.

        Args:
            prompt: Description of the avatar to generate
            negative_prompt: Things to avoid in the image
            model: Model to use (sdxl, realistic-vision)
            width: Image width
            height: Image height
            num_outputs: Number of images to generate
            guidance_scale: How closely to follow the prompt
            seed: Random seed for reproducibility

        Returns:
            List of image URLs
        """
        if not self.api_key:
            raise ValueError("REPLICATE_API_KEY not configured")

        model_key = model or self.default_model
        model_version = self.MODELS.get(model_key)
        if not model_version:
            raise ValueError(f"Unknown model: {model_key}")

        # Build input based on model
        input_params = {
            "prompt": prompt,
            "width": width,
            "height": height,
            "num_outputs": num_outputs,
            "guidance_scale": guidance_scale,
        }

        if negative_prompt:
            input_params["negative_prompt"] = negative_prompt
        if seed is not None:
            input_params["seed"] = seed

        # Start prediction
        prediction = await self._create_prediction(model_version, input_params)

        # Poll for completion
        result = await self._wait_for_prediction(prediction["id"])

        if result.get("status") == "succeeded":
            output = result.get("output", [])
            if isinstance(output, str):
                return [output]
            return output
        else:
            error = result.get("error", "Unknown error")
            raise RuntimeError(f"Avatar generation failed: {error}")

    async def generate_persona_avatar(
        self,
        name: str,
        gender: Optional[str] = None,
        age: Optional[int] = None,
        ethnicity: Optional[str] = None,
        occupation: Optional[str] = None,
        style: str = "professional"
    ) -> str:
        """
        Generate an avatar based on persona characteristics.

        Args:
            name: Persona name (used for style hints)
            gender: Male, female, or non-binary
            age: Approximate age
            ethnicity: Ethnic background
            occupation: Job or profession
            style: "professional", "casual", or "artistic"

        Returns:
            Image URL
        """
        # Build descriptive prompt
        prompt_parts = ["portrait photo of a person"]

        if gender:
            prompt_parts.append(gender.lower())

        if age:
            if age < 25:
                prompt_parts.append("young adult")
            elif age < 40:
                prompt_parts.append("adult in their 30s")
            elif age < 55:
                prompt_parts.append("middle-aged")
            else:
                prompt_parts.append("older adult")

        if ethnicity:
            prompt_parts.append(ethnicity)

        if occupation:
            prompt_parts.append(f"working as {occupation}")

        # Style modifiers
        style_modifiers = {
            "professional": "professional headshot, business attire, clean background, high quality, sharp focus",
            "casual": "casual portrait, natural lighting, friendly expression, candid feel",
            "artistic": "artistic portrait, creative lighting, unique style, expressive"
        }

        prompt_parts.append(style_modifiers.get(style, style_modifiers["professional"]))

        prompt = ", ".join(prompt_parts)

        # Negative prompt for better quality
        negative_prompt = (
            "blurry, low quality, distorted, deformed, ugly, "
            "watermark, text, logo, cartoon, anime, illustration, "
            "multiple people, cropped, out of frame"
        )

        images = await self.generate_avatar(
            prompt=prompt,
            negative_prompt=negative_prompt,
            width=512,
            height=512,
            num_outputs=1
        )

        return images[0] if images else None

    async def generate_avatar_variations(
        self,
        base_prompt: str,
        num_variations: int = 4,
        seed_start: int = 42
    ) -> list[str]:
        """
        Generate multiple variations of an avatar.

        Args:
            base_prompt: Base description
            num_variations: Number of variations
            seed_start: Starting seed for reproducibility

        Returns:
            List of image URLs
        """
        tasks = []
        for i in range(num_variations):
            tasks.append(
                self.generate_avatar(
                    prompt=base_prompt,
                    seed=seed_start + i,
                    num_outputs=1
                )
            )

        results = await asyncio.gather(*tasks, return_exceptions=True)

        images = []
        for result in results:
            if isinstance(result, list) and result:
                images.append(result[0])
            elif isinstance(result, Exception):
                # Log but continue
                print(f"Variation generation failed: {result}")

        return images

    async def _create_prediction(self, model_version: str, input_params: dict) -> dict:
        """Create a new prediction on Replicate."""
        url = f"{self.BASE_URL}/predictions"

        headers = {
            "Authorization": f"Token {self.api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "version": model_version.split(":")[-1] if ":" in model_version else model_version,
            "input": input_params
        }

        # Handle model reference format
        if ":" in model_version:
            parts = model_version.split(":")
            payload["version"] = parts[-1]

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            return response.json()

    async def _wait_for_prediction(
        self,
        prediction_id: str,
        timeout: int = 300,
        poll_interval: float = 1.0
    ) -> dict:
        """Poll for prediction completion."""
        url = f"{self.BASE_URL}/predictions/{prediction_id}"

        headers = {
            "Authorization": f"Token {self.api_key}"
        }

        elapsed = 0
        async with httpx.AsyncClient(timeout=30.0) as client:
            while elapsed < timeout:
                response = await client.get(url, headers=headers)
                response.raise_for_status()
                data = response.json()

                status = data.get("status")
                if status in ("succeeded", "failed", "canceled"):
                    return data

                await asyncio.sleep(poll_interval)
                elapsed += poll_interval

        raise TimeoutError(f"Prediction {prediction_id} timed out after {timeout}s")

    async def upload_to_storage(self, image_url: str, filename: str) -> str:
        """
        Download image from Replicate and upload to permanent storage.

        This should be implemented to upload to your storage service
        (S3, Supabase Storage, etc.) since Replicate URLs expire.

        Args:
            image_url: Temporary Replicate URL
            filename: Desired filename

        Returns:
            Permanent storage URL
        """
        # Download the image
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(image_url)
            response.raise_for_status()
            image_bytes = response.content

        # TODO: Upload to permanent storage
        # For now, return the temporary URL
        # In production, implement upload to Supabase Storage or S3

        return image_url

    def get_style_presets(self) -> dict[str, dict]:
        """Get available avatar style presets."""
        return {
            "professional": {
                "name": "Professional",
                "description": "Clean headshot suitable for business profiles",
                "prompt_suffix": "professional headshot, business attire, clean background, studio lighting",
                "negative_prompt": "casual, messy, unprofessional"
            },
            "casual": {
                "name": "Casual",
                "description": "Relaxed, approachable portrait",
                "prompt_suffix": "casual portrait, natural lighting, outdoor setting, friendly smile",
                "negative_prompt": "formal, stiff, studio"
            },
            "creative": {
                "name": "Creative",
                "description": "Artistic portrait with unique style",
                "prompt_suffix": "artistic portrait, creative lighting, vibrant colors, unique style",
                "negative_prompt": "boring, standard, corporate"
            },
            "minimalist": {
                "name": "Minimalist",
                "description": "Simple, clean avatar with minimal background",
                "prompt_suffix": "minimalist portrait, solid color background, clean lines, simple",
                "negative_prompt": "busy, cluttered, complex background"
            }
        }
