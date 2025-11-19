"""
Shared Utilities for Modal Functions

This module contains utility functions used across multiple Modal functions,
including file operations, logging, and data processing.
"""

import zipfile
import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List
from datetime import datetime


def setup_logging(level: str = "INFO") -> logging.Logger:
    """
    Set up logging for Modal functions.
    
    Args:
        level: Logging level (DEBUG, INFO, WARNING, ERROR)
        
    Returns:
        Configured logger
    """
    logger = logging.getLogger("nerf_modal")
    logger.setLevel(getattr(logging, level.upper()))
    
    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    
    return logger


def zip_directory(source_dir: Path, output_zip: Path) -> Path:
    """
    Zip a directory into a single archive.
    
    Args:
        source_dir: Source directory to zip
        output_zip: Output zip file path
        
    Returns:
        Path to created zip file
    """
    with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for file_path in source_dir.rglob('*'):
            if file_path.is_file():
                arcname = file_path.relative_to(source_dir)
                zipf.write(file_path, arcname)
    
    return output_zip


def unzip_archive(zip_path: Path, extract_dir: Path) -> Path:
    """
    Extract a zip archive to a directory.
    
    Args:
        zip_path: Path to zip file
        extract_dir: Directory to extract to
        
    Returns:
        Path to extraction directory
    """
    extract_dir.mkdir(parents=True, exist_ok=True)
    
    with zipfile.ZipFile(zip_path, 'r') as zipf:
        zipf.extractall(extract_dir)
    
    return extract_dir


def save_json(data: Dict[str, Any], file_path: Path) -> None:
    """
    Save dictionary as JSON file.
    
    Args:
        data: Data to save
        file_path: Output file path
    """
    file_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(file_path, 'w') as f:
        json.dump(data, f, indent=2)


def load_json(file_path: Path) -> Dict[str, Any]:
    """
    Load JSON file as dictionary.
    
    Args:
        file_path: Path to JSON file
        
    Returns:
        Loaded data
    """
    with open(file_path, 'r') as f:
        return json.load(f)


def ensure_directory(dir_path: Path) -> Path:
    """
    Ensure directory exists, create if it doesn't.
    
    Args:
        dir_path: Directory path
        
    Returns:
        Path to directory
    """
    dir_path.mkdir(parents=True, exist_ok=True)
    return dir_path


def get_file_size_mb(file_path: Path) -> float:
    """
    Get file size in megabytes.
    
    Args:
        file_path: Path to file
        
    Returns:
        File size in MB
    """
    return file_path.stat().st_size / (1024 * 1024)


def format_duration(seconds: float) -> str:
    """
    Format duration in seconds to human-readable string.
    
    Args:
        seconds: Duration in seconds
        
    Returns:
        Formatted duration string
    """
    if seconds < 60:
        return f"{seconds:.1f}s"
    elif seconds < 3600:
        minutes = seconds / 60
        return f"{minutes:.1f}m"
    else:
        hours = seconds / 3600
        return f"{hours:.1f}h"


def estimate_remaining_time(
    completed: int,
    total: int,
    elapsed_seconds: float
) -> Optional[float]:
    """
    Estimate remaining time based on progress.
    
    Args:
        completed: Number of completed items
        total: Total number of items
        elapsed_seconds: Time elapsed so far
        
    Returns:
        Estimated remaining time in seconds, or None if cannot estimate
    """
    if completed == 0 or completed >= total:
        return None
    
    time_per_item = elapsed_seconds / completed
    remaining_items = total - completed
    
    return time_per_item * remaining_items


def batch_items(items: List[Any], batch_size: int) -> List[List[Any]]:
    """
    Split items into batches.
    
    Args:
        items: List of items to batch
        batch_size: Size of each batch
        
    Returns:
        List of batches
    """
    return [items[i:i + batch_size] for i in range(0, len(items), batch_size)]


def write_progress(
    job_path: Path,
    stage: str,
    progress: int,
    status: str,
    current_operation: str = "",
    images_processed: Optional[int] = None,
    total_images: Optional[int] = None,
    elapsed_time: Optional[float] = None,
    error: Optional[str] = None,
) -> None:
    """
    Write progress update to job directory.
    
    Args:
        job_path: Path to job directory
        stage: Current stage name
        progress: Progress percentage (0-100)
        status: Status (processing, complete, failed)
        current_operation: Description of current operation
        images_processed: Number of images processed
        total_images: Total number of images
        elapsed_time: Elapsed time in seconds
        error: Error message if failed
    """
    progress_file = job_path / "progress.json"
    
    progress_data = {
        "stage": stage,
        "progress": progress,
        "status": status,
        "current_operation": current_operation,
        "timestamp": datetime.utcnow().isoformat(),
    }
    
    if images_processed is not None:
        progress_data["images_processed"] = images_processed
    
    if total_images is not None:
        progress_data["total_images"] = total_images
    
    if elapsed_time is not None:
        progress_data["elapsed_time"] = elapsed_time
    
    if error is not None:
        progress_data["error"] = error
    
    save_json(progress_data, progress_file)


def read_progress(job_path: Path) -> Optional[Dict[str, Any]]:
    """
    Read progress update from job directory.
    
    Args:
        job_path: Path to job directory
        
    Returns:
        Progress data or None if not found
    """
    progress_file = job_path / "progress.json"
    
    if not progress_file.exists():
        return None
    
    return load_json(progress_file)

