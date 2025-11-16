"""FastAPI router for scene planning endpoints."""
from fastapi import APIRouter, HTTPException

from app.models.scene_models import (
    ScenePlanRequest,
    ScenePlanResponse,
    ScenePlan,
    ScenePlanError
)
from app.services.scene_service import SceneGenerationService

router = APIRouter(prefix="/api/scenes", tags=["scenes"])

# Initialize service
scene_service = SceneGenerationService()


@router.post("/plan", response_model=ScenePlanResponse)
async def plan_scenes(
    request: ScenePlanRequest
) -> ScenePlanResponse:
    """
    Generate a scene-by-scene breakdown for a 30-second video.

    This endpoint:
    1. Takes creative brief and selected mood data
    2. Uses GPT-4o to analyze narrative structure
    3. Generates 5-7 scenes with descriptions and timing
    4. Ensures scenes follow storytelling best practices
    5. Returns structured scene plan with exact timing

    Args:
        request: Scene plan request containing creative brief and mood data

    Returns:
        ScenePlanResponse with scene breakdown (5-7 scenes totaling 30 seconds)
    """
    try:
        # Convert Pydantic model to dict for service
        creative_brief = {
            "product_name": request.product_name,
            "target_audience": request.target_audience,
            "emotional_tone": request.emotional_tone,
            "visual_style_keywords": request.visual_style_keywords,
            "key_messages": request.key_messages
        }

        selected_mood = {
            "mood_id": request.mood_id,
            "mood_name": request.mood_name,
            "mood_style_keywords": request.mood_style_keywords,
            "mood_color_palette": request.mood_color_palette,
            "mood_aesthetic_direction": request.mood_aesthetic_direction
        }

        # Generate scene breakdown
        scene_plan_dict = await scene_service.generate_scene_breakdown(
            creative_brief=creative_brief,
            selected_mood=selected_mood
        )

        # Convert to Pydantic model
        scene_plan = ScenePlan(**scene_plan_dict)

        # Count scenes
        num_scenes = len(scene_plan.scenes)
        total_duration = scene_plan.total_duration

        message = f"Generated {num_scenes} scenes totaling {total_duration:.1f} seconds"

        return ScenePlanResponse(
            success=True,
            scene_plan=scene_plan,
            message=message
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error during scene planning: {str(e)}"
        )
