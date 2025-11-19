"""
COLMAP Processing Modal Function

This module implements the COLMAP camera pose estimation pipeline via Modal,
including feature extraction, matching, and structure-from-motion (SfM).
"""

import json
import os
import subprocess
import zipfile
from pathlib import Path
from typing import Dict, Any, Optional

from nerf_app import app, volume, VOLUME_PATH, GPU_CONFIG, ENVIRONMENT
from shared.config import COLMAP_CONFIG
from shared.utils import write_progress, read_progress


@app.function(
    gpu=GPU_CONFIG.get(ENVIRONMENT, "T4"),
    timeout=1800,  # 30 minutes
    volumes={VOLUME_PATH: volume},
)
def process_colmap(
    job_id: str,
    images_path: str,
) -> Dict[str, Any]:
    """
    Process COLMAP camera pose estimation from uploaded images.
    
    Args:
        job_id: Unique job identifier
        images_zip_path: Path to zipped images in Modal volume
        
    Returns:
        dict: Processing result with output paths and validation status
    """
    import time
    
    start_time = time.time()
    
    try:
        # Setup paths
        job_path = Path(VOLUME_PATH) / "jobs" / job_id
        colmap_path = job_path / "colmap"
        colmap_db = colmap_path / "database.db"
        sparse_path = colmap_path / "sparse" / "0"
        
        # Create directories
        colmap_path.mkdir(parents=True, exist_ok=True)
        sparse_path.mkdir(parents=True, exist_ok=True)
        
        # Write initial progress
        write_progress(
            job_path,
            stage="feature_extraction",
            progress=0,
            status="processing",
            current_operation="Loading uploaded images...",
        )
        
        # Images are already uploaded to Modal volume as individual files
        # The images_path parameter is the path in the volume (e.g., "/jobs/{job_id}/images")
        print(f"Loading images from {images_path}...")
        images_dir = Path(VOLUME_PATH) / images_path.lstrip('/')
        
        if not images_dir.exists():
            raise FileNotFoundError(f"Images directory not found: {images_path}")
        
        # Count images in source directory
        image_files = list(images_dir.glob("*.jpg")) + list(images_dir.glob("*.jpeg")) + list(images_dir.glob("*.png"))
        total_images = len(image_files)
        print(f"Found {total_images} images")
        
        if total_images < 60:
            raise ValueError(f"Insufficient images: {total_images} (minimum 60 required)")
        
        # Stage 1: Feature Extraction
        write_progress(
            job_path,
            stage="feature_extraction",
            progress=10,
            status="processing",
            current_operation="Extracting SIFT features from images...",
            images_processed=0,
            total_images=total_images,
        )
        
        result = extract_features(
            colmap_db,
            images_dir,
            job_path,
            total_images,
        )
        
        if not result["success"]:
            raise RuntimeError(f"Feature extraction failed: {result.get('error', 'Unknown error')}")
        
        # Stage 2: Feature Matching
        write_progress(
            job_path,
            stage="feature_matching",
            progress=40,
            status="processing",
            current_operation="Matching features between image pairs...",
            images_processed=total_images,
            total_images=total_images,
        )
        
        result = match_features(
            colmap_db,
            job_path,
            total_images,
        )
        
        if not result["success"]:
            raise RuntimeError(f"Feature matching failed: {result.get('error', 'Unknown error')}")
        
        # Stage 3: Structure from Motion (SfM)
        write_progress(
            job_path,
            stage="sfm",
            progress=70,
            status="processing",
            current_operation="Reconstructing 3D scene and camera poses...",
            images_processed=total_images,
            total_images=total_images,
        )
        
        result = run_sfm(
            colmap_db,
            images_dir,
            sparse_path,
            job_path,
            total_images,
        )
        
        if not result["success"]:
            raise RuntimeError(f"SfM reconstruction failed: {result.get('error', 'Unknown error')}")
        
        # Validate COLMAP output
        write_progress(
            job_path,
            stage="complete",
            progress=95,
            status="processing",
            current_operation="Validating camera poses...",
            images_processed=total_images,
            total_images=total_images,
        )
        
        validation_result = validate_colmap_output(
            sparse_path,
            total_images,
        )
        
        if not validation_result["valid"]:
            raise RuntimeError(f"Validation failed: {validation_result.get('error', 'Unknown error')}")
        
        # Success!
        elapsed_time = time.time() - start_time
        
        write_progress(
            job_path,
            stage="complete",
            progress=100,
            status="complete",
            current_operation="COLMAP processing complete",
            images_processed=total_images,
            total_images=total_images,
            elapsed_time=elapsed_time,
        )
        
        # Commit volume changes
        volume.commit()
        
        return {
            "success": True,
            "job_id": job_id,
            "output_path": str(colmap_path.relative_to(VOLUME_PATH)),
            "validation": validation_result,
            "elapsed_time": elapsed_time,
            "total_images": total_images,
            "reconstructed_cameras": validation_result.get("num_cameras", 0),
        }
        
    except Exception as e:
        # Write error to progress
        write_progress(
            Path(VOLUME_PATH) / "jobs" / job_id,
            stage="failed",
            progress=0,
            status="failed",
            current_operation=f"Error: {str(e)}",
            error=str(e),
        )
        
        # Commit volume changes
        volume.commit()
        
        raise


