"""
NeRF Training Service - Orchestrates NeRF training via Modal

This service handles:
- Data preparation (COLMAP to NeRF Studio format)
- NeRF training with checkpointing
- Model validation
- Progress tracking and error handling
"""

import asyncio
import logging
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime

from .modal_service import modal_service, ModalAPIError
from ..models.nerf_models import (
    TrainingRequest,
    TrainingResponse,
    TrainingStatus,
    JobStatus,
    TrainingStage,
    ModalCallIDs,
    EstimatedCost,
    CostBreakdown,
    StageDetails,
    StageDetail,
)
from ..config import settings


# Configure logging
logger = logging.getLogger(__name__)


class NeRFTrainingService:
    """
    Service for managing NeRF training via Modal.
    """
    
    async def start_nerf_training(
        self,
        colmap_job_id: str,
        config: Optional[Dict[str, Any]] = None,
    ) -> TrainingResponse:
        """
        Start NeRF training for COLMAP-processed images.
        
        Args:
            colmap_job_id: COLMAP job ID (format: "colmap_{upload_job_id}")
            config: Training configuration (optional)
            
        Returns:
            TrainingResponse with job details
            
        Raises:
            ModalAPIError: If Modal function call fails
        """
        try:
            # Extract upload job ID from COLMAP job ID
            upload_job_id = colmap_job_id.replace("colmap_", "")
            
            logger.info(f"Starting NeRF training for job {upload_job_id}")
            
            # Determine paths
            colmap_path = f"jobs/{upload_job_id}/colmap"
            
            # Step 1: Call data preparation function
            prepare_call = await modal_service.call_function(
                "prepare_training_data",
                job_id=upload_job_id,
                colmap_path=colmap_path,
            )
            
            prepare_call_id = str(prepare_call.object_id) if hasattr(prepare_call, 'object_id') else "prepare_call"
            
            logger.info(f"Data preparation initiated: {prepare_call_id}")
            
            # Create training job ID
            train_job_id = f"train_{upload_job_id}"
            
            # Calculate estimated cost
            estimated_cost = self._calculate_cost_estimate(config)
            
            # Get GPU type
            gpu_type = settings.get_gpu_type()
            
            # Return initial response
            return TrainingResponse(
                job_id=train_job_id,
                modal_call_ids=ModalCallIDs(
                    prepare=prepare_call_id,
                    train=None,
                    validation=None,
                ),
                status=JobStatus.PROCESSING,
                stage=TrainingStage.DATA_PREPARATION,
                progress=0,
                estimated_time_remaining=1800,  # ~30 minutes
                estimated_cost=estimated_cost,
            )
            
        except ModalAPIError as e:
            logger.error(f"Failed to start NeRF training: {e}")
            raise
            
        except Exception as e:
            logger.error(f"Unexpected error starting NeRF training: {e}")
            raise ModalAPIError(f"Failed to start NeRF training: {e}")
    
    async def get_training_status(
        self,
        job_id: str,
    ) -> TrainingStatus:
        """
        Get current status of NeRF training.
        
        Args:
            job_id: Training job ID (format: "train_{upload_job_id}")
            
        Returns:
            TrainingStatus with current progress
            
        Raises:
            ModalAPIError: If status retrieval fails
        """
        try:
            # Extract upload job ID from training job ID
            upload_job_id = job_id.replace("train_", "")
            
            # Read progress from Modal volume
            progress_data = await modal_service.get_progress(upload_job_id)
            
            if progress_data is None:
                logger.warning(f"No progress data found for job {job_id}")
                return self._create_initial_status(job_id)
            
            # Parse progress data
            stage_str = progress_data.get("stage", "data_preparation")
            progress = progress_data.get("progress", 0)
            status_str = progress_data.get("status", "processing")
            current_operation = progress_data.get("current_operation", "")
            error = progress_data.get("error")
            elapsed_time = progress_data.get("elapsed_time", 0)
            
            # Map stage string to TrainingStage enum
            stage_mapping = {
                "data_preparation": TrainingStage.DATA_PREPARATION,
                "training": TrainingStage.TRAINING,
                "validation": TrainingStage.VALIDATION,
                "complete": TrainingStage.COMPLETE,
            }
            stage = stage_mapping.get(stage_str, TrainingStage.DATA_PREPARATION)
            
            # Map status string to JobStatus enum
            status_mapping = {
                "idle": JobStatus.IDLE,
                "processing": JobStatus.PROCESSING,
                "complete": JobStatus.COMPLETE,
                "failed": JobStatus.FAILED,
            }
            status = status_mapping.get(status_str, JobStatus.PROCESSING)
            
            # Calculate overall progress (weighted by stage)
            stage_weights = {
                TrainingStage.DATA_PREPARATION: (0, 5),  # 0-5%
                TrainingStage.TRAINING: (5, 90),  # 5-90%
                TrainingStage.VALIDATION: (90, 100),  # 90-100%
                TrainingStage.COMPLETE: (100, 100),
            }
            
            start_pct, end_pct = stage_weights.get(stage, (0, 100))
            stage_progress = progress
            overall_progress = start_pct + ((end_pct - start_pct) * (stage_progress / 100))
            
            # Calculate estimated time remaining
            if elapsed_time > 0 and overall_progress > 0:
                total_estimated_time = (elapsed_time / overall_progress) * 100
                estimated_remaining = int(total_estimated_time - elapsed_time)
            else:
                estimated_remaining = None
            
            # Calculate cost so far (rough estimate based on GPU and time)
            gpu_cost_per_hour = 0.35 if settings.is_development() else 1.10  # T4 vs A10G
            cost_so_far = (elapsed_time / 3600) * gpu_cost_per_hour
            
            # Get GPU type
            gpu_type = settings.get_gpu_type()
            
            # Determine model path
            model_path = None
            if status == JobStatus.COMPLETE:
                model_path = f"/jobs/{upload_job_id}/model"
            
            # Create stage details
            stage_details = StageDetails(
                prepare=StageDetail(
                    status="complete" if stage != TrainingStage.DATA_PREPARATION else "in_progress",
                    duration=int(elapsed_time) if stage == TrainingStage.DATA_PREPARATION else None,
                ),
                train=StageDetail(
                    status="in_progress" if stage == TrainingStage.TRAINING else (
                        "complete" if stage in [TrainingStage.VALIDATION, TrainingStage.COMPLETE] else "pending"
                    ),
                    duration=None,
                ),
                validation=StageDetail(
                    status="in_progress" if stage == TrainingStage.VALIDATION else (
                        "complete" if stage == TrainingStage.COMPLETE else "pending"
                    ),
                    duration=None,
                ),
            )
            
            return TrainingStatus(
                job_id=job_id,
                modal_call_ids=ModalCallIDs(),
                status=status,
                stage=stage,
                progress=overall_progress,
                stage_progress=stage_progress,
                current_iteration=None,  # Would be parsed from training logs
                total_iterations=None,
                loss=None,  # Would be parsed from training logs
                psnr=None,  # Available after validation
                ssim=None,  # Available after validation
                gpu_type=gpu_type,
                estimated_time_remaining=estimated_remaining,
                elapsed_time=int(elapsed_time),
                cost_so_far=cost_so_far,
                model_path=model_path,
                checkpoint_paths=[],
                error=error,
                stage_details=stage_details,
            )
            
        except Exception as e:
            logger.error(f"Failed to get training status for job {job_id}: {e}")
            raise ModalAPIError(f"Failed to get training status: {e}")
    
    async def retry_training(
        self,
        job_id: str,
        config: Optional[Dict[str, Any]] = None,
    ) -> TrainingResponse:
        """
        Retry NeRF training for a failed job.
        
        Args:
            job_id: Original training job ID
            config: Training configuration (optional)
            
        Returns:
            TrainingResponse with new job details
        """
        logger.info(f"Retrying NeRF training for job {job_id}")
        
        # Extract COLMAP job ID and restart training
        upload_job_id = job_id.replace("train_", "")
        colmap_job_id = f"colmap_{upload_job_id}"
        
        return await self.start_nerf_training(colmap_job_id, config)
    
    def _calculate_cost_estimate(
        self,
        config: Optional[Dict[str, Any]] = None,
    ) -> EstimatedCost:
        """
        Calculate estimated cost for NeRF processing.
        
        Args:
            config: Training configuration
            
        Returns:
            EstimatedCost with breakdown
        """
        # Get GPU cost per hour
        if settings.is_development():
            gpu_cost_per_hour = 0.35  # T4
        else:
            gpu_cost_per_hour = 1.10  # A10G
        
        # Estimate times (in hours)
        colmap_time = 0.3  # ~18 minutes
        training_time = 0.4  # ~24 minutes
        rendering_time = 0.3  # ~18 minutes
        
        # Calculate costs
        colmap_cost = colmap_time * gpu_cost_per_hour
        training_cost = training_time * gpu_cost_per_hour
        rendering_cost = rendering_time * gpu_cost_per_hour
        
        total_cost = colmap_cost + training_cost + rendering_cost
        
        return EstimatedCost(
            total_usd=round(total_cost, 2),
            breakdown=CostBreakdown(
                colmap=round(colmap_cost, 2),
                training=round(training_cost, 2),
                rendering=round(rendering_cost, 2),
            ),
        )
    
    def _create_initial_status(self, job_id: str) -> TrainingStatus:
        """Create initial training status when no progress data is available."""
        return TrainingStatus(
            job_id=job_id,
            modal_call_ids=ModalCallIDs(),
            status=JobStatus.PROCESSING,
            stage=TrainingStage.DATA_PREPARATION,
            progress=0,
            stage_progress=0,
            gpu_type=settings.get_gpu_type(),
            estimated_time_remaining=None,
            elapsed_time=0,
            cost_so_far=0.0,
            model_path=None,
            checkpoint_paths=[],
            error=None,
            stage_details=StageDetails(
                prepare=StageDetail(status="pending", duration=None),
                train=StageDetail(status="pending", duration=None),
                validation=StageDetail(status="pending", duration=None),
            ),
        )


# Global singleton instance
nerf_training_service = NeRFTrainingService()

