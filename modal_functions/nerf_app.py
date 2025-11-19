"""
NeRF Modal Application - Main Entry Point

This module defines the Modal application for NeRF processing, including:
- Docker image with COLMAP and NeRF Studio dependencies
- Shared Modal volume for data persistence
- App configuration for dev and prod environments
"""

import modal
import os
from pathlib import Path

# Determine environment (dev or production)
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
APP_NAME = "nerf-dev" if ENVIRONMENT == "development" else "nerf-prod"

# Create Modal image with all dependencies
# Include local Python files in the image
current_dir = Path(__file__).parent
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install(
        "colmap",
        "ffmpeg",
        "git",
        "wget",
        "libgl1-mesa-glx",
        "libglib2.0-0",
    )
    .pip_install(
        "nerfstudio>=1.0.0,<2.0.0",
        "Pillow>=10.0.0",
    )
    .add_local_dir(current_dir, remote_path="/root")
)

# Create Modal app
app = modal.App(APP_NAME, image=image)

# Create or reference shared Modal volume for job data
volume = modal.Volume.from_name("nerf-data", create_if_missing=True)

# Volume mount path
VOLUME_PATH = "/data"

# GPU configurations
GPU_CONFIG = {
    "development": "T4",  # ~$0.35/hour
    "production": "A10G",  # ~$1.10/hour
}


@app.function()
def health_check():
    """
    Health check function to verify Modal app is deployed and working.
    
    Returns:
        dict: Status information
    """
    import sys
    
    return {
        "status": "healthy",
        "environment": ENVIRONMENT,
        "app_name": APP_NAME,
        "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
    }


# Import all function modules to register them with the app
# This ensures all functions are included when the app is deployed
import colmap_processing  # noqa: F401
import nerf_training  # noqa: F401
import frame_rendering  # noqa: F401


# This allows running the app locally for testing
if __name__ == "__main__":
    with modal.enable_output():
        print(f"NeRF Modal App: {APP_NAME}")
        print(f"Environment: {ENVIRONMENT}")
        print(f"GPU: {GPU_CONFIG.get(ENVIRONMENT, 'T4')}")
        
        # Test health check
        result = health_check.remote()
        print(f"Health check result: {result}")

