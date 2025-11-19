"""
NeRF Studio Configuration Templates

This module contains configuration templates for NeRF Studio training,
including nerfacto method settings and environment-specific presets.
"""

from typing import Dict, Any, List, Tuple


# NeRF Studio nerfacto method configuration
NERFACTO_BASE_CONFIG = {
    "method_name": "nerfacto",
    "max_num_iterations": 15000,  # Cost-effective default for good quality
    "steps_per_save": 2000,  # Save checkpoint every N iterations
    "steps_per_eval_image": 100,  # Evaluation frequency
    "steps_per_eval_batch": 1000,  # Batch evaluation frequency
    "save_only_latest_checkpoint": False,  # Keep checkpoints for recovery
    "pipeline": {
        "datamanager": {
            "train_num_rays_per_batch": 4096,
            "eval_num_rays_per_batch": 4096,
            "camera_optimizer": {
                "mode": "SO3xR3"  # Optimize camera poses
            }
        },
        "model": {
            "near_plane": 0.05,
            "far_plane": 1000.0,
            "background_color": "random",  # For better alpha channel
            "proposal_initial_sampler": "uniform",
            "num_nerf_samples_per_ray": 48,
            "num_proposal_samples_per_ray": (256, 96)
        }
    }
}


# Environment-specific presets
TRAINING_PRESETS = {
    "dev_fast": {
        "max_num_iterations": 2000,
        "steps_per_save": 500,
        "pipeline": {
            "datamanager": {
                "train_num_rays_per_batch": 2048,
                "eval_num_rays_per_batch": 2048,
            }
        }
    },
    "dev_quality": {
        "max_num_iterations": 5000,
        "steps_per_save": 1000,
        "pipeline": {
            "datamanager": {
                "train_num_rays_per_batch": 4096,
                "eval_num_rays_per_batch": 4096,
            }
        }
    },
    "prod_quality": {
        "max_num_iterations": 15000,
        "steps_per_save": 2000,
        "pipeline": {
            "datamanager": {
                "train_num_rays_per_batch": 4096,
                "eval_num_rays_per_batch": 4096,
            }
        }
    },
    "prod_high_quality": {
        "max_num_iterations": 30000,
        "steps_per_save": 3000,
        "pipeline": {
            "datamanager": {
                "train_num_rays_per_batch": 8192,
                "eval_num_rays_per_batch": 4096,
            }
        }
    }
}


# GPU-specific configurations
GPU_CONFIGS = {
    "T4": {
        "max_batch_size": 4096,
        "recommended_iterations": 15000,
        "estimated_time_per_1000_iters": 90,  # seconds
    },
    "A10G": {
        "max_batch_size": 8192,
        "recommended_iterations": 15000,
        "estimated_time_per_1000_iters": 60,  # seconds
    },
    "A100": {
        "max_batch_size": 16384,
        "recommended_iterations": 30000,
        "estimated_time_per_1000_iters": 30,  # seconds
    }
}


# Rendering configuration
RENDERING_CONFIG = {
    "resolution": [1920, 1080],
    "samples_per_ray": 128,  # Cost-effective default
    "background_color": [0, 0, 0, 0],  # Transparent
    "frames_per_batch": 100,  # Balance memory and efficiency
    "num_workers": 2,  # Parallel workers within batch
    "output_format": "png",
    "compression_level": 6,  # PNG compression
}


# COLMAP configuration
COLMAP_CONFIG = {
    "feature_extractor": {
        "type": "SIFT",
        "quality": "standard",
        "image_resize": None,  # Optional (faster but less accurate)
    },
    "matcher": {
        "type": "exhaustive",  # or "vocabulary_tree"
        "geometric_verification": True,
    },
    "mapper": {
        "type": "incremental",  # Incremental SfM
        "bundle_adjustment": "full",  # Full optimization
    }
}


def get_training_config(
    preset: str = "prod_quality",
    custom_overrides: Dict[str, Any] = None
) -> Dict[str, Any]:
    """
    Get training configuration with optional custom overrides.
    
    Args:
        preset: Preset name (dev_fast, dev_quality, prod_quality, prod_high_quality)
        custom_overrides: Custom configuration overrides
        
    Returns:
        Complete training configuration
    """
    # Start with base config
    config = NERFACTO_BASE_CONFIG.copy()
    
    # Apply preset
    if preset in TRAINING_PRESETS:
        _deep_update(config, TRAINING_PRESETS[preset])
    
    # Apply custom overrides
    if custom_overrides:
        _deep_update(config, custom_overrides)
    
    return config


def get_gpu_config(gpu_type: str) -> Dict[str, Any]:
    """
    Get GPU-specific configuration.
    
    Args:
        gpu_type: GPU type (T4, A10G, A100)
        
    Returns:
        GPU configuration
    """
    return GPU_CONFIGS.get(gpu_type, GPU_CONFIGS["T4"])


def _deep_update(base_dict: Dict, update_dict: Dict) -> None:
    """
    Deep update dictionary (modifies base_dict in place).
    
    Args:
        base_dict: Base dictionary to update
        update_dict: Dictionary with updates
    """
    for key, value in update_dict.items():
        if key in base_dict and isinstance(base_dict[key], dict) and isinstance(value, dict):
            _deep_update(base_dict[key], value)
        else:
            base_dict[key] = value

