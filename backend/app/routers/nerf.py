"""
NeRF Pipeline Router

This router handles all NeRF-related endpoints:
- COLMAP camera pose estimation
- NeRF training
- Frame rendering
"""

from fastapi import APIRouter, HTTPException, status
from pathlib import Path
from typing import Optional
import logging

from ..models.nerf_models import (
    COLMAPRequest,
    COLMAPResponse,
    COLMAPStatus,
    TrainingRequest,
    TrainingResponse,
    TrainingStatus,
    RenderRequest,
    RenderResponse,
    RenderStatus,
)
from ..services.colmap_service import colmap_service
from ..services.nerf_service import nerf_training_service
from ..services.rendering_service import rendering_service
from ..config import settings


# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter()


def convert_url_to_filesystem_path(url_path: str, job_id: str) -> Path:
    """
    Convert a URL path to a filesystem path.
    
    Args:
        url_path: URL path like '/api/uploads/{job_id}/{filename}' or filesystem path
        job_id: Job ID from request (used as fallback if not in URL)
        
    Returns:
        Filesystem Path object
    """
    # Check if it's a URL path
    if url_path.startswith('/api/uploads/'):
        # Extract job_id and filename from URL: /api/uploads/{job_id}/{filename}
        parts = url_path.split('/')
        if len(parts) >= 5:
            # Extract job_id from URL (parts[3]) and filename (parts[4])
            url_job_id = parts[3]
            filename = parts[4]
            # Use job_id from URL (where files are actually stored)
            return settings.get_upload_storage_path() / url_job_id / filename
        else:
            # Fallback: use provided job_id
            filename = Path(url_path).name
            return settings.get_upload_storage_path() / job_id / filename
    else:
        # Assume it's already a filesystem path
        path = Path(url_path)
        if path.is_absolute():
            return path
        else:
            # Relative to upload storage
            return settings.get_upload_storage_path() / job_id / path.name


@router.post("/colmap", response_model=COLMAPResponse)
async def start_colmap(request: COLMAPRequest):
    """
    Start COLMAP camera pose estimation for uploaded product photos.
    Images are already in Modal volume at /jobs/{job_id}/images/
    
    Args:
        request: COLMAP processing request (only job_id needed)
        
    Returns:
        COLMAPResponse with job details
        
    Raises:
        HTTPException: If COLMAP processing fails to start
    """
    try:
        logger.info(f"Starting COLMAP processing for job {request.job_id}")
        
        # Start COLMAP processing (images already in Modal)
        response = await colmap_service.start_colmap_processing(
            job_id=request.job_id,
        )
        
        return response
        
    except HTTPException:
        raise
        
    except Exception as e:
        logger.error(f"Failed to start COLMAP processing: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start COLMAP processing: {str(e)}"
        )


@router.get("/colmap/status/{job_id}", response_model=COLMAPStatus)
async def get_colmap_status(job_id: str):
    """
    Get current status of COLMAP processing.
    
    Args:
        job_id: COLMAP job ID (e.g., "colmap_{upload_job_id}")
        
    Returns:
        COLMAPStatus with current progress
        
    Raises:
        HTTPException: If status retrieval fails
    """
    try:
        logger.debug(f"Getting COLMAP status for job {job_id}")
        
        # Get status from service
        status_response = await colmap_service.get_colmap_status(job_id)
        
        return status_response
        
    except Exception as e:
        logger.error(f"Failed to get COLMAP status for job {job_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get COLMAP status: {str(e)}"
        )


@router.post("/colmap/retry/{job_id}", response_model=COLMAPResponse)
async def retry_colmap(job_id: str, request: COLMAPRequest):
    """
    Retry COLMAP processing for a failed job.
    Images are already in Modal volume.
    
    Args:
        job_id: Original upload job ID
        request: COLMAP processing request (only job_id needed)
        
    Returns:
        COLMAPResponse with new job details
        
    Raises:
        HTTPException: If retry fails
    """
    try:
        logger.info(f"Retrying COLMAP processing for job {job_id}")
        
        # Retry COLMAP processing (images already in Modal)
        response = await colmap_service.retry_colmap_processing(
            job_id=job_id,
        )
        
        return response
        
    except Exception as e:
        logger.error(f"Failed to retry COLMAP processing: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retry COLMAP processing: {str(e)}"
        )


# ============================================================================
# Training Endpoints
# ============================================================================

@router.post("/train", response_model=TrainingResponse)
async def start_training(request: TrainingRequest):
    """
    Start NeRF training for COLMAP-processed images.
    
    Args:
        request: Training request with COLMAP job ID and configuration
        
    Returns:
        TrainingResponse with job details and cost estimate
        
    Raises:
        HTTPException: If training fails to start
    """
    try:
        logger.info(f"Starting NeRF training for COLMAP job {request.colmap_job_id}")
        
        # Start training
        response = await nerf_training_service.start_nerf_training(
            colmap_job_id=request.colmap_job_id,
            config=request.config.dict() if request.config else None,
        )
        
        return response
        
    except HTTPException:
        raise
        
    except Exception as e:
        logger.error(f"Failed to start NeRF training: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start NeRF training: {str(e)}"
        )


