"""API router for storyboard operations."""
from fastapi import APIRouter, HTTPException, status, BackgroundTasks
from fastapi.responses import StreamingResponse
from typing import AsyncGenerator, List, Optional
from pydantic import BaseModel, Field
from app.models.storyboard_models import (
    StoryboardInitializeRequest,
    StoryboardInitializeResponse,
    StoryboardGetResponse,
    SceneTextUpdateRequest,
    SceneTextGenerateRequest,
    SceneDurationUpdateRequest,
    SceneTrimUpdateRequest,
    SceneUpdateResponse,
    SSESceneUpdate,
    ErrorResponse,
)
from app.services.storyboard_service import storyboard_service
from app.services.product_service import get_product_service
from app.services.replicate_service import get_replicate_service
from app.services.metrics_service import get_composite_metrics
from app.services.brand_service import get_brand_service
from app.services.character_service import get_character_service
from app.database import db
from app.config import settings
import json
import asyncio
from datetime import datetime
import replicate
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/storyboards",
    tags=["storyboards"],
    responses={
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    }
)


# ============================================================================
# Storyboard Endpoints
# ============================================================================

@router.post("/initialize", response_model=StoryboardInitializeResponse)
async def initialize_storyboard(request: StoryboardInitializeRequest):
    """
    Initialize a new storyboard with AI-generated scene texts.

    This endpoint:
    1. Accepts creative brief and selected mood
    2. Generates 6 scene descriptions using OpenAI
    3. Creates a storyboard and scenes in the database
    4. Returns the storyboard with all scenes
    """
    try:
        storyboard, scenes = await storyboard_service.initialize_storyboard(request)

        return StoryboardInitializeResponse(
            success=True,
            storyboard=storyboard,
            scenes=scenes,
            message=f"Successfully initialized storyboard with {len(scenes)} scenes"
        )

    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error initializing storyboard: {str(e)}")
        print(f"Traceback: {error_trace}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initialize storyboard: {str(e)}"
        )


@router.get("/{storyboard_id}", response_model=StoryboardGetResponse)
async def get_storyboard(storyboard_id: str):
    """
    Get a storyboard with all its scenes.

    This endpoint is used for:
    - Page load / refresh recovery
    - Fetching latest state
    """
    try:
        storyboard, scenes = await storyboard_service.get_storyboard_with_scenes(storyboard_id)

        return StoryboardGetResponse(
            storyboard=storyboard,
            scenes=scenes
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve storyboard: {str(e)}"
        )


@router.post("/{storyboard_id}/regenerate-all", response_model=StoryboardInitializeResponse)
async def regenerate_all_scenes(storyboard_id: str):
    """
    Regenerate all scenes in a storyboard.

    WARNING: This erases all progress and generates new scene texts.
    """
    try:
        # Get existing storyboard
        storyboard = db.get_storyboard(storyboard_id)
        if not storyboard:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Storyboard {storyboard_id} not found"
            )

        # Delete existing scenes
        for scene_id in storyboard.scene_order:
            db.delete_scene(scene_id)

        # Generate new scenes
        # Note: storyboard.creative_brief is stored as a string, so we pass it directly
        # The service will handle both string and dict formats
        scene_texts = await storyboard_service.generate_scene_texts(
            creative_brief=storyboard.creative_brief,  # String format from database
            selected_mood=storyboard.selected_mood,
            num_scenes=6
        )

        # Create new scenes
        scenes = []
        for scene_data in scene_texts:
            from app.models.storyboard_models import StoryboardScene, SceneGenerationStatus
            scene = StoryboardScene(
                storyboard_id=storyboard.storyboard_id,
                state="text",
                text=scene_data["text"],
                style_prompt=scene_data["style_prompt"],
                video_duration=scene_data["duration"],
                generation_status=SceneGenerationStatus(
                    image="pending",
                    video="pending"
                )
            )
            scenes.append(scene)
            db.create_scene(scene)

        # Update storyboard with new scene order
        storyboard.scene_order = [scene.id for scene in scenes]
        storyboard.updated_at = datetime.utcnow()
        db.update_storyboard(storyboard_id, storyboard)

        return StoryboardInitializeResponse(
            success=True,
            storyboard=storyboard,
            scenes=scenes,
            message=f"Successfully regenerated {len(scenes)} scenes"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to regenerate scenes: {str(e)}"
        )


# ============================================================================
# Scene Text Endpoints
# ============================================================================

@router.put("/{storyboard_id}/scenes/{scene_id}/text", response_model=SceneUpdateResponse)
async def update_scene_text(storyboard_id: str, scene_id: str, request: SceneTextUpdateRequest):
    """
    Update scene text manually.

    This resets the scene to text state and clears image/video.
    """
    try:
        scene = await storyboard_service.update_scene_text(scene_id, request.text)

        return SceneUpdateResponse(
            success=True,
            scene=scene,
            message="Scene text updated successfully"
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update scene text: {str(e)}"
        )


@router.post("/{storyboard_id}/scenes/{scene_id}/text/generate", response_model=SceneUpdateResponse)
async def generate_scene_text(storyboard_id: str, scene_id: str, request: SceneTextGenerateRequest):
    """
    Regenerate scene text using AI.

    This generates new text based on the creative brief and resets the scene to text state.
    """
    try:
        scene = await storyboard_service.regenerate_scene_text(scene_id, request.creative_brief)

        return SceneUpdateResponse(
            success=True,
            scene=scene,
            message="Scene text regenerated successfully"
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to regenerate scene text: {str(e)}"
        )


# ============================================================================
# Scene Duration Endpoint
# ============================================================================

@router.put("/{storyboard_id}/scenes/{scene_id}/duration", response_model=SceneUpdateResponse)
async def update_scene_duration(storyboard_id: str, scene_id: str, request: SceneDurationUpdateRequest):
    """
    Update scene video duration.

    If the scene is in video state, this resets it to image state.
    """
    try:
        scene = await storyboard_service.update_scene_duration(scene_id, request.duration)

        return SceneUpdateResponse(
            success=True,
            scene=scene,
            message="Scene duration updated successfully"
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update scene duration: {str(e)}"
        )


# ============================================================================
# Scene Management Endpoints (Add, Remove, Reorder)
# ============================================================================

class AddSceneRequest(BaseModel):
    """Request to add a new scene."""
    position: Optional[int] = Field(None, description="Position to insert scene (None = end)")


class ReorderScenesRequest(BaseModel):
    """Request to reorder scenes."""
    scene_order: List[str] = Field(..., description="New ordered list of scene IDs")


