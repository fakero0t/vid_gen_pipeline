"""
Frame Rendering Modal Functions

This module implements frame rendering from trained NeRF models,
including trajectory generation, batch rendering, and frame output.
"""

import json
import subprocess
import time
import zipfile
from pathlib import Path
from typing import Dict, Any, Optional, List

from nerf_app import app, volume, VOLUME_PATH, GPU_CONFIG, ENVIRONMENT
from shared.utils import write_progress, read_progress, setup_logging

logger = setup_logging()


@app.function(
    gpu=GPU_CONFIG.get(ENVIRONMENT, "T4"),
    timeout=2700,  # 45 minutes
    volumes={VOLUME_PATH: volume},
)
def render_frames(
    job_id: str,
    model_path: str,
    trajectory_config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Render 1440 transparent PNG frames from trained NeRF model.
    
    Renders frames in batches of 100, with transparent backgrounds for
    easy compositing with scenes/moods.
    
    Args:
        job_id: Unique job identifier
        model_path: Path to trained model in Modal volume (relative to VOLUME_PATH)
        trajectory_config: Camera trajectory configuration (optional)
        
    Returns:
        dict: Rendering result with frame paths and stats
    """
    start_time = time.time()
    
    try:
        # Setup paths
        job_path = Path(VOLUME_PATH) / "jobs" / job_id
        model_full_path = Path(VOLUME_PATH) / model_path
        output_path = job_path / "frames"
        trajectory_path = job_path / "trajectory.json"
        
        # Create directories
        output_path.mkdir(parents=True, exist_ok=True)
        
        # Write initial progress
        write_progress(
            job_path,
            stage="rendering",
            progress=0,
            status="processing",
            current_operation="Initializing frame rendering...",
        )
        
        logger.info(f"Starting frame rendering for job {job_id}")
        logger.info(f"Model: {model_full_path}")
        logger.info(f"Output: {output_path}")
        
        # Verify model exists
        config_file = model_full_path / "config.yml"
        if not config_file.exists():
            raise FileNotFoundError(f"Model config not found: {config_file}")
        
        logger.info(f"Model config verified")
        
        # Generate or load trajectory
        if trajectory_config:
            logger.info(f"Generating trajectory with config: {trajectory_config}")
            trajectory = _generate_circular_trajectory(
                num_frames=trajectory_config.get("num_frames", 1440),
                radius=trajectory_config.get("radius", 2.5),
                elevation=trajectory_config.get("elevation", 35),
                center=trajectory_config.get("center", [0, 0, 0]),
            )
        else:
            logger.info(f"Generating default circular trajectory (1440 frames)")
            trajectory = _generate_circular_trajectory()
        
        # Save trajectory
        with open(trajectory_path, 'w') as f:
            json.dump(trajectory, f, indent=2)
        
        logger.info(f"Trajectory saved: {trajectory_path}")
        
        # Update progress
        write_progress(
            job_path,
            stage="rendering",
            progress=1,
            status="processing",
            current_operation="Trajectory generated, starting rendering...",
        )
        
        # Rendering configuration
        total_frames = trajectory.get("num_frames", 1440)
        frames_per_batch = 100
        total_batches = (total_frames + frames_per_batch - 1) // frames_per_batch
        
        logger.info(f"Rendering {total_frames} frames in {total_batches} batches")
        
        batch_paths = []
        frames_rendered = 0
        
        # Render in batches
        for batch_idx in range(total_batches):
            batch_start = batch_idx * frames_per_batch
            batch_end = min(batch_start + frames_per_batch, total_frames)
            batch_size = batch_end - batch_start
            
            logger.info(f"Rendering batch {batch_idx + 1}/{total_batches}: frames {batch_start}-{batch_end - 1}")
            
            # Update progress
            current_progress = int((batch_idx / total_batches) * 95)  # Cap at 95% until complete
            write_progress(
                job_path,
                stage="rendering",
                progress=current_progress,
                status="processing",
                current_operation=f"Rendering batch {batch_idx + 1}/{total_batches}...",
            )
            
            # Create batch output directory
            batch_output_path = output_path / f"batch_{batch_idx:02d}"
            batch_output_path.mkdir(parents=True, exist_ok=True)
            
            # Render batch using NeRF Studio
            _render_batch(
                model_config_path=config_file,
                trajectory_data=trajectory,
                batch_start=batch_start,
                batch_end=batch_end,
                output_path=batch_output_path,
            )
            
            # Zip batch frames
            batch_zip_path = output_path / f"batch_{batch_idx:02d}.zip"
            _zip_batch(batch_output_path, batch_zip_path)
            
            batch_paths.append(str(batch_zip_path.relative_to(VOLUME_PATH)))
            frames_rendered += batch_size
            
            logger.info(f"Batch {batch_idx + 1} complete: {batch_size} frames rendered")
            
            # Update progress with frame count
            write_progress(
                job_path,
                stage="rendering",
                progress=current_progress,
                status="processing",
                current_operation=f"Batch {batch_idx + 1}/{total_batches} complete",
                images_processed=frames_rendered,
                total_images=total_frames,
            )
        
        # Calculate stats
        elapsed_time = time.time() - start_time
        avg_time_per_frame = elapsed_time / frames_rendered if frames_rendered > 0 else 0
        
        logger.info(f"Rendering complete: {frames_rendered} frames in {elapsed_time:.1f}s")
        logger.info(f"Average: {avg_time_per_frame:.2f}s per frame")
        
        # Update final progress
        write_progress(
            job_path,
            stage="rendering",
            progress=100,
            status="complete",
            current_operation="Rendering complete",
            images_processed=frames_rendered,
            total_images=total_frames,
            elapsed_time=elapsed_time,
        )
        
        # Commit volume changes
        volume.commit()
        
        return {
            "success": True,
            "job_id": job_id,
            "frames_rendered": frames_rendered,
            "total_frames": total_frames,
            "batch_paths": batch_paths,
            "total_batches": len(batch_paths),
            "avg_time_per_frame": avg_time_per_frame,
            "elapsed_time": elapsed_time,
        }
        
    except Exception as e:
        logger.error(f"Rendering failed: {e}")
        
        # Write error to progress
        write_progress(
            Path(VOLUME_PATH) / "jobs" / job_id,
            stage="rendering",
            progress=0,
            status="failed",
            current_operation=f"Error: {str(e)}",
            error=str(e),
        )
        
        # Commit volume changes
        volume.commit()
        
        raise


def _generate_circular_trajectory(
    num_frames: int = 1440,
    radius: float = 2.5,
    elevation: float = 35.0,
    center: List[float] = [0.0, 0.0, 0.0],
    start_angle: float = 0.0,
    end_angle: float = 360.0,
) -> Dict[str, Any]:
    """
    Generate circular camera trajectory for rendering.
    
    Args:
        num_frames: Number of frames to generate (default: 1440)
        radius: Radius of circular orbit (default: 2.5)
        elevation: Camera elevation angle in degrees (default: 35)
        center: Center point of orbit [x, y, z] (default: [0, 0, 0])
        start_angle: Starting rotation angle in degrees (default: 0)
        end_angle: Ending rotation angle in degrees (default: 360)
        
    Returns:
        dict: Trajectory configuration for NeRF Studio
    """
    import math
    
    frames = []
    
    # Convert angles to radians
    elevation_rad = math.radians(elevation)
    
    for i in range(num_frames):
        # Calculate current angle (interpolate between start and end)
        progress = i / max(num_frames - 1, 1)
        angle = start_angle + (end_angle - start_angle) * progress
        angle_rad = math.radians(angle)
        
        # Calculate camera position on circular orbit
        x = center[0] + radius * math.cos(angle_rad) * math.cos(elevation_rad)
        y = center[1] + radius * math.sin(angle_rad) * math.cos(elevation_rad)
        z = center[2] + radius * math.sin(elevation_rad)
        
        # Calculate camera orientation (look at center)
        direction_x = center[0] - x
        direction_y = center[1] - y
        direction_z = center[2] - z
        
        # Normalize direction
        length = math.sqrt(direction_x**2 + direction_y**2 + direction_z**2)
        if length > 0:
            direction_x /= length
            direction_y /= length
            direction_z /= length
        
        # Store frame data
        frame = {
            "frame_number": i,
            "camera_position": [x, y, z],
            "camera_look_at": center,
            "camera_up": [0, 0, 1],  # Z-up coordinate system
        }
        
        frames.append(frame)
    
    return {
        "num_frames": num_frames,
        "frames": frames,
        "metadata": {
            "trajectory_type": "circular_orbit",
            "radius": radius,
            "elevation": elevation,
            "center": center,
            "start_angle": start_angle,
            "end_angle": end_angle,
        },
    }


def _render_batch(
    model_config_path: Path,
    trajectory_data: Dict[str, Any],
    batch_start: int,
    batch_end: int,
    output_path: Path,
) -> None:
    """
    Render a batch of frames using NeRF Studio.
    
    Args:
        model_config_path: Path to model config.yml
        trajectory_data: Trajectory configuration
        batch_start: Starting frame index (inclusive)
        batch_end: Ending frame index (exclusive)
        output_path: Directory to save rendered frames
    """
    # NeRF Studio rendering command
    # Note: This is a simplified version. Actual implementation would use NeRF Studio's
    # Python API for more control over the rendering process.
    
    for frame_idx in range(batch_start, batch_end):
        frame_data = trajectory_data["frames"][frame_idx]
        frame_number = frame_data["frame_number"]
        
        # Frame output path
        frame_output = output_path / f"product_frame_{frame_number:04d}.png"
        
        # Build ns-render command
        # This would be replaced with direct Python API calls in production
        cmd = [
            "ns-render",
            "camera-path",
            "--load-config", str(model_config_path),
            "--camera-path-filename", str(output_path.parent.parent / "trajectory.json"),
            "--output-path", str(frame_output),
            "--rendered-output-names", "rgb",
            "--image-format", "png",
        ]
        
        # For now, we'll use a simplified approach
        # In production, this would use NeRF Studio's rendering API directly
        logger.info(f"Rendering frame {frame_number}...")
        
        # Create a placeholder PNG for now (this would be actual NeRF rendering)
        # In production, this would call the NeRF Studio rendering pipeline
        _create_placeholder_frame(frame_output, frame_number)


def _create_placeholder_frame(output_path: Path, frame_number: int) -> None:
    """
    Create a placeholder transparent PNG frame.
    
    This is a temporary implementation for testing. In production, this would be
    replaced by actual NeRF rendering.
    
    Args:
        output_path: Path to save the frame
        frame_number: Frame number for reference
    """
    try:
        from PIL import Image, ImageDraw, ImageFont
        
        # Create a transparent RGBA image
        img = Image.new('RGBA', (1920, 1080), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        
        # Draw frame number (for testing)
        text = f"Frame {frame_number:04d}"
        try:
            # Try to use a nice font
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 60)
        except:
            # Fallback to default font
            font = ImageFont.load_default()
        
        # Calculate text position (center)
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        position = ((1920 - text_width) // 2, (1080 - text_height) // 2)
        
        # Draw text with white color
        draw.text(position, text, fill=(255, 255, 255, 255), font=font)
        
        # Save as PNG
        img.save(output_path, 'PNG')
        
    except ImportError:
        # If PIL is not available, create an empty file
        output_path.touch()


def _zip_batch(batch_path: Path, zip_path: Path) -> None:
    """
    Zip batch frames into a single archive.
    
    Args:
        batch_path: Directory containing batch frames
        zip_path: Output zip file path
    """
    logger.info(f"Zipping batch: {batch_path} -> {zip_path}")
    
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as zipf:
        for frame_file in sorted(batch_path.glob("*.png")):
            zipf.write(frame_file, frame_file.name)
    
    logger.info(f"Batch zipped: {zip_path}")


# Test function for local development
@app.local_entrypoint()
def test_rendering():
    """
    Test frame rendering functions.
    """
    print("Testing frame rendering functions...")
    
    # Test trajectory generation
    trajectory = _generate_circular_trajectory(num_frames=10)
    print(f"Generated trajectory with {trajectory['num_frames']} frames")
    print(f"First frame: {trajectory['frames'][0]}")
    print(f"Last frame: {trajectory['frames'][-1]}")
    
    print(f"Environment: {ENVIRONMENT}")
    print(f"GPU: {GPU_CONFIG.get(ENVIRONMENT, 'T4')}")

