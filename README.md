# AI Video Generation Pipeline

A project-based AI video generation pipeline that transforms user vision into 30-second vertical videos optimized for social media. Built with Next.js 16 (App Router) and FastAPI.

## 🎯 User Flow

The application follows a streamlined 4-step workflow within projects:

1. **Projects Dashboard** - Create, manage, and switch between multiple video projects
2. **Vision & Brief** (`/project/[id]/chat`) - Conversational AI interface to capture your video concept
3. **Mood Selection** (`/project/[id]/mood`) - Choose from AI-generated mood boards
4. **Scene Storyboard** (`/project/[id]/scenes`) - Progressive scene generation (text → image → video)
5. **Final Composition** (`/project/[id]/final`) - Generate the complete video with audio

### State Management

- **Project-Based**: All work is organized into projects with automatic saving
- **Multi-Project Support**: Switch between projects without losing progress
- **Persistent State**: Project data saves to browser localStorage
- **Scene Store**: Real-time scene updates via Server-Sent Events (SSE)

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** and **pnpm** (package manager)
- **Python 3.11, 3.12, or 3.13** (Python 3.14+ has compatibility issues with Pydantic V1 used by the `replicate` package)
- **FFmpeg** installed on your system
  - macOS: `brew install ffmpeg`
  - Linux: `sudo apt-get install ffmpeg` (Ubuntu/Debian) or `sudo yum install ffmpeg` (RHEL/CentOS)
  - Windows: Download from [ffmpeg.org](https://ffmpeg.org/download.html)
- **Modal Account** (for NeRF processing - optional for MVP)
  - Sign up at [modal.com](https://modal.com)
  - Free tier available for development/testing

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd jant-vid-pipe
   ```

2. **Install root dependencies**
   ```bash
   pnpm install
   ```

3. **Set up the frontend**
   ```bash
   cd frontend
   pnpm install
   ```

4. **Set up the backend**
   ```bash
   cd ../backend
   # Use Python 3.11, 3.12, or 3.13 (not 3.14+)
   python3.13 -m venv venv  # Or python3.12, python3.11
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

5. **Set up Modal (for NeRF processing - optional for MVP)**

   If you want to use NeRF product video generation:
   
   ```bash
   # Install Modal CLI
   pip install modal
   
   # Authenticate (opens browser)
   modal token new
   
   # Deploy Modal functions to development
   ENVIRONMENT=development modal deploy modal_functions/nerf_app.py --name nerf-dev
   ```
   
   Get your Modal credentials from [modal.com/settings](https://modal.com/settings) for use in `.env`.

6. **Configure environment variables**

   **Backend** (`backend/.env`):
   ```env
   # Required API Keys
   REPLICATE_API_TOKEN=your_replicate_api_token_here
   OPENAI_API_KEY=your_openai_api_key_here
   
   # Modal API Keys (optional - for NeRF processing)
   MODAL_TOKEN_ID=your_modal_token_id
   MODAL_TOKEN_SECRET=your_modal_token_secret
   
   # Environment Configuration (defaults to "development")
   ENVIRONMENT=development  # Options: development, production
   
   # Optional: Override model selection
   # REPLICATE_IMAGE_MODEL=stability-ai/sdxl:...  # Override default model
   # OPENAI_MODEL=gpt-4o  # Override default model
   
   # CORS Configuration
   CORS_ORIGINS=http://localhost:3000
   ```
   
   > 💡 **Performance & Cost Optimization:** In development mode, the app automatically optimizes for speed:
   > - **Replicate Image Generation**:
   >   - **Dev**: 15 inference steps, guidance scale 6.5, resolution 512×912 = ~10-15s/image
   >   - **Prod**: 50 inference steps, guidance scale 7.5, resolution 1080×1920 = ~30-60s/image
   > - **Images per mood**: 1 in dev (faster), 4 in prod (more variety)
   > - **OpenAI**: GPT-3.5-turbo (~$0.0015/1K tokens) instead of GPT-4o (~$0.005/1K tokens)
   > 
   > **Expected generation time:**
   > - **Dev**: ~10-20 seconds for 3 images (3 moods × 1 image) at lower quality
   > - **Prod**: ~3-6 minutes for 12 images (3 moods × 4 images) at full quality
   > 
   > **To test with higher quality in dev mode**, adjust these settings:
   > 
   > 1. **Images Per Mood** - Edit `backend/app/routers/moods.py` (line 67):
   >    ```python
   >    images_per_mood = 2  # Or 4 for full prod-like experience
   >    ```
   > 
   > 2. **Image Resolution** - Edit `backend/app/routers/moods.py` (lines 75-76):
   >    ```python
   >    image_width = 640   # Higher = better quality (512→640→1080)
   >    image_height = 1136 # Must be divisible by 8 for SDXL
   >    ```
   > 
   > 3. **Inference Steps** - Edit `backend/app/services/replicate_service.py` (line 77):
   >    ```python
   >    num_inference_steps = 20  # Higher = better quality (15→20→30→50)
   >    ```
   > 
   > 4. **Guidance Scale** - Edit `backend/app/services/replicate_service.py` (line 84):
   >    ```python
   >    guidance_scale = 7.0  # Higher = better prompt adherence (6.5→7.0→7.5)
   >    ```
   > 
   > Set `ENVIRONMENT=production` to use full-quality settings automatically.

   **Frontend** (`frontend/.env.local`):
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

   > 💡 **Tip:** Copy `.env.example` from the root directory as a template.

### Running the Development Servers

**Option 1: Run both servers simultaneously (Recommended)**
```bash
# From the root directory
pnpm dev
```

This will start:
- Frontend: http://localhost:3000
- Backend: http://localhost:8000

**Option 2: Run servers separately**

Terminal 1 (Frontend):
```bash
cd frontend
pnpm dev
```

Terminal 2 (Backend):
```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

## 📁 Project Structure

```
jant-vid-pipe/
├── frontend/                    # Next.js 16 App (App Router)
│   ├── app/                    # App Router pages and API routes
│   │   ├── projects/           # Projects dashboard
│   │   ├── project/[id]/       # Project-specific pages
│   │   │   ├── chat/           # Step 1: Vision & Brief
│   │   │   ├── mood/           # Step 2: Mood Selection
│   │   │   ├── scenes/         # Step 3: Scene Storyboard
│   │   │   └── final/          # Step 4: Final Composition
│   │   ├── sign-in/            # Authentication
│   │   └── sign-up/            # User registration
│   ├── components/             # React components
│   │   ├── storyboard/         # Scene carousel & timeline
│   │   ├── moods/              # Mood gallery
│   │   └── ui/                 # Shared UI components
│   ├── lib/                    # Utilities and API client
│   ├── store/                  # Zustand state management
│   │   ├── appStore.ts         # Workflow state (ephemeral)
│   │   ├── projectStore.ts     # Project management (persistent)
│   │   └── sceneStore.ts       # Scene state (ephemeral, API-backed)
│   ├── types/                  # TypeScript type definitions
│   └── hooks/                  # Custom React hooks
│
├── backend/                    # FastAPI application
│   ├── app/
│   │   ├── main.py      # FastAPI app entry point
│   │   ├── config.py    # Configuration settings
│   │   ├── routers/     # API endpoint routers
│   │   ├── services/    # Business logic services
│   │   │   └── modal_service.py  # Modal API client
│   │   ├── models/      # Pydantic models
│   │   │   └── nerf_models.py    # NeRF pipeline schemas
│   │   └── utils/       # Utility functions
│   ├── nerf/            # NeRF processing outputs
│   │   ├── models/      # Trained NeRF models
│   │   └── renders/     # Rendered frames
│   ├── uploads/         # Temporary file uploads
│   ├── requirements.txt # Python dependencies
│   └── tests/           # Backend tests
│
├── modal_functions/     # Modal serverless functions (NeRF)
│   ├── nerf_app.py      # Main Modal app
│   ├── shared/          # Shared utilities
│   │   ├── config.py    # NeRF Studio configuration
│   │   ├── utils.py     # Helper functions
│   │   └── progress.py  # Progress tracking
│   ├── requirements.txt # Modal dependencies
│   └── README.md        # Modal setup guide
│
├── docs/                 # Documentation
│   ├── prd.md           # Product Requirements Document
│   ├── architecture.md  # Technical Architecture
│   └── nerf_md.md       # NeRF implementation details
│
└── .cursor/             # Cursor IDE configuration
```

## 🛠️ Tech Stack

### Frontend
- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Authentication:** Clerk (user management & auth)
- **UI Components:** shadcn/ui
- **Styling:** Tailwind CSS v4
- **State Management:** Zustand (3 stores: appStore, projectStore, sceneStore)
- **AI/Chat:** Vercel AI SDK with OpenAI
- **Real-time Updates:** Server-Sent Events (SSE)
- **Package Manager:** pnpm

### Backend
- **Framework:** FastAPI (Python 3.11+)
- **AI Services:** Replicate API (image & video generation)
- **NeRF Processing:** Modal + NeRF Studio (3D product videos)
- **Video Processing:** FFmpeg (via `ffmpeg-python`)
- **Async Processing:** Python asyncio/async-await

### External Services
- **OpenAI API:** GPT-4o (chat & creative brief synthesis)
- **Replicate:** Image generation, video generation (img2vid)
- **Modal:** Serverless GPU computing (COLMAP, NeRF training, rendering)

## 📚 Documentation

### User Documentation
- **[User Guide](docs/USER_GUIDE.md)** - Complete walkthrough of the 4-step workflow
- **[Architecture Overview](docs/architecture.md)** - System architecture and technical design

### Developer Documentation
- **[Frontend README](frontend/README.md)** - Frontend architecture and state management
- **[Implementation Notes](docs/implementation-notes.md)** - Technical implementation details and decisions
- **[Storyboard Components](frontend/components/storyboard/README.md)** - Scene carousel and timeline documentation
- **[Error Handling](frontend/components/storyboard/ERROR_HANDLING.md)** - Comprehensive error handling system

### Deployment & Testing
- **[Composite Testing Guide](docs/composite_testing.md)** - Testing guide for product compositing
- **[Composite Deployment Guide](docs/composite_deployment.md)** - Deployment instructions for compositing features
- **[Modal Functions README](modal_functions/README.md)** - Setup and deployment guide for Modal functions

## 🎬 NeRF Product Videos (Optional Feature)

This project includes an advanced NeRF-based product video generation system:

### What is NeRF?
Neural Radiance Fields (NeRF) allows you to create stunning 360° product videos from just 80 product photos. The system:
1. **Processes photos** using COLMAP (camera pose estimation)
2. **Trains a 3D model** using NeRF Studio on cloud GPUs
3. **Renders 1440 frames** with transparent backgrounds for seamless compositing

### Quick Start for NeRF

1. **Set up Modal** (see installation step 6 above)
2. **Configure credentials** in `backend/.env`
3. **Deploy Modal functions**:
   ```bash
   ENVIRONMENT=development modal deploy modal_functions/nerf_app.py --name nerf-dev
   ```
4. **Upload product photos** (80 images recommended)
5. **Start processing** via API or frontend

### Cost Estimate
- **Development (T4 GPU)**: ~$0.30 per product
- **Production (A10G GPU)**: ~$0.70 per product
- Includes COLMAP processing, NeRF training, and frame rendering

### More Information
- [NeRF Implementation Guide](nerf_md.md) - Complete technical details
- [Modal Functions README](modal_functions/README.md) - Deployment and configuration

## 🎨 Product Compositing

This application supports AI-powered product compositing using FLUX Kontext multi-image model.

### Configuration

Set these environment variables in `backend/.env`:

```bash
# Product Compositing Configuration
USE_KONTEXT_COMPOSITE=true          # Enable Kontext compositing
COMPOSITE_METHOD=kontext            # "kontext" or "pil"
KONTEXT_MODEL_ID=flux-kontext-apps/multi-image-kontext-pro
KONTEXT_TIMEOUT_SECONDS=60         # Timeout for Kontext API
MAX_CONCURRENT_KONTEXT=10          # Max concurrent requests
MAX_KONTEXT_PER_HOUR=100           # Rate limit per hour
KONTEXT_DAILY_GENERATION_LIMIT=1000 # Daily alert threshold
```

### Features

- **Intelligent Integration**: AI-powered product placement with natural lighting and shadows
- **Automatic Fallback**: Gracefully falls back to PIL method if Kontext fails
- **Rate Limiting**: Prevents API abuse with configurable limits
- **Metrics Tracking**: Monitor usage and performance via admin endpoints

### Admin Endpoints

- `GET /api/admin/metrics/composite` - Get composite generation statistics
- `GET /api/admin/metrics/daily-generations?days=7` - Get daily generation counts
- `GET /api/admin/metrics/health` - Get health status and warnings
- `POST /api/admin/metrics/reset` - Reset all metrics

### Example Usage

**Get Metrics:**
```bash
curl http://localhost:8000/api/admin/metrics/composite
```

**Get Daily Generations:**
```bash
curl http://localhost:8000/api/admin/metrics/daily-generations?days=7
```

**Check Health:**
```bash
curl http://localhost:8000/api/admin/metrics/health
```

### Switching Methods

To use the PIL method instead of Kontext:

```bash
COMPOSITE_METHOD=pil
# or
USE_KONTEXT_COMPOSITE=false
```

### Documentation

- [Manual Testing Guide](docs/composite_testing.md) - Comprehensive testing checklist
- [Deployment Guide](docs/composite_deployment.md) - Production deployment instructions

## 🧪 Testing

### Backend Health Check
```bash
curl http://localhost:8000/health
```

### Frontend
Open http://localhost:3000 in your browser.

## 🚧 Development Status

This project is currently in MVP development. See the [PRD](docs/prd.md) for feature roadmap and MVP scope.

## 📝 License

[Add your license here]

## 🤝 Contributing

[Add contributing guidelines here]

