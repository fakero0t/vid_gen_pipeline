"""API router for storyboard operations."""
from fastapi import APIRouter, HTTPException, status, BackgroundTasks
from fastapi.responses import StreamingResponse
from typing import AsyncGenerator
from pydantic import BaseModel
from app.models.storyboard_models import (
    StoryboardInitializeRequest,
    StoryboardInitializeResponse,
    StoryboardGetResponse,
    SceneTextUpdateRequest,
    SceneTextGenerateRequest,
    SceneDurationUpdateRequest,
    SceneUpdateResponse,
    SSESceneUpdate,
    ErrorResponse,
)
from app.services.storyboard_service import storyboard_service
from app.services.product_service import get_product_service
from app.services.replicate_service import get_replicate_service
from app.services.metrics_service import get_composite_metrics
from app.database import db
from app.config import settings
import json
import asyncio
from datetime import datetime
import replicate

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
# Image Generation Endpoints
# ============================================================================

async def generate_image_task(scene_id: str):
    """Background task to generate image using Replicate."""
    print(f"[Image Generation] Starting image generation for scene {scene_id}")
    try:
        scene = db.get_scene(scene_id)
        if not scene:
            print(f"[Image Generation] Scene {scene_id} not found")
            return

        # Update status to generating
        scene.generation_status.image = "generating"
        db.update_scene(scene_id, scene)
        print(f"[Image Generation] Updated scene {scene_id} status to 'generating'")

        # Get Replicate token
        replicate_token = settings.get_replicate_token()
        if not replicate_token:
            # No API key - use placeholder
            print(f"[Image Generation] No Replicate token, using placeholder for scene {scene_id}")
            scene.generation_status.image = "complete"
            scene.image_url = f"https://via.placeholder.com/1080x1920/000000/FFFFFF?text=Scene+{scene_id[:8]}"
            scene.state = "image"
            db.update_scene(scene_id, scene)
            print(f"[Image Generation] Placeholder image set for scene {scene_id}")
            return

        # Check if product compositing is enabled
        if scene.use_product_composite and scene.product_id:
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
                print(f"[Image Generation] Using Kontext composite method")
                try:
                    # Try Kontext method with timeout
                    image_url = await asyncio.wait_for(
                        replicate_service.generate_scene_with_kontext_composite(
                            scene_text=scene.text,
                            style_prompt=scene.style_prompt,
                            product_image_path=str(product_image_path),
                            width=1080,
                            height=1920
                        ),
                        timeout=settings.KONTEXT_TIMEOUT_SECONDS
                    )
                    print(f"[Image Generation] Kontext composite succeeded")
                    
                except asyncio.TimeoutError:
                    print(f"[Image Generation] Kontext timeout, falling back to PIL")
                    
                    # Record fallback
                    metrics = get_composite_metrics()
                    metrics.record_fallback()
                    
                    image_url = await replicate_service.generate_scene_with_product(
                        scene_text=scene.text,
                        style_prompt=scene.style_prompt,
                        product_image_path=str(product_image_path),
                        width=1080,
                        height=1920
                    )
                    
                except Exception as e:
                    print(f"[Image Generation] Kontext failed: {e}, falling back to PIL")
                    
                    # Record fallback
                    metrics = get_composite_metrics()
                    metrics.record_fallback()
                    
                    # Silent fallback to PIL method
                    image_url = await replicate_service.generate_scene_with_product(
                        scene_text=scene.text,
                        style_prompt=scene.style_prompt,
                        product_image_path=str(product_image_path),
                        width=1080,
                        height=1920
                    )
            else:
                print(f"[Image Generation] Using PIL composite method")
                # Use PIL method (existing implementation)
                image_url = await replicate_service.generate_scene_with_product(
                    scene_text=scene.text,
                    style_prompt=scene.style_prompt,
                    product_image_path=str(product_image_path),
                    width=1080,
                    height=1920
                )
        else:
            # Standard scene generation (existing logic)
            # Generate image using Replicate
            # Using Flux model for high-quality image generation
            prompt = f"{scene.text}. Style: {scene.style_prompt}"
            print(f"[Image Generation] Generating image for scene {scene_id} with prompt: {prompt[:100]}...")

            # Create Replicate client with token
            client = replicate.Client(api_token=replicate_token)
            
            output = await asyncio.to_thread(
                client.run,
                "black-forest-labs/flux-schnell",
                input={
                    "prompt": prompt,
                    "width": 1080,
                    "height": 1920,
                    "num_outputs": 1,
                }
            )

            print(f"[Image Generation] Replicate returned output for scene {scene_id}: {output}")

            # Extract image URL from output
            if not output or len(output) == 0:
                raise Exception("No image generated")
            
            image_url = str(output[0]) if hasattr(output[0], '__str__') else output[0]
            print(f"[Image Generation] Extracted image URL for scene {scene_id}: {image_url}")
        
        # Update scene with result (common for both paths)
        # Update scene with image URL
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

    This clears the existing image and starts new generation.
    """
    try:
        scene = db.get_scene(scene_id)
        if not scene:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scene {scene_id} not found"
            )

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
    try:
        scene = db.get_scene(scene_id)
        if not scene:
            return

        # Update status to generating
        scene.generation_status.video = "generating"
        db.update_scene(scene_id, scene)

        # Get Replicate token
        replicate_token = settings.get_replicate_token()
        if not replicate_token or not scene.image_url:
            # No API key or no image - use placeholder
            scene.generation_status.video = "complete"
            scene.video_url = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
            scene.state = "video"
            db.update_scene(scene_id, scene)
            return

        # Generate video using Replicate (image-to-video model)
        # Using ByteDance SeeDance-1 Pro Fast - supports longer videos
        client = replicate.Client(api_token=replicate_token)
        
        # Convert relative image URL to full URL for Replicate API
        full_image_url = settings.to_full_url(scene.image_url)
        
        # For localhost URLs, Replicate can't access them, so we need to convert to base64
        # This is necessary for local development
        if "localhost" in full_image_url or "127.0.0.1" in full_image_url:
            # Extract the local file path from the URL
            # e.g., http://localhost:8000/uploads/composites/file.png -> uploads/composites/file.png
            from pathlib import Path
            import base64
            
            local_path = full_image_url.split("/uploads/", 1)[-1]
            local_file_path = f"uploads/{local_path}"
            
            # Check if file exists locally
            if Path(local_file_path).exists():
                try:
                    # Convert to base64 data URI
                    with open(local_file_path, 'rb') as f:
                        image_data = f.read()
                    base64_data = base64.b64encode(image_data).decode('utf-8')
                    full_image_url = f"data:image/png;base64,{base64_data}"
                    print(f"[Video Generation] Converted localhost URL to base64 data URI for scene {scene_id}")
                except Exception as e:
                    print(f"[Video Generation] Failed to convert to base64: {e}, will try URL anyway")
        
        output = await asyncio.to_thread(
            client.run,
            "bytedance/seedance-1-pro-fast",
            input={
                "image": full_image_url,
                "prompt": scene.text,
                "duration": scene.video_duration,
            }
        )

        # Extract video URL from output
        # Video output might be a list or a single URL
        if output:
            if isinstance(output, list) and len(output) > 0:
                video_url = str(output[0]) if hasattr(output[0], '__str__') else output[0]
            else:
                video_url = str(output) if hasattr(output, '__str__') else output

            # Update scene with video URL
            scene.video_url = video_url
            scene.generation_status.video = "complete"
            scene.state = "video"
            scene.error_message = None
        else:
            raise Exception("No video generated")

        db.update_scene(scene_id, scene)

    except Exception as e:
        scene = db.get_scene(scene_id)
        if scene:
            scene.generation_status.video = "error"
            scene.error_message = f"Video generation failed: {str(e)}"
            db.update_scene(scene_id, scene)


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

    This clears the existing video and starts new generation.
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