@router.post("/{storyboard_id}/scenes", response_model=StoryboardGetResponse)
async def add_scene(storyboard_id: str, request: AddSceneRequest):
    """
    Add a new scene to the storyboard.
    
    Auto-generates AI text using the storyboard's creative brief and mood.
    Scene is added at the specified position (default: end).
    """
    try:
        storyboard, scenes = await storyboard_service.add_scene(
            storyboard_id=storyboard_id,
            position=request.position
        )
        
        return StoryboardGetResponse(
            storyboard=storyboard,
            scenes=scenes
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add scene: {str(e)}"
        )


@router.delete("/{storyboard_id}/scenes/{scene_id}", response_model=StoryboardGetResponse)
async def remove_scene(storyboard_id: str, scene_id: str):
    """
    Remove a scene from the storyboard.
    
    Validates minimum 3 scenes before deletion.
    """
    try:
        storyboard, scenes = await storyboard_service.remove_scene(
            storyboard_id=storyboard_id,
            scene_id=scene_id
        )
        
        return StoryboardGetResponse(
            storyboard=storyboard,
            scenes=scenes
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to remove scene: {str(e)}"
        )


@router.put("/{storyboard_id}/scenes/reorder", response_model=StoryboardGetResponse)
async def reorder_scenes(storyboard_id: str, request: ReorderScenesRequest):
    """
    Reorder scenes in the storyboard.
    
    Validates all scene IDs exist and belong to the storyboard.
    """
    try:
        storyboard, scenes = await storyboard_service.reorder_scenes(
            storyboard_id=storyboard_id,
            new_scene_order=request.scene_order
        )
        
        return StoryboardGetResponse(
            storyboard=storyboard,
            scenes=scenes
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reorder scenes: {str(e)}"
        )


# ============================================================================
# Scene Status Endpoint (for polling fallback)
# ============================================================================

@router.get("/{storyboard_id}/scenes/{scene_id}/status", response_model=SceneUpdateResponse)
async def get_scene_status(storyboard_id: str, scene_id: str):
    """
    Get current scene status.

    Used for polling fallback when SSE is not available.
    """
    try:
        scene = db.get_scene(scene_id)
        if not scene:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scene {scene_id} not found"
            )

        return SceneUpdateResponse(
            success=True,
            scene=scene,
            message="Scene status retrieved successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get scene status: {str(e)}"
        )


# ============================================================================
# Product Composite Endpoints
# ============================================================================

class EnableProductCompositeRequest(BaseModel):
    """Request to enable product compositing for a scene."""
    product_id: str


@router.post("/{storyboard_id}/scenes/{scene_id}/product-composite")
async def enable_product_composite(
    storyboard_id: str,
    scene_id: str,
    request: EnableProductCompositeRequest
):
    """
    Enable product compositing for a scene.
    
    This marks the scene to include the product in image generation.
    If the scene already has an image, it will need to be regenerated.
    """
    # Check if product mode is enabled
    if not settings.is_product_mode():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Product compositing not available in NeRF mode"
        )
    
    try:
        # Validate product exists
        product_service = get_product_service()
        product = product_service.get_product_image(request.product_id)
        
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product {request.product_id} not found"
            )
        
        # Get scene
        scene = db.get_scene(scene_id)
        if not scene:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scene {scene_id} not found"
            )
        
        # Update scene
        scene.use_product_composite = True
        scene.product_id = request.product_id
        
        # If scene already has an image, mark for regeneration
        if scene.image_url:
            scene.generation_status.image = "pending"
            scene.image_url = None
        
        # Save scene
        db.update_scene(scene_id, scene)
        
        return {
            "success": True,
            "scene": scene,
            "message": "Product compositing enabled"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to enable product composite: {str(e)}"
        )


@router.delete("/{storyboard_id}/scenes/{scene_id}/product-composite")
async def disable_product_composite(
    storyboard_id: str,
    scene_id: str
):
    """
    Disable product compositing for a scene.
    
    Removes product from the scene. If the scene has an image with product,
    it will need to be regenerated.
    """
    try:
        # Get scene
        scene = db.get_scene(scene_id)
        if not scene:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scene {scene_id} not found"
            )
        
        # Update scene
        scene.use_product_composite = False
        scene.product_id = None
        
        # If scene has an image, mark for regeneration
        if scene.image_url:
            scene.generation_status.image = "pending"
            scene.image_url = None
        
        # Save scene
        db.update_scene(scene_id, scene)
        
        return {
            "success": True,
            "scene": scene,
            "message": "Product compositing disabled"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to disable product composite: {str(e)}"
        )


# ============================================================================
# Asset Toggle Endpoints
# ============================================================================

class EnableBrandAssetRequest(BaseModel):
    """Request to enable brand asset for a scene."""
    brand_asset_id: str


class EnableCharacterAssetRequest(BaseModel):
    """Request to enable character asset for a scene."""
    character_asset_id: str


class EnableBackgroundAssetRequest(BaseModel):
    """Request to enable background asset for a scene."""
    background_asset_id: str


@router.post("/{storyboard_id}/scenes/{scene_id}/brand-asset")
async def enable_brand_asset(
    storyboard_id: str,
    scene_id: str,
    request: EnableBrandAssetRequest
):
    """
    Enable brand asset for a scene.
    
    This marks the scene to include the brand asset in image generation.
    If the scene already has an image, it will need to be regenerated.
    """
    try:
        # Validate brand asset exists
        brand_service = get_brand_service()
        brand_asset = brand_service.get_brand_asset(request.brand_asset_id)
        
        if not brand_asset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Brand asset {request.brand_asset_id} not found"
            )
        
        # Get scene
        scene = db.get_scene(scene_id)
        if not scene:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scene {scene_id} not found"
            )
        
        # Update scene
        scene.brand_asset_id = request.brand_asset_id
        
        # If scene already has an image, mark for regeneration
        if scene.image_url:
            scene.generation_status.image = "pending"
            scene.image_url = None
        
        # Save scene
        db.update_scene(scene_id, scene)
        
        return {
            "success": True,
            "scene": scene,
            "message": "Brand asset enabled"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to enable brand asset: {str(e)}"
        )


@router.delete("/{storyboard_id}/scenes/{scene_id}/brand-asset")
async def disable_brand_asset(
    storyboard_id: str,
    scene_id: str
):
    """
    Disable brand asset for a scene.
    
    Removes brand asset from the scene. If the scene has an image with brand asset,
    it will need to be regenerated.
    """
    try:
        # Get scene
        scene = db.get_scene(scene_id)
        if not scene:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scene {scene_id} not found"
            )
        
        # Update scene
        scene.brand_asset_id = None
        
        # If scene has an image, mark for regeneration
        if scene.image_url:
            scene.generation_status.image = "pending"
            scene.image_url = None
        
        # Save scene
        db.update_scene(scene_id, scene)
        
        return {
            "success": True,
            "scene": scene,
            "message": "Brand asset disabled"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to disable brand asset: {str(e)}"
        )


