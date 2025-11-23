"""FastAPI router for video composition endpoints."""
import uuid
from datetime import datetime
from typing import Dict, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from pathlib import Path

from app.models.composition_models import (
    CompositionRequest,
    CompositionResponse,
    CompositionJobStatus,
    CompositionJobStatusResponse,
    CompositionStatus
)
from app.services.ffmpeg_service import FFmpegCompositionService

router = APIRouter(prefix="/api/composition", tags=["composition"])

# In-memory job tracking
# In production, this should be replaced with Redis or a database
_jobs: Dict[str, CompositionJobStatus] = {}

# Initialize composition service
composition_service = None  # Will be initialized on first request


def get_composition_service() -> FFmpegCompositionService:
    """Get or initialize FFmpeg composition service."""
    global composition_service
    if composition_service is None:
        try:
            composition_service = FFmpegCompositionService()
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Composition service not available: {str(e)}"
            )
    return composition_service


def _create_composition_job(request: CompositionRequest) -> str:
    """
    Create a new video composition job.

    Args:
        request: Composition request with clips and settings

    Returns:
        job_id: Unique identifier for the job
    """
    job_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    # Create job status
    job_status = CompositionJobStatus(
        job_id=job_id,
        status=CompositionStatus.PENDING,
        progress_percent=0,
        total_clips=len(request.clips),
        current_step="Job created",
        video_url=None,
        file_size_mb=None,
        duration_seconds=None,
        error=None,
        created_at=now,
        updated_at=now
    )

    # Store in memory
    _jobs[job_id] = job_status

    return job_id


def _update_job_status(
    job_id: str,
    status: CompositionStatus,
    progress: int,
    current_step: Optional[str] = None,
    video_url: Optional[str] = None,
    file_size_mb: Optional[float] = None,
    duration_seconds: Optional[float] = None,
    error: Optional[str] = None
):
    """
    Update composition job status.

    Args:
        job_id: Job identifier
        status: New status
        progress: Progress percentage (0-100)
        current_step: Current processing step description
        video_url: URL of final video (if completed)
        file_size_mb: File size in MB (if completed)
        duration_seconds: Duration in seconds (if completed)
        error: Error message (if failed)
    """
    if job_id not in _jobs:
        return

    job = _jobs[job_id]
    job.status = status
    job.progress_percent = progress

    if current_step:
        job.current_step = current_step
    if video_url:
        job.video_url = video_url
    if file_size_mb is not None:
        job.file_size_mb = file_size_mb
    if duration_seconds is not None:
        job.duration_seconds = duration_seconds
    if error:
        job.error = error

    job.updated_at = datetime.utcnow().isoformat()


async def _process_composition(job_id: str, request: CompositionRequest):
    """
    Background task to process video composition.

    Args:
        job_id: Job identifier
        request: Composition request
    """
    if job_id not in _jobs:
        return

    try:
        # Get composition service
        service = get_composition_service()

        # Step 1: Downloading
        _update_job_status(
            job_id,
            CompositionStatus.DOWNLOADING,
            10,
            current_step=f"Downloading {len(request.clips)} clips and audio..."
        )

        # Step 2: Composing
        _update_job_status(
            job_id,
            CompositionStatus.COMPOSING,
            30,
            current_step="Composing video with transitions..."
        )

        # Prepare clip data for composition
        clips_data = [
            {
                "scene_number": clip.scene_number,
                "video_url": clip.video_url,
                "duration": clip.duration,
                "trim_start_time": clip.trim_start_time,
                "trim_end_time": clip.trim_end_time
            }
            for clip in request.clips
        ]

        # Compose video
        output_path = await service.compose_video(
            video_clips=clips_data,
            audio_url=request.audio_url,
            include_crossfade=request.include_crossfade,
            target_bitrate="3M" if not request.optimize_size else "2500k"
        )

        if not output_path or not output_path.exists():
            raise Exception("Video composition failed to produce output file")

        # Step 3: Optimizing (if requested)
        if request.optimize_size:
            _update_job_status(
                job_id,
                CompositionStatus.OPTIMIZING,
                80,
                current_step="Optimizing file size..."
            )

            output_path = await service.optimize_file_size(
                output_path,
                target_size_mb=request.target_size_mb
            )

        # Step 4: Completed
        # Get file info
        file_size_mb = output_path.stat().st_size / (1024 * 1024)

        # Calculate duration
        from ffmpeg import probe
        probe_data = probe(str(output_path))
        duration_seconds = float(probe_data['format']['duration'])

        # For now, video_url is the local file path
        # In production, you would upload this to cloud storage (S3, etc.)
        video_url = f"/api/composition/download/{job_id}"

        # Store file path and URL separately
        _jobs[job_id].file_path = str(output_path)
        _jobs[job_id].video_url = video_url

        _update_job_status(
            job_id,
            CompositionStatus.COMPLETED,
            100,
            current_step="Composition complete",
            video_url=video_url,
            file_size_mb=file_size_mb,
            duration_seconds=duration_seconds
        )

        print(f"✅ Composition job {job_id} completed successfully")

    except Exception as e:
        # Job failed
        error_msg = f"Composition failed: {str(e)}"
        print(f"✗ Job {job_id} failed: {error_msg}")

        _update_job_status(
            job_id,
            CompositionStatus.FAILED,
            0,
            current_step="Failed",
            error=error_msg
        )


