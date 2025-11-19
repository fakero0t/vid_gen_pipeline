"""
Pydantic Models for NeRF Pipeline

This module contains all Pydantic schemas for the NeRF processing pipeline,
including upload, COLMAP, training, and rendering endpoints.
"""

from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any, Literal
from enum import Enum


# Enums for status types
class JobStatus(str, Enum):
    """Job processing status."""
    IDLE = "idle"
    PROCESSING = "processing"
    COMPLETE = "complete"
    FAILED = "failed"


class UploadStatus(str, Enum):
    """Upload processing status."""
    IDLE = "idle"
    UPLOADING = "uploading"
    VALIDATING = "validating"
    COMPLETE = "complete"
    FAILED = "failed"


class COLMAPStage(str, Enum):
    """COLMAP processing stages."""
    FEATURE_EXTRACTION = "feature_extraction"
    FEATURE_MATCHING = "feature_matching"
    SFM = "sfm"
    COMPLETE = "complete"


class TrainingStage(str, Enum):
    """Training processing stages."""
    DATA_PREPARATION = "data_preparation"
    TRAINING = "training"
    VALIDATION = "validation"
    COMPLETE = "complete"


class ImageStatus(str, Enum):
    """Image validation status."""
    PENDING = "pending"
    UPLOADING = "uploading"
    VALID = "valid"
    WARNING = "warning"
    ERROR = "error"


# ============================================================================
# Product Upload Models
# ============================================================================

class ImageDimensions(BaseModel):
    """Image dimensions."""
    width: int = Field(..., description="Image width in pixels")
    height: int = Field(..., description="Image height in pixels")


class ImageValidation(BaseModel):
    """Individual image validation result."""
    file_id: str = Field(..., description="Unique file identifier")
    filename: str = Field(..., description="Original filename")
    url: str = Field(..., description="URL to access the image")
    size: int = Field(..., description="File size in bytes")
    dimensions: ImageDimensions = Field(..., description="Image dimensions")
    status: ImageStatus = Field(..., description="Validation status")
    warnings: List[str] = Field(default_factory=list, description="Non-blocking warnings")
    errors: List[str] = Field(default_factory=list, description="Validation errors")


class ValidationSummary(BaseModel):
    """Summary of validation results."""
    total: int = Field(..., description="Total number of images")
    valid: int = Field(..., description="Number of valid images")
    warnings: int = Field(..., description="Number of images with warnings")
    errors: int = Field(..., description="Number of images with errors")


class UploadResponse(BaseModel):
    """Response from product photo upload."""
    job_id: str = Field(..., description="Unique job identifier")
    status: UploadStatus = Field(..., description="Upload status")
    uploaded_count: int = Field(..., description="Number of images uploaded")
    total_count: int = Field(..., description="Total number of images expected")
    validated_images: List[ImageValidation] = Field(
        default_factory=list,
        description="List of validated images"
    )
    validation_summary: ValidationSummary = Field(..., description="Validation summary")
    errors: List[str] = Field(default_factory=list, description="Global errors")
    auto_start_nerf: bool = Field(
        default=False,
        description="Whether to automatically start NeRF processing"
    )


class UploadStatusResponse(BaseModel):
    """Response from upload status check."""
    job_id: str = Field(..., description="Job identifier")
    status: UploadStatus = Field(..., description="Current upload status")
    progress: float = Field(..., ge=0, le=100, description="Upload progress (0-100)")
    uploaded_count: int = Field(..., description="Number of images uploaded so far")
    total_count: int = Field(..., description="Total number of images")
    upload_speed_mbps: Optional[float] = Field(None, description="Upload speed in Mbps")
    estimated_time_remaining: Optional[int] = Field(
        None,
        description="Estimated time remaining in seconds"
    )


# ============================================================================
# COLMAP Models
# ============================================================================

class COLMAPRequest(BaseModel):
    """Request to start COLMAP processing."""
    job_id: str = Field(..., description="Upload job ID")
    image_paths: Optional[List[str]] = Field(
        default=None,
        description="Paths to uploaded images (deprecated, images already in Modal)"
    )


class COLMAPResponse(BaseModel):
    """Response from COLMAP start request."""
    job_id: str = Field(..., description="COLMAP job identifier")
    status: JobStatus = Field(..., description="Job status")
    stage: COLMAPStage = Field(..., description="Current COLMAP stage")
    progress: float = Field(..., ge=0, le=100, description="Progress percentage")
    estimated_time_remaining: Optional[int] = Field(
        None,
        description="Estimated time remaining in seconds"
    )


