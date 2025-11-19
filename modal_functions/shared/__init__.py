"""Shared utilities for Modal functions."""

from .config import (
    NERFACTO_BASE_CONFIG,
    TRAINING_PRESETS,
    GPU_CONFIGS,
    RENDERING_CONFIG,
    COLMAP_CONFIG,
    get_training_config,
    get_gpu_config,
)
from .utils import (
    setup_logging,
    zip_directory,
    unzip_archive,
    save_json,
    load_json,
    ensure_directory,
    get_file_size_mb,
    format_duration,
    estimate_remaining_time,
    batch_items,
)
from .progress import (
    Stage,
    ProgressTracker,
    write_progress,
    read_progress,
)

__all__ = [
    # Config
    "NERFACTO_BASE_CONFIG",
    "TRAINING_PRESETS",
    "GPU_CONFIGS",
    "RENDERING_CONFIG",
    "COLMAP_CONFIG",
    "get_training_config",
    "get_gpu_config",
    # Utils
    "setup_logging",
    "zip_directory",
    "unzip_archive",
    "save_json",
    "load_json",
    "ensure_directory",
    "get_file_size_mb",
    "format_duration",
    "estimate_remaining_time",
    "batch_items",
    # Progress
    "Stage",
    "ProgressTracker",
    "write_progress",
    "read_progress",
]

