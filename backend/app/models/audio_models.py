"""Pydantic models for audio generation API."""
from typing import Optional, List
from pydantic import BaseModel, Field


class AudioGenerationRequest(BaseModel):
    """Request model for audio generation from mood data."""
    mood_name: str = Field(..., description="Name of the mood (e.g., 'Energetic', 'Calm')")
    mood_description: str = Field(..., description="Detailed description of the mood")
    emotional_tone: List[str] = Field(..., description="List of emotional tones from creative brief")
    aesthetic_direction: str = Field(..., description="Overall aesthetic direction")
    style_keywords: Optional[List[str]] = Field(default=None, description="Optional list of visual style keywords")
    duration: int = Field(default=30, ge=1, description="Duration in seconds (default: 30)")
    custom_prompt: Optional[str] = Field(default=None, description="Optional custom prompt to use instead of building from fields")


class AudioGenerationResponse(BaseModel):
    """Response model for audio generation."""
    success: bool = Field(..., description="Whether generation was successful")
    audio_url: Optional[str] = Field(None, description="URL of the generated audio file")
    prompt: str = Field(..., description="The prompt used for generation")
    duration: int = Field(..., description="Actual duration of generated audio in seconds")
    error: Optional[str] = Field(None, description="Error message if generation failed")


class MoodAudioRequest(BaseModel):
    """Request model for generating audio for a selected mood."""
    mood_id: str = Field(..., description="Unique identifier of the selected mood")
    creative_brief: dict = Field(..., description="Creative brief data containing emotional tone and other context")
    duration: int = Field(default=30, ge=1, description="Duration in seconds (default: 30)")


class AudioGenerationError(BaseModel):
    """Error response model."""
    success: bool = Field(False, description="Always false for errors")
    error: str = Field(..., description="Error message")
    details: Optional[str] = Field(None, description="Additional error details")
