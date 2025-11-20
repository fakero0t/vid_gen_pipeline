# Unified Storyboard Interface Components

This directory contains the components for the new Unified Storyboard Interface, which replaces the traditional multi-step workflow with a progressive carousel-based experience.

## Architecture

The interface follows a **progressive state workflow**:
```
Text State → Image State → Video State
```

Each scene independently progresses through these states, allowing parallel work across multiple scenes.

## Components

### StoryboardCarousel
Main container component that manages the carousel and integrates all sub-components.

**Props:**
- `storyboard: Storyboard` - The storyboard data
- `scenes: StoryboardScene[]` - Array of scenes
- `onRegenerateAll: () => Promise<void>` - Regenerate all scenes
- `onPreviewAll: () => void` - Show preview modal
- `onGenerateFinalVideo: () => void` - Navigate to final video generation
- `onApproveText: (sceneId: string) => Promise<void>` - Approve text and generate image
- `onRegenerateText: (sceneId: string) => Promise<void>` - Regenerate scene text with AI
- `onEditText: (sceneId: string, newText: string) => Promise<void>` - Update text manually
- `onApproveImage: (sceneId: string) => Promise<void>` - Approve image and generate video
- `onRegenerateImage: (sceneId: string) => Promise<void>` - Regenerate image
- `onUpdateDuration: (sceneId: string, newDuration: number) => Promise<void>` - Update video duration
- `onRegenerateVideo: (sceneId: string) => Promise<void>` - Regenerate video
- `isLoading?: boolean` - Global loading state

### SceneTimelineNew
Interactive timeline with color-coded states and click navigation.

**Props:**
- `scenes: StoryboardScene[]` - Array of scenes
- `sceneOrder: string[]` - Ordered array of scene IDs
- `currentSceneIndex: number` - Currently selected scene index
- `onSceneClick: (index: number) => void` - Handle scene selection

**Color Coding:**
- 🔘 Gray (`hsl(220, 10%, 40%)`) - Text state
- 🟡 Yellow (`hsl(45, 90%, 60%)`) - Image state
- 🟢 Green (`hsl(140, 70%, 50%)`) - Video state
- 🔴 Red (`hsl(0, 70%, 50%)`) - Error state

### SceneCardNew
State-specific scene rendering with interactive controls.

**Props:**
- `scene: StoryboardScene` - Scene data
- `sceneNumber: number` - Display number (1-indexed)
- `onApproveText: () => Promise<void>` - Approve text
- `onRegenerateText: () => Promise<void>` - Regenerate text
- `onEditText: (newText: string) => Promise<void>` - Edit text
- `onApproveImage: () => Promise<void>` - Approve image
- `onRegenerateImage: () => Promise<void>` - Regenerate image
- `onUpdateDuration: (newDuration: number) => Promise<void>` - Update duration
- `onRegenerateVideo: () => Promise<void>` - Regenerate video
- `isLoading?: boolean` - Loading state

**States:**
1. **Text State**: Inline editing, AI regeneration, approval button
2. **Image State**: Image display, duration slider, approval for video
3. **Video State**: Video player, thumbnail, regeneration option

## Usage Example

```tsx
import { StoryboardCarousel } from '@/components/storyboard';
import { useStoryboard } from '@/hooks/useStoryboard';

function StoryboardPage() {
  const {
    storyboard,
    scenes,
    approveText,
    regenerateText,
    editText,
    approveImage,
    regenerateImage,
    updateDuration,
    regenerateVideo,
    regenerateAllScenes,
    isSaving,
  } = useStoryboard();

  return (
    <StoryboardCarousel
      storyboard={storyboard}
      scenes={scenes}
      onRegenerateAll={regenerateAllScenes}
      onPreviewAll={() => console.log('Preview')}
      onGenerateFinalVideo={() => console.log('Generate final')}
      onApproveText={approveText}
      onRegenerateText={regenerateText}
      onEditText={editText}
      onApproveImage={approveImage}
      onRegenerateImage={regenerateImage}
      onUpdateDuration={updateDuration}
      onRegenerateVideo={regenerateVideo}
      isLoading={isSaving}
    />
  );
}
```

## State Management

The components integrate with the Zustand scene store (`store/sceneStore.ts`) which provides:
- Auto-save to localStorage
- Server-Sent Events (SSE) for real-time updates
- Polling fallback when SSE unavailable
- Automatic session recovery
- Error handling and retry logic

## API Integration

All scene operations are handled through the API client (`lib/api/storyboard.ts`):
- Text operations: `updateSceneText()`, `generateSceneText()`
- Image operations: `generateSceneImage()`, `regenerateSceneImage()`
- Video operations: `generateSceneVideo()`, `regenerateSceneVideo()`
- Duration: `updateSceneDuration()`
- Storyboard: `initializeStoryboard()`, `getStoryboard()`, `regenerateAllScenes()`

## Real-Time Updates

Video and image generation happen asynchronously. The interface uses Server-Sent Events (SSE) to receive real-time updates:

```typescript
// SSE connection is automatic via useStoryboard hook
const { scenes } = useStoryboard();

// Scenes update in real-time as generation completes
// generation_status.image: 'pending' | 'generating' | 'complete' | 'error'
// generation_status.video: 'pending' | 'generating' | 'complete' | 'error'
```

## Responsive Design

All components are responsive and use Tailwind CSS:
- Mobile: Single column, touch-optimized
- Tablet: Optimized carousel navigation
- Desktop: Full-width layout with hover states

## Accessibility

- ARIA labels on all interactive elements
- Keyboard navigation support
- Focus management in carousel
- Screen reader announcements for state changes
- High contrast color coding
