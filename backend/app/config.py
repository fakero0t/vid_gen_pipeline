"""Configuration settings for the FastAPI backend."""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Environment (development or production)
    ENVIRONMENT: str = "development"
    
    # API Keys (optional for development, required for actual API calls)
    REPLICATE_API_TOKEN: str = ""
    REPLICATE_API_KEY: str = ""  # Alias for REPLICATE_API_TOKEN (some users might use this)
    OPENAI_API_KEY: str = ""
    
    # Model Configuration (optional, defaults to dev/prod based on ENVIRONMENT)
    REPLICATE_IMAGE_MODEL: str = ""  # Override default model selection
    OPENAI_MODEL: str = ""  # Override default model selection
    
    # Image Generation Configuration
    IMAGES_PER_MOOD: int = 0  # 0 = auto (2 for dev, 4 for prod)
    IMAGE_WIDTH: int = 0  # 0 = auto (640 for dev, 1080 for prod)
    IMAGE_HEIGHT: int = 0  # 0 = auto (1136 for dev, 1920 for prod)
    
    # CORS Configuration (comma-separated string)
    CORS_ORIGINS: str = "http://localhost:3000"
    
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
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # Ignore extra fields in .env


# Global settings instance
settings = Settings()

