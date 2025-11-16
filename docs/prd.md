# **AI Video Generation Pipeline - Product Requirements Document**

## **Executive Summary**

A guided, multi-step AI video generation pipeline that transforms user vision into 30-second vertical videos optimized for social media. Users progress through mood selection, scene planning, and automated video generation with AI assistance at each step.

**MVP Scope:** Single-user, client-side state management, no persistence, no authentication.

---

## **Product Specifications - MVP**

### **Core Parameters**

- **Video Length:** 30 seconds (fixed for MVP)
- **Aspect Ratio:** 9:16 (vertical/portrait - social media optimized)
- **Resolution:** Minimum 1080p
- **Frame Rate:** 30 FPS
- **User Flow:** Synchronous (users wait through each step)
- **Generation Strategy:** Parallel processing where possible to minimize wait times
- **State Management:** Frontend-only (React state, no database)
- **Storage:** No S3, videos served directly from generation APIs or temporary URLs

---

## **Detailed User Flow**

### **Step 1: Vision Definition & AI Assistance**

**User Experience:**

- Landing page with prominent input area
- AI chat interface to help users refine their vision
- System guides users to provide sufficient detail for generation

**AI Chat Behavior:**

- If user provides detailed prompt → Process immediately
- If user provides vague prompt → Ask clarifying questions:
  - "What product/service is this video for?"
  - "Who is your target audience?"
  - "What emotion should this evoke?"
  - "Any specific visual style preferences (minimalist, vibrant, luxury, etc.)?"
- Synthesize conversation into structured creative brief

**Output:** Comprehensive creative brief with:

- Core message/product
- Target audience
- Emotional tone
- Visual style keywords
- Key scenes/moments to highlight

**State to Store:**

```typescript
interface CreativeBrief {
  product_name: string;
  target_audience: string;
  emotional_tone: string[];
  visual_style_keywords: string[];
  key_messages: string[];
  conversation_history?: Message[];
}
```

---

### **Step 2: Mood Selection**

**User Experience:**

- System presents 3 distinct mood boards
- Each mood board contains 4 curated images
- Moods show different visual interpretations of the creative brief
- Click to select one mood
- Selected mood highlights/expands

**Mood Generation:**

- Extract 3 different style directions from creative brief
  - Example: "Luxury skincare" might generate:
    - Mood 1: Minimalist white/gold, clinical elegance
    - Mood 2: Natural/organic, earthy tones, botanical
    - Mood 3: Modern gradient, holographic, futuristic
- Generate 4 images per mood that represent that aesthetic
- Images should vary in composition but maintain consistent style

**Technical Details:**

- 12 total images generated (3 moods × 4 images)
- MVP: Use fast/cheap models during development
- Production: Use high-quality models, generate all 12 in parallel
- Images are references, not final video frames

**State to Store:**

```typescript
interface Mood {
  mood_id: string;
  style_name: string;
  style_keywords: string[];
  reference_images: string[]; // URLs or base64
  color_palette?: string[];
}

interface MoodState {
  moods: Mood[]; // Array of 3 moods
  selected_mood_id?: string;
}
```

---

### **Step 3: Scene Storyboarding**

**User Experience:**

