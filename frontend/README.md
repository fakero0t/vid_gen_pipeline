# Frontend - AI Video Generation Pipeline

A Next.js 16 (App Router) application with project-based workflow management for AI video generation.

## 🎯 Architecture Overview

### Project-Based Workflow

The application is built around a **project-based architecture** where each video is a separate project with its own isolated state. Users can:
- Create multiple projects
- Switch between projects without losing progress
- Automatically save state to browser localStorage
- Resume work from any step in the pipeline

### State Management (Zustand)

Three specialized stores manage different aspects of the application:

#### 1. **appStore** (Ephemeral Workflow State)
- **Purpose**: Tracks the current workflow progress
- **Persistence**: NOT persisted directly (managed by projectStore)
- **Contains**:
  - `currentStep` - Current pipeline step ('chat', 'mood', 'scenes', 'final')
  - `creativeBrief` - AI-generated creative brief from chat
  - `moods` - Array of generated mood boards
  - `selectedMoodId` - Selected mood for the project
  - `storyboardCompleted` - Flag for scene completion
  - `audioUrl`, `compositionJobId`, `finalVideo` - Final composition data

#### 2. **projectStore** (Project Management - Persistent)
- **Purpose**: Manages multiple projects and their lifecycle
- **Persistence**: Saves to `localStorage` as `jant-vid-pipe-projects`
- **Contains**:
  - List of all projects
  - Current project ID
  - Project CRUD operations (create, update, delete, duplicate, rename)
  - Auto-save functionality (debounced to prevent excessive writes)
  - Thumbnail generation for projects

#### 3. **sceneStore** (Scene/Storyboard State - Ephemeral)
- **Purpose**: Manages scene generation and real-time updates
- **Persistence**: NOT persisted (loads from backend database via API)
- **Contains**:
  - Storyboard metadata
  - Array of scenes with their current states (text, image, video)
  - Scene operations (approve, regenerate, edit)
  - SSE connection for real-time generation updates
  - Loading/error states

### User Flow

```
Authentication (Firebase)
    ↓
Projects Dashboard (/projects)
    ↓
Create/Select Project
    ↓
┌─────────────────────────────────────┐
│  Project Pipeline (4 Steps)        │
├─────────────────────────────────────┤
│ 1. Vision & Brief (/chat)          │
│    - Conversational AI interface   │
│    - Creative brief generation     │
│                                     │
│ 2. Mood Selection (/mood)          │
│    - AI-generated mood boards      │
│    - Visual style selection        │
│                                     │
│ 3. Scene Storyboard (/scenes)      │
│    - Progressive scene workflow    │
│    - Text → Image → Video          │
│    - Real-time SSE updates         │
│                                     │
│ 4. Final Composition (/final)      │
│    - Audio generation              │
│    - Video composition             │
│    - Final export                  │
└─────────────────────────────────────┘
```

## 📂 Directory Structure

```
frontend/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout with Firebase Auth provider
│   ├── page.tsx                  # Landing page (redirects to /projects)
│   ├── projects/                 # Projects dashboard
│   │   └── page.tsx              # Project list, create, manage
│   ├── project/[id]/             # Dynamic project routes
│   │   ├── chat/                 # Step 1: Vision & Brief
│   │   ├── mood/                 # Step 2: Mood Selection
│   │   ├── scenes/               # Step 3: Scene Storyboard
│   │   └── final/                # Step 4: Final Composition
│   ├── sign-in/                  # Firebase sign-in
│   ├── sign-up/                  # Firebase sign-up
│   └── api/                      # API routes
│       └── chat/                 # OpenAI chat endpoint
│
├── components/
│   ├── storyboard/               # Scene components
│   │   ├── StoryboardCarousel.tsx      # Main carousel container
│   │   ├── SceneCardNew.tsx            # Individual scene card
│   │   ├── SceneTimelineNew.tsx        # Visual timeline
│   │   ├── README.md                   # Component documentation
│   │   └── ERROR_HANDLING.md           # Error handling guide
│   ├── moods/                    # Mood selection components
│   │   ├── MoodGallery.tsx
│   │   └── MoodCard.tsx
│   ├── projects/                 # Project management components
│   │   └── ProjectCard.tsx
│   ├── auth/                     # Authentication components
│   └── ui/                       # Shared UI components (shadcn/ui)
│
├── store/
│   ├── appStore.ts               # Workflow state (ephemeral)
│   ├── projectStore.ts           # Project management (persistent)
│   └── sceneStore.ts             # Scene state (ephemeral)
│
├── lib/
│   ├── api/                      # API client functions
│   │   ├── storyboard.ts         # Storyboard API
│   │   └── moods.ts              # Mood generation API
│   ├── auth/                     # Auth utilities
│   ├── steps.ts                  # Step definitions and utilities
│   ├── errors.ts                 # Error handling utilities
│   └── utils.ts                  # Shared utilities
│
├── hooks/
│   ├── useStoryboard.ts          # Storyboard hook with SSE
│   ├── useMoodGeneration.ts      # Mood generation hook
│   └── ...                       # Other custom hooks
│
└── types/
    ├── project.types.ts          # Project and state types
    ├── storyboard.types.ts       # Scene and storyboard types
    ├── mood.types.ts             # Mood types
    └── ...                       # Other type definitions
```

