"""Pydantic models for video composition."""
from typing import List, Optional
from pydantic import BaseModel, Field
from enum import Enum


class CompositionStatus(str, Enum):
    """Video composition job status."""
    PENDING = "pending"
    DOWNLOADING = "downloading"
    COMPOSING = "composing"
    OPTIMIZING = "optimizing"
    COMPLETED = "completed"
    FAILED = "failed"


class VideoClipInput(BaseModel):
    """Model for a video clip to include in composition."""
    scene_number: int = Field(..., description="Scene number in sequence", ge=1)
    video_url: str = Field(..., description="URL of the video clip")
    duration: float = Field(..., description="Duration in seconds", gt=0)


class CompositionRequest(BaseModel):
    """Request model for video composition."""
    clips: List[VideoClipInput] = Field(..., description="List of video clips to compose", min_length=1)
    audio_url: Optional[str] = Field(None, description="URL of background music")
    include_crossfade: bool = Field(True, description="Whether to include crossfade transitions")
    optimize_size: bool = Field(True, description="Whether to optimize final file size")
    target_size_mb: float = Field(50.0, description="Target file size in MB", gt=0, le=100)


class CompositionResponse(BaseModel):
    """Response model for composition initiation."""
    success: bool = Field(..., description="Whether job was successfully initiated")
    job_id: str = Field(..., description="Unique job ID for tracking progress")
    message: str = Field(..., description="Status message")
    total_clips: int = Field(..., description="Total number of clips to compose")


class CompositionJobStatus(BaseModel):
    """Model for composition job status."""
    job_id: str = Field(..., description="Unique job ID")
    status: CompositionStatus = Field(..., description="Current job status")
    progress_percent: int = Field(0, description="Progress percentage (0-100)")
    total_clips: int = Field(..., description="Total number of clips")
    current_step: Optional[str] = Field(None, description="Current processing step")
    video_url: Optional[str] = Field(None, description="URL of the final composed video")
    file_path: Optional[str] = Field(None, description="Local file path of the composed video")
    file_size_mb: Optional[float] = Field(None, description="Size of final video in MB")
    duration_seconds: Optional[float] = Field(None, description="Duration of final video in seconds")
    error: Optional[str] = Field(None, description="Error message if job failed")
    created_at: str = Field(..., description="Job creation timestamp (ISO format)")
    updated_at: str = Field(..., description="Last update timestamp (ISO format)")


class CompositionJobStatusResponse(BaseModel):
    """Response model for composition job status polling."""
    success: bool = Field(..., description="Whether status retrieval was successful")
    job_status: Optional[CompositionJobStatus] = Field(None, description="Current job status")
    message: Optional[str] = Field(None, description="Optional message")