@router.post("/compose", response_model=CompositionResponse)
async def compose_video(
    request: CompositionRequest,
    background_tasks: BackgroundTasks
) -> CompositionResponse:
    """
    Initiate video composition with transitions and audio.

    This endpoint:
    1. Accepts video clips and optional audio
    2. Creates a composition job
    3. Processes composition in the background
    4. Returns job ID for status polling

    Args:
        request: Composition request with clips and settings
        background_tasks: FastAPI background tasks manager

    Returns:
        CompositionResponse with job_id for tracking
    """
    try:
        # Validate request
        if not request.clips:
            raise HTTPException(
                status_code=400,
                detail="At least one video clip is required"
            )

        # Validate clip URLs
        clips_without_urls = [
            c.scene_number for c in request.clips
            if not c.video_url
        ]
        if clips_without_urls:
            raise HTTPException(
                status_code=400,
                detail=f"Clips missing video URLs: {clips_without_urls}"
            )

        # Create job
        job_id = _create_composition_job(request)

        # Start background composition
        background_tasks.add_task(_process_composition, job_id, request)

        return CompositionResponse(
            success=True,
            job_id=job_id,
            message=f"Composition job created for {len(request.clips)} clips",
            total_clips=len(request.clips)
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to initiate composition: {str(e)}"
        )


@router.get("/status/{job_id}", response_model=CompositionJobStatusResponse)
async def get_composition_status(job_id: str) -> CompositionJobStatusResponse:
    """
    Get the current status of a composition job.

    Args:
        job_id: Unique job identifier from /compose endpoint

    Returns:
        CompositionJobStatusResponse with current job status
    """
    try:
        # Check if job exists
        if job_id not in _jobs:
            raise HTTPException(
                status_code=404,
                detail=f"Job {job_id} not found"
            )

        job_status = _jobs[job_id]

        return CompositionJobStatusResponse(
            success=True,
            job_status=job_status,
            message=f"Job status: {job_status.status.value}"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve job status: {str(e)}"
        )


@router.get("/download/{job_id}")
async def download_video(job_id: str):
    """
    Download the composed video file.

    Args:
        job_id: Unique job identifier

    Returns:
        FileResponse with the video file
    """
    try:
        # Check if job exists
        if job_id not in _jobs:
            raise HTTPException(
                status_code=404,
                detail=f"Job {job_id} not found"
            )

        job = _jobs[job_id]

        # Check if job is completed
        if job.status != CompositionStatus.COMPLETED:
            raise HTTPException(
                status_code=400,
                detail=f"Job {job_id} is not completed yet (status: {job.status.value})"
            )

        # Get video file path
        if not job.file_path:
            raise HTTPException(
                status_code=404,
                detail=f"Video file not found for job {job_id}"
            )

        video_path = Path(job.file_path)
        if not video_path.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Video file does not exist: {video_path}"
            )

        # Return file
        return FileResponse(
            path=str(video_path),
            media_type="video/mp4",
            filename=f"composed_video_{job_id}.mp4"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to download video: {str(e)}"
        )


@router.get("/jobs")
async def list_jobs():
    """List all composition jobs (for debugging)."""
    return {
        "total_jobs": len(_jobs),
        "jobs": [
            {
                "job_id": job.job_id,
                "status": job.status.value,
                "progress": job.progress_percent,
                "total_clips": job.total_clips,
                "current_step": job.current_step,
                "video_url": job.video_url,
                "file_path": job.file_path,
                "file_size_mb": job.file_size_mb,
                "duration_seconds": job.duration_seconds
            }
            for job in _jobs.values()
        ]
    }