- System shows scene-by-scene breakdown
- For 30-second video: Display 5-7 scenes
- Each scene displays:
  - Seed image (in selected mood's style)
  - Text description of what happens in this scene
  - Duration (e.g., "Scene 1 - 4 seconds")
- Scenes shown in vertical scroll or horizontal timeline
- Clear progression from scene 1 → final scene

**Scene Planning Logic:**

- Analyze creative brief + selected mood
- Break 30 seconds into logical narrative beats:
  - Opening hook (3-4 seconds)
  - Product/message introduction (4-6 seconds)
  - Key features/benefits (12-16 seconds, split into 2-3 scenes)
  - Closing/CTA setup (4-6 seconds)
- Generate seed image for each scene using mood style as reference
- Write concise description for each scene

**Scene Seed Images:**

- Match selected mood aesthetic
- Represent key visual moment in that scene
- Will be used to seed video generation (img2vid)
- Should have variety in composition (close-up, wide, detail shots)

**State to Store:**

```typescript
interface Scene {
  scene_number: number;
  duration: number; // in seconds
  seed_image_url: string; // or base64
  description: string;
  style_prompt: string;
}

interface ScenePlan {
  total_duration: number; // 30 seconds
  scenes: Scene[];
}
```

---

### **Step 4: Video Clip Generation**

**User Experience:**

- Progress bar showing overall completion
- Individual progress indicators for each scene
- "Generating Scene 1 of 6..." with scene thumbnail
- Clips preview as they complete (optional: show in-progress clips)

**Technical Process:**

- Generate video clips in parallel for all scenes
- Use seed images from Step 3 as img2vid inputs
- Each clip duration matches scene timing from Step 3
- Maintain style consistency via:
  - Consistent prompting strategy
  - Seed image style reference
  - Same model/parameters across all clips

**Clip Specifications:**

- Format: 9:16 vertical
- Duration: Variable per scene (3-7 seconds each)
- Quality: 1080p minimum
- Generated with scene description + seed image + mood style keywords

**State to Store:**

```typescript
interface GeneratedClip {
  scene_number: number;
  video_url: string; // Temporary URL from generation API
  duration: number;
  status: "generating" | "complete" | "failed";
}

interface ClipGenerationState {
  clips: GeneratedClip[];
  overall_progress: number; // 0-100
}
```

---

### **Step 5: Final Composition & Audio**

**User Experience:**

- "Composing your final video..." message
- Progress indicator for:
  - Audio generation
  - Audio-visual sync
  - Final rendering
- Preview player when complete
- Download button for final video

**Technical Process:**

1. **Audio Generation:**

   - Generate background music based on mood + creative brief
   - Style: Match emotional tone (upbeat, calm, dramatic, etc.)
   - Length: Exactly 30 seconds
   - No lyrics for MVP (instrumental only)

2. **Clip Stitching:**

   - Concatenate clips in scene order
   - Apply subtle transitions between clips (0.5s crossfade)
   - Ensure total duration = 30 seconds

3. **Audio-Visual Sync:**

   - Align music to video timeline
   - Ensure no audio drift
   - Normalize audio levels

4. **Final Render:**
   - Output: MP4, 1080p, 30fps, 9:16
   - Proper compression (target: <50MB file size)
   - Metadata: Title from creative brief

**State to Store:**

```typescript
interface FinalVideo {
  video_url: string; // Temporary download URL
  audio_url: string;
  duration: number;
  status: "composing" | "complete" | "failed";
  thumbnail_url?: string;
}
```

---

## **Complete Application State Structure**

```typescript
interface AppState {
  current_step: 1 | 2 | 3 | 4 | 5;

  // Step 1
  creative_brief: CreativeBrief | null;

  // Step 2
  moods: Mood[];
  selected_mood_id: string | null;

  // Step 3
  scene_plan: ScenePlan | null;

  // Step 4
  generated_clips: GeneratedClip[];
  clip_generation_progress: number;

  // Step 5
  final_video: FinalVideo | null;

  // Error handling
  error: string | null;
}
```

---

## **Engineering Domain Division**

### **Engineer 1: Vision & Chat Interface (Step 1)**

**Full Ownership:**

- Landing page and initial user input
- AI chat interface for vision refinement
- LLM integration for conversational guidance
- Creative brief synthesis
- State management for Step 1
- Navigation to Step 2

**Deliverables:**

- Chat UI component
- LLM prompt engineering for vision extraction
- Creative brief data structure in app state
- API integration: LLM chat endpoint
- "Continue to Mood Selection" transition

**Tech Stack:**

- Frontend: React components for chat
- State: React Context/Zustand for creative_brief
- API: LLM API integration (Claude/GPT-4 via backend endpoint)

**Key Files/Directories:**

```
/components/vision/
  - ChatInterface.tsx
  - VisionPromptInput.tsx
  - CreativeBriefSummary.tsx
/hooks/
  - useVisionChat.ts
/api/
  - vision.ts (backend endpoint for LLM)
/types/
  - vision.types.ts
```

**Dependencies:**

- **None** (first in pipeline)
- **Provides:** `creative_brief` object to app state

---

### **Engineer 2: Mood Generation & Selection (Step 2)**

**Full Ownership:**

- Mood generation algorithm
- Parallel image generation orchestration (12 images)
- Mood board UI display
- Mood selection interaction
- State management for Step 2
- Navigation to Step 3

**Deliverables:**

- Mood generation logic (creates 3 distinct styles)
- Parallel image generation via Replicate
- Mood board gallery UI
- Mood selection handler
- "Continue to Storyboard" transition

**Tech Stack:**

- Frontend: React components for mood gallery
- State: React Context/Zustand for moods and selected_mood_id
- API: Replicate image generation endpoints
- Parallel Processing: Promise.all for 12 concurrent generations

**Key Files/Directories:**

```
/components/moods/
  - MoodBoard.tsx
  - MoodCard.tsx
  - MoodGallery.tsx
/hooks/
  - useMoodGeneration.ts
/api/
  - moods.ts (backend endpoint for image gen orchestration)
/utils/
  - moodStyleGenerator.ts (extracts 3 styles from brief)
/types/
  - mood.types.ts
```

**Dependencies:**

- **Input:** `creative_brief` from Engineer 1
- **Provides:** `moods` array and `selected_mood_id` to app state

---

### **Engineer 3: Scene Planning & Storyboarding (Step 3)**

**Full Ownership:**

- Scene breakdown algorithm
- Seed image generation for each scene
- Scene description generation
- Timing allocation logic
- Storyboard UI display
- State management for Step 3
- Navigation to Step 4

**Deliverables:**

- Scene planning algorithm (breaks 30s into 5-7 scenes)
- Seed image generation (styled via selected mood)
- Scene description generation (LLM-based)
- Storyboard timeline/vertical UI
- "Generate Videos" transition

**Tech Stack:**

- Frontend: React components for storyboard display
- State: React Context/Zustand for scene_plan
- API: LLM for scene descriptions, Replicate for seed images
- Parallel Processing: Generate all seed images concurrently

**Key Files/Directories:**

```
/components/scenes/
  - Storyboard.tsx
  - SceneCard.tsx
  - SceneTimeline.tsx
/hooks/
  - useScenePlanning.ts
/api/
  - scenes.ts (backend endpoints)
/utils/
  - sceneBreakdown.ts (timing logic)
  - sceneSeedImageGen.ts
/types/
  - scene.types.ts
```

**Dependencies:**

- **Input:** `creative_brief` and `selected_mood_id` from previous steps
- **Provides:** `scene_plan` object to app state

---

### **Engineer 4: Video Generation & Composition (Steps 4 & 5)**

**Full Ownership:**

- Video clip generation (img2vid) for all scenes
- Parallel clip processing
- Progress tracking for clip generation
- Background music generation
- Clip stitching and transitions (FFmpeg)
- Audio-visual synchronization
- Final video rendering
- Video player and download UI
- State management for Steps 4 & 5

**Deliverables:**

- Video generation orchestration (parallel img2vid)
- Audio generation integration
- FFmpeg-based composition pipeline
- Progress tracking UI for both steps
- Final video player component
- Download functionality

**Tech Stack:**

- Frontend: React components for progress and video player
- State: React Context/Zustand for generated_clips and final_video
- API:
  - Replicate for img2vid generation
  - Audio generation API
  - FFmpeg backend endpoint for composition
- Parallel Processing: Generate all clips concurrently

**Key Files/Directories:**

```
/components/generation/
  - ClipProgress.tsx
  - ProgressIndicator.tsx
  - VideoPlayer.tsx
  - DownloadButton.tsx
/components/composition/
  - CompositionProgress.tsx
/hooks/
  - useVideoGeneration.ts
  - useVideoComposition.ts
/api/
  - video-generation.ts
  - audio-generation.ts
  - composition.ts (FFmpeg endpoint)
/utils/
  - clipStitching.ts
  - audioSync.ts
/types/
  - video.types.ts
```

**Dependencies:**

- **Input:** `scene_plan` from Engineer 3
- **Provides:** `generated_clips` and `final_video` to app state

---

## **Interface Contracts Between Engineers**

### **Engineer 1 → Engineer 2**

```typescript
interface CreativeBrief {
  product_name: string;
  target_audience: string;
  emotional_tone: string[]; // ["energetic", "modern", "bold"]
  visual_style_keywords: string[]; // ["minimalist", "vibrant", "geometric"]
  key_messages: string[]; // ["Fast delivery", "Premium quality"]
  conversation_history?: Message[];
}
```

### **Engineer 2 → Engineer 3**

```typescript
interface SelectedMood {
  mood_id: string;
  style_name: string; // "Minimalist Gold Elegance"
  style_keywords: string[]; // ["minimalist", "white", "gold", "clean"]
  reference_images: string[]; // Array of 4 image URLs
  color_palette?: string[]; // ["#FFFFFF", "#D4AF37", "#F5F5F5"]
}

// Also needs access to CreativeBrief from global state
```

### **Engineer 3 → Engineer 4**

```typescript
interface ScenePlan {
  total_duration: number; // 30
  scenes: Scene[];
}

interface Scene {
  scene_number: number;
  duration: number; // seconds
  seed_image_url: string;
  description: string; // "Close-up of product with soft lighting"
  style_prompt: string; // Full prompt for video generation
}
```

### **Engineer 4 Output (Final)**

```typescript
interface FinalVideo {
  video_url: string; // Temporary download URL
  audio_url: string;
  duration: number;
  thumbnail_url?: string;
}
```

---

## **Shared Infrastructure**

### **Backend API Structure**

```
/api/
  /vision
    POST /chat - LLM chat endpoint
    POST /synthesize - Create creative brief from conversation

  /moods
    POST /generate - Generate 12 mood images

  /scenes
    POST /plan - Generate scene breakdown
    POST /generate-seeds - Generate seed images for scenes

  /video
    POST /generate-clips - Generate video clips (parallel)
    POST /generate-audio - Generate background music
    POST /compose - Stitch clips + audio into final video
```

### **State Management**

- **Library:** Zustand (lightweight, no boilerplate) or React Context
- **Structure:** Single global store with sections for each step
- **Persistence:** None for MVP (all in-memory)

### **File Organization**

```
/src
  /components
    /vision      (Engineer 1)
    /moods       (Engineer 2)
    /scenes      (Engineer 3)
    /generation  (Engineer 4)
    /composition (Engineer 4)
    /shared      (All)

  /hooks
    - useVisionChat.ts       (Engineer 1)
    - useMoodGeneration.ts   (Engineer 2)
    - useScenePlanning.ts    (Engineer 3)
    - useVideoGeneration.ts  (Engineer 4)
    - useVideoComposition.ts (Engineer 4)

  /api
    - vision.ts      (Engineer 1)
    - moods.ts       (Engineer 2)
    - scenes.ts      (Engineer 3)
    - video.ts       (Engineer 4)

  /types
    - vision.types.ts (Engineer 1)
    - mood.types.ts   (Engineer 2)
    - scene.types.ts  (Engineer 3)
    - video.types.ts  (Engineer 4)
    - shared.types.ts (All)

  /store
    - appStore.ts (Shared state management)

  /utils
    (Each engineer owns utils for their domain)
```

---

## **Git Workflow to Minimize Conflicts**

### **Branch Strategy**

- `main` - Production-ready code
- `dev` - Integration branch
- Feature branches per engineer:
  - `feature/vision-chat` (Engineer 1)
  - `feature/mood-generation` (Engineer 2)
  - `feature/scene-planning` (Engineer 3)
  - `feature/video-composition` (Engineer 4)

### **Merge Strategy**

1. Engineers work independently on feature branches
2. Create PRs to `dev` branch
3. Code review by at least one other engineer
4. Merge to `dev` for integration testing
5. When stable, merge `dev` to `main`

### **Conflict Prevention**

- Each engineer owns distinct file paths
- Shared files (`types/shared.types.ts`, `store/appStore.ts`) require coordination
- Use clear interface contracts (no changes without team discussion)
- Regular sync meetings to discuss state structure changes

---

## **Mock Data Strategy for Parallel Development**

Each engineer can develop independently using mock data:

### **Engineer 1 (Vision)**

- No dependencies, can build and test fully independently

### **Engineer 2 (Moods)**

**Mock Creative Brief:**

```typescript
const mockBrief: CreativeBrief = {
  product_name: "Luxury Skincare Serum",
  target_audience: "Women 25-40, beauty enthusiasts",
  emotional_tone: ["elegant", "calming", "premium"],
  visual_style_keywords: ["minimalist", "white", "gold", "botanical"],
  key_messages: [
    "Natural ingredients",
    "Visible results",
    "Dermatologist approved",
  ],
};
```

### **Engineer 3 (Scenes)**

**Mock Selected Mood:**

```typescript
const mockMood: Mood = {
  mood_id: "mood-1",
  style_name: "Minimalist Gold Elegance",
  style_keywords: ["minimalist", "white", "gold", "clean", "botanical"],
  reference_images: [
    "https://example.com/mood1.jpg",
    "https://example.com/mood2.jpg",
    "https://example.com/mood3.jpg",
    "https://example.com/mood4.jpg",
  ],
};
```

### **Engineer 4 (Video)**

**Mock Scene Plan:**

```typescript
const mockScenePlan: ScenePlan = {
  total_duration: 30,
  scenes: [
    {
      scene_number: 1,
      duration: 5,
      seed_image_url: "https://example.com/seed1.jpg",
      description: "Close-up of serum bottle on white marble",
      style_prompt:
        "minimalist white and gold, luxury skincare product closeup",
    },
    // ... 4-6 more scenes
  ],
};
```

---

## **Success Metrics - MVP**

### **Functional Completeness**

- ✅ User can complete entire flow from vision to final video
- ✅ All 5 steps work end-to-end
- ✅ State persists correctly across step transitions
- ✅ Final video can be downloaded

### **Quality Metrics**

- ✅ Visual style consistency across all clips in a video
- ✅ Audio-visual sync (no drift)
- ✅ 1080p output, 30fps, 9:16 aspect ratio
- ✅ Smooth transitions between clips

### **User Experience**

- ✅ Clear progress indication at each step
- ✅ User can navigate forward through steps
- ✅ Loading states for all async operations
- ✅ Error messages when generation fails

---

## **Architecture & Technical Decisions**

### **Tech Stack**

**Frontend:**
- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **UI Components:** shadcn/ui
- **Styling:** Tailwind CSS v4
- **State Management:** Zustand
- **AI/Chat:** Vercel AI SDK with OpenAI
- **Deployment:** Local development (`localhost:3000`) for MVP

**Backend:**
- **Framework:** FastAPI (Python 3.11+)
- **Language:** Python
- **AI Services:** Replicate API (image & video generation)
- **Video Processing:** FFmpeg (via `ffmpeg-python`)
- **Async Processing:** Python asyncio/async-await
- **Deployment:** Local development (`localhost:8000`) for MVP

**External Services:**
- **OpenAI API:** GPT-4o (chat & creative brief synthesis)
- **Replicate:** Image generation, video generation (img2vid)

---

### **System Architecture**

The system is built as a **monorepo** with a Next.js frontend and FastAPI backend, designed for local development in MVP with future AWS deployment.

**Architecture Flow:**
- User Browser → Next.js Frontend (localhost:3000)
  - React Components (shadcn/ui + Tailwind)
  - Zustand State Store (global app state)
  - Next.js API Routes (`/api/chat/*` for Engineer 1)
- Frontend → FastAPI Backend (localhost:8000)
  - FastAPI Endpoints (moods, scenes, video generation)
  - Replicate Integration (image/video generation)
  - FFmpeg Processing (video concatenation, audio sync, transitions)
- Backend → External Services
  - OpenAI API (GPT-4o)
  - Replicate API (image & video generation)

---

### **API Structure**

**Next.js API Routes (App Router):**
- **Location:** `/app/api/`
- **Engineer 1 Ownership:**
  - `/app/api/chat/route.ts` - OpenAI chat endpoint using Vercel AI SDK
  - Handles conversational AI for vision refinement
  - Synthesizes creative brief from chat history
  - Uses Vercel AI SDK `streamText()` or `generateText()`

**FastAPI Backend Endpoints:**
- **Base URL:** `http://localhost:8000` (MVP)
- **CORS Configuration:** Allow `http://localhost:3000`

**Engineer 2: Mood Generation**
- `POST /api/moods/generate` - Generate 12 mood images (3 moods × 4 images) in parallel via Replicate

**Engineer 3: Scene Planning**
- `POST /api/scenes/plan` - Generate scene breakdown using GPT-4o
- `POST /api/scenes/seeds` - Generate seed images for each scene (5-7 parallel Replicate calls)

**Engineer 4: Video Generation & Composition**
- `POST /api/video/generate` - Start async video clip generation (img2vid for all scenes)
- `GET /api/video/status/{job_id}` - Poll for clip generation progress
- `POST /api/video/compose` - Stitch clips + audio into final video (FFmpeg processing)
- `GET /api/video/compose/status/{job_id}` - Poll for composition progress

**API Communication Pattern:**
- Long-running tasks (video generation, composition) use polling pattern
- Frontend polls status endpoints every 3 seconds
- Backend uses in-memory job tracking (no database for MVP)

---

### **State Management (Zustand)**

**Store Location:** `/src/store/appStore.ts`

Single global Zustand store containing:
- Navigation state (`currentStep`)
- Step 1: `creativeBrief`
- Step 2: `moods`, `selectedMoodId`
- Step 3: `scenePlan`
- Step 4: `generatedClips`, `clipGenerationProgress`
- Step 5: `finalVideo`, `compositionProgress`
- Error handling: `error`

**No persistence for MVP** - all state is in-memory.

---

### **Project Structure**

```
/
├── frontend/                    # Next.js App
│   ├── app/
│   │   ├── api/chat/           # Engineer 1: OpenAI endpoints
│   │   ├── page.tsx
│   │   └── layout.tsx
│   ├── components/
│   │   ├── vision/             # Engineer 1
│   │   ├── moods/              # Engineer 2
│   │   ├── scenes/             # Engineer 3
│   │   ├── generation/         # Engineer 4
│   │   ├── composition/        # Engineer 4
│   │   └── ui/                 # shadcn/ui components
│   ├── hooks/                  # Custom React hooks per engineer
│   ├── lib/api/                # API client functions
│   ├── store/appStore.ts       # Zustand store (shared)
│   └── types/                  # TypeScript types per engineer
│
├── backend/                     # FastAPI App
│   ├── app/
│   │   ├── main.py             # FastAPI app entry
│   │   ├── config.py           # Configuration & env vars
│   │   ├── routers/            # API endpoints (moods, scenes, video)
│   │   ├── services/           # Replicate, OpenAI, FFmpeg services
│   │   ├── models/             # Pydantic models
│   │   └── utils/              # Job tracker, helpers
│   └── requirements.txt
│
└── README.md
```

---

### **Key Technical Decisions**

**Why Direct Frontend → FastAPI Calls?**
- Simpler architecture with fewer layers
- Faster development (no Next.js proxy layer needed)
- Clear separation: Frontend handles UI/state, backend handles AI/video processing
- Post-MVP: Can add Next.js middleware layer if needed for auth, rate limiting

**Why Polling Instead of WebSockets?**
- Simpler for MVP (no WebSocket infrastructure needed)
- Stateless backend (FastAPI doesn't need to maintain WS connections)
- Good enough UX (3-second polls feel responsive for video generation)
- Post-MVP: Can upgrade to WebSockets or Server-Sent Events if needed

**Why In-Memory Job Tracking?**
- MVP simplicity (no database/Redis setup required)
- Single-user MVP (in-memory is sufficient)
- Faster development (no persistence layer to build)
- Post-MVP: Migrate to Redis or PostgreSQL for multi-user support

**Why Zustand Over Redux?**
- Less boilerplate (simpler API, faster development)
- TypeScript-first (better type inference)
- Small bundle size (lightweight for MVP)
- Easy migration (can migrate to Redux if needed post-MVP)

**Why Monorepo Structure?**
- Clear separation between frontend and backend
- Shared types can be defined separately
- Easier local development (both services run independently)
- Post-MVP: Can split into separate repos if needed

---

### **Environment Variables**

**Frontend (`.env.local`):**
- `OPENAI_API_KEY` - For Vercel AI SDK
- `NEXT_PUBLIC_API_URL=http://localhost:8000` - FastAPI backend URL

**Backend (`.env`):**
- `REPLICATE_API_TOKEN` - Replicate API key
- `OPENAI_API_KEY` - For scene planning, mood analysis
- `CORS_ORIGINS=http://localhost:3000` - CORS configuration

---

### **Local Development Setup**

**Prerequisites:**
- Node.js 18+ and npm/yarn/pnpm
- Python 3.11+
- FFmpeg installed on system (`brew install ffmpeg` on macOS)

**Frontend Setup:**
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:3000
```

**Backend Setup:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# Runs on http://localhost:8000
```

---

## **Post-MVP Roadmap**

### **Phase 1: Persistence & Multi-User**

- PostgreSQL database for storing projects
- User authentication
- Save/resume video projects
- S3 for video storage

### **Phase 2: Enhanced Control**

- Regenerate individual scenes
- Edit scene descriptions
- Regenerate mood boards
- Variable video length

### **Phase 3: Asset Management**

- Brand asset uploads (logos, colors)
- Reference image uploads
- Multiple aspect ratio support

### **Phase 4: Advanced Features**

- Audio selection step (multiple music options)
- Text overlays and CTAs
- Voiceover generation
- Batch generation for A/B testing

---

## **Team Implementation Guidelines**

### **Week 1: Foundation & Mocks**

- All engineers set up their respective component structures
- Build with mock data (no dependencies on other engineers)
- Focus on UI/UX for their step
- Backend endpoints with placeholder responses

**Deliverables:**

- Engineer 1: Chat interface with mock LLM responses
- Engineer 2: Mood gallery with mock images
- Engineer 3: Storyboard view with mock scenes
- Engineer 4: Progress UI and video player with mock data

### **Week 2: API Integration**

- Replace mocks with real API calls
- Integrate actual AI models (Replicate, LLM APIs)
- Test individual steps thoroughly
- Begin backend development for orchestration

**Deliverables:**

- Engineer 1: Working LLM chat, real creative brief generation
- Engineer 2: Real image generation (12 images per run)
- Engineer 3: Real scene planning with LLM + image generation
- Engineer 4: Real video clip generation

### **Week 3: Integration & State Management**

- Connect all steps via shared app state
- Test end-to-end flow
- Fix handoff issues between steps
- Implement proper error handling

**Deliverables:**

- Working flow from Step 1 → Step 5
- State properly shared across all components
- Error states and retry logic

### **Week 4: Composition & Optimization**

- Engineer 4: Implement FFmpeg composition pipeline
- Audio generation and sync
- Polish UI/UX across all steps
- Performance optimization (parallel processing)

**Deliverables:**

- Full working pipeline producing downloadable videos
- Polished UI with smooth transitions
- Complete error handling

### **Week 5: Testing & Demo Prep**

- Generate multiple test videos
- Fix bugs and edge cases
- Optimize for production models (switch from dev to high-quality)
- Create demo videos for submission

**Deliverables:**

- 3+ sample generated videos
- Demo video showcasing the pipeline
- Documentation and README
