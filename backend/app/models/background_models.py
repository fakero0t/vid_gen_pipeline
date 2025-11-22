"""
Pydantic Models for Background Asset Upload and Generation
"""

from ..models.asset_models import AssetUploadResponse, AssetStatus
from typing import List, Optional
from pydantic import BaseModel, Field

# Background assets use the generic asset models
BackgroundAssetUploadResponse = AssetUploadResponse
BackgroundAssetStatus = AssetStatus


class BackgroundGenerationRequest(BaseModel):
    """Request model for generating background images from creative brief."""
    product_name: str = Field(..., description="Name of the product")
    target_audience: str = Field(..., description="Target audience description")
    emotional_tone: List[str] = Field(default_factory=list, description="List of emotional tones")
    visual_style_keywords: List[str] = Field(default_factory=list, description="List of visual style keywords")
    key_messages: List[str] = Field(default_factory=list, description="List of key messages")


class BackgroundGenerationResponse(BaseModel):
    """Response model for background generation."""
    success: bool = Field(..., description="Whether generation was successful")
    backgrounds: List[BackgroundAssetStatus] = Field(..., description="List of generated background assets")
    message: Optional[str] = Field(None, description="Optional message about the generation")

