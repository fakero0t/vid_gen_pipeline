"""
NeRF Training Modal Functions

This module implements NeRF training pipeline using NeRF Studio,
including data preparation, training with checkpointing, and validation.
"""

import json
import os
import subprocess
import shutil
from pathlib import Path
from typing import Dict, Any, Optional

from nerf_app import app, volume, VOLUME_PATH, GPU_CONFIG, ENVIRONMENT
from shared.config import get_training_config, get_gpu_config, NERFACTO_BASE_CONFIG
from shared.utils import write_progress, read_progress


@app.function(
    gpu=GPU_CONFIG.get(ENVIRONMENT, "T4"),
    timeout=600,  # 10 minutes
    volumes={VOLUME_PATH: volume},
)
def prepare_training_data(
    job_id: str,
    colmap_path: str,
) -> Dict[str, Any]:
    """
    Prepare training data from COLMAP output.
    
    Converts COLMAP output to NeRF Studio format (transforms.json).
    
    Args:
        job_id: Unique job identifier
        colmap_path: Path to COLMAP output in Modal volume (relative to VOLUME_PATH)
        
    Returns:
        dict: Preparation result with dataset path and validation status
    """
    import time
    
    start_time = time.time()
    
    try:
        # Setup paths
        job_path = Path(VOLUME_PATH) / "jobs" / job_id
        colmap_full_path = Path(VOLUME_PATH) / colmap_path
        dataset_path = job_path / "dataset"
        images_path = job_path / "images"
        
        # Create directories
        dataset_path.mkdir(parents=True, exist_ok=True)
        
        # Write initial progress
        write_progress(
            job_path,
            stage="data_preparation",
            progress=0,
            status="processing",
            current_operation="Preparing training data...",
        )
        
        print(f"Preparing training data for job {job_id}")
        print(f"COLMAP path: {colmap_full_path}")
        print(f"Dataset path: {dataset_path}")
        
        # Verify COLMAP output exists
        sparse_path = colmap_full_path / "sparse" / "0"
        if not sparse_path.exists():
            raise FileNotFoundError(f"COLMAP sparse reconstruction not found: {sparse_path}")
        
        # Verify required COLMAP files exist
        cameras_file = sparse_path / "cameras.bin"
        images_file = sparse_path / "images.bin"
        points_file = sparse_path / "points3D.bin"
        
        if not cameras_file.exists():
            raise FileNotFoundError(f"COLMAP cameras.bin not found: {cameras_file}")
        if not images_file.exists():
            raise FileNotFoundError(f"COLMAP images.bin not found: {images_file}")
        
        print(f"COLMAP files verified")
        
        # Update progress
        write_progress(
            job_path,
            stage="data_preparation",
            progress=20,
            status="processing",
            current_operation="Converting COLMAP to NeRF Studio format...",
        )
        
        # Convert COLMAP to NeRF Studio format using ns-process-data
        # NeRF Studio expects images to be in the dataset directory
        images_dest = dataset_path / "images"
        if images_path.exists():
            # Copy images to dataset directory
            shutil.copytree(images_path, images_dest, dirs_exist_ok=True)
        else:
            print(f"Warning: Images path not found: {images_path}")
        
        # Run ns-process-data to convert COLMAP output
        cmd = [
            "ns-process-data", "colmap",
            "--data", str(dataset_path),
            "--colmap-model-path", str(sparse_path),
            "--output-dir", str(dataset_path),
        ]
        
        print(f"Running NeRF Studio data processing: {' '.join(cmd)}")
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True,
        )
        
        print(f"Data processing completed")
        print(f"STDOUT: {result.stdout}")
        
        # Update progress
        write_progress(
            job_path,
            stage="data_preparation",
            progress=60,
            status="processing",
            current_operation="Validating dataset...",
        )
        
        # Validate dataset
        transforms_file = dataset_path / "transforms.json"
        if not transforms_file.exists():
            raise FileNotFoundError(f"transforms.json not created: {transforms_file}")
        
        # Load transforms to validate
        with open(transforms_file, 'r') as f:
            transforms = json.load(f)
        
        num_frames = len(transforms.get("frames", []))
        if num_frames < 50:
            raise ValueError(f"Insufficient camera poses: {num_frames} (minimum 50 required)")
        
        print(f"Dataset validated: {num_frames} camera poses")
        
        # Update progress
        elapsed_time = time.time() - start_time
        
        write_progress(
            job_path,
            stage="data_preparation",
            progress=100,
            status="complete",
            current_operation="Data preparation complete",
            elapsed_time=elapsed_time,
        )
        
        # Commit volume changes
        volume.commit()
        
        return {
            "success": True,
            "job_id": job_id,
            "dataset_path": str(dataset_path.relative_to(VOLUME_PATH)),
            "num_cameras": num_frames,
            "elapsed_time": elapsed_time,
        }
        
    except Exception as e:
        print(f"Data preparation failed: {e}")
        
        # Write error to progress
        write_progress(
            Path(VOLUME_PATH) / "jobs" / job_id,
            stage="data_preparation",
            progress=0,
            status="failed",
            current_operation=f"Error: {str(e)}",
            error=str(e),
        )
        
        # Commit volume changes
        volume.commit()
        
        raise


