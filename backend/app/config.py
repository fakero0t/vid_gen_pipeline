"""Configuration settings for the FastAPI backend."""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # API Keys (optional for development, required for actual API calls)
    REPLICATE_API_TOKEN: str = ""
    REPLICATE_API_KEY: str = ""  # Alias for REPLICATE_API_TOKEN (some users might use this)
    OPENAI_API_KEY: str = ""
    
    # CORS Configuration (comma-separated string)
    CORS_ORIGINS: str = "http://localhost:3000"
    
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