@router.post("/{storyboard_id}/scenes/{scene_id}/character-asset")
async def enable_character_asset(
    storyboard_id: str,
    scene_id: str,
    request: EnableCharacterAssetRequest
):
    """
    Enable character asset for a scene.
    
    This marks the scene to include the character asset in image generation.
    If the scene already has an image, it will need to be regenerated.
    """
    try:
        # Validate character asset exists
        character_service = get_character_service()
        character_asset = character_service.get_character_asset(request.character_asset_id)
        
        if not character_asset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Character asset {request.character_asset_id} not found"
            )
        
        # Get scene
        scene = db.get_scene(scene_id)
        if not scene:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scene {scene_id} not found"
            )
        
        # Update scene
        scene.character_asset_id = request.character_asset_id
        
        # If scene already has an image, mark for regeneration
        if scene.image_url:
            scene.generation_status.image = "pending"
            scene.image_url = None
        
        # Save scene
        db.update_scene(scene_id, scene)
        
        return {
            "success": True,
            "scene": scene,
            "message": "Character asset enabled"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to enable character asset: {str(e)}"
        )


@router.post("/{storyboard_id}/scenes/{scene_id}/background-asset")
async def enable_background_asset(
    storyboard_id: str,
    scene_id: str,
    request: EnableBackgroundAssetRequest
):
    """
    Enable background asset for a scene.
    
    This marks the scene to include the background asset in image generation.
    If the scene already has an image, it will need to be regenerated.
    """
    try:
        # Validate background asset exists
        from ..services.background_service import get_background_service
        background_service = get_background_service()
        background_asset = background_service.get_asset(request.background_asset_id)
        
        if not background_asset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Background asset {request.background_asset_id} not found"
            )
        
        # Get scene
        scene = db.get_scene(scene_id)
        if not scene:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scene {scene_id} not found"
            )
        
        # Update scene
        scene.background_asset_id = request.background_asset_id
        
        # If scene already has an image, mark for regeneration
        if scene.image_url:
            scene.generation_status.image = "pending"
            scene.image_url = None
        
        # Save scene
        db.update_scene(scene_id, scene)
        
        return {
            "success": True,
            "scene": scene,
            "message": "Background asset enabled"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to enable background asset: {str(e)}"
        )


@router.delete("/{storyboard_id}/scenes/{scene_id}/background-asset")
async def disable_background_asset(
    storyboard_id: str,
    scene_id: str
):
    """
    Disable background asset for a scene.
    
    Removes background asset from the scene. If the scene has an image with background asset,
    it will need to be regenerated.
    """
    try:
        # Get scene
        scene = db.get_scene(scene_id)
        if not scene:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scene {scene_id} not found"
            )
        
        # Update scene
        scene.background_asset_id = None
        
        # If scene has an image, mark for regeneration
        if scene.image_url:
            scene.generation_status.image = "pending"
            scene.image_url = None
        
        # Save scene
        db.update_scene(scene_id, scene)
        
        return {
            "success": True,
            "scene": scene,
            "message": "Background asset disabled"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to disable background asset: {str(e)}"
        )


@router.delete("/{storyboard_id}/scenes/{scene_id}/character-asset")
async def disable_character_asset(
    storyboard_id: str,
    scene_id: str
):
    """
    Disable character asset for a scene.
    
    Removes character asset from the scene. If the scene has an image with character asset,
    it will need to be regenerated.
    """
    try:
        # Get scene
        scene = db.get_scene(scene_id)
        if not scene:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scene {scene_id} not found"
            )
        
        # Update scene
        scene.character_asset_id = None
        
        # If scene has an image, mark for regeneration
        if scene.image_url:
            scene.generation_status.image = "pending"
            scene.image_url = None
        
        # Save scene
        db.update_scene(scene_id, scene)
        
        return {
            "success": True,
            "scene": scene,
            "message": "Character asset disabled"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to disable character asset: {str(e)}"
        )


# ============================================================================
# Image Generation Endpoints
# ============================================================================