@app.function(
    gpu=GPU_CONFIG.get(ENVIRONMENT, "T4"),
    timeout=2700,  # 45 minutes
    volumes={VOLUME_PATH: volume},
)
def train_nerf(
    job_id: str,
    dataset_path: str,
    config: Optional[Dict[str, Any]] = None,
    resume_from_checkpoint: bool = False,
) -> Dict[str, Any]:
    """
    Train NeRF model using NeRF Studio.
    
    Args:
        job_id: Unique job identifier
        dataset_path: Path to dataset in Modal volume (relative to VOLUME_PATH)
        config: Training configuration (optional, uses defaults if not provided)
        resume_from_checkpoint: Whether to resume from last checkpoint
        
    Returns:
        dict: Training result with model path and metrics
    """
    import time
    
    start_time = time.time()
    
    try:
        # Setup paths
        job_path = Path(VOLUME_PATH) / "jobs" / job_id
        dataset_full_path = Path(VOLUME_PATH) / dataset_path
        output_path = job_path / "model"
        checkpoints_path = output_path / "checkpoints"
        
        # Create directories
        output_path.mkdir(parents=True, exist_ok=True)
        checkpoints_path.mkdir(parents=True, exist_ok=True)
        
        # Get training configuration
        training_config = get_training_config(
            preset="prod_quality" if ENVIRONMENT == "production" else "dev_quality",
            custom_overrides=config or {}
        )
        
        num_iterations = training_config.get("max_num_iterations", 15000)
        steps_per_save = training_config.get("steps_per_save", 2000)
        
        # Write initial progress
        write_progress(
            job_path,
            stage="training",
            progress=0,
            status="processing",
            current_operation=f"Starting NeRF training ({num_iterations} iterations)...",
        )
        
        print(f"Training NeRF for job {job_id}")
        print(f"Dataset: {dataset_full_path}")
        print(f"Output: {output_path}")
        print(f"Iterations: {num_iterations}")
        
        # Build ns-train command
        cmd = [
            "ns-train", "nerfacto",
            "--data", str(dataset_full_path),
            "--output-dir", str(output_path),
            "--max-num-iterations", str(num_iterations),
            "--steps-per-save", str(steps_per_save),
            "--pipeline.datamanager.train-num-rays-per-batch", "4096",
            "--pipeline.model.background-color", "random",
        ]
        
        # Add resume flag if requested
        if resume_from_checkpoint:
            latest_checkpoint = _find_latest_checkpoint(checkpoints_path)
            if latest_checkpoint:
                cmd.extend(["--load-dir", str(latest_checkpoint)])
                print(f"Resuming from checkpoint: {latest_checkpoint}")
        
        print(f"Running NeRF training: {' '.join(cmd)}")
        
        # Start training process
        # Note: In production, we would stream output and parse it for progress
        # For now, we'll run it and check progress periodically
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        
        # Monitor training progress
        iteration = 0
        loss = None
        psnr = None
        
        for line in process.stdout:
            print(line.strip())
            
            # Parse progress from NeRF Studio output
            # NeRF Studio outputs logs like: "Iteration: 1000/15000, Loss: 0.0234, PSNR: 28.5"
            if "Iteration" in line or "Step" in line:
                # Try to extract iteration number
                try:
                    parts = line.split()
                    for i, part in enumerate(parts):
                        if "iteration" in part.lower() or "step" in part.lower():
                            if i + 1 < len(parts):
                                iter_str = parts[i + 1].split('/')[0].strip(':,')
                                iteration = int(iter_str)
                                
                                # Calculate progress
                                progress = int((iteration / num_iterations) * 100)
                                
                                # Update progress every 100 iterations
                                if iteration % 100 == 0:
                                    write_progress(
                                        job_path,
                                        stage="training",
                                        progress=min(95, progress),  # Cap at 95% until validation
                                        status="processing",
                                        current_operation=f"Training iteration {iteration}/{num_iterations}...",
                                    )
                except (ValueError, IndexError):
                    pass
            
            # Check for loss in output
            if "loss" in line.lower():
                try:
                    parts = line.lower().split("loss")
                    if len(parts) > 1:
                        loss_str = parts[1].strip().split()[0].strip(':,')
                        loss = float(loss_str)
                except (ValueError, IndexError):
                    pass
            
            # Check for PSNR in output
            if "psnr" in line.lower():
                try:
                    parts = line.lower().split("psnr")
                    if len(parts) > 1:
                        psnr_str = parts[1].strip().split()[0].strip(':,')
                        psnr = float(psnr_str)
                except (ValueError, IndexError):
                    pass
            
            # Check for divergence (loss becomes NaN or very large)
            if loss and (loss != loss or loss > 1000):  # NaN check or very large loss
                print(f"Training diverged: loss = {loss}")
                process.kill()
                raise RuntimeError("Training diverged (loss became NaN or very large)")
        
        # Wait for process to complete
        return_code = process.wait()
        
        if return_code != 0:
            raise RuntimeError(f"Training failed with return code {return_code}")
        
        print(f"Training completed successfully")
        
        # Update progress
        elapsed_time = time.time() - start_time
        
        write_progress(
            job_path,
            stage="training",
            progress=100,
            status="complete",
            current_operation="Training complete",
            elapsed_time=elapsed_time,
        )
        
        # Commit volume changes
        volume.commit()
        
        return {
            "success": True,
            "job_id": job_id,
            "model_path": str(output_path.relative_to(VOLUME_PATH)),
            "final_iteration": iteration,
            "final_loss": loss,
            "final_psnr": psnr,
            "elapsed_time": elapsed_time,
        }
        
    except Exception as e:
        print(f"Training failed: {e}")
        
        # Write error to progress
        write_progress(
            Path(VOLUME_PATH) / "jobs" / job_id,
            stage="training",
            progress=0,
            status="failed",
            current_operation=f"Error: {str(e)}",
            error=str(e),
        )
        
        # Commit volume changes
        volume.commit()
        
        raise


