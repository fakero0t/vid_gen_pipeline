"""
COLMAP Service - Orchestrates COLMAP processing via Modal

This service handles:
- Zipping and uploading product photos to Modal volume
- Initiating COLMAP processing via Modal function
- Polling and tracking COLMAP progress
- Error handling and retry logic
"""

import asyncio
import logging
from typing import Dict, Any, Optional
from datetime import datetime

from .modal_service import modal_service, ModalAPIError, ModalGPUUnavailable, ModalRateLimitError
from ..models.nerf_models import COLMAPResponse, COLMAPStatus
from ..config import settings


# Configure logging
logger = logging.getLogger(__name__)


class COLMAPService:
    """
    Service for managing COLMAP camera pose estimation via Modal.
    """
    
    async def start_colmap_processing(
        self,
        job_id: str,
    ) -> COLMAPResponse:
        """
        Start COLMAP processing for uploaded product photos.
        Images are already in Modal volume at /jobs/{job_id}/images/
        
        Args:
            job_id: Upload job ID
            
        Returns:
            COLMAPResponse with job details
            
        Raises:
            ModalAPIError: If Modal function call fails
        """
        try:
            logger.info(f"Starting COLMAP processing for job {job_id}")
            
            # Images are already in Modal at /jobs/{job_id}/images/
            # List files to get count
            images_dir = f"/jobs/{job_id}/images"
            image_files = await modal_service.list_files(images_dir)
            num_images = len(image_files)
            
            logger.info(f"Found {num_images} images in Modal volume for job {job_id}")
            
            # Call Modal COLMAP function with images directory
            function_call = await modal_service.call_function(
                "process_colmap",
                job_id=job_id,
                images_path=images_dir,
            )
            
            # Store function call ID for status polling
            colmap_job_id = f"colmap_{job_id}"
            
            logger.info(f"COLMAP processing initiated: {colmap_job_id}")
            
            # Return initial response
            return COLMAPResponse(
                job_id=colmap_job_id,
                status="processing",
                stage="feature_extraction",
                progress=0,
                estimated_time_remaining=1200,  # ~20 minutes
            )
            
        except ModalAPIError as e:
            logger.error(f"Failed to start COLMAP processing: {e}")
            raise
            
        except Exception as e:
            logger.error(f"Unexpected error starting COLMAP processing: {e}")
            raise ModalAPIError(f"Failed to start COLMAP processing: {e}")
    
    async def get_colmap_status(
        self,
        job_id: str,
    ) -> COLMAPStatus:
        """
        Get current status of COLMAP processing.
        
        Args:
            job_id: COLMAP job ID (e.g., "colmap_{upload_job_id}")
            
        Returns:
            COLMAPStatus with current progress
            
        Raises:
            ModalAPIError: If status retrieval fails
        """
        try:
            # Extract upload job ID from COLMAP job ID
            upload_job_id = job_id.replace("colmap_", "")
            
            # Read progress from Modal volume
            progress_data = await modal_service.get_progress(upload_job_id)
            
            if progress_data is None:
                logger.warning(f"No progress data found for job {job_id}")
                return COLMAPStatus(
                    job_id=job_id,
                    status="processing",
                    stage="initializing",
                    progress=0,
                    current_operation="Initializing...",
                    images_processed=0,
                    total_images=0,
                    estimated_time_remaining=None,
                    output_path=None,
                    error=None,
                )
            
            # Parse progress data
            stage = progress_data.get("stage", "initializing")
            progress = progress_data.get("progress", 0)
            status_str = progress_data.get("status", "processing")
            current_operation = progress_data.get("current_operation", "")
            images_processed = progress_data.get("images_processed", 0)
            total_images = progress_data.get("total_images", 0)
            error = progress_data.get("error")
            
            # Calculate estimated time remaining based on progress
            elapsed_time = progress_data.get("elapsed_time")
            if elapsed_time and progress > 0:
                estimated_remaining = (elapsed_time / progress) * (100 - progress)
            else:
                estimated_remaining = None
            
            # Determine output path
            output_path = None
            if status_str == "complete":
                output_path = f"/jobs/{upload_job_id}/colmap"
            
            return COLMAPStatus(
                job_id=job_id,
                status=status_str,
                stage=stage,
                progress=progress,
                current_operation=current_operation,
                images_processed=images_processed,
                total_images=total_images,
                estimated_time_remaining=int(estimated_remaining) if estimated_remaining else None,
                output_path=output_path,
                error=error,
            )
            
        except Exception as e:
            logger.error(f"Failed to get COLMAP status for job {job_id}: {e}")
            raise ModalAPIError(f"Failed to get COLMAP status: {e}")
    
    async def retry_colmap_processing(
        self,
        job_id: str,
    ) -> COLMAPResponse:
        """
        Retry COLMAP processing for a failed job.
        
        Args:
            job_id: Original upload job ID
            
        Returns:
            COLMAPResponse with new job details
        """
        logger.info(f"Retrying COLMAP processing for job {job_id}")
        
        # Start new COLMAP processing (images already in Modal)
        return await self.start_colmap_processing(job_id)
    
    def _estimate_processing_time(
        self,
        num_images: int,
    ) -> int:
        """
        Estimate COLMAP processing time in seconds.
        
        Args:
            num_images: Number of images to process
            
        Returns:
            Estimated time in seconds
        """
        # Rough estimates based on PRD:
        # - Feature extraction: ~2-5 minutes
        # - Feature matching: ~5-10 minutes
        # - SfM: ~5-10 minutes
        # Total: ~12-25 minutes
        
        # Base time per image (seconds)
        time_per_image = 15 if settings.is_development() else 10
        
        # Add overhead for setup and finalization
        overhead = 120
        
        return (num_images * time_per_image) + overhead


# Global singleton instance
colmap_service = COLMAPService()

