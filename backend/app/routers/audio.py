"""FastAPI router for audio generation endpoints."""
from fastapi import APIRouter, HTTPException

from app.models.audio_models import (
    AudioGenerationRequest,
    AudioGenerationResponse,
    MoodAudioRequest,
    AudioGenerationError
)
from app.services.audio_service import AudioGenerationService

router = APIRouter(prefix="/api/audio", tags=["audio"])

# Initialize service
audio_service = None  # Will be initialized on first request


def get_audio_service() -> AudioGenerationService:
    """Get or initialize audio generation service."""
    global audio_service
    if audio_service is None:
        try:
            audio_service = AudioGenerationService()
        except ValueError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Audio generation service not available: {str(e)}"
            )
    return audio_service


@router.post("/generate", response_model=AudioGenerationResponse)
async def generate_audio(
    request: AudioGenerationRequest
) -> AudioGenerationResponse:
    """
    Generate background music from mood and creative brief data.

    This endpoint:
    1. Builds a music generation prompt from mood characteristics
    2. Generates instrumental background music (variable duration)
    3. Returns the audio URL and generation metadata

    Args:
        request: Audio generation request with mood data and duration

    Returns:
        AudioGenerationResponse with audio URL and metadata
    """
    try:
        # Get audio service
        service = get_audio_service()

        # Use custom prompt if provided, otherwise build from structured fields
        if request.custom_prompt:
            result = await service.generate_music_with_custom_prompt(
                prompt=request.custom_prompt,
                duration=request.duration,
                max_retries=2
            )
        else:
            # Generate music with retry logic
            result = await service.generate_music_with_retry(
                mood_name=request.mood_name,
                mood_description=request.mood_description,
                emotional_tone=request.emotional_tone,
                aesthetic_direction=request.aesthetic_direction,
                style_keywords=request.style_keywords,
                duration=request.duration,
                max_retries=2
            )

        # Return response
        return AudioGenerationResponse(
            success=result["success"],
            audio_url=result["audio_url"],
            prompt=result["prompt"],
            duration=result["duration"],
            error=result["error"]
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error during audio generation: {str(e)}"
        )


@router.post("/generate-for-mood", response_model=AudioGenerationResponse)
async def generate_audio_for_mood(
    request: MoodAudioRequest
) -> AudioGenerationResponse:
    """
    Generate background music for a selected mood.

    This endpoint simplifies audio generation by accepting a mood ID and creative brief,
    then extracting the necessary data to generate appropriate background music.

    Args:
        request: Mood audio request with mood ID and creative brief

    Returns:
        AudioGenerationResponse with audio URL and metadata
    """
    try:
        # Extract mood and creative brief data
        mood_id = request.mood_id
        creative_brief = request.creative_brief
        duration = request.duration

        # Extract required fields from creative brief
        emotional_tone = creative_brief.get("emotional_tone", [])

        # For now, we'll need the mood data to be passed in the creative_brief
        # In a full implementation, you would fetch the mood from a database using mood_id
        mood_name = creative_brief.get("mood_name", "Unknown Mood")
        mood_description = creative_brief.get("mood_description", "")
        aesthetic_direction = creative_brief.get("aesthetic_direction", "")
        style_keywords = creative_brief.get("style_keywords", [])

        # Get audio service
        service = get_audio_service()

        # Generate music with retry logic
        result = await service.generate_music_with_retry(
            mood_name=mood_name,
            mood_description=mood_description,
            emotional_tone=emotional_tone,
            aesthetic_direction=aesthetic_direction,
            style_keywords=style_keywords,
            duration=duration,
            max_retries=2
        )

        # Return response
        return AudioGenerationResponse(
            success=result["success"],
            audio_url=result["audio_url"],
            prompt=result["prompt"],
            duration=result["duration"],
            error=result["error"]
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except KeyError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required field in creative brief: {str(e)}"
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error during audio generation: {str(e)}"
        )
