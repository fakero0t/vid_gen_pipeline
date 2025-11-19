"""
Progress Tracking Utilities

This module provides utilities for tracking and reporting progress
from Modal functions to the backend via progress.json files.
"""

import json
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime
from enum import Enum


class Stage(str, Enum):
    """Progress stages for NeRF pipeline."""
    INITIALIZING = "initializing"
    FEATURE_EXTRACTION = "feature_extraction"
    FEATURE_MATCHING = "feature_matching"
    SFM = "sfm"
    DATA_PREPARATION = "data_preparation"
    TRAINING = "training"
    VALIDATION = "validation"
    RENDERING = "rendering"
    COMPLETE = "complete"
    FAILED = "failed"


class ProgressTracker:
    """
    Track and persist progress for long-running Modal functions.
    """
    
    def __init__(self, job_id: str, progress_file: Path):
        """
        Initialize progress tracker.
        
        Args:
            job_id: Unique job identifier
            progress_file: Path to progress.json file
        """
        self.job_id = job_id
        self.progress_file = progress_file
        self.started_at = datetime.utcnow().isoformat()
        
        # Ensure directory exists
        progress_file.parent.mkdir(parents=True, exist_ok=True)
        
        # Initialize progress file
        self.update(stage=Stage.INITIALIZING, progress=0)
    
    def update(
        self,
        stage: Stage,
        progress: float,
        message: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None
    ) -> None:
        """
        Update progress and write to file.
        
        Args:
            stage: Current processing stage
            progress: Progress percentage (0-100)
            message: Human-readable progress message
            details: Additional progress details (iteration, loss, etc.)
            error: Error message if failed
        """
        data = {
            "job_id": self.job_id,
            "stage": stage.value,
            "progress": min(100, max(0, progress)),
            "message": message or self._default_message(stage),
            "updated_at": datetime.utcnow().isoformat(),
            "started_at": self.started_at,
        }
        
        if details:
            data["details"] = details
        
        if error:
            data["error"] = error
            data["stage"] = Stage.FAILED.value
        
        # Write to file
        with open(self.progress_file, 'w') as f:
            json.dump(data, f, indent=2)
    
    def complete(self, message: Optional[str] = None) -> None:
        """
        Mark progress as complete.
        
        Args:
            message: Completion message
        """
        self.update(
            stage=Stage.COMPLETE,
            progress=100,
            message=message or "Processing complete"
        )
    
    def fail(self, error: str) -> None:
        """
        Mark progress as failed.
        
        Args:
            error: Error message
        """
        self.update(
            stage=Stage.FAILED,
            progress=0,
            error=error
        )
    
    @staticmethod
    def _default_message(stage: Stage) -> str:
        """
        Get default message for a stage.
        
        Args:
            stage: Processing stage
            
        Returns:
            Default message
        """
        messages = {
            Stage.INITIALIZING: "Initializing...",
            Stage.FEATURE_EXTRACTION: "Extracting features from images...",
            Stage.FEATURE_MATCHING: "Matching features between images...",
            Stage.SFM: "Running structure-from-motion...",
            Stage.DATA_PREPARATION: "Preparing training data...",
            Stage.TRAINING: "Training NeRF model...",
            Stage.VALIDATION: "Validating model quality...",
            Stage.RENDERING: "Rendering frames...",
            Stage.COMPLETE: "Processing complete",
            Stage.FAILED: "Processing failed",
        }
        return messages.get(stage, "Processing...")
    
    @staticmethod
    def read_progress(progress_file: Path) -> Optional[Dict[str, Any]]:
        """
        Read progress from file.
        
        Args:
            progress_file: Path to progress.json file
            
        Returns:
            Progress data or None if file doesn't exist
        """
        if not progress_file.exists():
            return None
        
        try:
            with open(progress_file, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return None


def write_progress(
    progress_file: Path,
    job_id: str,
    stage: str,
    progress: float,
    message: str = "",
    details: Optional[Dict[str, Any]] = None,
    error: Optional[str] = None
) -> None:
    """
    Convenience function to write progress without tracker instance.
    
    Args:
        progress_file: Path to progress.json file
        job_id: Job identifier
        stage: Processing stage
        progress: Progress percentage (0-100)
        message: Progress message
        details: Additional details
        error: Error message
    """
    progress_file.parent.mkdir(parents=True, exist_ok=True)
    
    data = {
        "job_id": job_id,
        "stage": stage,
        "progress": min(100, max(0, progress)),
        "message": message,
        "updated_at": datetime.utcnow().isoformat(),
    }
    
    if details:
        data["details"] = details
    
    if error:
        data["error"] = error
        data["stage"] = "failed"
    
    with open(progress_file, 'w') as f:
        json.dump(data, f, indent=2)


def read_progress(progress_file: Path) -> Optional[Dict[str, Any]]:
    """
    Read progress from file.
    
    Args:
        progress_file: Path to progress.json file
        
    Returns:
        Progress data or None if file doesn't exist
    """
    return ProgressTracker.read_progress(progress_file)

