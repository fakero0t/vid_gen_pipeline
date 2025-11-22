"""
Background Asset Router

API endpoints for generating and managing background assets.
"""

from fastapi import APIRouter, HTTPException, status
from ..models.background_models import (
    BackgroundAssetUploadResponse,
    BackgroundAssetStatus,
    BackgroundGenerationRequest,
    BackgroundGenerationResponse
)
from ..services.background_service import get_background_service
from .base_asset_router import create_asset_router

# Create base router for standard asset operations (list, get, delete, upload)
router = create_asset_router(
    prefix="background",
    tag="background",
    service=get_background_service(),
    response_class=BackgroundAssetUploadResponse,
    asset_type_name="background"
)

# Add custom generate endpoint
@router.post("/generate", response_model=BackgroundGenerationResponse)
async def generate_backgrounds(
    creative_brief: BackgroundGenerationRequest
) -> BackgroundGenerationResponse:
    """
    Generate 6 background images from a creative brief.
    
    This endpoint:
    1. Generates 6 distinct background prompts using AI
    2. Generates 6 images in parallel using google/nano-banana-pro
    3. Saves each image as a background asset
    4. Returns list of background assets
    
    Args:
        creative_brief: Creative brief data containing product info, audience, etc.
    
    Returns:
        BackgroundGenerationResponse with 6 background assets
    """
    try:
        background_service = get_background_service()
        
        # Generate backgrounds from brief
        backgrounds = await background_service.generate_backgrounds_from_brief(creative_brief)
        
        # Count successful generations
        successful = len(backgrounds)
        total = 6
        
        message = f"Generated {successful}/{total} background images"
        if successful < total:
            message += f" ({total - successful} failed)"
        
        return BackgroundGenerationResponse(
            success=True,
            backgrounds=backgrounds,
            message=message
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error during background generation: {str(e)}"
        )