class COLMAPStatus(BaseModel):
    """COLMAP processing status."""
    job_id: str = Field(..., description="Job identifier")
    status: JobStatus = Field(..., description="Processing status")
    stage: COLMAPStage = Field(..., description="Current processing stage")
    progress: float = Field(..., ge=0, le=100, description="Progress percentage")
    current_operation: str = Field(..., description="Current operation description")
    images_processed: int = Field(..., description="Number of images processed")
    total_images: int = Field(..., description="Total number of images")
    estimated_time_remaining: Optional[int] = Field(
        None,
        description="Estimated time remaining in seconds"
    )
    output_path: Optional[str] = Field(None, description="Path to COLMAP output")
    error: Optional[str] = Field(None, description="Error message if failed")


# ============================================================================
# Training Models
# ============================================================================

class TrainingConfig(BaseModel):
    """Configuration for NeRF training."""
    num_iterations: int = Field(
        default=15000,
        ge=1000,
        le=100000,
        description="Number of training iterations"
    )
    resolution: List[int] = Field(
        default=[1920, 1080],
        description="Render resolution [width, height]"
    )
    downscale_factor: int = Field(
        default=1,
        ge=1,
        le=4,
        description="Image downscaling factor (1=no downscale, 2=half)"
    )
    
    @validator('resolution')
    def validate_resolution(cls, v):
        """Validate resolution format."""
        if len(v) != 2:
            raise ValueError("Resolution must be [width, height]")
        if any(dim < 256 or dim > 4096 for dim in v):
            raise ValueError("Resolution dimensions must be between 256 and 4096")
        return v


class CostBreakdown(BaseModel):
    """Cost breakdown for different stages."""
    colmap: float = Field(..., description="COLMAP processing cost in USD")
    training: float = Field(..., description="Training cost in USD")
    rendering: float = Field(..., description="Rendering cost in USD")


class EstimatedCost(BaseModel):
    """Estimated cost for NeRF processing."""
    total_usd: float = Field(..., description="Total estimated cost in USD")
    breakdown: CostBreakdown = Field(..., description="Cost breakdown by stage")


class ModalCallIDs(BaseModel):
    """Modal function call IDs for tracking."""
    prepare: Optional[str] = Field(None, description="Data preparation call ID")
    train: Optional[str] = Field(None, description="Training call ID")
    validation: Optional[str] = Field(None, description="Validation call ID")


class TrainingRequest(BaseModel):
    """Request to start NeRF training."""
    colmap_job_id: str = Field(..., description="COLMAP job ID")
    config: TrainingConfig = Field(default_factory=TrainingConfig, description="Training configuration")


class TrainingResponse(BaseModel):
    """Response from training start request."""
    job_id: str = Field(..., description="Training job identifier")
    modal_call_ids: ModalCallIDs = Field(..., description="Modal function call IDs")
    status: JobStatus = Field(..., description="Job status")
    stage: TrainingStage = Field(..., description="Current training stage")
    progress: float = Field(..., ge=0, le=100, description="Overall progress percentage")
    estimated_time_remaining: Optional[int] = Field(
        None,
        description="Estimated time remaining in seconds"
    )
    estimated_cost: EstimatedCost = Field(..., description="Estimated cost")


class StageDetail(BaseModel):
    """Details for a specific processing stage."""
    status: Literal["pending", "in_progress", "complete", "failed"] = Field(
        ...,
        description="Stage status"
    )
    duration: Optional[int] = Field(None, description="Stage duration in seconds")


class StageDetails(BaseModel):
    """Details for all training stages."""
    prepare: StageDetail = Field(..., description="Data preparation stage")
    train: StageDetail = Field(..., description="Training stage")
    validation: StageDetail = Field(..., description="Validation stage")


