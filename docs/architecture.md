# System Architecture

## Overview

The AI Video Generation Pipeline is a full-stack application with a Next.js frontend, FastAPI backend, and optional Modal serverless functions for NeRF processing.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Next.js 16 (App Router) + TypeScript                │  │
│  │  - Clerk Authentication                               │  │
│  │  - Zustand State Management                           │  │
│  │  - SSE Real-time Updates                              │  │
│  │  - shadcn/ui + Tailwind CSS v4                        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTP/SSE
┌─────────────────────────────────────────────────────────────┐
│                        Backend                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  FastAPI (Python 3.11+)                              │  │
│  │  - RESTful API                                        │  │
│  │  - SSE for real-time updates                          │  │
│  │  - SQLite database                                    │  │
│  │  - FFmpeg video processing                            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                  ↕                    ↕
┌─────────────────────────┐  ┌──────────────────────────┐
│   External Services     │  │  Modal Functions         │
│  - OpenAI (GPT-4o)      │  │  - COLMAP processing     │
│  - Replicate            │  │  - NeRF training         │
│    • SDXL (images)      │  │  - Frame rendering       │
│    • img2vid (videos)   │  │  (Optional - for NeRF)   │
│    • FLUX Kontext       │  │                          │
└─────────────────────────┘  └──────────────────────────┘
```

## Frontend Architecture

### Routing Structure

```
/                          Landing page (redirects to /projects)
/sign-in                   Authentication page (Clerk)
/sign-up                   User registration (Clerk)
/projects                  Projects dashboard (protected)
/project/[id]/chat         Step 1: Vision & Creative Brief
/project/[id]/mood         Step 2: Mood Selection
/project/[id]/scenes       Step 3: Scene Storyboard
/project/[id]/final        Step 4: Final Composition
/brand-assets              Brand asset library (future)
```

### State Management Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    State Layer                            │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────────┐  ┌──────────────────┐             │
│  │   appStore      │  │  projectStore    │             │
│  │   (ephemeral)   │  │  (persistent)    │             │
│  ├─────────────────┤  ├──────────────────┤             │
│  │ • currentStep   │  │ • projects[]     │             │
│  │ • creativeBrief │  │ • currentId      │             │
│  │ • moods         │  │ • CRUD ops       │             │
│  │ • selectedMood  │  │ • auto-save      │             │
│  │ • completion    │  │ • thumbnails     │             │
│  │ • audioUrl      │  │                  │             │
│  │ • finalVideo    │  │ localStorage     │             │
│  └─────────────────┘  └──────────────────┘             │
│          ↕                     ↕                         │
│  ┌──────────────────────────────────────┐              │
│  │        sceneStore (ephemeral)        │              │
│  ├──────────────────────────────────────┤              │
│  │ • storyboard                         │              │
│  │ • scenes[]                           │              │
│  │ • SSE connection                     │              │
│  │ • scene operations                   │              │
│  │                                      │              │
│  │ Loaded from API (not persisted)     │              │
│  └──────────────────────────────────────┘              │
│                    ↕                                     │
│              Backend API                                │
└──────────────────────────────────────────────────────────┘
```

### Project State Lifecycle

```
1. User creates project
   └→ projectStore.createProject()
       └→ Generates unique ID
       └→ Initializes empty appState snapshot
       └→ Saves to localStorage

2. User works on project
   └→ appStore updates (creativeBrief, moods, etc.)
       └→ Triggers projectStore.scheduleAutoSave() (debounced 500ms)
           └→ Creates snapshot of appStore state
           └→ Updates project in localStorage

3. User switches projects
   └→ projectStore.loadProject(id)
       └→ Resets appStore
       └→ Resets sceneStore
       └→ Restores appState snapshot
       └→ Loads storyboard from backend (if exists)

4. User navigates to scenes
   └→ sceneStore.loadStoryboard(storyboardId)
       └→ Fetches from backend API
       └→ Connects SSE for real-time updates
       └→ Polls for incomplete generations

5. Scene generation updates
   └→ SSE pushes scene update
       └→ sceneStore updates scene state
       └→ UI re-renders automatically
```

## Backend Architecture

### API Layer Structure

