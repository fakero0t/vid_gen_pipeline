"""FastAPI router for mood generation endpoints."""
from fastapi import APIRouter, HTTPException

from app.models.mood_models import (
    CreativeBriefInput,
    MoodGenerationResponse,
    MoodGenerationError,
    Mood,
    MoodImage
)
from app.services.mood_service import MoodGenerationService
from app.services.replicate_service import ReplicateImageService

router = APIRouter(prefix="/api/moods", tags=["moods"])

# Initialize services
mood_service = MoodGenerationService()
replicate_service = None  # Will be initialized on first request


def get_replicate_service() -> ReplicateImageService:
    """Get or initialize Replicate service."""
    global replicate_service
    if replicate_service is None:
        try:
            replicate_service = ReplicateImageService()
        except ValueError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Replicate service not available: {str(e)}"
            )
    return replicate_service


@router.post("/generate", response_model=MoodGenerationResponse)
async def generate_moods(
    creative_brief: CreativeBriefInput
) -> MoodGenerationResponse:
    """
    Generate 3 distinct mood boards with 1 image each from a creative brief.
    
    This endpoint:
    1. Generates 3 distinct mood directions using AI
    2. Generates 1 image per mood (3 total) in parallel using Replicate
    3. Returns complete mood data with images
    
    Args:
        creative_brief: Creative brief data containing product info, audience, etc.
    
    Returns:
        MoodGenerationResponse with 3 moods, each containing 1 image
    """
    try:
        # Convert Pydantic model to dict for service
        brief_dict = creative_brief.model_dump()
        
        # Step 1: Generate 3 mood directions
        mood_directions = await mood_service.generate_mood_directions(brief_dict)
        
        # Step 2: Generate images for each mood
        replicate_svc = get_replicate_service()
        
        # Determine images per mood and resolution based on environment
        from app.config import settings
        
        # Images per mood: Always 1 for consistent experience
        images_per_mood = settings.IMAGES_PER_MOOD if settings.IMAGES_PER_MOOD > 0 else 1
        
        # Resolution: Lower for dev (faster), higher for prod (better quality)
        if settings.IMAGE_WIDTH > 0 and settings.IMAGE_HEIGHT > 0:
            image_width = settings.IMAGE_WIDTH
            image_height = settings.IMAGE_HEIGHT
        elif settings.is_development():
            # Dev: 1280x720 (maintains 16:9 ratio, 4x fewer pixels = much faster)
            image_width = 1280
            image_height = 720
        else:
            # Prod: 1920x1080 (full HD landscape, high quality)
            image_width = 1920
            image_height = 1080
        
        # Build prompts for all images (3 moods × images_per_mood)
        all_prompts = []
        
        for mood in mood_directions:
            base_prompt = replicate_svc.build_image_prompt(
                mood_name=mood["name"],
                mood_description=mood["description"],
                style_keywords=mood["style_keywords"],
                color_palette=mood["color_palette"],
                aesthetic_direction=mood["aesthetic_direction"],
                product_name=brief_dict.get("product_name")
            )
            
            # Generate single image per mood
            all_prompts.append(base_prompt)
        
        # Step 3: Generate all images in parallel
        # Use 9:16 aspect ratio for vertical video
        total_images = len(all_prompts)
        print(f"Starting parallel generation of {total_images} images at {image_width}x{image_height}...")
        print(f"Environment: {'development' if settings.is_development() else 'production'}")
        image_results = await replicate_svc.generate_images_parallel(
            prompts=all_prompts,
            width=image_width,
            height=image_height
        )
        print(f"Completed generation: {sum(1 for r in image_results if r['success'])}/{len(image_results)} successful")
        
        # Step 4: Persist images to Firebase Storage and organize by mood
        print(f"Persisting {len(image_results)} images to Firebase Storage...")
        moods_with_images = []
        for mood_idx, mood in enumerate(mood_directions):
            # Each mood gets images_per_mood images, so calculate the range
            start_idx = mood_idx * images_per_mood
            end_idx = start_idx + images_per_mood
            
            # Get the image results for this mood
            mood_image_results = image_results[start_idx:end_idx]
            
            # Build MoodImage objects with persisted URLs
            mood_images = []
            for idx, result in enumerate(mood_image_results):
                image_url = result["image_url"] or ""
                
                # Persist successful images to Firebase Storage
                if result["success"] and image_url:
                    print(f"[Mood {mood_idx + 1}/{len(mood_directions)}] Persisting image {idx + 1}/{len(mood_image_results)}...")
                    image_url = replicate_svc.persist_replicate_image(image_url, folder="moods")
                
                mood_images.append(MoodImage(
                    url=image_url,
                    prompt=result["prompt"],
                    success=result["success"],
                    error=result.get("error")
                ))
            
            moods_with_images.append(Mood(
                id=mood["id"],
                name=mood["name"],
                description=mood["description"],
                style_keywords=mood["style_keywords"],
                color_palette=mood["color_palette"],
                aesthetic_direction=mood["aesthetic_direction"],
                images=mood_images
            ))
        
        # Count successful images
        total_images = sum(len(mood.images) for mood in moods_with_images)
        successful_images = sum(
            sum(1 for img in mood.images if img.success)
            for mood in moods_with_images
        )
        
        message = f"Generated 3 mood boards with {successful_images}/{total_images} images"
        if successful_images < total_images:
            message += f" ({total_images - successful_images} failed or filtered)"
        
        return MoodGenerationResponse(
            success=True,
            moods=moods_with_images,
            message=message
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error during mood generation: {str(e)}"
        )

