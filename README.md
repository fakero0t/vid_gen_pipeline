# AI Video Generation Pipeline

A guided, multi-step AI video generation pipeline that transforms user vision into 30-second vertical videos optimized for social media. Built with Next.js 16 (App Router) and FastAPI.

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** and **pnpm** (package manager)
- **Python 3.11, 3.12, or 3.13** (Python 3.14+ has compatibility issues with Pydantic V1 used by the `replicate` package)
- **FFmpeg** installed on your system
  - macOS: `brew install ffmpeg`
  - Linux: `sudo apt-get install ffmpeg` (Ubuntu/Debian) or `sudo yum install ffmpeg` (RHEL/CentOS)
  - Windows: Download from [ffmpeg.org](https://ffmpeg.org/download.html)

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

5. **Configure Taskmaster MCP (for Cursor users)**

   If you're using Cursor with Taskmaster, set up the MCP server:
   
   **Option A: Project-level config (recommended for teams)**
   ```bash
   cp .cursor/mcp.json.example .cursor/mcp.json
   ```
   Then edit `.cursor/mcp.json` and add your API keys. You only need the keys for the AI providers you plan to use.
   
   **Option B: Global config (recommended for personal use)**
   Edit `~/.cursor/mcp.json` and add the `task-master-ai` server configuration (see `.cursor/mcp.json.example` for reference).
   
   > 💡 **Note:** The project-level `.cursor/mcp.json` is gitignored to protect your API keys. Each team member should create their own.

6. **Configure environment variables**

   **Backend** (`backend/.env`):
   ```env
   # Required API Keys
   REPLICATE_API_TOKEN=your_replicate_api_token_here
   OPENAI_API_KEY=your_openai_api_key_here
   
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
├── frontend/              # Next.js 16 App (App Router)
│   ├── app/              # App Router pages and API routes
│   ├── components/       # React components
│   ├── lib/              # Utilities and API client
│   ├── store/            # Zustand state management
│   └── types/            # TypeScript type definitions
│
├── backend/              # FastAPI application
│   ├── app/
│   │   ├── main.py      # FastAPI app entry point
│   │   ├── config.py    # Configuration settings
│   │   ├── routers/     # API endpoint routers
│   │   ├── services/    # Business logic services
│   │   ├── models/      # Pydantic models
│   │   └── utils/       # Utility functions
│   └── requirements.txt # Python dependencies
│
├── docs/                 # Documentation
│   ├── prd.md           # Product Requirements Document
│   └── architecture.md  # Technical Architecture
│
├── .taskmaster/         # Task management files
└── .cursor/             # Cursor IDE configuration (MCP setup)
```

## 🛠️ Tech Stack

### Frontend
- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **UI Components:** shadcn/ui
- **Styling:** Tailwind CSS v4
- **State Management:** Zustand
- **AI/Chat:** Vercel AI SDK with OpenAI
- **Package Manager:** pnpm

### Backend
- **Framework:** FastAPI (Python 3.11+)
- **AI Services:** Replicate API (image & video generation)
- **Video Processing:** FFmpeg (via `ffmpeg-python`)
- **Async Processing:** Python asyncio/async-await

### External Services
- **OpenAI API:** GPT-4o (chat & creative brief synthesis)
- **Replicate:** Image generation, video generation (img2vid)

## 📚 Documentation

- **[Product Requirements Document (PRD)](docs/prd.md)** - Complete product specifications and user flows
- **[Architecture Documentation](docs/architecture.md)** - Technical architecture, API structure, and design decisions

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