class TrainingStatus(BaseModel):
    """Training processing status."""
    job_id: str = Field(..., description="Job identifier")
    modal_call_ids: ModalCallIDs = Field(..., description="Modal function call IDs")
    status: JobStatus = Field(..., description="Processing status")
    stage: TrainingStage = Field(..., description="Current processing stage")
    progress: float = Field(..., ge=0, le=100, description="Overall progress (0-100)")
    stage_progress: float = Field(..., ge=0, le=100, description="Progress within current stage")
    current_iteration: Optional[int] = Field(None, description="Current training iteration")
    total_iterations: Optional[int] = Field(None, description="Total training iterations")
    loss: Optional[float] = Field(None, description="Current loss value")
    psnr: Optional[float] = Field(None, description="PSNR value (after validation)")
    ssim: Optional[float] = Field(None, description="SSIM value (after validation)")
    gpu_type: str = Field(..., description="GPU type used (T4, A10G, A100)")
    estimated_time_remaining: Optional[int] = Field(
        None,
        description="Estimated time remaining in seconds"
    )
    elapsed_time: int = Field(..., description="Total elapsed time in seconds")
    cost_so_far: float = Field(..., description="Cost so far in USD")
    model_path: Optional[str] = Field(None, description="Path to trained model (when complete)")
    checkpoint_paths: List[str] = Field(
        default_factory=list,
        description="Paths to saved checkpoints"
    )
    error: Optional[str] = Field(None, description="Error message if failed")
    stage_details: StageDetails = Field(..., description="Details for each stage")


# ============================================================================
# Rendering Models
# ============================================================================

class TrajectoryConfig(BaseModel):
    """Camera trajectory configuration."""
    trajectory_type: Literal["circular_orbit"] = Field(
        default="circular_orbit",
        description="Type of camera trajectory"
    )
    center: List[float] = Field(
        default=[0, 0, 0],
        description="Product center position [x, y, z]"
    )
    radius: float = Field(default=2.0, ge=0.1, description="Camera distance from center")
    elevation: float = Field(
        default=35,
        ge=0,
        le=90,
        description="Elevation angle in degrees"
    )
    start_angle: float = Field(default=0, description="Starting rotation angle")
    end_angle: float = Field(default=360, description="Ending rotation angle")
    num_frames: int = Field(default=1440, ge=1, description="Number of frames to render")
    resolution: List[int] = Field(
        default=[1920, 1080],
        description="Render resolution [width, height]"
    )


class RenderRequest(BaseModel):
    """Request to start frame rendering."""
    train_job_id: str = Field(..., description="Training job ID")
    trajectory_config: TrajectoryConfig = Field(
        default_factory=TrajectoryConfig,
        description="Camera trajectory configuration"
    )


class RenderResponse(BaseModel):
    """Response from render start request."""
    job_id: str = Field(..., description="Rendering job identifier")
    modal_call_id: str = Field(..., description="Modal function call ID")
    status: JobStatus = Field(..., description="Job status")
    progress: float = Field(..., ge=0, le=100, description="Progress percentage")
    frames_rendered: int = Field(default=0, description="Number of frames rendered")
    total_frames: int = Field(..., description="Total number of frames to render")
    current_batch: int = Field(default=0, description="Current batch being rendered")
    total_batches: int = Field(..., description="Total number of batches")
    gpu_type: str = Field(..., description="GPU type used")
    estimated_time_remaining: Optional[int] = Field(
        None,
        description="Estimated time remaining in seconds"
    )


class RenderStatus(BaseModel):
    """Rendering processing status."""
    job_id: str = Field(..., description="Job identifier")
    modal_call_id: str = Field(..., description="Modal function call ID")
    status: JobStatus = Field(..., description="Processing status")
    progress: float = Field(..., ge=0, le=100, description="Progress percentage")
    frames_rendered: int = Field(..., description="Number of frames rendered")
    total_frames: int = Field(..., description="Total number of frames")
    current_batch: int = Field(..., description="Current batch being rendered")
    total_batches: int = Field(..., description="Total number of batches")
    current_frame: int = Field(..., description="Current frame number")
    rendering_speed: Optional[float] = Field(None, description="Frames per second")
    gpu_type: str = Field(..., description="GPU type used")
    estimated_time_remaining: Optional[int] = Field(
        None,
        description="Estimated time remaining in seconds"
    )
    volume_path: Optional[str] = Field(
        None,
        description="Path to frames in Modal volume"
    )
    local_path: Optional[str] = Field(
        None,
        description="Path to frames in local storage (after download)"
    )
    frames_available: int = Field(
        default=0,
        description="Number of frames available locally"
    )
    error: Optional[str] = Field(None, description="Error message if failed")