async def generate_image_task(scene_id: str):
    """Background task to generate image using Replicate with webhooks."""
    print(f"\n{'='*80}")
    print(f"[Image Generation] 🎨 STARTING IMAGE GENERATION (WEBHOOK MODE)")
    print(f"{'='*80}")
    print(f"[Image Generation] Scene ID: {scene_id}")
    
    try:
        scene = db.get_scene(scene_id)
        if not scene:
            print(f"[Image Generation] ❌ ERROR: Scene {scene_id} not found")
            return

        print(f"[Image Generation] Scene found:")
        print(f"  - Storyboard ID: {scene.storyboard_id}")
        print(f"  - Brand Asset ID: {scene.brand_asset_id or '(none)'}")
        print(f"  - Character Asset ID: {scene.character_asset_id or '(none)'}")
        print(f"  - Background Asset ID: {scene.background_asset_id or '(none)'}")
        print(f"  - Product Composite: {scene.use_product_composite}")

        # Update status to generating
        scene.generation_status.image = "generating"
        db.update_scene(scene_id, scene)
        print(f"[Image Generation] Status updated to 'generating'")
        
        # Get webhook URL for Replicate callbacks
        webhook_url = settings.get_webhook_url()
        print(f"[Image Generation] Webhook URL: {webhook_url}")

        # Get Replicate token
        replicate_token = settings.get_replicate_token()
        if not replicate_token:
            # No API key - use placeholder
            print(f"[Image Generation] No Replicate token, using placeholder for scene {scene_id}")
            scene.generation_status.image = "complete"
            scene.image_url = f"https://via.placeholder.com/1920x1080/000000/FFFFFF?text=Scene+{scene_id[:8]}"
            scene.state = "image"
            db.update_scene(scene_id, scene)
            print(f"[Image Generation] Placeholder image set for scene {scene_id}")
            return

        # Determine which generation path to use
        print(f"\n[Image Generation] 🔀 DETERMINING GENERATION PATH:")
        if scene.use_product_composite and scene.product_id:
            print(f"  → Using PRODUCT COMPOSITE path")
            # Product compositing path
            print(f"[Image Generation] Product compositing enabled for scene {scene_id}")
            
            # Get product service
            product_service = get_product_service()
            product = product_service.get_product_image(scene.product_id)
            
            if not product:
                raise Exception(f"Product {scene.product_id} not found")
            
            # Get product image path (full path)
            product_image_path = product_service.get_product_image_path(scene.product_id, thumbnail=False)
            
            if not product_image_path:
                raise Exception(f"Product image file not found for {scene.product_id}")
            
            # Use Replicate service to generate scene with product
            replicate_service = get_replicate_service()
            
            # Choose method based on feature flag
            use_kontext = settings.USE_KONTEXT_COMPOSITE and settings.COMPOSITE_METHOD == "kontext"
            
            if use_kontext:
                print(f"[Image Generation] Using Kontext composite method (webhook)")
                # For now, Kontext composite with webhooks requires breaking down into steps
                # TODO: Implement webhook-based Kontext composite
                # For now, fall back to synchronous call
                logger.warning("Kontext composite not yet implemented with webhooks, using blocking call")
                image_url = await replicate_service.generate_scene_with_kontext_composite(
                    scene_text=scene.text,
                    style_prompt=scene.style_prompt,
                    product_image_path=str(product_image_path),
                    width=1920,
                    height=1080
                )
                print(f"[Image Generation] Kontext composite completed")
            else:
                print(f"[Image Generation] Using PIL composite method (webhook)")
                # For PIL composite, also use blocking for now as it requires multiple steps
                # TODO: Implement webhook-based PIL composite
                logger.warning("PIL composite not yet implemented with webhooks, using blocking call")
                image_url = await replicate_service.generate_scene_with_product(
                    scene_text=scene.text,
                    style_prompt=scene.style_prompt,
                    product_image_path=str(product_image_path),
                    width=1920,
                    height=1080
                )
                print(f"[Image Generation] PIL composite completed")
        elif scene.brand_asset_id or scene.character_asset_id or scene.background_asset_id:
            logger.info(f"  → Using ASSET-BASED path (nano-banana-pro, {'webhook' if settings.use_webhooks() else 'blocking'})")
            # Asset-based generation using nano-banana-pro
            logger.info("="*80)
            logger.info(f"🎨 ASSET-BASED GENERATION USING google/nano-banana-pro ({'WEBHOOK' if settings.use_webhooks() else 'BLOCKING'})")
            logger.info("="*80)
            logger.info(f"Scene ID: {scene_id}")
            logger.info(f"Storyboard ID: {scene.storyboard_id}")
            
            # Log Scene Description
            logger.info("📝 SCENE DESCRIPTION:")
            logger.info(f"  Text: {scene.text}")
            logger.info(f"  Style Prompt: {scene.style_prompt}")
            
            replicate_service = get_replicate_service()
            brand_service = get_brand_service()
            character_service = get_character_service()
            from ..services.background_service import get_background_service
            background_service = get_background_service()
            
            # Get asset image URLs and metadata
            brand_asset_image_url = None
            brand_asset_filename = None
            character_asset_image_url = None
            character_asset_filename = None
            background_asset_image_url = None
            background_asset_filename = None
            
            if scene.brand_asset_id:
                logger.info("🏷️  BRAND ASSET:")
                logger.info(f"  Asset ID: {scene.brand_asset_id}")
                brand_asset = brand_service.get_brand_asset(scene.brand_asset_id)
                if brand_asset:
                    # Try to get public URL, upload to Firebase Storage if missing
                    brand_asset_image_url = brand_asset.public_url
                    if not brand_asset_image_url:
                        logger.warning(f"  ⚠️  Brand asset missing public_url, attempting Firebase Storage upload...")
                        try:
                            from ..services.firebase_storage_service import get_firebase_storage_service
                            storage_service = get_firebase_storage_service()
                            if storage_service:
                                asset_path = brand_service.get_asset_path(scene.brand_asset_id, thumbnail=False)
                                if asset_path and asset_path.exists():
                                    brand_asset_image_url = storage_service.upload_image(asset_path, folder="assets/brands")
                                    if brand_asset_image_url:
                                        logger.info(f"  ✓ Successfully uploaded brand asset to Firebase Storage: {brand_asset_image_url}")
                                        # Update metadata with new public_url
                                        import json
                                        metadata_path = brand_service.upload_dir / scene.brand_asset_id / "metadata.json"
                                        if metadata_path.exists():
                                            with open(metadata_path, 'r') as f:
                                                metadata = json.load(f)
                                            metadata['public_url'] = brand_asset_image_url
                                            with open(metadata_path, 'w') as f:
                                                json.dump(metadata, f, indent=2)
                                    else:
                                        logger.warning(f"  ⚠️  Firebase Storage upload failed, will use localhost URL")
                                else:
                                    logger.warning(f"  ⚠️  Brand asset file not found at {asset_path}")
                        except Exception as e:
                            logger.warning(f"  ⚠️  Error uploading brand asset to Firebase Storage: {e}")
                    
                    # Fall back to localhost URL if still no public URL
                    if not brand_asset_image_url:
                        brand_asset_image_url = settings.to_full_url(brand_asset.url)
                        logger.info(f"  ⚠️  Using localhost URL (will be converted to base64): {brand_asset_image_url}")
                    
                    brand_asset_filename = brand_asset.metadata.get("filename", "brand asset")
                    logger.info(f"  Filename: {brand_asset_filename}")
                    logger.info(f"  Final URL: {brand_asset_image_url[:100] if len(brand_asset_image_url) > 100 else brand_asset_image_url}")
                    logger.info(f"  Using public URL: {bool(brand_asset.public_url)}")
                else:
                    logger.warning(f"  ⚠️  WARNING: Brand asset {scene.brand_asset_id} not found")
            
            if scene.character_asset_id:
                logger.info("👤 CHARACTER ASSET:")
                logger.info(f"  Asset ID: {scene.character_asset_id}")
                character_asset = character_service.get_character_asset(scene.character_asset_id)
                if character_asset:
                    # Use public URL if available (for external APIs), otherwise fall back to full URL
                    character_asset_image_url = character_asset.public_url or settings.to_full_url(character_asset.url)
                    character_asset_filename = character_asset.metadata.get("filename", "character asset")
                    logger.info(f"  Filename: {character_asset_filename}")
                    logger.info(f"  URL: {character_asset_image_url}")
                    logger.info(f"  Using public URL: {bool(character_asset.public_url)}")
                else:
                    logger.warning(f"  ⚠️  WARNING: Character asset {scene.character_asset_id} not found")
            
            if scene.background_asset_id:
                logger.info("🖼️  BACKGROUND ASSET:")
                logger.info(f"  Asset ID: {scene.background_asset_id}")
                background_asset = background_service.get_asset(scene.background_asset_id)
                if background_asset:
                    # Use public URL if available (for external APIs), otherwise fall back to full URL
                    background_asset_image_url = background_asset.public_url or settings.to_full_url(background_asset.url)
                    background_asset_filename = background_asset.metadata.get("filename", "background asset")
                    logger.info(f"  Filename: {background_asset_filename}")
                    logger.info(f"  URL: {background_asset_image_url}")
                    logger.info(f"  Using public URL: {bool(background_asset.public_url)}")
                else:
                    logger.warning(f"  ⚠️  WARNING: Background asset {scene.background_asset_id} not found")
            
            # Generate image with assets using nano-banana-pro
            # 16:9 aspect ratio, 1K resolution (1920x1080), PNG format
            
            if settings.use_webhooks():
                # WEBHOOK MODE: Create prediction and return immediately
                logger.info("🚀 Creating webhook-based prediction for asset generation...")
                
                # Prepare input parameters for nano-banana-pro
                # Build comprehensive prompt
                prompt = f"{scene.text}. {scene.style_prompt}. landscape orientation, horizontal composition."
                
                # Prepare control images array
                control_images = []
                if brand_asset_image_url:
                    if brand_asset_image_url.startswith("http"):
                        control_images.append(brand_asset_image_url)
                    else:
                        # Convert to base64 if local file
                        control_images.append(await replicate_service._image_to_base64_url(brand_asset_image_url))
                
                if character_asset_image_url:
                    if character_asset_image_url.startswith("http"):
                        control_images.append(character_asset_image_url)
                    else:
                        control_images.append(await replicate_service._image_to_base64_url(character_asset_image_url))
                
                if background_asset_image_url:
                    if background_asset_image_url.startswith("http"):
                        control_images.append(background_asset_image_url)
                    else:
                        control_images.append(await replicate_service._image_to_base64_url(background_asset_image_url))
                
                input_params = {
                    "prompt": prompt,
                    "resolution": "1K",
                    "aspect_ratio": "16:9",
                    "image_input": control_images,
                    "output_format": "png",
                    "safety_filter_level": "block_only_high"
                }
                
                # Create prediction with webhook
                prediction_id = await replicate_service.create_prediction_with_webhook(
                    model="google/nano-banana-pro",
                    input_params=input_params,
                    webhook_url=webhook_url
                )
                
                # Store prediction ID in scene
                scene.replicate_image_prediction_id = prediction_id
                db.update_scene(scene_id, scene)
                
                logger.info(f"✅ Prediction created with ID: {prediction_id}")
                logger.info("   Webhook will be called when generation completes")
                logger.info("="*80)
                
                # Return immediately - webhook will handle completion
                return
            
            else:
                # BLOCKING MODE: Generate and wait for result (local dev)
                logger.info("🚀 Generating image with assets (blocking mode for local dev)...")
                
                # Use the existing generate_scene_with_assets method (blocking)
                image_url = await replicate_service.generate_scene_with_assets(
                    scene_text=scene.text,
                    style_prompt=scene.style_prompt,
                    brand_asset_image_url=brand_asset_image_url,
                    character_asset_image_url=character_asset_image_url,
                    background_asset_image_url=background_asset_image_url,
                    brand_asset_filename=brand_asset_filename,
                    character_asset_filename=character_asset_filename,
                    background_asset_filename=background_asset_filename,
                    width=1920,
                    height=1080
                )
                logger.info(f"✅ Image generated: {image_url}")
                logger.info("="*80)
        
        else:
            logger.info(f"  → Using STANDARD path (nano-banana-pro, {'webhook' if settings.use_webhooks() else 'blocking'})")
            # Standard scene generation using nano-banana-pro (no assets)
            logger.info("="*80)
            logger.info(f"🍌 GENERATING SCENE USING google/nano-banana-pro (NO ASSETS, {'WEBHOOK' if settings.use_webhooks() else 'BLOCKING'})")
            logger.info("="*80)
            
            # Initialize replicate service
            replicate_service = get_replicate_service()
            
            if settings.use_webhooks():
                # WEBHOOK MODE: Create prediction and return immediately
                logger.info("🚀 Creating webhook-based prediction for standard generation...")
                
                # Prepare input parameters for nano-banana-pro
                prompt = f"{scene.text}. {scene.style_prompt}. landscape orientation, horizontal composition."
                
                input_params = {
                    "prompt": prompt,
                    "resolution": "1K",
                    "aspect_ratio": "16:9",
                    "image_input": [],  # No control images
                    "output_format": "png",
                    "safety_filter_level": "block_only_high"
                }
                
                # Create prediction with webhook
                prediction_id = await replicate_service.create_prediction_with_webhook(
                    model="google/nano-banana-pro",
                    input_params=input_params,
                    webhook_url=webhook_url
                )
                
                # Store prediction ID in scene
                scene.replicate_image_prediction_id = prediction_id
                db.update_scene(scene_id, scene)
                
                logger.info(f"✅ Prediction created with ID: {prediction_id}")
                logger.info("   Webhook will be called when generation completes")
                logger.info("="*80)
                
                # Return immediately - webhook will handle completion
                return
            
            else:
                # BLOCKING MODE: Generate and wait for result (local dev)
                logger.info("🚀 Generating standard scene (blocking mode for local dev)...")
                
                # Use the existing generate_scene_with_assets method with no assets (blocking)
                image_url = await replicate_service.generate_scene_with_assets(
                    scene_text=scene.text,
                    style_prompt=scene.style_prompt,
                    brand_asset_image_url=None,
                    character_asset_image_url=None,
                    background_asset_image_url=None,
                    brand_asset_filename=None,
                    character_asset_filename=None,
                    background_asset_filename=None,
                    width=1920,
                    height=1080
                )
                logger.info(f"✅ Image generated: {image_url}")
                logger.info("="*80)
        
        # Persist and update scene if we have an image URL
        # Webhook mode: already returned early (webhook handles completion)
        # Blocking mode: falls through to here with image_url set
        if 'image_url' in locals() and image_url:
            # Persist image to Firebase Storage (common for both paths)
            print(f"[Image Generation] Persisting scene image to Firebase Storage...")
            logger.info("Persisting scene image to Firebase Storage...")
            image_url = replicate_service.persist_replicate_image(image_url, folder="scenes")
            
            # Update scene with result (common for both paths)
            # Update scene with image URL (now permanent Firebase URL)
            scene.image_url = image_url
            scene.generation_status.image = "complete"
            scene.state = "image"
            scene.error_message = None

            db.update_scene(scene_id, scene)
            print(f"[Image Generation] Successfully updated scene {scene_id} with image")
            print(f"[Image Generation] Scene state after update: {scene.state}")
            print(f"[Image Generation] Scene image_url after update: {scene.image_url}")
            print(f"[Image Generation] Scene generation_status.image after update: {scene.generation_status.image}")
            
            # Verify the scene was saved correctly
            verified_scene = db.get_scene(scene_id)
            if verified_scene:
                print(f"[Image Generation] Verified saved scene: state={verified_scene.state}, image_url={verified_scene.image_url}, status={verified_scene.generation_status.image}")
            else:
                print(f"[Image Generation] ERROR: Scene {scene_id} not found after update!")

    except Exception as e:
        # Update scene with error
        print(f"[Image Generation] Error generating image for scene {scene_id}: {str(e)}")
        import traceback
        print(f"[Image Generation] Traceback: {traceback.format_exc()}")
        scene = db.get_scene(scene_id)
        if scene:
            scene.generation_status.image = "error"
            scene.error_message = f"Image generation failed: {str(e)}"
            db.update_scene(scene_id, scene)
            print(f"[Image Generation] Updated scene {scene_id} with error status")