def extract_features(
    colmap_db: Path,
    images_path: Path,
    job_path: Path,
    total_images: int,
) -> Dict[str, Any]:
    """
    Extract SIFT features from images using COLMAP.
    
    Args:
        colmap_db: Path to COLMAP database file
        images_path: Path to directory containing images
        job_path: Path to job directory for progress updates
        total_images: Total number of images
        
    Returns:
        dict: Result with success status
    """
    try:
        # COLMAP feature extraction command
        cmd = [
            "colmap", "feature_extractor",
            "--database_path", str(colmap_db),
            "--image_path", str(images_path),
            "--ImageReader.camera_model", "SIMPLE_RADIAL",
            "--ImageReader.single_camera", "1",
            "--SiftExtraction.use_gpu", "1",
        ]
        
        print(f"Running feature extraction: {' '.join(cmd)}")
        
        # Run COLMAP command
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True,
        )
        
        print(f"Feature extraction completed successfully")
        print(f"STDOUT: {result.stdout}")
        
        # Update progress
        write_progress(
            job_path,
            stage="feature_extraction",
            progress=35,
            status="processing",
            current_operation="Feature extraction complete",
            images_processed=total_images,
            total_images=total_images,
        )
        
        return {"success": True}
        
    except subprocess.CalledProcessError as e:
        print(f"Feature extraction failed: {e.stderr}")
        return {"success": False, "error": e.stderr}
    except Exception as e:
        print(f"Feature extraction error: {str(e)}")
        return {"success": False, "error": str(e)}


def match_features(
    colmap_db: Path,
    job_path: Path,
    total_images: int,
) -> Dict[str, Any]:
    """
    Match features between image pairs using COLMAP.
    
    Args:
        colmap_db: Path to COLMAP database file
        job_path: Path to job directory for progress updates
        total_images: Total number of images
        
    Returns:
        dict: Result with success status
    """
    try:
        # COLMAP feature matching command (exhaustive)
        cmd = [
            "colmap", "exhaustive_matcher",
            "--database_path", str(colmap_db),
            "--SiftMatching.use_gpu", "1",
        ]
        
        print(f"Running feature matching: {' '.join(cmd)}")
        
        # Run COLMAP command
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True,
        )
        
        print(f"Feature matching completed successfully")
        print(f"STDOUT: {result.stdout}")
        
        # Update progress
        write_progress(
            job_path,
            stage="feature_matching",
            progress=65,
            status="processing",
            current_operation="Feature matching complete",
            images_processed=total_images,
            total_images=total_images,
        )
        
        return {"success": True}
        
    except subprocess.CalledProcessError as e:
        print(f"Feature matching failed: {e.stderr}")
        return {"success": False, "error": e.stderr}
    except Exception as e:
        print(f"Feature matching error: {str(e)}")
        return {"success": False, "error": str(e)}