@app.function(
    gpu=GPU_CONFIG.get(ENVIRONMENT, "T4"),
    timeout=300,  # 5 minutes
    volumes={VOLUME_PATH: volume},
)
def validate_training(
    job_id: str,
    model_path: str,
    dataset_path: str,
) -> Dict[str, Any]:
    """
    Validate trained NeRF model by rendering test views and computing metrics.
    
    Args:
        job_id: Unique job identifier
        model_path: Path to trained model in Modal volume
        dataset_path: Path to dataset in Modal volume
        
    Returns:
        dict: Validation result with metrics (PSNR, SSIM)
    """
    import time
    
    start_time = time.time()
    
    try:
        # Setup paths
        job_path = Path(VOLUME_PATH) / "jobs" / job_id
        model_full_path = Path(VOLUME_PATH) / model_path
        dataset_full_path = Path(VOLUME_PATH) / dataset_path
        
        # Write initial progress
        write_progress(
            job_path,
            stage="validation",
            progress=0,
            status="processing",
            current_operation="Validating trained model...",
        )
        
        print(f"Validating model for job {job_id}")
        print(f"Model: {model_full_path}")
        
        # Run ns-eval to compute metrics
        cmd = [
            "ns-eval",
            "--load-config", str(model_full_path / "config.yml"),
            "--output-path", str(job_path / "validation_results.json"),
        ]
        
        print(f"Running validation: {' '.join(cmd)}")
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True,
        )
        
        print(f"Validation completed")
        print(f"STDOUT: {result.stdout}")
        
        # Load validation results
        results_file = job_path / "validation_results.json"
        if results_file.exists():
            with open(results_file, 'r') as f:
                validation_results = json.load(f)
        else:
            validation_results = {}
        
        # Extract metrics
        psnr = validation_results.get("psnr", 0.0)
        ssim = validation_results.get("ssim", 0.0)
        
        print(f"Validation metrics: PSNR={psnr}, SSIM={ssim}")
        
        # Check quality thresholds
        quality_pass = psnr >= 25.0 and ssim >= 0.85
        
        if not quality_pass:
            print(f"Warning: Model quality below threshold (PSNR >= 25, SSIM >= 0.85)")
        
        # Update progress
        elapsed_time = time.time() - start_time
        
        write_progress(
            job_path,
            stage="validation",
            progress=100,
            status="complete",
            current_operation="Validation complete",
            elapsed_time=elapsed_time,
        )
        
        # Commit volume changes
        volume.commit()
        
        return {
            "success": True,
            "job_id": job_id,
            "psnr": psnr,
            "ssim": ssim,
            "quality_pass": quality_pass,
            "elapsed_time": elapsed_time,
        }
        
    except Exception as e:
        print(f"Validation failed: {e}")
        
        # Write error to progress
        write_progress(
            Path(VOLUME_PATH) / "jobs" / job_id,
            stage="validation",
            progress=0,
            status="failed",
            current_operation=f"Error: {str(e)}",
            error=str(e),
        )
        
        # Commit volume changes
        volume.commit()
        
        raise


def _find_latest_checkpoint(checkpoints_path: Path) -> Optional[Path]:
    """
    Find the latest checkpoint in the checkpoints directory.
    
    Args:
        checkpoints_path: Path to checkpoints directory
        
    Returns:
        Path to latest checkpoint or None if no checkpoints found
    """
    if not checkpoints_path.exists():
        return None
    
    # Find all checkpoint directories
    checkpoints = [d for d in checkpoints_path.iterdir() if d.is_dir()]
    
    if not checkpoints:
        return None
    
    # Sort by modification time (most recent first)
    checkpoints.sort(key=lambda d: d.stat().st_mtime, reverse=True)
    
    return checkpoints[0]


# Test function for local development
@app.local_entrypoint()
def test_training():
    """
    Test NeRF training functions.
    """
    print("Testing NeRF training functions...")
    
    # This would be called with actual test data
    # For now, just verify the functions exist
    print("prepare_training_data function ready")
    print("train_nerf function ready")
    print("validate_training function ready")
    print(f"Environment: {ENVIRONMENT}")
    print(f"GPU: {GPU_CONFIG.get(ENVIRONMENT, 'T4')}")

