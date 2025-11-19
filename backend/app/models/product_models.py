"""
Pydantic Models for Product Image Upload
"""

from pydantic import BaseModel, Field
from typing import Literal, Dict, Any, Optional

class ImageDimensions(BaseModel):
    """Image dimensions."""
    width: int = Field(..., description="Image width in pixels")
    height: int = Field(..., description="Image height in pixels")

class ProductImageUploadResponse(BaseModel):
    """Response from single product image upload."""
    product_id: str = Field(..., description="UUID for product")
    filename: str = Field(..., description="Original filename")
    url: str = Field(..., description="Accessible URL to product image")
    thumbnail_url: str = Field(..., description="URL to 512x512 thumbnail")
    size: int = Field(..., description="File size in bytes")
    dimensions: ImageDimensions = Field(..., description="Image dimensions")
    format: str = Field(..., description="png or jpg")
    has_alpha: bool = Field(..., description="Whether image has alpha channel")
    uploaded_at: str = Field(..., description="ISO timestamp")

class ProductImageStatus(BaseModel):
    """Status of uploaded product image."""
    product_id: str
    status: Literal["active", "deleted"]
    url: str
    thumbnail_url: str
    dimensions: ImageDimensions
    format: str
    has_alpha: bool
    metadata: Dict[str, Any]

