"""Configuration settings for the FastAPI backend."""
from pydantic_settings import BaseSettings
from typing import List, Literal
from pathlib import Path
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Environment (development or production)
    ENVIRONMENT: str = "development"
    
    # API Keys (optional for development, required for actual API calls)
    REPLICATE_API_TOKEN: str = ""
    REPLICATE_API_KEY: str = ""  # Alias for REPLICATE_API_TOKEN (some users might use this)
    OPENAI_API_KEY: str = ""
    
    # Modal API Keys (required for NeRF processing)
    MODAL_TOKEN_ID: str = ""
    MODAL_TOKEN_SECRET: str = ""
    
    # Model Configuration (optional, defaults to dev/prod based on ENVIRONMENT)
    REPLICATE_IMAGE_MODEL: str = ""  # Override default model selection
    OPENAI_MODEL: str = ""  # Override default model selection
    
    # Image Generation Configuration
    IMAGES_PER_MOOD: int = 0  # 0 = auto (2 for dev, 4 for prod)
    IMAGE_WIDTH: int = 0  # 0 = auto (640 for dev, 1080 for prod)
    IMAGE_HEIGHT: int = 0  # 0 = auto (1136 for dev, 1920 for prod)
    
    # CORS Configuration (comma-separated string)
    CORS_ORIGINS: str = "http://localhost:3000"
    
    # Backend API Base URL (for generating full URLs for external services)
    API_BASE_URL: str = "http://localhost:8000"
    
    # Upload mode configuration
    UPLOAD_MODE: Literal["nerf", "product"] = Field(
        default="nerf",
        description="Upload mode: 'nerf' for NeRF pipeline, 'product' for single image"
    )
    
    # NeRF Storage Paths
    FRAME_STORAGE_PATH: str = "backend/nerf/renders"
    MODEL_STORAGE_PATH: str = "backend/nerf/models"
    UPLOAD_STORAGE_PATH: str = "backend/uploads/temp"
    
    # NeRF Training Configuration
    NERF_DEFAULT_ITERATIONS: int = 15000
    NERF_STEPS_PER_SAVE: int = 2000
    NERF_STEPS_PER_EVAL: int = 100
    
    # NeRF Rendering Configuration
    NERF_SAMPLES_PER_RAY: int = 128
    NERF_FRAMES_PER_BATCH: int = 100
    NERF_DEFAULT_RESOLUTION_WIDTH: int = 1920
    NERF_DEFAULT_RESOLUTION_HEIGHT: int = 1080
    
    # GPU Configuration (based on environment)
    # T4: ~$0.35/hour (development)
    # A10G: ~$1.10/hour (production)
    GPU_TYPE_DEV: str = "T4"
    GPU_TYPE_PROD: str = "A10G"
    
    # COLMAP Configuration
    COLMAP_FEATURE_TYPE: str = "SIFT"
    COLMAP_MATCHER_TYPE: str = "exhaustive"
    
    # Job Cleanup (hours)
    JOB_CLEANUP_HOURS: int = 24
    MODAL_VOLUME_CLEANUP_HOURS: int = 48
    
    # Product Compositing Configuration
    USE_KONTEXT_COMPOSITE: bool = Field(
        default=True,
        description="Enable FLUX Kontext for product compositing (feature flag)"
    )
    
    KONTEXT_MODEL_ID: str = Field(
        default="flux-kontext-apps/multi-image-kontext-pro",
        description="Replicate model ID for Kontext compositing"
    )
    
    COMPOSITE_METHOD: str = Field(
        default="kontext",
        description="Compositing method: 'kontext' or 'pil'"
    )
    
    # Rate Limiting
    MAX_CONCURRENT_KONTEXT: int = Field(
        default=10,
        description="Max concurrent Kontext generations"
    )
    
    MAX_KONTEXT_PER_HOUR: int = Field(
        default=100,
        description="Max Kontext generations per hour"
    )
    
    # Timeouts
    KONTEXT_TIMEOUT_SECONDS: int = Field(
        default=60,
        description="Timeout for Kontext API calls"
    )
    
    # Monitoring
    KONTEXT_DAILY_GENERATION_LIMIT: int = Field(
        default=1000,
        description="Alert threshold for daily Kontext generations"
    )
    
    def is_development(self) -> bool:
        """Check if running in development mode."""
        return self.ENVIRONMENT.lower() in ("development", "dev", "local")
    
    def get_cors_origins(self) -> List[str]:
        """Get CORS origins as a list from comma-separated string."""
        if not self.CORS_ORIGINS:
            return ["http://localhost:3000"]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
    
    def get_replicate_token(self) -> str:
        """Get Replicate API token, checking both field names."""
        return self.REPLICATE_API_TOKEN or self.REPLICATE_API_KEY
    
    def get_gpu_type(self) -> str:
        """Get GPU type based on environment."""
        return self.GPU_TYPE_DEV if self.is_development() else self.GPU_TYPE_PROD
    
    def get_frame_storage_path(self) -> Path:
        """Get frame storage path as Path object."""
        return Path(self.FRAME_STORAGE_PATH)
    
    def get_model_storage_path(self) -> Path:
        """Get model storage path as Path object."""
        return Path(self.MODEL_STORAGE_PATH)
    
    def get_upload_storage_path(self) -> Path:
        """Get upload storage path as Path object."""
        return Path(self.UPLOAD_STORAGE_PATH)
    
    def has_modal_credentials(self) -> bool:
        """Check if Modal credentials are configured."""
        return bool(self.MODAL_TOKEN_ID and self.MODAL_TOKEN_SECRET)
    
    def is_nerf_mode(self) -> bool:
        """Check if NeRF mode is enabled."""
        return self.UPLOAD_MODE == "nerf"
    
    def is_product_mode(self) -> bool:
        """Check if product mode is enabled."""
        return self.UPLOAD_MODE == "product"
    
    def to_full_url(self, path: str) -> str:
        """
        Convert a relative path to a full URL.
        
        If the path is already a full URL (starts with http:// or https://),
        return it as-is. Otherwise, prepend the API_BASE_URL.
        
        Args:
            path: Relative path (e.g., /uploads/image.png) or full URL
            
        Returns:
            Full URL (e.g., http://localhost:8000/uploads/image.png)
        """
        if not path:
            return path
        
        # If already a full URL, return as-is
        if path.startswith(("http://", "https://")):
            return path
        
        # Ensure path starts with /
        if not path.startswith("/"):
            path = f"/{path}"
        
        # Remove trailing slash from base URL and prepend to path
        base_url = self.API_BASE_URL.rstrip("/")
        return f"{base_url}{path}"
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # Ignore extra fields in .env


# Global settings instance
settings = Settings()

