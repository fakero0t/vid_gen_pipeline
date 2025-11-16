# ARCHITECTURE.md

## System Architecture Overview

This document defines the technical architecture for the AI Video Generation Pipeline. The system is built as a **monorepo** with a Next.js frontend and FastAPI backend, designed for local development in MVP with future AWS deployment.

---

## Tech Stack

### Frontend
- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **UI Components:** shadcn/ui
- **Styling:** Tailwind CSS v4
- **State Management:** Zustand
- **AI/Chat:** Vercel AI SDK with OpenAI
- **Deployment:** 
  - MVP: Local development (`localhost:3000`)
  - Post-MVP: AWS (Amplify or EC2/ECS)

### Backend
- **Framework:** FastAPI (Python 3.11+)
- **Language:** Python
- **AI Services:**
  - Replicate API (image & video generation)
- **Video Processing:** FFmpeg (via `ffmpeg-python`)
- **Async Processing:** Python asyncio/async-await
- **Deployment:**
  - MVP: Local development (`localhost:8000`)
  - Post-MVP: AWS (ECS/Fargate - TBD)

### External Services
- **OpenAI API:** GPT-4o (chat & creative brief synthesis)
- **Replicate:** Image generation, video generation (img2vid)

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NEXT.JS FRONTEND (localhost:3000)            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  React Components (shadcn/ui + Tailwind)                  │  │
│  │  - Vision Chat Interface                                  │  │
│  │  - Mood Gallery                                          │  │
│  │  - Storyboard Timeline                                   │  │
│  │  - Video Player & Progress Tracking                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Zustand State Store                                      │  │
│  │  - Global app state (creative_brief, moods, scenes, etc.) │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Next.js API Routes (App Router)                          │  │
│  │  - /api/chat/* (OpenAI via Vercel AI SDK) - Engineer 1   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
           │                                      │
           │ (OpenAI API)                        │ (Direct HTTP calls)
           ▼                                      ▼
    ┌─────────────┐              ┌─────────────────────────────────┐
    │  OpenAI API │              │  FASTAPI BACKEND (localhost:8000)│
    │   (GPT-4o)  │              │  ┌──────────────────────────────┐│
    └─────────────┘              │  │  FastAPI Endpoints           ││
                                 │  │  - POST /api/moods/generate  ││
                                 │  │  - POST /api/scenes/plan     ││
                                 │  │  - POST /api/scenes/seeds    ││
                                 │  │  - POST /api/video/generate  ││
                                 │  │  - POST /api/video/compose   ││
                                 │  │  - GET  /api/status/{job_id} ││
                                 │  └──────────────────────────────┘│
                                 │  ┌──────────────────────────────┐│
                                 │  │  Replicate Integration       ││
                                 │  │  - Image generation models   ││
                                 │  │  - Video generation models   ││
                                 │  └──────────────────────────────┘│
                                 │  ┌──────────────────────────────┐│
                                 │  │  FFmpeg Processing           ││
                                 │  │  - Video concatenation       ││
                                 │  │  - Audio sync                ││
                                 │  │  - Transitions               ││
                                 │  └──────────────────────────────┘│
                                 └─────────────────────────────────┘
                                              │
                                              ▼
                                      ┌──────────────┐
                                      │ Replicate API │
                                      │ (Image & Video)│
                                      └──────────────┘
```

---

## API Architecture

### Next.js API Routes (App Router)

**Location:** `/app/api/`

**Engineer 1 Ownership:**
```
/app/api/chat/
  - route.ts - OpenAI chat endpoint using Vercel AI SDK
```

**Purpose:**
- Handle conversational AI for vision refinement
- Synthesize creative brief from chat history
- Uses Vercel AI SDK `streamText()` or `generateText()`

**Example Endpoint:**
```typescript
// /app/api/chat/route.ts
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

export async function POST(req: Request) {
  const { messages } = await req.json();
  
  const result = await streamText({
    model: openai('gpt-4o'),
    messages,
    system: 'You are a creative director helping users define their video vision...'
  });
  
  return result.toDataStreamResponse();
}
```

---

### FastAPI Backend Endpoints

**Base URL:** `http://localhost:8000` (MVP)

**CORS Configuration:** Allow `http://localhost:3000`

#### Engineer 2: Mood Generation

```
POST /api/moods/generate
```
**Request:**
```json
{
  "creative_brief": {
    "product_name": "Luxury Skincare Serum",
    "target_audience": "Women 25-40",
    "emotional_tone": ["elegant", "calming"],
    "visual_style_keywords": ["minimalist", "white", "gold"],
    "key_messages": ["Natural ingredients"]
  }
}
```

**Response:**
```json
{
  "moods": [
    {
      "mood_id": "uuid-1",
      "style_name": "Minimalist Gold Elegance",
      "style_keywords": ["minimalist", "white", "gold", "clean"],
      "reference_images": [
        "https://replicate.delivery/temp-url-1.png",
        "https://replicate.delivery/temp-url-2.png",
        "https://replicate.delivery/temp-url-3.png",
        "https://replicate.delivery/temp-url-4.png"
      ],
      "color_palette": ["#FFFFFF", "#D4AF37"]
    }
  ]
}
```

**Processing:**
1. Extract 3 distinct style directions from creative brief (using GPT-4o or logic)
2. Generate 4 images per mood in parallel (12 total Replicate calls)
3. Use `asyncio.gather()` for parallel execution
4. Return temporary URLs from Replicate

---

#### Engineer 3: Scene Planning

```
POST /api/scenes/plan
```
**Request:**
```json
{
  "creative_brief": { },
  "selected_mood": { }
}
```

**Response:**
```json
{
  "scene_plan": {
    "total_duration": 30,
    "scenes": [
      {
        "scene_number": 1,
        "duration": 5,
        "description": "Close-up of serum bottle on white marble",
        "style_prompt": "minimalist white and gold, luxury skincare product closeup, soft lighting"
      }
    ]
  }
}
```

**Processing:**
1. Use GPT-4o to break 30 seconds into 5-7 logical scenes
2. Generate scene descriptions
3. Calculate timing (must sum to 30s)

---

```
POST /api/scenes/seeds
```
**Request:**
```json
{
  "scenes": [ ],
  "mood_style": { }
}
```

**Response:**
```json
{
  "scenes_with_seeds": [
    {
      "scene_number": 1,
      "duration": 5,
      "seed_image_url": "https://replicate.delivery/seed-1.png",
      "description": "Close-up of serum bottle",
      "style_prompt": "minimalist white gold luxury..."
    }
  ]
}
```

**Processing:**
1. Generate seed image for each scene (5-7 Replicate calls)
2. Use selected mood's style keywords + scene description
3. Parallel generation with `asyncio.gather()`

---

#### Engineer 4: Video Generation & Composition

```
POST /api/video/generate
```
**Request:**
```json
{
  "scenes": [ ]
}
```

**Response:**
```json
{
  "job_id": "uuid-123",
  "status": "processing",
  "clips": []
}
```

**Processing:**
1. Start async video generation for all scenes (img2vid)
2. Return immediately with job_id
3. Frontend polls status endpoint

---

```
GET /api/video/status/{job_id}
```
**Response (In Progress):**
```json
{
  "status": "processing",
  "progress": 45,
  "clips": [
    {
      "scene_number": 1,
      "status": "complete",
      "video_url": "https://replicate.delivery/clip-1.mp4"
    },
    {
      "scene_number": 2,
      "status": "processing",
      "video_url": null
    }
  ]
}
```

**Response (Complete):**
```json
{
  "status": "complete",
  "progress": 100,
  "clips": [ ]
}
```

---

```
POST /api/video/compose
```
**Request:**
```json
{
  "clips": [ ],
  "mood": { },
  "creative_brief": { }
}
```

**Response:**
```json
{
  "job_id": "uuid-456",
  "status": "processing"
}
```

---

```
GET /api/video/compose/status/{job_id}
```
**Response (Complete):**
```json
{
  "status": "complete",
  "final_video_url": "https://replicate.delivery/final-video.mp4",
  "duration": 30,
  "audio_url": "https://replicate.delivery/audio.mp3"
}
```

**Processing:**
1. Generate background music (Replicate audio model)
2. Download all video clips to temp directory
3. Use FFmpeg to:
   - Concatenate clips with 0.5s crossfade
   - Add background audio
   - Sync audio timeline
   - Export as MP4 (1080p, 30fps, 9:16)
4. Upload to temporary storage or return Replicate URL
5. Return final video URL

---

## Data Flow

### Step 1: Vision Chat (Engineer 1)
```
User Input → Next.js Chat UI → /api/chat (Vercel AI SDK) → OpenAI GPT-4o
                                                              ↓
User ← Creative Brief ← Zustand Store ← Synthesized Response ←
```

### Step 2: Mood Generation (Engineer 2)
```
Creative Brief (from Zustand) → Frontend Component
                                       ↓
                              POST /api/moods/generate (FastAPI)
                                       ↓
                              Replicate (12 parallel image generations)
                                       ↓
                              3 Moods × 4 Images each
                                       ↓
User Selects Mood ← Zustand Store ← Response with temp URLs
```

### Step 3: Scene Planning (Engineer 3)
```
Creative Brief + Selected Mood → Frontend Component
                                       ↓
                              POST /api/scenes/plan (FastAPI)
                                       ↓
                              GPT-4o generates scene breakdown
                                       ↓
                              POST /api/scenes/seeds (FastAPI)
                                       ↓
                              Replicate (5-7 parallel seed images)
                                       ↓
Scene Plan with Seed Images ← Zustand Store ← Response
```

### Step 4: Video Generation (Engineer 4)
```
Scene Plan → Frontend Component
                   ↓
          POST /api/video/generate (FastAPI)
                   ↓
          Replicate (5-7 parallel img2vid calls)
                   ↓
          Frontend Polls: GET /api/video/status/{job_id}
                   ↓
Generated Clips ← Zustand Store ← Status Response (when complete)
```

### Step 5: Composition (Engineer 4)
```
Generated Clips → Frontend Component
                        ↓
               POST /api/video/compose (FastAPI)
                        ↓
          Generate Audio (Replicate) + FFmpeg Processing
                        ↓
          Frontend Polls: GET /api/video/compose/status/{job_id}
                        ↓
Final Video URL ← Zustand Store ← Status Response (when complete)
```

---

## State Management (Zustand)

**Store Location:** `/src/store/appStore.ts`

```typescript
interface AppState {
  // Navigation
  currentStep: 1 | 2 | 3 | 4 | 5;
  setCurrentStep: (step: number) => void;
  
  // Step 1: Vision
  creativeBrief: CreativeBrief | null;
  setCreativeBrief: (brief: CreativeBrief) => void;
  
  // Step 2: Moods
  moods: Mood[];
  selectedMoodId: string | null;
  setMoods: (moods: Mood[]) => void;
  selectMood: (moodId: string) => void;
  
  // Step 3: Scenes
  scenePlan: ScenePlan | null;
  setScenePlan: (plan: ScenePlan) => void;
  
  // Step 4: Video Clips
  generatedClips: GeneratedClip[];
  clipGenerationProgress: number;
  setGeneratedClips: (clips: GeneratedClip[]) => void;
  updateClipProgress: (progress: number) => void;
  
  // Step 5: Final Video
  finalVideo: FinalVideo | null;
  compositionProgress: number;
  setFinalVideo: (video: FinalVideo) => void;
  updateCompositionProgress: (progress: number) => void;
  
  // Error Handling
  error: string | null;
  setError: (error: string | null) => void;
  
  // Reset
  reset: () => void;
}
```

**Usage Example:**
```typescript
// In a component
import { useAppStore } from '@/store/appStore';

function MoodGallery() {
  const { creativeBrief, setMoods, selectMood } = useAppStore();
  
  // Use state...
}
```

---

## Project Structure

```
/
├── frontend/                    # Next.js App
│   ├── app/
│   │   ├── api/
│   │   │   └── chat/           # Engineer 1: OpenAI endpoints
│   │   │       └── route.ts
│   │   ├── page.tsx            # Main app entry
│   │   └── layout.tsx
│   ├── components/
│   │   ├── vision/             # Engineer 1
│   │   │   ├── ChatInterface.tsx
│   │   │   ├── VisionPrompt.tsx
│   │   │   └── CreativeBriefSummary.tsx
│   │   ├── moods/              # Engineer 2
│   │   │   ├── MoodBoard.tsx
│   │   │   ├── MoodCard.tsx
│   │   │   └── MoodGallery.tsx
│   │   ├── scenes/             # Engineer 3
│   │   │   ├── Storyboard.tsx
│   │   │   ├── SceneCard.tsx
│   │   │   └── SceneTimeline.tsx
│   │   ├── generation/         # Engineer 4
│   │   │   ├── ClipProgress.tsx
│   │   │   └── ProgressIndicator.tsx
│   │   ├── composition/        # Engineer 4
│   │   │   ├── CompositionProgress.tsx
│   │   │   ├── VideoPlayer.tsx
│   │   │   └── DownloadButton.tsx
│   │   └── ui/                 # shadcn/ui components
│   ├── hooks/
│   │   ├── useVisionChat.ts    # Engineer 1
│   │   ├── useMoodGeneration.ts # Engineer 2
│   │   ├── useScenePlanning.ts # Engineer 3
│   │   ├── useVideoGeneration.ts # Engineer 4
│   │   └── useVideoComposition.ts # Engineer 4
│   ├── lib/
│   │   ├── api/                # API client functions
│   │   │   ├── moods.ts        # Engineer 2
│   │   │   ├── scenes.ts       # Engineer 3
│   │   │   └── video.ts        # Engineer 4
│   │   └── utils.ts
│   ├── store/
│   │   └── appStore.ts         # Zustand store (shared)
│   ├── types/
│   │   ├── vision.types.ts     # Engineer 1
│   │   ├── mood.types.ts       # Engineer 2
│   │   ├── scene.types.ts      # Engineer 3
│   │   ├── video.types.ts      # Engineer 4
│   │   └── shared.types.ts     # Shared types
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   └── next.config.js
│
├── backend/                     # FastAPI App
│   ├── app/
│   │   ├── main.py             # FastAPI app entry
│   │   ├── config.py           # Configuration & env vars
│   │   ├── routers/
│   │   │   ├── moods.py        # Engineer 2: Mood endpoints
│   │   │   ├── scenes.py       # Engineer 3: Scene endpoints
│   │   │   └── video.py        # Engineer 4: Video endpoints
│   │   ├── services/
│   │   │   ├── replicate_service.py  # Replicate API wrapper
│   │   │   ├── openai_service.py     # OpenAI API wrapper
│   │   │   ├── ffmpeg_service.py     # FFmpeg operations
│   │   │   └── audio_service.py      # Audio generation
│   │   ├── models/
│   │   │   ├── creative_brief.py
│   │   │   ├── mood.py
│   │   │   ├── scene.py
│   │   │   └── video.py
│   │   └── utils/
│   │       ├── job_tracker.py  # In-memory job status tracking
│   │       └── helpers.py
│   ├── requirements.txt
│   └── .env.example
│
└── README.md
```

---

## Environment Variables

### Frontend (`.env.local`)
```bash
# OpenAI API Key (for Vercel AI SDK)
OPENAI_API_KEY=sk-...

# FastAPI Backend URL
NEXT_PUBLIC_API_URL=http://localhost:8000

# Optional: For production
NEXT_PUBLIC_API_URL_PROD=https://api.yourdomain.com
```

### Backend (`.env`)
```bash
# Replicate API Key
REPLICATE_API_TOKEN=r8_...

# OpenAI API Key (for scene planning, mood analysis)
OPENAI_API_KEY=sk-...

# CORS Origins
CORS_ORIGINS=http://localhost:3000

# Optional: For production
# CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

---

## Local Development Setup

### Prerequisites
- Node.js 18+ and pnpm (package manager)
- Python 3.11+
- FFmpeg installed on system (`brew install ffmpeg` on macOS)

### Frontend Setup
```bash
cd frontend
pnpm install
pnpm dev
# Runs on http://localhost:3000
```

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# Runs on http://localhost:8000
```

### Running Both Simultaneously
**Option 1: Use concurrently (Recommended)**
```bash
# From the root directory
pnpm dev
```

This uses the root `package.json` scripts:
```json
{
  "scripts": {
    "dev": "concurrently \"pnpm run dev:frontend\" \"pnpm run dev:backend\"",
    "dev:frontend": "cd frontend && pnpm dev",
    "dev:backend": "cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8000"
  }
}
```

**Option 2: Two terminals**
- Terminal 1: `cd frontend && pnpm dev`
- Terminal 2: `cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8000`

---

## API Communication Pattern

### Polling Implementation (for long-running tasks)

**Frontend Pattern:**
```typescript
// hooks/useVideoGeneration.ts
import { useState, useEffect } from 'react';

export function useVideoGeneration() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'processing' | 'complete' | 'failed'>('idle');
  const [progress, setProgress] = useState(0);
  
  // Start generation
  async function startGeneration(scenes: Scene[]) {
    const response = await fetch('http://localhost:8000/api/video/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenes })
    });
    const data = await response.json();
    setJobId(data.job_id);
    setStatus('processing');
  }
  
  // Poll for status
  useEffect(() => {
    if (!jobId || status !== 'processing') return;
    
    const pollInterval = setInterval(async () => {
      const response = await fetch(`http://localhost:8000/api/video/status/${jobId}`);
      const data = await response.json();
      
      setProgress(data.progress);
      
      if (data.status === 'complete') {
        setStatus('complete');
        clearInterval(pollInterval);
        // Update Zustand store with clips
      } else if (data.status === 'failed') {
        setStatus('failed');
        clearInterval(pollInterval);
      }
    }, 3000); // Poll every 3 seconds
    
    return () => clearInterval(pollInterval);
  }, [jobId, status]);
  
  return { startGeneration, status, progress };
}
```

**Backend Pattern (FastAPI):**
```python
# app/routers/video.py
from fastapi import APIRouter
from app.utils.job_tracker import job_tracker
import asyncio

router = APIRouter()

@router.post("/api/video/generate")
async def generate_video(scenes: list[Scene]):
    job_id = str(uuid.uuid4())
    
    # Store job in memory
    job_tracker.create_job(job_id, total_clips=len(scenes))
    
    # Start background task
    asyncio.create_task(process_video_generation(job_id, scenes))
    
    return {"job_id": job_id, "status": "processing"}

@router.get("/api/video/status/{job_id}")
async def get_status(job_id: str):
    job = job_tracker.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return {
        "status": job.status,
        "progress": job.progress,
        "clips": job.clips
    }

async def process_video_generation(job_id: str, scenes: list[Scene]):
    # Generate clips in parallel
    tasks = [generate_clip(scene) for scene in scenes]
    results = await asyncio.gather(*tasks)
    
    # Update job tracker
    job_tracker.complete_job(job_id, clips=results)
```

---

## FastAPI CORS Configuration

```python
# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

app = FastAPI()

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Engineer Responsibilities Summary

| Engineer | Frontend Components | Backend Endpoints | External APIs |
|----------|-------------------|-------------------|---------------|
| **Engineer 1** | Vision chat UI, Creative brief display | `/api/chat/*` (Next.js) | OpenAI (via Vercel AI SDK) |
| **Engineer 2** | Mood gallery, Mood selection | `/api/moods/generate` (FastAPI) | Replicate (image gen) |
| **Engineer 3** | Storyboard, Scene cards | `/api/scenes/plan`, `/api/scenes/seeds` (FastAPI) | OpenAI (scene planning), Replicate (seed images) |
| **Engineer 4** | Progress tracking, Video player, Download | `/api/video/generate`, `/api/video/compose`, status endpoints (FastAPI) | Replicate (video gen, audio gen), FFmpeg |

---

## Key Technical Decisions

### Why Direct Frontend → FastAPI Calls?
- **Simpler architecture:** Fewer layers = less complexity
- **Faster development:** No need to build Next.js proxy layer
- **Clear separation:** Frontend handles UI/state, backend handles AI/video processing
- **Post-MVP:** Can add Next.js middleware layer if needed for auth, rate limiting, etc.

### Why Polling Instead of WebSockets?
- **Simpler for MVP:** No WebSocket infrastructure needed
- **Stateless backend:** FastAPI doesn't need to maintain WS connections
- **Good enough UX:** 3-second polls feel responsive for video generation
- **Post-MVP:** Can upgrade to WebSockets or Server-Sent Events if needed

### Why In-Memory Job Tracking?
- **MVP simplicity:** No database/Redis setup required
- **Single-user:** Since MVP is single user, in-memory is sufficient
- **Faster development:** No persistence layer to build
- **Post-MVP:** Migrate to Redis or PostgreSQL for multi-user support

### Why Zustand Over Redux?
- **Less boilerplate:** Simpler API, faster development
- **TypeScript-first:** Better type inference
- **Small bundle size:** Lightweight for MVP
- **Easy migration:** Can migrate to Redux if needed post-MVP

---

## Post-MVP Architecture Evolution

### Database Layer
- **PostgreSQL** for persistent storage
- Schema:
  - `users` - User accounts
  - `projects` - Video projects (save/resume)
  - `videos` - Generated videos metadata
  - `brand_assets` - Uploaded logos, fonts, colors

### File Storage
- **AWS S3** for:
  - User-uploaded brand assets
  - Generated videos (permanent storage)
  - Intermediate files (mood images, seed images, clips)

### Authentication
- **NextAuth.js** for frontend auth
- **JWT tokens** for FastAPI authentication

### Job Queue
- **Celery + Redis** for:
  - Background job processing
  - Task scheduling
  - Job result storage

### Deployment
- **Frontend:** AWS Amplify or Vercel
- **Backend:** AWS ECS (Fargate) with Docker
- **Database:** AWS RDS (PostgreSQL)
- **Storage:** AWS S3
- **CDN:** CloudFront for video delivery

---

## Testing Strategy

### Frontend Testing
- **Unit tests:** Jest + React Testing Library
- **Component tests:** Test each step's UI independently
- **Integration tests:** Test state flow between steps
- **E2E tests:** Playwright (full user flow)

### Backend Testing
- **Unit tests:** pytest for individual functions
- **API tests:** pytest + httpx for endpoint testing
- **Integration tests:** Test Replicate/OpenAI integrations with mocks
- **Load tests:** Locust for performance testing

---

## Monitoring & Logging

### MVP (Local Development)
- **Frontend:** Browser console, React DevTools
- **Backend:** FastAPI auto-generated docs at `/docs`, Python logging to console

### Post-MVP (Production)
- **Frontend:** Sentry for error tracking
- **Backend:** CloudWatch Logs, Sentry
- **Metrics:** Prometheus + Grafana
- **Costs:** Track Replicate/OpenAI API usage

---

## Security Considerations

### MVP
- **API Keys:** Stored in `.env` files (not committed to git)
- **CORS:** Restricted to `localhost:3000`
- **Input validation:** Pydantic models in FastAPI

### Post-MVP
- **Authentication:** OAuth 2.0, JWT tokens
- **Rate limiting:** Prevent API abuse
- **Input sanitization:** Prevent injection attacks
- **Secrets management:** AWS Secrets Manager
- **HTTPS:** SSL/TLS for all production traffic

---

## Development Workflow

### Git Workflow
1. Create feature branch from `dev`
2. Develop locally with mock data
3. Test independently
4. Create PR to `dev`
5. Code review
6. Merge to `dev`
7. Integration testing
8. Merge `dev` to `main` for releases

### Code Review Checklist
- [ ] TypeScript types defined
- [ ] Error handling implemented
- [ ] Loading states handled
- [ ] API contracts match documentation
- [ ] No hardcoded values
- [ ] Environment variables used correctly
- [ ] Comments for complex logic
- [ ] No console.logs in production code

---

## Performance Optimization

### Frontend
- **Code splitting:** Lazy load components for each step
- **Image optimization:** Next.js Image component
- **Caching:** SWR or React Query for API calls (post-MVP)

### Backend
- **Parallel processing:** `asyncio.gather()` for batch operations
- **Caching:** Cache mood generation results (post-MVP)
- **Connection pooling:** Replicate API client reuse
- **Compression:** gzip responses

### Video Processing
- **FFmpeg optimization:** Use hardware acceleration if available
- **Temp file cleanup:** Delete intermediate files after composition
- **Streaming:** Stream large files instead of loading into memory

---

## Troubleshooting Guide

### Common Issues

**Issue:** CORS errors when calling FastAPI from Next.js
- **Solution:** Ensure FastAPI CORS middleware allows `http://localhost:3000`

**Issue:** FFmpeg not found
- **Solution:** Install FFmpeg (`brew install ffmpeg` on macOS)

**Issue:** Replicate API rate limits
- **Solution:** Implement exponential backoff and retry logic

**Issue:** Video generation timeout
- **Solution:** Increase timeout, or break into smaller chunks

**Issue:** State not persisting between steps
- **Solution:** Check Zustand store updates, ensure selectors are correct

---

## Resources & Documentation

### Official Docs
- [Next.js 15 Documentation](https://nextjs.org/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Replicate API Docs](https://replicate.com/docs)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)

### Useful Libraries
- **Frontend:**
  - `ai` - Vercel AI SDK
  - `zustand` - State management
  - `@radix-ui/*` - UI primitives (via shadcn)
  - `lucide-react` - Icons
  - `clsx` & `tailwind-merge` - Utility classes

- **Backend:**
  - `replicate` - Replicate Python client
  - `openai` - OpenAI Python client
  - `ffmpeg-python` - FFmpeg wrapper
  - `pydantic` - Data validation
  - `python-multipart` - File uploads (post-MVP)
  - `python-dotenv` - Environment variables

---

## Contact & Support

For architecture questions or clarifications, refer to this document or consult with the team lead.

**Last Updated:** [Date]
**Version:** 1.0.0 (MVP)
