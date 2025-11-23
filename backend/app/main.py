"""FastAPI application entry point."""
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import moods, scenes, video, audio, composition, storyboards, product, admin, brand, character, backgrounds, whisper, webhooks

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Create FastAPI app
app = FastAPI(
    title="AI Video Generation Pipeline API",
    description="Backend API for AI-powered video generation pipeline",
    version="0.1.0"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include routers
app.include_router(webhooks.router)  # Webhooks for Replicate callbacks (must be registered first for proper routing)
app.include_router(storyboards.router)  # Unified Storyboard Interface
app.include_router(moods.router)
app.include_router(scenes.router)
app.include_router(video.router)
app.include_router(audio.router)
app.include_router(composition.router)
app.include_router(product.router)
app.include_router(brand.router)
app.include_router(character.router)
app.include_router(backgrounds.router)
app.include_router(whisper.router)  # Whisper speech-to-text
app.include_router(admin.router)  # Admin metrics and monitoring


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "AI Video Generation Pipeline API",
        "version": "0.1.0",
        "status": "running"
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}