```
backend/
├── app/
│   ├── main.py                    # FastAPI app + CORS + routes
│   ├── config.py                  # Settings + environment config
│   ├── database.py                # SQLite connection + init
│   │
│   ├── routers/                   # API endpoints
│   │   ├── admin.py               # Admin/metrics endpoints
│   │   ├── audio.py               # Audio generation
│   │   ├── composition.py         # Video composition
│   │   ├── moods.py               # Mood board generation
│   │   ├── scenes.py              # Scene operations
│   │   ├── storyboards.py         # Storyboard CRUD + SSE
│   │   ├── product.py             # Product management
│   │   ├── nerf.py                # NeRF processing
│   │   ├── upload.py              # File uploads
│   │   └── video.py               # Video generation
│   │
│   ├── services/                  # Business logic
│   │   ├── audio_service.py       # Audio generation logic
│   │   ├── colmap_service.py      # COLMAP processing
│   │   ├── ffmpeg_service.py      # Video processing
│   │   ├── metrics_service.py     # Usage metrics
│   │   ├── modal_service.py       # Modal API client
│   │   ├── mood_service.py        # Mood generation
│   │   ├── nerf_service.py        # NeRF coordination
│   │   ├── product_service.py     # Product operations
│   │   ├── rate_limiter.py        # Rate limiting
│   │   ├── rendering_service.py   # Frame rendering
│   │   ├── replicate_service.py   # Replicate API client
│   │   ├── scene_service.py       # Scene operations
│   │   ├── storyboard_service.py  # Storyboard logic
│   │   └── upload_service.py      # File handling
│   │
│   ├── models/                    # Pydantic schemas
│   │   ├── storyboard_models.py   # Storyboard/scene schemas
│   │   ├── mood_models.py         # Mood schemas
│   │   ├── audio_models.py        # Audio schemas
│   │   ├── composition_models.py  # Composition schemas
│   │   ├── video_models.py        # Video schemas
│   │   ├── product_models.py      # Product schemas
│   │   └── nerf_models.py         # NeRF schemas
│   │
│   └── utils/                     # Shared utilities
│       ├── file_utils.py          # File operations
│       ├── image_utils.py         # Image processing
│       └── validation.py          # Input validation
```

### Database Schema (SQLite)

```sql
-- Storyboards
CREATE TABLE storyboards (
    storyboard_id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    creative_brief JSON NOT NULL,
    selected_mood JSON NOT NULL,
    scene_order JSON NOT NULL,  -- Array of scene IDs
    status TEXT NOT NULL,        -- 'generating' | 'complete' | 'error'
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- Scenes
CREATE TABLE scenes (
    id TEXT PRIMARY KEY,
    storyboard_id TEXT NOT NULL,
    text TEXT NOT NULL,
    image_url TEXT,
    video_url TEXT,
    duration REAL DEFAULT 3.0,
    state TEXT NOT NULL,         -- 'text' | 'image' | 'video'
    generation_status JSON NOT NULL,  -- { image: status, video: status }
    error_message TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    FOREIGN KEY (storyboard_id) REFERENCES storyboards(storyboard_id)
);

-- Products
CREATE TABLE products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    image_paths JSON NOT NULL,   -- Array of image URLs
    created_at TIMESTAMP
);

-- Moods
CREATE TABLE moods (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    seed_image TEXT NOT NULL,
    created_at TIMESTAMP
);

-- Compositions (Final Videos)
CREATE TABLE compositions (
    job_id TEXT PRIMARY KEY,
    storyboard_id TEXT NOT NULL,
    audio_url TEXT,
    video_url TEXT,
    status TEXT NOT NULL,        -- 'pending' | 'processing' | 'complete' | 'error'
    error_message TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    FOREIGN KEY (storyboard_id) REFERENCES storyboards(storyboard_id)
);
```

## API Endpoints

### Storyboard & Scenes

```
POST   /api/storyboards/initialize      Initialize new storyboard
GET    /api/storyboards/{id}            Get storyboard by ID
GET    /api/storyboards/{id}/stream     SSE stream for updates
POST   /api/storyboards/{id}/regenerate Regenerate all scenes

GET    /api/scenes/{scene_id}           Get scene details
POST   /api/scenes/{scene_id}/text      Update scene text
POST   /api/scenes/{scene_id}/regenerate-text   Regenerate text
POST   /api/scenes/{scene_id}/approve-text      Generate image
POST   /api/scenes/{scene_id}/regenerate-image  Regenerate image
POST   /api/scenes/{scene_id}/approve-image     Generate video
POST   /api/scenes/{scene_id}/regenerate-video  Regenerate video
PATCH  /api/scenes/{scene_id}/duration  Update scene duration
```

### Moods

```
POST   /api/moods/generate              Generate mood boards
GET    /api/moods/{mood_id}             Get mood by ID
```

### Composition

```
POST   /api/compositions/initialize     Start final video composition
GET    /api/compositions/{job_id}       Get composition status
GET    /api/compositions/{job_id}/stream  SSE stream for progress
```

### Audio

```
POST   /api/audio/generate              Generate background audio
GET    /api/audio/{audio_id}            Get audio file
```

### Products & NeRF (Optional)

```
POST   /api/products/upload             Upload product images
GET    /api/products/{product_id}       Get product details

POST   /api/nerf/colmap                 Start COLMAP processing
POST   /api/nerf/train                  Start NeRF training
POST   /api/nerf/render                 Start frame rendering
GET    /api/nerf/{job_id}/status        Get processing status
```

### Admin

```
GET    /api/admin/metrics/composite     Get compositing metrics
GET    /api/admin/metrics/daily-generations  Get daily stats
GET    /api/admin/metrics/health        Health check + warnings
POST   /api/admin/metrics/reset         Reset metrics
```

