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

5. **Configure environment variables**

   **Backend** (`backend/.env`):
   ```env
   REPLICATE_API_TOKEN=your_replicate_api_token_here
   OPENAI_API_KEY=your_openai_api_key_here
   CORS_ORIGINS=http://localhost:3000
   ```

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
└── .taskmaster/         # Task management files
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

