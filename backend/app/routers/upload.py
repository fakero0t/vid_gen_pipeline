"""
Product Upload Router

API endpoints for uploading product photos for NeRF processing.
"""

import logging
from fastapi import APIRouter, File, UploadFile, HTTPException, Form, status
from fastapi.responses import JSONResponse
from typing import List, Optional

from ..models.nerf_models import UploadResponse, UploadStatusResponse
from ..services.upload_service import get_upload_service
from ..utils.image_validation import get_supported_extensions
from ..config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/upload", tags=["upload"])


@router.post("/photos", response_model=UploadResponse)
async def upload_photos(
    files: List[UploadFile] = File(..., description="Product photos to upload"),
    auto_start_nerf: bool = Form(False, description="Auto-start NeRF processing after upload"),
    strict_validation: bool = Form(False, description="Treat warnings as errors"),
):
    """
    Upload product photos for NeRF processing.
    
    **Requirements:**
    - 20-200 images (80+ recommended)
    - Supported formats: JPEG, PNG, WEBP
    - Max file size: 50 MB per image
    - Min resolution: 512x512
    - Images should show product from diverse angles
    
    **Process:**
    1. Upload and validate images
    2. Store validated images
    3. Optionally start NeRF processing automatically
    
    **Returns:**
    - `job_id`: Upload job identifier
    - `validated_images`: List of validation results per image
    - `validation_summary`: Aggregate statistics
    - `auto_start_nerf`: Whether NeRF processing will start
    """
    # Check if NeRF mode is enabled
    if not settings.is_nerf_mode():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="NeRF upload not available. Set UPLOAD_MODE=nerf"
        )
    
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    
    # Check file count
    if len(files) > 200:
        raise HTTPException(
            status_code=400,
            detail=f"Too many files ({len(files)}). Maximum: 200"
        )
    
    logger.info(f"Received upload request: {len(files)} files, auto_start={auto_start_nerf}")
    
    try:
        # Read file contents
        file_data = []
        for file in files:
            content = await file.read()
            file_data.append((file.filename, content))
        
        # Process upload
        upload_service = get_upload_service()
        response = await upload_service.upload_photos(
            files=file_data,
            auto_start_nerf=auto_start_nerf,
            strict_validation=strict_validation,
        )
        
        # If auto-start is enabled and validation passed, upload to Modal
        if response.auto_start_nerf and response.validation_summary.valid >= 20:
            logger.info(f"Auto-starting NeRF processing for job {response.job_id}")
            
            success, error = await upload_service.upload_to_modal(response.job_id)
            if not success:
                logger.error(f"Failed to upload to Modal: {error}")
                # Don't fail the upload, just disable auto-start
                response.auto_start_nerf = False
                response.errors.append(f"Modal upload failed: {error}")
        
        return response
        
    except Exception as e:
        logger.error(f"Upload failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.get("/status/{job_id}", response_model=UploadStatusResponse)
async def get_upload_status(job_id: str):
    """
    Get upload job status.
    
    **Args:**
    - `job_id`: Upload job identifier from upload response
    
    **Returns:**
    - Current upload status and progress
    - Upload speed (if uploading)
    - Estimated time remaining (if uploading)
    """
    upload_service = get_upload_service()
    status = await upload_service.get_upload_status(job_id)
    
    if not status:
        raise HTTPException(status_code=404, detail=f"Upload job not found: {job_id}")
    
    return status


@router.get("/info")
async def get_upload_info():
    """
    Get upload requirements and supported formats.
    
    **Returns:**
    - Supported file formats
    - Image count requirements
    - File size limits
    - Resolution requirements
    """
    return {
        "supported_formats": get_supported_extensions(),
        "image_count": {
            "minimum": 20,
            "recommended": 80,
            "maximum": 200,
        },
        "file_size": {
            "maximum_mb": 50,
        },
        "resolution": {
            "minimum_width": 512,
            "minimum_height": 512,
            "maximum_width": 8192,
            "maximum_height": 8192,
        },
        "recommendations": [
            "Take photos from diverse angles around the product",
            "Use consistent lighting",
            "Ensure product is clearly visible",
            "Avoid motion blur",
            "Use high-resolution images for best quality",
        ],
    }


@router.delete("/{job_id}")
async def delete_upload(job_id: str):
    """
    Delete uploaded files for a job.
    
    **Args:**
    - `job_id`: Upload job identifier
    
    **Returns:**
    - Success message
    """
    upload_service = get_upload_service()
    
    # Verify job exists
    status = await upload_service.get_upload_status(job_id)
    if not status:
        raise HTTPException(status_code=404, detail=f"Upload job not found: {job_id}")
    
    # Clean up files
    upload_service.cleanup_job(job_id)
    
    return {"message": f"Upload job {job_id} deleted successfully"}