@router.post("/{storyboard_id}/scenes/{scene_id}/image/generate", response_model=SceneUpdateResponse)
async def generate_scene_image(
    storyboard_id: str,
    scene_id: str,
    background_tasks: BackgroundTasks
):
    """
    Approve text and generate image for a scene.

    This starts async image generation using Replicate.
    """
    try:
        scene = db.get_scene(scene_id)
        if not scene:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scene {scene_id} not found"
            )

        # Start image generation in background
        print(f"[Image Generation] Adding background task for scene {scene_id}")
        background_tasks.add_task(generate_image_task, scene_id)
        print(f"[Image Generation] Background task added for scene {scene_id}")

        # Return immediately with generating status
        scene.generation_status.image = "generating"
        db.update_scene(scene_id, scene)
        print(f"[Image Generation] Endpoint returning with 'generating' status for scene {scene_id}")

        return SceneUpdateResponse(
            success=True,
            scene=scene,
            message="Image generation started"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start image generation: {str(e)}"
        )


@router.post("/{storyboard_id}/scenes/{scene_id}/image/regenerate", response_model=SceneUpdateResponse)
async def regenerate_scene_image(
    storyboard_id: str,
    scene_id: str,
    background_tasks: BackgroundTasks
):
    """
    Regenerate image for a scene.

    This cancels any existing generation, clears the image, and starts new generation.
    """
    try:
        scene = db.get_scene(scene_id)
        if not scene:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scene {scene_id} not found"
            )

        # Cancel existing prediction if any
        if scene.replicate_image_prediction_id:
            print(f"[Image Regeneration] Canceling existing prediction: {scene.replicate_image_prediction_id}")
            from app.services.replicate_service import get_replicate_service
            replicate_service = get_replicate_service()
            await replicate_service.cancel_prediction(scene.replicate_image_prediction_id)
            scene.replicate_image_prediction_id = None

        # Reset image state
        scene.image_url = None
        scene.generation_status.image = "generating"
        db.update_scene(scene_id, scene)

        # Start image generation in background
        background_tasks.add_task(generate_image_task, scene_id)

        return SceneUpdateResponse(
            success=True,
            scene=scene,
            message="Image regeneration started"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start image regeneration: {str(e)}"
        )


