"""Webhook endpoints for receiving Replicate prediction callbacks."""
import logging
import hmac
import hashlib
from typing import Dict, Any
from fastapi import APIRouter, Request, HTTPException, status
from app.config import settings
from app.firestore_database import db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


def verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
    """
    Verify Replicate webhook signature.
    
    Args:
        payload: Raw request body bytes
        signature: Signature from Webhook-Signature header
        secret: Shared secret configured in Replicate
        
    Returns:
        True if signature is valid, False otherwise
    """
    if not secret:
        # If no secret configured, skip verification (dev mode)
        logger.warning("Webhook secret not configured - skipping signature verification")
        return True
    
    # Compute expected signature
    expected_signature = hmac.new(
        secret.encode('utf-8'),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    # Compare signatures (constant-time comparison to prevent timing attacks)
    return hmac.compare_digest(signature, expected_signature)


@router.post("/replicate")
async def replicate_webhook(request: Request):
    """
    Handle Replicate prediction webhooks.
    
    This endpoint is called by Replicate when a prediction completes, fails, or is canceled.
    It updates the corresponding scene with the results.
    
    Webhook payload format:
    {
        "id": "prediction-id",
        "status": "succeeded" | "failed" | "canceled",
        "output": [...] or "output-url",
        "error": "error message if failed",
        "completed_at": "timestamp"
    }
    """
    # Get raw body for signature verification
    body = await request.body()
    
    # Verify webhook signature
    signature = request.headers.get("Webhook-Signature", "")
    if not verify_webhook_signature(body, signature, settings.REPLICATE_WEBHOOK_SECRET):
        logger.error("Invalid webhook signature")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook signature"
        )
    
    # Parse JSON payload
    try:
        data = await request.json()
    except Exception as e:
        logger.error(f"Failed to parse webhook payload: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload"
        )
    
    prediction_id = data.get("id")
    prediction_status = data.get("status")
    output = data.get("output")
    error = data.get("error")
    
    logger.info(f"Received webhook for prediction {prediction_id}: status={prediction_status}")
    
    if not prediction_id or not prediction_status:
        logger.error(f"Missing required fields in webhook payload: {data}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required fields (id, status)"
        )
    
    # Try to find scene by prediction ID (try both image and video)
    scene = db.get_scene_by_image_prediction_id(prediction_id)
    if scene:
        await _handle_image_webhook(scene, prediction_status, output, error)
    else:
        scene = db.get_scene_by_video_prediction_id(prediction_id)
        if scene:
            await _handle_video_webhook(scene, prediction_status, output, error)
        else:
            # Scene not found - might have been deleted or prediction ID doesn't match
            logger.warning(f"No scene found for prediction {prediction_id}")
            # Return 200 anyway to prevent Replicate from retrying
            return {"ok": True, "message": "Scene not found (may have been deleted)"}
    
    return {"ok": True, "message": "Webhook processed successfully"}


async def _handle_image_webhook(
    scene: Any,
    prediction_status: str,
    output: Any,
    error: str = None
):
    """Handle image generation webhook callback."""
    logger.info(f"Handling image webhook for scene {scene.id}: status={prediction_status}")
    
    if prediction_status == "succeeded":
        # Extract image URL from output
        if isinstance(output, list) and len(output) > 0:
            image_url = str(output[0])
        elif isinstance(output, str):
            image_url = output
        elif hasattr(output, 'url'):
            image_url = str(output.url)
        else:
            logger.error(f"Unexpected output format: {type(output)}")
            scene.generation_status.image = "error"
            scene.error_message = "Unexpected output format from Replicate"
            db.update_scene(scene.id, scene)
            return
        
        # Persist image to Firebase Storage
        try:
            from app.services.replicate_service import get_replicate_service
            replicate_service = get_replicate_service()
            persisted_url = replicate_service.persist_replicate_image(image_url, folder="scenes")
            
            # Update scene with persisted URL
            scene.image_url = persisted_url
            scene.generation_status.image = "complete"
            scene.state = "image"
            scene.error_message = None
            
            logger.info(f"Image generation succeeded for scene {scene.id}: {persisted_url}")
            
        except Exception as e:
            logger.error(f"Failed to persist image for scene {scene.id}: {e}")
            # Still save the temporary Replicate URL
            scene.image_url = image_url
            scene.generation_status.image = "complete"
            scene.state = "image"
            scene.error_message = f"Image generated but persistence failed: {str(e)}"
    
    elif prediction_status == "failed":
        scene.generation_status.image = "error"
        scene.error_message = f"Image generation failed: {error or 'Unknown error'}"
        logger.error(f"Image generation failed for scene {scene.id}: {error}")
    
    elif prediction_status == "canceled":
        # Don't update status if canceled (might be due to regeneration)
        logger.info(f"Image generation canceled for scene {scene.id}")
        # Clear prediction ID so it can be restarted
        scene.replicate_image_prediction_id = None
    
    else:
        logger.warning(f"Unexpected prediction status: {prediction_status}")
    
    # Save updated scene
    db.update_scene(scene.id, scene)


async def _handle_video_webhook(
    scene: Any,
    prediction_status: str,
    output: Any,
    error: str = None
):
    """Handle video generation webhook callback."""
    logger.info(f"Handling video webhook for scene {scene.id}: status={prediction_status}")
    
    if prediction_status == "succeeded":
        # Extract video URL from output
        if isinstance(output, str):
            video_url = output
        elif isinstance(output, list) and len(output) > 0:
            video_url = str(output[0])
        elif hasattr(output, 'url'):
            video_url = str(output.url)
        else:
            logger.error(f"Unexpected output format: {type(output)}")
            scene.generation_status.video = "error"
            scene.error_message = "Unexpected output format from Replicate"
            db.update_scene(scene.id, scene)
            return
        
        # Update scene with video URL
        scene.video_url = video_url
        scene.generation_status.video = "complete"
        scene.state = "video"
        scene.error_message = None
        
        logger.info(f"Video generation succeeded for scene {scene.id}: {video_url}")
    
    elif prediction_status == "failed":
        scene.generation_status.video = "error"
        scene.error_message = f"Video generation failed: {error or 'Unknown error'}"
        logger.error(f"Video generation failed for scene {scene.id}: {error}")
    
    elif prediction_status == "canceled":
        # Don't update status if canceled (might be due to regeneration)
        logger.info(f"Video generation canceled for scene {scene.id}")
        # Clear prediction ID so it can be restarted
        scene.replicate_video_prediction_id = None
    
    else:
        logger.warning(f"Unexpected prediction status: {prediction_status}")
    
    # Save updated scene
    db.update_scene(scene.id, scene)



