"""
Rendering Service - Orchestrates frame rendering via Modal

This service handles:
- Frame rendering initiation
- Progress tracking
- Batch download and assembly
- Frame serving
"""

import asyncio
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List
import zipfile
import shutil

from .modal_service import modal_service, ModalAPIError
from ..models.nerf_models import (
    RenderRequest,
    RenderResponse,
    RenderStatus,
    JobStatus,
)
from ..config import settings


# Configure logging
logger = logging.getLogger(__name__)


class RenderingService:
    """
    Service for managing frame rendering via Modal.
    """
    
    async def start_rendering(
        self,
        train_job_id: str,
        trajectory_config: Optional[Dict[str, Any]] = None,
    ) -> RenderResponse:
        """
        Start frame rendering for trained NeRF model.
        
        Args:
            train_job_id: Training job ID (format: "train_{upload_job_id}")
            trajectory_config: Camera trajectory configuration (optional)
            
        Returns:
            RenderResponse with job details
            
        Raises:
            ModalAPIError: If Modal function call fails
        """
        try:
            # Extract upload job ID from training job ID
            upload_job_id = train_job_id.replace("train_", "")
            
            logger.info(f"Starting frame rendering for job {upload_job_id}")
            
            # Determine model path
            model_path = f"jobs/{upload_job_id}/model"
            
            # Default trajectory config if not provided
            if trajectory_config is None:
                trajectory_config = {
                    "trajectory_type": "circular_orbit",
                    "num_frames": 1440,
                    "radius": 2.5,
                    "elevation": 35,
                    "center": [0, 0, 0],
                }
            
            # Call rendering function
            render_call = await modal_service.call_function(
                "render_frames",
                job_id=upload_job_id,
                model_path=model_path,
                trajectory_config=trajectory_config,
            )
            
            render_call_id = str(render_call.object_id) if hasattr(render_call, 'object_id') else "render_call"
            
            logger.info(f"Rendering initiated: {render_call_id}")
            
            # Create rendering job ID
            render_job_id = f"render_{upload_job_id}"
            
            # Get GPU type
            gpu_type = settings.get_gpu_type()
            
            # Get total frames from config
            total_frames = trajectory_config.get("num_frames", 1440)
            frames_per_batch = 100
            total_batches = (total_frames + frames_per_batch - 1) // frames_per_batch
            
            # Return initial response
            return RenderResponse(
                job_id=render_job_id,
                modal_call_id=render_call_id,
                status=JobStatus.PROCESSING,
                progress=0,
                frames_rendered=0,
                total_frames=total_frames,
                current_batch=0,
                total_batches=total_batches,
                gpu_type=gpu_type,
                estimated_time_remaining=1200,  # ~20 minutes
            )
            
        except ModalAPIError as e:
            logger.error(f"Failed to start frame rendering: {e}")
            raise
            
        except Exception as e:
            logger.error(f"Unexpected error starting frame rendering: {e}")
            raise ModalAPIError(f"Failed to start frame rendering: {e}")
    
    async def get_rendering_status(
        self,
        job_id: str,
    ) -> RenderStatus:
        """
        Get current status of frame rendering.
        
        Args:
            job_id: Rendering job ID (format: "render_{upload_job_id}")
            
        Returns:
            RenderStatus with current progress
            
        Raises:
            ModalAPIError: If status retrieval fails
        """
        try:
            # Extract upload job ID from rendering job ID
            upload_job_id = job_id.replace("render_", "")
            
            # Read progress from Modal volume
            progress_data = await modal_service.get_progress(upload_job_id)
            
            if progress_data is None:
                logger.warning(f"No progress data found for job {job_id}")
                return self._create_initial_status(job_id)
            
            # Parse progress data
            progress = progress_data.get("progress", 0)
            status_str = progress_data.get("status", "processing")
            current_operation = progress_data.get("current_operation", "")
            images_processed = progress_data.get("images_processed", 0)
            total_images = progress_data.get("total_images", 1440)
            error = progress_data.get("error")
            elapsed_time = progress_data.get("elapsed_time", 0)
            
            # Map status string to JobStatus enum
            status_mapping = {
                "idle": JobStatus.IDLE,
                "processing": JobStatus.PROCESSING,
                "complete": JobStatus.COMPLETE,
                "failed": JobStatus.FAILED,
            }
            status = status_mapping.get(status_str, JobStatus.PROCESSING)
            
            # Calculate batch info
            frames_per_batch = 100
            total_batches = (total_images + frames_per_batch - 1) // frames_per_batch
            current_batch = images_processed // frames_per_batch
            current_frame = images_processed % frames_per_batch if images_processed > 0 else 0
            
            # Calculate rendering speed (frames per second)
            rendering_speed = None
            if elapsed_time > 0 and images_processed > 0:
                rendering_speed = images_processed / elapsed_time
            
            # Calculate estimated time remaining
            estimated_remaining = None
            if rendering_speed and rendering_speed > 0 and status == JobStatus.PROCESSING:
                remaining_frames = total_images - images_processed
                estimated_remaining = int(remaining_frames / rendering_speed)
            
            # Get GPU type
            gpu_type = settings.get_gpu_type()
            
            # Determine frame paths
            volume_path = None
            local_path = None
            frames_available = images_processed
            
            if status == JobStatus.COMPLETE:
                volume_path = f"/jobs/{upload_job_id}/frames/"
                local_path = str(settings.FRAME_STORAGE_PATH / upload_job_id)
            
            return RenderStatus(
                job_id=job_id,
                modal_call_id="",  # Would be tracked separately
                status=status,
                progress=progress,
                frames_rendered=images_processed,
                total_frames=total_images,
                current_batch=current_batch,
                total_batches=total_batches,
                current_frame=current_frame,
                rendering_speed=rendering_speed,
                gpu_type=gpu_type,
                estimated_time_remaining=estimated_remaining,
                volume_path=volume_path,
                local_path=local_path,
                frames_available=frames_available,
                error=error,
            )
            
        except Exception as e:
            logger.error(f"Failed to get rendering status for job {job_id}: {e}")
            raise ModalAPIError(f"Failed to get rendering status: {e}")
    
    async def retry_rendering(
        self,
        job_id: str,
        trajectory_config: Optional[Dict[str, Any]] = None,
    ) -> RenderResponse:
        """
        Retry frame rendering for a failed job.
        
        Args:
            job_id: Original rendering job ID
            trajectory_config: Camera trajectory configuration (optional)
            
        Returns:
            RenderResponse with new job details
        """
        logger.info(f"Retrying frame rendering for job {job_id}")
        
        # Extract training job ID and restart rendering
        upload_job_id = job_id.replace("render_", "")
        train_job_id = f"train_{upload_job_id}"
        
        return await self.start_rendering(train_job_id, trajectory_config)
    
    async def download_batch(
        self,
        job_id: str,
        batch_index: int,
    ) -> Path:
        """
        Download a specific batch of rendered frames from Modal volume.
        
        Args:
            job_id: Rendering job ID
            batch_index: Batch index to download (0-based)
            
        Returns:
            Path to extracted batch directory
            
        Raises:
            ModalAPIError: If download fails
        """
        try:
            upload_job_id = job_id.replace("render_", "")
            
            # Define paths
            batch_zip_name = f"batch_{batch_index:02d}.zip"
            volume_batch_path = f"jobs/{upload_job_id}/frames/{batch_zip_name}"
            local_job_dir = settings.FRAME_STORAGE_PATH / upload_job_id
            local_batch_zip = local_job_dir / batch_zip_name
            local_batch_dir = local_job_dir / f"batch_{batch_index:02d}"
            
            # Create local directories
            local_job_dir.mkdir(parents=True, exist_ok=True)
            
            # Download batch zip from Modal volume
            logger.info(f"Downloading batch {batch_index} from {volume_batch_path}")
            
            # TODO: Implement actual download from Modal volume
            # For now, this is a placeholder
            # await modal_service.download_file(volume_batch_path, local_batch_zip)
            
            # Extract batch zip
            if local_batch_zip.exists():
                logger.info(f"Extracting batch {batch_index} to {local_batch_dir}")
                local_batch_dir.mkdir(parents=True, exist_ok=True)
                
                with zipfile.ZipFile(local_batch_zip, 'r') as zipf:
                    zipf.extractall(local_batch_dir)
                
                logger.info(f"Batch {batch_index} extracted successfully")
                
                # Remove zip file after extraction
                local_batch_zip.unlink()
            
            return local_batch_dir
            
        except Exception as e:
            logger.error(f"Failed to download batch {batch_index} for job {job_id}: {e}")
            raise ModalAPIError(f"Failed to download batch: {e}")
    
    async def download_all_frames(
        self,
        job_id: str,
    ) -> Path:
        """
        Download all rendered frames for a job.
        
        Args:
            job_id: Rendering job ID
            
        Returns:
            Path to directory containing all frames
            
        Raises:
            ModalAPIError: If download fails
        """
        try:
            upload_job_id = job_id.replace("render_", "")
            
            # Get rendering status to determine number of batches
            status = await self.get_rendering_status(job_id)
            
            if status.status != JobStatus.COMPLETE:
                raise ValueError(f"Rendering not complete (status: {status.status})")
            
            # Download all batches
            total_batches = status.total_batches
            
            logger.info(f"Downloading {total_batches} batches for job {job_id}")
            
            for batch_idx in range(total_batches):
                await self.download_batch(job_id, batch_idx)
            
            # Return path to job frames directory
            frames_dir = settings.FRAME_STORAGE_PATH / upload_job_id
            
            logger.info(f"All frames downloaded to {frames_dir}")
            
            return frames_dir
            
        except Exception as e:
            logger.error(f"Failed to download all frames for job {job_id}: {e}")
            raise ModalAPIError(f"Failed to download frames: {e}")
    
    def get_frame_path(
        self,
        job_id: str,
        frame_number: int,
    ) -> Optional[Path]:
        """
        Get path to a specific frame file.
        
        Args:
            job_id: Rendering job ID
            frame_number: Frame number (1-1440)
            
        Returns:
            Path to frame file or None if not found
        """
        upload_job_id = job_id.replace("render_", "")
        frames_dir = settings.FRAME_STORAGE_PATH / upload_job_id
        
        # Search for frame in all batch directories
        frame_name = f"product_frame_{frame_number:04d}.png"
        
        for batch_dir in sorted(frames_dir.glob("batch_*")):
            frame_path = batch_dir / frame_name
            if frame_path.exists():
                return frame_path
        
        return None
    
    def _create_initial_status(self, job_id: str) -> RenderStatus:
        """Create initial rendering status when no progress data is available."""
        return RenderStatus(
            job_id=job_id,
            modal_call_id="",
            status=JobStatus.PROCESSING,
            progress=0,
            frames_rendered=0,
            total_frames=1440,
            current_batch=0,
            total_batches=15,
            current_frame=0,
            rendering_speed=None,
            gpu_type=settings.get_gpu_type(),
            estimated_time_remaining=None,
            volume_path=None,
            local_path=None,
            frames_available=0,
            error=None,
        )


# Global singleton instance
rendering_service = RenderingService()