## Real-Time Updates (SSE)

### Storyboard SSE Stream

```
Endpoint: GET /api/storyboards/{storyboard_id}/stream

Event Types:
- scene_update: Individual scene state change
- storyboard_complete: All scenes finished
- storyboard_error: Critical error occurred

Event Format:
{
  "scene_id": "scene-123",
  "state": "image",
  "generation_status": {
    "image": "complete",
    "video": "pending"
  },
  "image_url": "https://...",
  "error_message": null
}
```

### Composition SSE Stream

```
Endpoint: GET /api/compositions/{job_id}/stream

Event Types:
- progress: Composition progress update
- complete: Composition finished
- error: Composition failed

Event Format:
{
  "progress": 45,
  "stage": "merging_clips",
  "status": "processing"
}
```

## External Service Integration

### OpenAI (GPT-4o)
- **Use**: Creative brief generation, scene text generation
- **Endpoint**: `/v1/chat/completions`
- **Model**: `gpt-4o` (production), `gpt-3.5-turbo` (development)

### Replicate
- **Image Generation**: `stability-ai/sdxl` (SDXL)
  - Input: Text prompt + style parameters
  - Output: 1080×1920 vertical image
- **Video Generation**: `stability-ai/stable-video-diffusion-img2vid-xt`
  - Input: Image + duration
  - Output: MP4 video (3-6 seconds)
- **Product Compositing**: `flux-kontext-apps/multi-image-kontext-pro`
  - Input: Scene image + product image
  - Output: Composed image with product

### Modal (Optional - for NeRF)
- **COLMAP Processing**: Camera pose estimation from images
- **NeRF Training**: Train 3D model using NeRF Studio
- **Frame Rendering**: Render 1440 frames with transparent backgrounds
- **GPU**: T4 (dev), A10G (prod)

## Security

### Authentication (Frontend)
- **Provider**: Clerk
- **Strategy**: Session-based auth with JWT
- **Protected Routes**: Middleware protects `/projects` and `/project/*`

### API Security (Backend)
- **CORS**: Configured for frontend origin only
- **Rate Limiting**: Prevents API abuse (configurable per endpoint)
- **Input Validation**: Pydantic schemas validate all requests
- **File Upload**: Size limits, type validation, secure storage

### Data Privacy
- **User Data**: Managed by Clerk (GDPR compliant)
- **Project Data**: Stored locally in browser (not synced to backend yet)
- **Generated Content**: Stored on backend with unique IDs

## Performance Optimization

### Frontend
- **Code Splitting**: Automatic with Next.js App Router
- **Image Optimization**: Next.js Image component
- **Lazy Loading**: React.lazy for heavy components
- **Debounced Auto-Save**: Prevents excessive localStorage writes
- **SSE Connection Pooling**: One connection per storyboard

### Backend
- **Async/Await**: Non-blocking I/O for all API calls
- **Connection Pooling**: Replicate API connection reuse
- **Caching**: FFmpeg processes cached where possible
- **Rate Limiting**: Prevents service overload

### Development vs Production

| Feature | Development | Production |
|---------|-------------|------------|
| Image Steps | 15 | 50 |
| Image Resolution | 512×912 | 1080×1920 |
| Images per Mood | 1 | 4 |
| OpenAI Model | GPT-3.5-turbo | GPT-4o |
| NeRF GPU | T4 | A10G |

## Deployment

### Frontend
- **Platform**: Vercel (recommended)
- **Build**: `pnpm build`
- **Environment**: Configure Clerk keys, API URL

### Backend
- **Platform**: Render, Railway, or Docker container
- **Requirements**: Python 3.11+, FFmpeg
- **Environment**: Configure API keys (OpenAI, Replicate, Modal)
- **Database**: SQLite (included), or migrate to PostgreSQL

### Modal Functions
- **Platform**: Modal.com
- **Deploy**: `modal deploy modal_functions/nerf_app.py`
- **Environment**: Development vs Production deployment names

## Monitoring & Logging

### Frontend
- **Console Logging**: Structured logs with context
- **Error Boundaries**: Prevent full app crashes
- **Performance**: Next.js analytics (optional)

### Backend
- **Structured Logging**: Python logging module
- **Metrics Tracking**: Admin endpoints for usage stats
- **Health Checks**: `/health` endpoint
- **Error Tracking**: Ready for Sentry integration

## Future Improvements

1. **Backend Project Persistence**
   - Migrate from localStorage to database
   - Associate projects with user accounts
   - Enable cross-device access

2. **Real-time Collaboration**
   - WebSocket for multi-user editing
   - Conflict resolution for concurrent edits

3. **Advanced Features**
   - Brand asset library with version control
   - Template system for common video types
   - Batch processing for multiple projects

4. **Performance**
   - Redis cache for API responses
   - CDN for static assets and generated content
   - Database indexing for large-scale data