# ============================================================================
# Video Generation Endpoints
# ============================================================================

async def generate_video_task(scene_id: str):
    """Background task to generate video using Replicate."""
    print(f"\n{'='*80}")
    print(f"[Video Generation] Starting video generation for scene {scene_id} ({'WEBHOOK' if settings.use_webhooks() else 'BLOCKING'} MODE)")
    print(f"{'='*80}")
    
    try:
        scene = db.get_scene(scene_id)
        if not scene:
            print(f"[Video Generation] ERROR: Scene {scene_id} not found")
            return

        print(f"[Video Generation] Scene details:")
        print(f"  - Storyboard ID: {scene.storyboard_id}")
        print(f"  - Scene text: {scene.text[:100]}...")
        print(f"  - Video duration: {scene.video_duration}s")
        print(f"  - Image URL: {scene.image_url}")

        # Update status to generating
        scene.generation_status.video = "generating"
        db.update_scene(scene_id, scene)
        print(f"[Video Generation] Status updated to 'generating'")

        # Get Replicate token
        replicate_token = settings.get_replicate_token()
        if not replicate_token:
            print(f"[Video Generation] WARNING: No Replicate token found, using placeholder")
            scene.generation_status.video = "complete"
            scene.video_url = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
            scene.state = "video"
            db.update_scene(scene_id, scene)
            print(f"[Video Generation] Placeholder video set")
            return

        if not scene.image_url:
            print(f"[Video Generation] ERROR: No image URL found for scene {scene_id}")
            scene.generation_status.video = "error"
            scene.error_message = "Cannot generate video without an image"
            db.update_scene(scene_id, scene)
            return

        # Generate video using Replicate with webhook (image-to-video model)
        # Using ByteDance SeeDance-1 Pro Fast - supports longer videos
        print(f"[Video Generation] Initializing Replicate service")
        from app.services.replicate_service import get_replicate_service
        replicate_service = get_replicate_service()
        
        # Convert relative image URL to full URL for Replicate API
        full_image_url = settings.to_full_url(scene.image_url)
        print(f"[Video Generation] Image URL: {full_image_url[:100]}...")
        
        # For localhost URLs, Replicate can't access them, so we need to convert to base64
        # This is necessary for local development
        if "localhost" in full_image_url or "127.0.0.1" in full_image_url:
            print(f"[Video Generation] Detected localhost URL, converting to base64")
            # Extract the local file path from the URL
            # e.g., http://localhost:8000/uploads/composites/file.png -> uploads/composites/file.png
            from pathlib import Path
            import base64
            
            local_path = full_image_url.split("/uploads/", 1)[-1]
            local_file_path = f"uploads/{local_path}"
            print(f"[Video Generation] Local file path: {local_file_path}")
            
            # Check if file exists locally
            if Path(local_file_path).exists():
                try:
                    # Convert to base64 data URI
                    print(f"[Video Generation] Converting image to base64...")
                    with open(local_file_path, 'rb') as f:
                        image_data = f.read()
                    base64_data = base64.b64encode(image_data).decode('utf-8')
                    full_image_url = f"data:image/png;base64,{base64_data}"
                    print(f"[Video Generation] ✓ Converted to base64 data URI (size: {len(base64_data)} chars)")
                except Exception as e:
                    print(f"[Video Generation] WARNING: Failed to convert to base64: {e}, will try URL anyway")
            else:
                print(f"[Video Generation] WARNING: Local file not found at {local_file_path}")
        
        # Prepare input parameters for Seedance
        # Clamp duration to valid range (3-8 seconds)
        clamped_duration = min(max(int(scene.video_duration), 3), 8)
        
        # Set resolution based on environment
        if settings.is_development():
            resolution = "720p"  # Faster for dev
        else:
            resolution = "1080p"  # Higher quality for prod
        
        input_params = {
            "image": full_image_url,
            "prompt": scene.text,
            "duration": clamped_duration,
            "resolution": resolution,  # 480p, 720p, or 1080p
            "aspect_ratio": "16:9",  # Landscape format (1080p)
        }
        
        if settings.use_webhooks():
            # WEBHOOK MODE: Create prediction and return immediately
            webhook_url = settings.get_webhook_url()
            print(f"[Video Generation] Webhook URL: {webhook_url}")
            
            print(f"[Video Generation] Creating webhook-based prediction:")
            print(f"  - Model: bytedance/seedance-1-pro-fast")
            print(f"  - Prompt: {scene.text[:100]}...")
            print(f"  - Duration: {clamped_duration}s (clamped from {scene.video_duration}s)")
            print(f"  - Resolution: {resolution}")
            print(f"  - Aspect Ratio: 16:9")
            print(f"  - Image: {'base64 data URI' if full_image_url.startswith('data:') else full_image_url[:80]}...")
            print(f"[Video Generation] Creating prediction with webhook...")
            
            # Create prediction with webhook
            prediction_id = await replicate_service.create_prediction_with_webhook(
                model="bytedance/seedance-1-pro-fast",
                input_params=input_params,
                webhook_url=webhook_url
            )
            
            # Store prediction ID in scene
            scene.replicate_video_prediction_id = prediction_id
            db.update_scene(scene_id, scene)
            
            print(f"[Video Generation] ✓ Prediction created with ID: {prediction_id}")
            print(f"[Video Generation]    Webhook will be called when generation completes")
            print(f"[Video Generation] ✓ Video generation started successfully for scene {scene_id}")
            print(f"{'='*80}\n")
        
        else:
            # BLOCKING MODE: Generate and wait for result (local dev)
            print(f"[Video Generation] Generating video (blocking mode for local dev):")
            print(f"  - Model: bytedance/seedance-1-pro-fast")
            print(f"  - Prompt: {scene.text[:100]}...")
            print(f"  - Duration: {clamped_duration}s (clamped from {scene.video_duration}s)")
            print(f"  - Resolution: {resolution}")
            print(f"  - Aspect Ratio: 16:9")
            print(f"  - Image: {'base64 data URI' if full_image_url.startswith('data:') else full_image_url[:80]}...")
            print(f"[Video Generation] Calling Replicate API (blocking)...")
            
            # Use blocking client.run call
            import replicate
            client = replicate.Client(api_token=replicate_token)
            
            start_time = asyncio.get_event_loop().time()
            output = await asyncio.to_thread(
                client.run,
                "bytedance/seedance-1-pro-fast",
                input=input_params
            )
            elapsed_time = asyncio.get_event_loop().time() - start_time
            
            print(f"[Video Generation] ✓ Replicate API call completed in {elapsed_time:.2f}s")
            print(f"[Video Generation] Output type: {type(output)}")
            print(f"[Video Generation] Output: {output}")
            
            # Extract video URL from output
            if output:
                if isinstance(output, list) and len(output) > 0:
                    video_url = str(output[0]) if hasattr(output[0], '__str__') else output[0]
                else:
                    video_url = str(output) if hasattr(output, '__str__') else output
                
                print(f"[Video Generation] ✓ Video URL extracted: {video_url[:100]}...")
                
                # Update scene with video URL
                scene.video_url = video_url
                scene.generation_status.video = "complete"
                scene.state = "video"
                scene.error_message = None
                db.update_scene(scene_id, scene)
                
                print(f"[Video Generation] ✓ Scene updated successfully")
                print(f"[Video Generation] Status: {scene.generation_status.video}")
                print(f"[Video Generation] State: {scene.state}")
            else:
                raise Exception("No video generated")
            
            print(f"[Video Generation] ✓ Video generation completed successfully for scene {scene_id}")
            print(f"{'='*80}\n")

    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[Video Generation] ✗ ERROR: Video generation failed for scene {scene_id}")
        print(f"[Video Generation] Error: {str(e)}")
        print(f"[Video Generation] Traceback:\n{error_trace}")
        
        scene = db.get_scene(scene_id)
        if scene:
            scene.generation_status.video = "error"
            scene.error_message = f"Video generation failed: {str(e)}"
            db.update_scene(scene_id, scene)
            print(f"[Video Generation] Scene error status updated")
        
        print(f"{'='*80}\n")


