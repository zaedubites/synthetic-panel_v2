"""
Avatar API Router

Endpoints for AI avatar generation using Replicate.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.auth import get_current_user, TokenPayload
from app.services.avatar_service import AvatarService

router = APIRouter(prefix="/avatar", tags=["avatar"])


class GenerateAvatarRequest(BaseModel):
    """Request to generate an avatar from a prompt."""
    prompt: str
    negative_prompt: Optional[str] = None
    model: Optional[str] = None
    width: int = 512
    height: int = 512
    num_outputs: int = 1
    seed: Optional[int] = None


class GeneratePersonaAvatarRequest(BaseModel):
    """Request to generate an avatar for a persona."""
    name: str
    gender: Optional[str] = None
    age: Optional[int] = None
    ethnicity: Optional[str] = None
    occupation: Optional[str] = None
    style: str = "professional"


class GenerateVariationsRequest(BaseModel):
    """Request to generate avatar variations."""
    base_prompt: str
    num_variations: int = 4
    seed_start: int = 42


@router.post("/generate")
async def generate_avatar(
    request: GenerateAvatarRequest,
    current_user: TokenPayload = Depends(get_current_user)
):
    """
    Generate avatar images from a text prompt.

    Returns list of image URLs.
    """
    try:
        avatar_service = AvatarService()
        images = await avatar_service.generate_avatar(
            prompt=request.prompt,
            negative_prompt=request.negative_prompt,
            model=request.model,
            width=request.width,
            height=request.height,
            num_outputs=request.num_outputs,
            seed=request.seed
        )

        return {"images": images}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except TimeoutError as e:
        raise HTTPException(status_code=504, detail="Avatar generation timed out")
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to generate avatar")


@router.post("/generate/persona")
async def generate_persona_avatar(
    request: GeneratePersonaAvatarRequest,
    current_user: TokenPayload = Depends(get_current_user)
):
    """
    Generate an avatar based on persona characteristics.

    Returns a single image URL optimized for the persona.
    """
    try:
        avatar_service = AvatarService()
        image_url = await avatar_service.generate_persona_avatar(
            name=request.name,
            gender=request.gender,
            age=request.age,
            ethnicity=request.ethnicity,
            occupation=request.occupation,
            style=request.style
        )

        if not image_url:
            raise HTTPException(
                status_code=500,
                detail="Failed to generate persona avatar"
            )

        return {"image_url": image_url}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except TimeoutError as e:
        raise HTTPException(status_code=504, detail="Avatar generation timed out")
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to generate avatar")


@router.post("/generate/variations")
async def generate_avatar_variations(
    request: GenerateVariationsRequest,
    current_user: TokenPayload = Depends(get_current_user)
):
    """
    Generate multiple variations of an avatar.

    Useful for letting users choose from options.
    """
    try:
        avatar_service = AvatarService()
        images = await avatar_service.generate_avatar_variations(
            base_prompt=request.base_prompt,
            num_variations=request.num_variations,
            seed_start=request.seed_start
        )

        return {"images": images}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except TimeoutError as e:
        raise HTTPException(status_code=504, detail="Avatar generation timed out")
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to generate variations")


@router.get("/styles")
async def get_style_presets(
    current_user: TokenPayload = Depends(get_current_user)
):
    """
    Get available avatar style presets.
    """
    avatar_service = AvatarService()
    presets = avatar_service.get_style_presets()
    return {"presets": presets}
