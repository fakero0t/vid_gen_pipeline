"""Configuration settings for the FastAPI backend."""
from pydantic_settings import BaseSettings
from typing import List
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Environment (development or production)
    ENVIRONMENT: str = "development"
    
    # API Keys (optional for development, required for actual API calls)
    REPLICATE_API_TOKEN: str = ""
    REPLICATE_API_KEY: str = ""  # Alias for REPLICATE_API_TOKEN (some users might use this)
    OPENAI_API_KEY: str = ""
    
    # Firebase Configuration (for public image URLs via Firebase Storage)
    FIREBASE_CREDENTIALS_PATH: str = "serviceAccountKey.json"
    FIREBASE_STORAGE_BUCKET: str = ""  # Set via FIREBASE_STORAGE_BUCKET env var or auto-detected

    # Model Configuration (optional, defaults to dev/prod based on ENVIRONMENT)
    REPLICATE_IMAGE_MODEL: str = ""  # Override default model selection
    OPENAI_MODEL: str = ""  # Override default model selection
    
    # Image Generation Configuration
    IMAGES_PER_MOOD: int = 0  # 0 = auto (2 for dev, 4 for prod)
    IMAGE_WIDTH: int = 0  # 0 = auto (1280 for dev, 1920 for prod - 16:9 aspect ratio)
    IMAGE_HEIGHT: int = 0  # 0 = auto (720 for dev, 1080 for prod - 16:9 aspect ratio)
    
    # CORS Configuration (comma-separated string)
    CORS_ORIGINS: str = "http://localhost:3000"
    
    # Backend API Base URL (for generating full URLs for external services)
    API_BASE_URL: str = "http://localhost:8000"
    
    # Webhook Configuration (for Replicate async predictions)
    REPLICATE_WEBHOOK_SECRET: str = ""  # Secret for verifying webhook signatures

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
    
    def use_webhooks(self) -> bool:
        """
        Determine whether to use webhook-based predictions.
        
        Returns True in production (scalable, non-blocking)
        Returns False in development (simple, no ngrok needed)
        
        Can be overridden with FORCE_WEBHOOKS=true environment variable
        for testing webhooks locally with ngrok.
        """
        import os
        force_webhooks = os.getenv("FORCE_WEBHOOKS", "").lower() in ("true", "1", "yes")
        return force_webhooks or not self.is_development()
    
    def get_cors_origins(self) -> List[str]:
        """Get CORS origins as a list from comma-separated string."""
        if not self.CORS_ORIGINS:
            return ["http://localhost:3000"]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
    
    def get_replicate_token(self) -> str:
        """Get Replicate API token, checking both field names."""
        return self.REPLICATE_API_TOKEN or self.REPLICATE_API_KEY
    
    def get_webhook_url(self) -> str:
        """
        Get the webhook URL for Replicate callbacks.
        
        Returns:
            Full webhook URL (e.g., https://xxxx.ngrok.io/api/webhooks/replicate)
        """
        base_url = self.API_BASE_URL.rstrip("/")
        return f"{base_url}/api/webhooks/replicate"
    
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