@router.post("/{storyboard_id}/scenes/{scene_id}/video/generate", response_model=SceneUpdateResponse)
async def generate_scene_video(
    storyboard_id: str,
    scene_id: str,
    background_tasks: BackgroundTasks
):
    """
    Approve image and generate video for a scene.

    This starts async video generation using Replicate.
    """
    try:
        scene = db.get_scene(scene_id)
        if not scene:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scene {scene_id} not found"
            )

        if not scene.image_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot generate video without an image"
            )

        # Start video generation in background
        background_tasks.add_task(generate_video_task, scene_id)

        # Return immediately with generating status
        scene.generation_status.video = "generating"
        db.update_scene(scene_id, scene)

        return SceneUpdateResponse(
            success=True,
            scene=scene,
            message="Video generation started"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start video generation: {str(e)}"
        )


@router.post("/{storyboard_id}/scenes/{scene_id}/video/regenerate", response_model=SceneUpdateResponse)
async def regenerate_scene_video(
    storyboard_id: str,
    scene_id: str,
    background_tasks: BackgroundTasks
):
    """
    Regenerate video for a scene.

    This cancels any existing generation, clears the video, and starts new generation.
    """
    try:
        scene = db.get_scene(scene_id)
        if not scene:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scene {scene_id} not found"
            )

        if not scene.image_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot generate video without an image"
            )

        # Cancel existing prediction if any
        if scene.replicate_video_prediction_id:
            print(f"[Video Regeneration] Canceling existing prediction: {scene.replicate_video_prediction_id}")
            from app.services.replicate_service import get_replicate_service
            replicate_service = get_replicate_service()
            await replicate_service.cancel_prediction(scene.replicate_video_prediction_id)
            scene.replicate_video_prediction_id = None

        # Reset video state
        scene.video_url = None
        scene.generation_status.video = "generating"
        db.update_scene(scene_id, scene)

        # Start video generation in background
        background_tasks.add_task(generate_video_task, scene_id)

        return SceneUpdateResponse(
            success=True,
            scene=scene,
            message="Video regeneration started"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start video regeneration: {str(e)}"
        )


