# Video Pipeline Breakdown

## User Flow

The pipeline follows a 4-step workflow:

1. **Vision & Brief** - User chats with AI to define their video concept (product, audience, key messages, tone)
2. **Mood Selection** - AI generates 3 mood boards based on the brief; user selects one
3. **Scene Storyboard** - AI creates 5-7 scenes (text → image → video) that the user can edit and approve
4. **Final Composition** - All scene videos are stitched together with background music into a final 30-second video

## Video Generation Process

### Step 1: Scene Text Generation
- OpenAI GPT-4o analyzes the creative brief and selected mood
- Generates 5-7 scene descriptions (4-6 seconds each, totaling ~30 seconds)
- Each scene includes: description text, style keywords, and duration

### Step 2: Image Generation
- For each approved scene text, Replicate SDXL generates a still image
- Image matches the selected mood's aesthetic and style keywords
- Generated images are stored in Firebase Storage

### Step 3: Video Generation
- Replicate img2vid model (Google Veo 3.1) animates each scene image
- Uses the scene description as a prompt for motion
- Videos are generated in parallel for all scenes
- Each video clip is 3-8 seconds (matching the scene duration)
- Generated videos are stored in Firebase Storage

### Step 4: Audio Generation
- AI generates background music matching the mood (30 seconds)
- Uses mood characteristics (name, description, aesthetic direction) to build a music prompt
- Generated audio is stored for composition

### Step 5: Final Composition
- FFmpeg stitches all scene videos together in sequence
- Adds smooth crossfade transitions between scenes
- Syncs background music with the video
- Outputs final MP4 file (1080×1920 vertical format for social media)
- User can download the completed video

## Technical Stack

- **Image Generation**: Replicate SDXL
- **Video Generation**: Replicate (Google Veo 3.1 / ByteDance Seedance)
- **Audio Generation**: Replicate music models
- **Video Composition**: FFmpeg
- **AI Planning**: OpenAI GPT-4o
- **Storage**: Firebase Storage
- **Database**: Firestore

## Key Features

- **Progressive Generation**: Each scene goes through text → image → video states
- **Parallel Processing**: Multiple video clips generate simultaneously
- **Real-time Updates**: Progress tracked via job status polling
- **Automatic Saving**: All progress persists to Firestore

