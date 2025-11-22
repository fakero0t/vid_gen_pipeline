"""Pydantic models for the Unified Storyboard Interface."""
from typing import List, Optional, Literal
from pydantic import BaseModel, Field
from datetime import datetime
import uuid
from app.models.mood_models import CreativeBriefInput


# ============================================================================
# Scene States and Status Types
# ============================================================================

SceneState = Literal["text", "image", "video"]
GenerationStatus = Literal["pending", "generating", "complete", "error"]


# ============================================================================
# Database Models (Data Layer)
# ============================================================================

class SceneGenerationStatus(BaseModel):
    """Status tracking for async image and video generation."""
    image: GenerationStatus = Field(default="pending", description="Image generation status")
    video: GenerationStatus = Field(default="pending", description="Video generation status")


class StoryboardScene(BaseModel):
    """Scene model for the unified storyboard interface."""
    # Identity
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique scene ID (UUID)")
    storyboard_id: str = Field(..., description="Foreign key to parent storyboard")

    # Current state
    state: SceneState = Field(default="text", description="Current scene state (text|image|video)")

    # Content
    text: str = Field(..., description="Scene description text")
    style_prompt: str = Field(..., description="Visual style prompt for image/video generation")
    image_url: Optional[str] = Field(default=None, description="URL of generated image")
    seed_image_urls: Optional[List[str]] = Field(default=None, description="Alternative seed images for regeneration")
    video_url: Optional[str] = Field(default=None, description="URL of generated video")
    video_duration: float = Field(default=5.0, description="Video duration in seconds", ge=1.0, le=8.0)
    
    # Product compositing (for product mode)
    use_product_composite: bool = Field(default=False, description="Whether to composite product into scene")
    product_id: Optional[str] = Field(default=None, description="Product ID to composite (if use_product_composite=True)")

    # Asset references (from project-level assets)
    brand_asset_id: Optional[str] = Field(default=None, description="Brand asset ID from project (first asset if multiple)")
    character_asset_id: Optional[str] = Field(default=None, description="Character asset ID from project (first asset if multiple)")
    background_asset_id: Optional[str] = Field(default=None, description="Background asset ID from project")

    # Generation tracking
    generation_status: SceneGenerationStatus = Field(default_factory=SceneGenerationStatus)
    error_message: Optional[str] = Field(default=None, description="Error message if generation fails")

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "storyboard_id": "660e8400-e29b-41d4-a716-446655440000",
                "state": "text",
                "text": "A runner sprints through a neon-lit cityscape at night",
                "style_prompt": "cyberpunk, neon lights, urban, high energy",
                "video_duration": 5.0,
                "generation_status": {
                    "image": "pending",
                    "video": "pending"
                }
            }
        }


class Storyboard(BaseModel):
    """Storyboard model containing metadata and scene ordering."""
    # Identity
    storyboard_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique storyboard ID (UUID)")
    project_id: Optional[str] = Field(default=None, description="Project ID this storyboard belongs to (for asset access)")

    # Content
    creative_brief: str = Field(..., description="Original creative brief text")
    selected_mood: dict = Field(..., description="Selected mood data (mood name, keywords, etc.)")
    scene_order: List[str] = Field(..., description="Ordered list of scene IDs", min_length=3, max_length=20)

    # Metadata
    total_duration: float = Field(default=30.0, description="Total video duration target in seconds")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "storyboard_id": "660e8400-e29b-41d4-a716-446655440000",
                "creative_brief": "Create a high-energy ad for a new running shoe...",
                "selected_mood": {
                    "mood_id": "modern_energetic",
                    "name": "Modern Energetic",
                    "style_keywords": ["dynamic", "bold", "vibrant"]
                },
                "scene_order": [
                    "550e8400-e29b-41d4-a716-446655440000",
                    "550e8400-e29b-41d4-a716-446655440001"
                ],
                "total_duration": 30.0
            }
        }


# ============================================================================
# API Request/Response Models
# ============================================================================

class StoryboardInitializeRequest(BaseModel):
    """Request to initialize a new storyboard with generated scene texts."""
    creative_brief: CreativeBriefInput = Field(..., description="Creative brief data")
    selected_mood: dict = Field(..., description="Selected mood data")
    project_id: Optional[str] = Field(default=None, description="Project ID for asset access")
    brand_asset_ids: Optional[List[str]] = Field(default=None, description="Brand asset IDs from project (uses first if multiple)")
    character_asset_ids: Optional[List[str]] = Field(default=None, description="Character asset IDs from project (uses first if multiple)")


class StoryboardInitializeResponse(BaseModel):
    """Response from storyboard initialization."""
    success: bool = Field(..., description="Whether initialization was successful")
    storyboard: Optional[Storyboard] = Field(None, description="Created storyboard")
    scenes: Optional[List[StoryboardScene]] = Field(None, description="Generated scenes")
    message: Optional[str] = Field(None, description="Status message")


class StoryboardGetResponse(BaseModel):
    """Response for getting a storyboard with all its scenes."""
    storyboard: Storyboard = Field(..., description="Storyboard data")
    scenes: List[StoryboardScene] = Field(..., description="All scenes in order")


class SceneTextUpdateRequest(BaseModel):
    """Request to update scene text."""
    text: str = Field(..., description="New scene text", min_length=10)


class SceneTextGenerateRequest(BaseModel):
    """Request to generate new scene text with AI."""
    creative_brief: CreativeBriefInput = Field(..., description="Creative brief for context")


class SceneDurationUpdateRequest(BaseModel):
    """Request to update scene duration."""
    duration: float = Field(..., description="New duration in seconds", ge=1.0, le=8.0)


class SceneUpdateResponse(BaseModel):
    """Response for scene update operations."""
    success: bool = Field(..., description="Whether update was successful")
    scene: Optional[StoryboardScene] = Field(None, description="Updated scene")
    message: Optional[str] = Field(None, description="Status message")


# ============================================================================
# Server-Sent Events (SSE) Models
# ============================================================================

class SSESceneUpdate(BaseModel):
    """Server-Sent Event model for scene generation updates."""
    scene_id: str = Field(..., description="Scene ID being updated")
    state: SceneState = Field(..., description="Current scene state")
    image_status: GenerationStatus = Field(..., description="Image generation status")
    video_status: GenerationStatus = Field(..., description="Video generation status")
    image_url: Optional[str] = Field(None, description="Image URL if generation complete")
    video_url: Optional[str] = Field(None, description="Video URL if generation complete")
    error: Optional[str] = Field(None, description="Error message if generation failed")


# ============================================================================
# Error Response Models
# ============================================================================

class ErrorResponse(BaseModel):
    """Standard error response model."""
    success: bool = Field(False, description="Always false for errors")
    error: str = Field(..., description="Error message")
    details: Optional[str] = Field(None, description="Additional error details")
