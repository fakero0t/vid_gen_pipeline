"""
Job State Management Utilities

This module provides utilities for managing job state throughout the NeRF pipeline,
including persistence, status tracking, and job lifecycle management.
"""

import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from enum import Enum

from ..models.nerf_models import JobStatus, UploadStatus, COLMAPStage, TrainingStage
from ..config import settings

logger = logging.getLogger(__name__)


class JobType(str, Enum):
    """Type of NeRF processing job."""
    UPLOAD = "upload"
    COLMAP = "colmap"
    TRAINING = "training"
    RENDERING = "rendering"


class JobState:
    """
    Represents the state of a NeRF processing job.
    """
    
    def __init__(
        self,
        job_id: str,
        job_type: JobType,
        status: str = "idle",
        data: Dict[str, Any] = None
    ):
        self.job_id = job_id
        self.job_type = job_type
        self.status = status
        self.data = data or {}
        self.created_at = datetime.utcnow().isoformat()
        self.updated_at = self.created_at
    
    def update(self, **kwargs):
        """Update job state with new data."""
        for key, value in kwargs.items():
            if key == "data":
                self.data.update(value)
            else:
                setattr(self, key, value)
        self.updated_at = datetime.utcnow().isoformat()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert job state to dictionary."""
        return {
            "job_id": self.job_id,
            "job_type": self.job_type.value,
            "status": self.status,
            "data": self.data,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'JobState':
        """Create job state from dictionary."""
        job = cls(
            job_id=data["job_id"],
            job_type=JobType(data["job_type"]),
            status=data["status"],
            data=data.get("data", {})
        )
        job.created_at = data.get("created_at", job.created_at)
        job.updated_at = data.get("updated_at", job.updated_at)
        return job


class JobStateManager:
    """
    Manages job state persistence and retrieval.
    
    Stores job state in JSON files in the upload storage path.
    """
    
    def __init__(self, state_dir: Optional[Path] = None):
        """
        Initialize job state manager.
        
        Args:
            state_dir: Directory to store job state files (defaults to upload storage)
        """
        self.state_dir = state_dir or settings.get_upload_storage_path() / "jobs"
        self.state_dir.mkdir(parents=True, exist_ok=True)
    
    def _get_state_file(self, job_id: str) -> Path:
        """Get path to job state file."""
        return self.state_dir / f"{job_id}.json"
    
    def save(self, job: JobState) -> None:
        """
        Save job state to disk.
        
        Args:
            job: Job state to save
        """
        try:
            state_file = self._get_state_file(job.job_id)
            with open(state_file, 'w') as f:
                json.dump(job.to_dict(), f, indent=2)
            logger.debug(f"Saved job state: {job.job_id}")
        except Exception as e:
            logger.error(f"Failed to save job state {job.job_id}: {e}")
            raise
    
    def load(self, job_id: str) -> Optional[JobState]:
        """
        Load job state from disk.
        
        Args:
            job_id: Job identifier
            
        Returns:
            Job state or None if not found
        """
        try:
            state_file = self._get_state_file(job_id)
            if not state_file.exists():
                return None
            
            with open(state_file, 'r') as f:
                data = json.load(f)
            
            return JobState.from_dict(data)
        except Exception as e:
            logger.error(f"Failed to load job state {job_id}: {e}")
            return None
    
    def exists(self, job_id: str) -> bool:
        """
        Check if job state exists.
        
        Args:
            job_id: Job identifier
            
        Returns:
            True if job exists
        """
        return self._get_state_file(job_id).exists()
    
    def delete(self, job_id: str) -> None:
        """
        Delete job state.
        
        Args:
            job_id: Job identifier
        """
        try:
            state_file = self._get_state_file(job_id)
            if state_file.exists():
                state_file.unlink()
                logger.debug(f"Deleted job state: {job_id}")
        except Exception as e:
            logger.error(f"Failed to delete job state {job_id}: {e}")
    
    def list_jobs(
        self,
        job_type: Optional[JobType] = None,
        status: Optional[str] = None
    ) -> List[JobState]:
        """
        List all jobs, optionally filtered by type and status.
        
        Args:
            job_type: Filter by job type
            status: Filter by status
            
        Returns:
            List of job states
        """
        jobs = []
        
        for state_file in self.state_dir.glob("*.json"):
            try:
                with open(state_file, 'r') as f:
                    data = json.load(f)
                
                # Apply filters
                if job_type and data.get("job_type") != job_type.value:
                    continue
                if status and data.get("status") != status:
                    continue
                
                jobs.append(JobState.from_dict(data))
            except Exception as e:
                logger.warning(f"Failed to load job from {state_file}: {e}")
                continue
        
        # Sort by created_at (newest first)
        jobs.sort(key=lambda j: j.created_at, reverse=True)
        
        return jobs
    
    def cleanup_old_jobs(self, hours: int = None) -> int:
        """
        Clean up jobs older than specified hours.
        
        Args:
            hours: Age threshold in hours (defaults to JOB_CLEANUP_HOURS setting)
            
        Returns:
            Number of jobs cleaned up
        """
        hours = hours or settings.JOB_CLEANUP_HOURS
        cutoff = datetime.utcnow() - timedelta(hours=hours)
        cleaned = 0
        
        for state_file in self.state_dir.glob("*.json"):
            try:
                # Check file modification time
                mtime = datetime.fromtimestamp(state_file.stat().st_mtime)
                
                if mtime < cutoff:
                    # Load to check if it's a completed/failed job
                    with open(state_file, 'r') as f:
                        data = json.load(f)
                    
                    status = data.get("status", "")
                    if status in ("complete", "failed"):
                        state_file.unlink()
                        cleaned += 1
                        logger.info(f"Cleaned up old job: {state_file.stem}")
            except Exception as e:
                logger.warning(f"Failed to cleanup {state_file}: {e}")
                continue
        
        return cleaned


# Global job state manager instance
_job_manager: Optional[JobStateManager] = None


def get_job_manager() -> JobStateManager:
    """
    Get global job state manager instance.
    
    Returns:
        Job state manager singleton
    """
    global _job_manager
    if _job_manager is None:
        _job_manager = JobStateManager()
    return _job_manager


def create_job(
    job_id: str,
    job_type: JobType,
    initial_data: Dict[str, Any] = None
) -> JobState:
    """
    Create a new job with initial state.
    
    Args:
        job_id: Unique job identifier
        job_type: Type of job
        initial_data: Initial job data
        
    Returns:
        Created job state
    """
    manager = get_job_manager()
    
    job = JobState(
        job_id=job_id,
        job_type=job_type,
        status="idle",
        data=initial_data or {}
    )
    
    manager.save(job)
    return job


def update_job(
    job_id: str,
    status: Optional[str] = None,
    data: Optional[Dict[str, Any]] = None
) -> Optional[JobState]:
    """
    Update job state.
    
    Args:
        job_id: Job identifier
        status: New status (optional)
        data: Data to merge into job state (optional)
        
    Returns:
        Updated job state or None if not found
    """
    manager = get_job_manager()
    
    job = manager.load(job_id)
    if not job:
        logger.warning(f"Job not found: {job_id}")
        return None
    
    if status:
        job.update(status=status)
    if data:
        job.update(data=data)
    
    manager.save(job)
    return job


def get_job(job_id: str) -> Optional[JobState]:
    """
    Get job state.
    
    Args:
        job_id: Job identifier
        
    Returns:
        Job state or None if not found
    """
    manager = get_job_manager()
    return manager.load(job_id)


def delete_job(job_id: str) -> None:
    """
    Delete job state.
    
    Args:
        job_id: Job identifier
    """
    manager = get_job_manager()
    manager.delete(job_id)