def run_sfm(
    colmap_db: Path,
    images_path: Path,
    sparse_path: Path,
    job_path: Path,
    total_images: int,
) -> Dict[str, Any]:
    """
    Run incremental structure-from-motion (SfM) using COLMAP.
    
    Args:
        colmap_db: Path to COLMAP database file
        images_path: Path to directory containing images
        sparse_path: Path to output sparse reconstruction
        job_path: Path to job directory for progress updates
        total_images: Total number of images
        
    Returns:
        dict: Result with success status
    """
    try:
        # COLMAP mapper command (incremental SfM)
        cmd = [
            "colmap", "mapper",
            "--database_path", str(colmap_db),
            "--image_path", str(images_path),
            "--output_path", str(sparse_path.parent),
        ]
        
        print(f"Running SfM reconstruction: {' '.join(cmd)}")
        
        # Run COLMAP command
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True,
        )
        
        print(f"SfM reconstruction completed successfully")
        print(f"STDOUT: {result.stdout}")
        
        # Update progress
        write_progress(
            job_path,
            stage="sfm",
            progress=90,
            status="processing",
            current_operation="SfM reconstruction complete",
            images_processed=total_images,
            total_images=total_images,
        )
        
        return {"success": True}
        
    except subprocess.CalledProcessError as e:
        print(f"SfM reconstruction failed: {e.stderr}")
        return {"success": False, "error": e.stderr}
    except Exception as e:
        print(f"SfM reconstruction error: {str(e)}")
        return {"success": False, "error": str(e)}


def validate_colmap_output(
    sparse_path: Path,
    total_images: int,
) -> Dict[str, Any]:
    """
    Validate COLMAP reconstruction output.
    
    Args:
        sparse_path: Path to sparse reconstruction directory
        total_images: Total number of images
        
    Returns:
        dict: Validation result with camera count and point cloud info
    """
    try:
        # Check if required files exist
        cameras_file = sparse_path / "cameras.bin"
        images_file = sparse_path / "images.bin"
        points_file = sparse_path / "points3D.bin"
        
        if not cameras_file.exists():
            return {
                "valid": False,
                "error": "cameras.bin not found - COLMAP reconstruction failed"
            }
        
        if not images_file.exists():
            return {
                "valid": False,
                "error": "images.bin not found - COLMAP reconstruction failed"
            }
        
        # Read cameras and images using COLMAP commands
        # For simplicity, we'll just check file sizes as a basic validation
        # A more thorough validation would parse the binary files
        
        camera_size = cameras_file.stat().st_size
        images_size = images_file.stat().st_size
        points_size = points_file.stat().st_size if points_file.exists() else 0
        
        print(f"Validation: cameras.bin={camera_size} bytes, images.bin={images_size} bytes, points3D.bin={points_size} bytes")
        
        # Basic size checks
        if camera_size < 100:
            return {
                "valid": False,
                "error": "cameras.bin too small - insufficient camera calibration"
            }
        
        if images_size < 1000:
            return {
                "valid": False,
                "error": "images.bin too small - insufficient camera poses reconstructed"
            }
        
        if points_size < 1000:
            return {
                "valid": False,
                "error": "Sparse point cloud too small - poor reconstruction quality",
                "warning": True,  # This is a warning, not a hard failure
            }
        
        # Estimate number of reconstructed cameras based on file size
        # This is a rough estimate - actual parsing would be more accurate
        estimated_cameras = min(images_size // 200, total_images)  # Rough heuristic
        
        if estimated_cameras < total_images * 0.5:
            return {
                "valid": False,
                "error": f"Only {estimated_cameras}/{total_images} images reconstructed. Please ensure photos show the product from many different angles with good overlap."
            }
        
        # Success
        return {
            "valid": True,
            "num_cameras": estimated_cameras,
            "num_points": points_size // 50,  # Rough estimate
            "reconstruction_rate": estimated_cameras / total_images,
        }
        
    except Exception as e:
        return {
            "valid": False,
            "error": f"Validation error: {str(e)}"
        }


# Test function for local development
@app.local_entrypoint()
def test_colmap():
    """
    Test COLMAP processing with sample data.
    """
    print("Testing COLMAP processing...")
    
    # This would be called with actual test data
    # For now, just verify the function exists
    print("process_colmap function ready")
    print(f"Environment: {ENVIRONMENT}")
    print(f"GPU: {GPU_CONFIG.get(ENVIRONMENT, 'T4')}")

