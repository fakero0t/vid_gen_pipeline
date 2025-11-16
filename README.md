# AI Video Generation Pipeline

A guided, multi-step AI video generation pipeline that transforms user vision into 30-second vertical videos optimized for social media. Built with Next.js 16 (App Router) and FastAPI.

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** and **pnpm** (package manager)
- **Python 3.11+**
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
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
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
   > - **Replicate**: SDXL with optimized settings (20 steps, 640x1136) = ~20-40s/image
   > - **Production**: SDXL with full quality (50 steps, 1080x1920) = ~30-60s/image
   > - **Images per mood**: 2 in dev (faster), 4 in prod (more variety)
   > - **OpenAI**: GPT-3.5-turbo (~$0.0015/1K tokens) instead of GPT-4o (~$0.005/1K tokens)
   > 
   > **Expected generation time:**
   > - **Dev**: ~2-4 minutes for 6 images (3 moods × 2 images) at lower resolution
   > - **Prod**: ~3-6 minutes for 12 images (3 moods × 4 images) at full resolution
   > 
   > **Speed improvements in dev:**
   > - 4x fewer pixels (640x1136 vs 1080x1920) = ~4x faster
   > - 2.5x fewer inference steps (20 vs 50) = ~2.5x faster
   > - 50% fewer images (6 vs 12) = 50% faster
   > 
   > Set `ENVIRONMENT=production` to use full-quality settings for production.

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