@router.post("/{storyboard_id}/scenes/{scene_id}/video/trim", response_model=SceneUpdateResponse)
async def update_scene_trim(
    storyboard_id: str,
    scene_id: str,
    request: SceneTrimUpdateRequest
):
    """
    Update trim start/end times for a scene video.
    
    Validates:
    - Scene exists and has a video
    - Trim times are within video duration
    - trim_end_time > trim_start_time
    """
    try:
        scene = db.get_scene(scene_id)
        if not scene:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scene {scene_id} not found"
            )

        # Validate scene has video
        if not scene.video_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot trim video: scene has no video URL"
            )

        if scene.generation_status.video != "complete":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot trim video: video generation is not complete"
            )

        # Validate trim times
        # If both are None, clear trim (use full video)
        if request.trim_start_time is None and request.trim_end_time is None:
            scene.trim_start_time = None
            scene.trim_end_time = None
        else:
            # Both must be provided if one is set
            if request.trim_start_time is None or request.trim_end_time is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Both trim_start_time and trim_end_time must be provided together, or both must be None"
                )

            # Validate values
            if request.trim_start_time < 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="trim_start_time must be >= 0"
                )

            if request.trim_end_time <= request.trim_start_time:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="trim_end_time must be greater than trim_start_time"
                )

            # Validate against video duration (use scene.video_duration as max)
            # Note: This uses the requested duration, not actual video file duration
            # For more accuracy, we could probe the video file, but that requires downloading it
            # Allow small tolerance (0.1s) for floating point precision differences between
            # stored duration and actual video file duration
            TOLERANCE = 0.1
            if request.trim_end_time > scene.video_duration + TOLERANCE:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"trim_end_time ({request.trim_end_time}s) exceeds video duration ({scene.video_duration}s)"
                )
            
            # Clamp trim_end_time to not exceed video duration to handle precision differences
            # between stored duration and actual video file duration
            clamped_trim_end_time = min(request.trim_end_time, scene.video_duration)

            # Update scene with trim times
            scene.trim_start_time = request.trim_start_time
            scene.trim_end_time = clamped_trim_end_time

        # Save updated scene
        updated_scene = db.update_scene(scene_id, scene)

        return SceneUpdateResponse(
            success=True,
            scene=updated_scene,
            message="Video trim times updated successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update trim times: {str(e)}"
        )


# ============================================================================
# Server-Sent Events (SSE) Endpoint
# ============================================================================

async def scene_update_generator(storyboard_id: str) -> AsyncGenerator[str, None]:
    """
    Generate SSE events for scene updates.

    This watches for changes to scenes in the storyboard and sends updates.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    # Track last known state for each scene
    last_states = {}
    
    try:
        # Send initial connection success message
        yield f"event: connected\ndata: {{'storyboard_id': '{storyboard_id}'}}\n\n"
        logger.info(f"SSE connection established for storyboard {storyboard_id}")
        
        while True:
            try:
                # Get all scenes for this storyboard
                scenes = db.get_scenes_by_storyboard(storyboard_id)

                # Check for changes
                for scene in scenes:
                    current_state = {
                        "state": scene.state,
                        "image_status": scene.generation_status.image,
                        "video_status": scene.generation_status.video,
                        "image_url": scene.image_url,
                        "video_url": scene.video_url,
                        "error": scene.error_message
                    }

                    # Compare with last known state
                    last_state = last_states.get(scene.id)
                    
                    if last_state != current_state:
                        # State changed, send update with BOTH statuses
                        update = SSESceneUpdate(
                            scene_id=scene.id,
                            state=scene.state,
                            image_status=scene.generation_status.image,
                            video_status=scene.generation_status.video,
                            image_url=scene.image_url,
                            video_url=scene.video_url,
                            error=scene.error_message
                        )

                        # Format as SSE event
                        data = f"event: scene_update\ndata: {update.model_dump_json()}\n\n"
                        yield data

                        # Update last known state
                        last_states[scene.id] = current_state

                # Send keepalive ping every poll cycle to prevent timeout
                yield f": keepalive\n\n"
                
                # Wait before next poll
                await asyncio.sleep(2)  # Poll every 2 seconds
                
            except Exception as e:
                logger.error(f"Error in SSE update loop: {e}", exc_info=True)
                # Send error to client
                error_data = f"event: error\ndata: {{'error': 'Internal server error'}}\n\n"
                yield error_data
                await asyncio.sleep(5)  # Wait before retrying

    except asyncio.CancelledError:
        logger.info(f"SSE connection cancelled for storyboard {storyboard_id}")
        raise
    except Exception as e:
        logger.error(f"Fatal error in SSE generator: {e}", exc_info=True)
        raise


@router.get("/test-sse")
async def test_sse():
    """
    Test SSE endpoint to verify EventSource connectivity.
    Returns a simple heartbeat every second for 10 seconds.
    """
    async def heartbeat_generator():
        import logging
        logger = logging.getLogger(__name__)
        logger.info("SSE test endpoint called")
        
        try:
            for i in range(10):
                yield f"event: heartbeat\ndata: {{\"count\": {i+1}}}\n\n"
                await asyncio.sleep(1)
            yield f"event: complete\ndata: {{\"message\": \"Test completed\"}}\n\n"
        except Exception as e:
            logger.error(f"Error in test SSE: {e}")
            
    return StreamingResponse(
        heartbeat_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
        }
    )


@router.get("/{storyboard_id}/events")
async def scene_updates_sse(storyboard_id: str):
    """
    Server-Sent Events endpoint for real-time scene updates.

    Clients connect to this endpoint to receive real-time updates
    about scene generation progress (image/video generation status).
    """
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"SSE connection requested for storyboard {storyboard_id}")
    
    # Verify storyboard exists
    storyboard = db.get_storyboard(storyboard_id)
    if not storyboard:
        logger.warning(f"SSE connection rejected: Storyboard {storyboard_id} not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Storyboard {storyboard_id} not found"
        )

    logger.info(f"Starting SSE stream for storyboard {storyboard_id}")
    
    return StreamingResponse(
        scene_update_generator(storyboard_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
            # CORS headers for SSE
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET",
            "Access-Control-Allow-Headers": "*",
        }
    )
