"""Pydantic models for mood generation API."""
from typing import List, Optional
from pydantic import BaseModel, Field


class CreativeBriefInput(BaseModel):
    """Input model for creative brief."""
    product_name: str = Field(..., description="Name of the product")
    target_audience: str = Field(..., description="Target audience description")
    emotional_tone: List[str] = Field(..., description="List of emotional tones")
    visual_style_keywords: List[str] = Field(..., description="List of visual style keywords")
    key_messages: List[str] = Field(..., description="List of key messages")


class MoodImage(BaseModel):
    """Model for a single mood board image."""
    url: str = Field(..., description="URL of the generated image")
    prompt: str = Field(..., description="Prompt used to generate the image")
    success: bool = Field(..., description="Whether generation was successful")
    error: Optional[str] = Field(None, description="Error message if generation failed")


class Mood(BaseModel):
    """Model for a mood board."""
    id: str = Field(..., description="Unique identifier for the mood")
    name: str = Field(..., description="Name of the mood")
    description: str = Field(..., description="Description of the mood")
    style_keywords: List[str] = Field(..., description="Visual style keywords")
    color_palette: List[str] = Field(..., description="Color palette for the mood")
    aesthetic_direction: str = Field(..., description="Overall aesthetic direction")
    images: List[MoodImage] = Field(default_factory=list, description="Generated images for this mood")


class MoodGenerationResponse(BaseModel):
    """Response model for mood generation."""
    success: bool = Field(..., description="Whether generation was successful")
    moods: List[Mood] = Field(..., description="List of generated moods")
    message: Optional[str] = Field(None, description="Optional message about the generation")


class MoodGenerationError(BaseModel):
    """Error response model."""
    success: bool = Field(False, description="Always false for errors")
    error: str = Field(..., description="Error message")
    details: Optional[str] = Field(None, description="Additional error details")