## 🔑 Key Features

### 1. Project Management
- Create unlimited projects
- Switch between projects seamlessly
- Automatic state saving (debounced every 500ms)
- Project thumbnails (from scene images or mood images)
- Duplicate/rename/delete projects

### 2. Real-Time Scene Generation
- Server-Sent Events (SSE) for live updates
- Progressive workflow: Text → Image → Video
- Polling fallback when SSE unavailable
- Per-scene state management
- Error handling with automatic retry

### 3. Authentication (Firebase)
- Email/password authentication
- Session management with automatic token refresh
- Protected routes with client-side guards
- User profile management

### 4. Responsive Design
- Mobile-first approach
- Touch-optimized carousels
- Responsive typography (Tailwind CSS v4)
- Accessible components (ARIA labels, keyboard navigation)

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- pnpm package manager

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
```

### Environment Variables

Create `.env.local`:

```env
# OpenAI API Key (for Vercel AI SDK chat endpoint)
OPENAI_API_KEY=your_openai_api_key_here

# FastAPI Backend URL
NEXT_PUBLIC_API_URL=http://localhost:8000

# Firebase Authentication
# Get these from Firebase Console > Project Settings > General > Your apps
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

### Development

```bash
# Run development server
pnpm dev

# Open http://localhost:3000
```

### Building for Production

```bash
# Build the application
pnpm build

# Start production server
pnpm start
```

## 🧪 Testing

```bash
# Run linter
pnpm lint

# Type check
pnpm type-check
```

## 📚 Documentation

- **[Storyboard Components](components/storyboard/README.md)** - Scene carousel and timeline
- **[Error Handling](components/storyboard/ERROR_HANDLING.md)** - Error handling system
- **[State Management](#state-management-zustand)** - Store architecture (see above)

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Authentication**: Firebase Auth
- **UI Components**: shadcn/ui
- **Styling**: Tailwind CSS v4
- **State Management**: Zustand
- **AI/Chat**: Vercel AI SDK with OpenAI
- **Real-time**: Server-Sent Events (SSE)
- **Package Manager**: pnpm

## 🎨 Design System

- **Colors**: CSS variables with dark/light mode support
- **Typography**: Geist font family (optimized by next/font)
- **Components**: shadcn/ui (customizable, accessible)
- **Icons**: Lucide React
- **Animations**: Tailwind CSS animations + custom keyframes

## 🔒 Security

- **Authentication**: Clerk handles all auth (OAuth, session management)
- **Protected Routes**: Middleware protects `/projects` and `/project/*` routes
- **API Keys**: Server-side only (never exposed to client)
- **CORS**: Backend configured for frontend origin only

## 🚧 Future Enhancements

- Brand assets library (upload/manage brand elements)
- Multi-user collaboration on projects
- Backend persistence (migrate from localStorage to database)
- Project sharing and export
- Advanced video editing capabilities

## 📝 Notes

- Projects are stored in **browser localStorage** (per-device, not per-user yet)
- Scene data is **API-backed** (fetched from backend on project load)
- SSE connections auto-reconnect on failure
- All state changes trigger auto-save (debounced)
- Component-level error boundaries prevent full app crashes