@router.get("/train/status/{job_id}", response_model=TrainingStatus)
async def get_training_status(job_id: str):
    """
    Get current status of NeRF training.
    
    Args:
        job_id: Training job ID (e.g., "train_{upload_job_id}")
        
    Returns:
        TrainingStatus with current progress and metrics
        
    Raises:
        HTTPException: If status retrieval fails
    """
    try:
        logger.debug(f"Getting training status for job {job_id}")
        
        # Get status from service
        status_response = await nerf_training_service.get_training_status(job_id)
        
        return status_response
        
    except Exception as e:
        logger.error(f"Failed to get training status for job {job_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get training status: {str(e)}"
        )


@router.post("/train/retry/{job_id}", response_model=TrainingResponse)
async def retry_training(job_id: str, request: TrainingRequest):
    """
    Retry NeRF training for a failed job.
    
    Args:
        job_id: Original training job ID
        request: Training request with configuration
        
    Returns:
        TrainingResponse with new job details
        
    Raises:
        HTTPException: If retry fails
    """
    try:
        logger.info(f"Retrying NeRF training for job {job_id}")
        
        # Retry training
        response = await nerf_training_service.retry_training(
            job_id=job_id,
            config=request.config.dict() if request.config else None,
        )
        
        return response
        
    except Exception as e:
        logger.error(f"Failed to retry NeRF training: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retry NeRF training: {str(e)}"
        )


# ============================================================================
# Rendering Endpoints
# ============================================================================

@router.post("/render", response_model=RenderResponse)
async def start_rendering(request: RenderRequest):
    """
    Start frame rendering for trained NeRF model.
    
    Args:
        request: Rendering request with training job ID and trajectory config
        
    Returns:
        RenderResponse with job details
        
    Raises:
        HTTPException: If rendering fails to start
    """
    try:
        logger.info(f"Starting frame rendering for training job {request.train_job_id}")
        
        # Start rendering
        response = await rendering_service.start_rendering(
            train_job_id=request.train_job_id,
            trajectory_config=request.trajectory_config.dict() if request.trajectory_config else None,
        )
        
        return response
        
    except HTTPException:
        raise
        
    except Exception as e:
        logger.error(f"Failed to start frame rendering: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start frame rendering: {str(e)}"
        )


@router.get("/render/status/{job_id}", response_model=RenderStatus)
async def get_rendering_status(job_id: str):
    """
    Get current status of frame rendering.
    
    Args:
        job_id: Rendering job ID (e.g., "render_{upload_job_id}")
        
    Returns:
        RenderStatus with current progress and frame availability
        
    Raises:
        HTTPException: If status retrieval fails
    """
    try:
        logger.debug(f"Getting rendering status for job {job_id}")
        
        # Get status from service
        status_response = await rendering_service.get_rendering_status(job_id)
        
        return status_response
        
    except Exception as e:
        logger.error(f"Failed to get rendering status for job {job_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get rendering status: {str(e)}"
        )


@router.post("/render/retry/{job_id}", response_model=RenderResponse)
async def retry_rendering(job_id: str, request: RenderRequest):
    """
    Retry frame rendering for a failed job.
    
    Args:
        job_id: Original rendering job ID
        request: Rendering request with trajectory config
        
    Returns:
        RenderResponse with new job details
        
    Raises:
        HTTPException: If retry fails
    """
    try:
        logger.info(f"Retrying frame rendering for job {job_id}")
        
        # Retry rendering
        response = await rendering_service.retry_rendering(
            job_id=job_id,
            trajectory_config=request.trajectory_config.dict() if request.trajectory_config else None,
        )
        
        return response
        
    except Exception as e:
        logger.error(f"Failed to retry frame rendering: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retry frame rendering: {str(e)}"
        )


@router.get("/frames/{job_id}/{frame_number}")
async def get_frame(job_id: str, frame_number: int):
    """
    Get a specific rendered frame.
    
    Args:
        job_id: Rendering job ID
        frame_number: Frame number (1-1440)
        
    Returns:
        PNG image file
        
    Raises:
        HTTPException: If frame not found
    """
    from fastapi.responses import FileResponse
    
    try:
        # Validate frame number
        if frame_number < 1 or frame_number > 1440:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid frame number: {frame_number} (must be 1-1440)"
            )
        
        # Get frame path
        frame_path = rendering_service.get_frame_path(job_id, frame_number)
        
        if frame_path is None or not frame_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Frame {frame_number} not found for job {job_id}"
            )
        
        # Return frame as image
        return FileResponse(
            frame_path,
            media_type="image/png",
            headers={"Content-Disposition": f"inline; filename=product_frame_{frame_number:04d}.png"}
        )
        
    except HTTPException:
        raise
        
    except Exception as e:
        logger.error(f"Failed to get frame {frame_number} for job {job_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get frame: {str(e)}"
        )

