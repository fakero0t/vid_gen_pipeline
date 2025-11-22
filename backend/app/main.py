"""FastAPI application entry point."""
import logging
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.routers import moods, scenes, video, audio, composition, storyboards, upload, nerf, product, admin, brand, character, backgrounds

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

# Ensure uploads directory exists
uploads_dir = Path("uploads")
uploads_dir.mkdir(exist_ok=True)
(uploads_dir / "products").mkdir(exist_ok=True)
(uploads_dir / "composites").mkdir(exist_ok=True)
(uploads_dir / "brands").mkdir(exist_ok=True)
(uploads_dir / "characters").mkdir(exist_ok=True)
(uploads_dir / "backgrounds").mkdir(exist_ok=True)

# Mount static file serving for uploads
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Include routers
app.include_router(storyboards.router)  # Unified Storyboard Interface
app.include_router(moods.router)
app.include_router(scenes.router)
app.include_router(video.router)
app.include_router(audio.router)
app.include_router(composition.router)
app.include_router(upload.router)
app.include_router(nerf.router, prefix="/api/nerf", tags=["nerf"])
app.include_router(product.router)
app.include_router(brand.router)
app.include_router(character.router)
app.include_router(backgrounds.router)
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

