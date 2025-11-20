# Error Handling and Recovery System

This document describes the comprehensive error handling and recovery system implemented for the Unified Storyboard Interface.

## Overview

The storyboard interface includes multi-layered error handling with automatic retry logic, user notifications, and graceful degradation.

## Error Classes

### StoryboardError

Custom error class for storyboard-specific operations, defined in `lib/errors.ts`:

```typescript
export class StoryboardError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean = true,
    public sceneId?: string
  ) {
    super(message);
    this.name = 'StoryboardError';
  }
}
```

### Error Codes

Storyboard-specific error codes in `lib/errors.ts`:

```typescript
// Storyboard Errors
STORYBOARD_INIT_FAILED: 'STORYBOARD_INIT_FAILED',
STORYBOARD_LOAD_FAILED: 'STORYBOARD_LOAD_FAILED',
STORYBOARD_REGENERATE_FAILED: 'STORYBOARD_REGENERATE_FAILED',
SCENE_TEXT_UPDATE_FAILED: 'SCENE_TEXT_UPDATE_FAILED',
SCENE_TEXT_GENERATION_FAILED: 'SCENE_TEXT_GENERATION_FAILED',
SCENE_IMAGE_GENERATION_FAILED: 'SCENE_IMAGE_GENERATION_FAILED',
SCENE_VIDEO_GENERATION_FAILED: 'SCENE_VIDEO_GENERATION_FAILED',
SCENE_DURATION_UPDATE_FAILED: 'SCENE_DURATION_UPDATE_FAILED',
SCENE_NOT_FOUND: 'SCENE_NOT_FOUND',
SSE_CONNECTION_FAILED: 'SSE_CONNECTION_FAILED',
```

## Retry Logic

### Automatic Retry with Exponential Backoff

All storyboard operations use the `retryOperation` function from `lib/errors.ts`:

```typescript
await retryOperation(
  () => storyboardAPI.generateSceneImage(sceneId),
  {
    maxRetries: 2,
    operationName: 'Generate Scene Image',
  }
);
```

**Default retry configuration:**
- Max retries: 2-3 attempts depending on operation
- Initial delay: 1000ms
- Max delay: 10000ms
- Backoff multiplier: 2x (exponential)

**Retry criteria:**
- Network errors (timeout, connection issues)
- Server errors (500, 502, 503, 504)
- Rate limit errors (429)
- Custom retryable errors

**Non-retryable errors:**
- Validation errors
- Content policy violations
- Authentication errors
- 404 Not Found errors

### Store Operations with Retry

The `sceneStore.ts` wraps all API operations with retry logic:

**Text operations:**
- `approveText()` - 2 retries
- `regenerateText()` - 2 retries
- `editText()` - 2 retries

**Image operations:**
- `approveImage()` - 2 retries (starts video generation)
- `regenerateImage()` - 2 retries

**Video operations:**
- `regenerateVideo()` - 2 retries

**Duration:**
- `updateDuration()` - 2 retries

**Storyboard:**
- `initializeStoryboard()` - 2 retries
- `loadStoryboard()` - 3 retries

## User Notifications

### Toast Notifications

Implemented in `components/ui/Toast.tsx`:

**Success toasts (3s duration):**
- Image generation started
- Video generation started
- Scene text updated/regenerated
- Duration updated
- All scenes regenerated

**Error toasts (5s duration):**
- Operation failures with user-friendly messages
- Specific guidance based on error type

**Usage:**
```typescript
const { addToast } = useToast();

addToast({
  type: 'success',
  message: 'Image generation started',
  duration: 3000,
});

addToast({
  type: 'error',
  message: error.message,
  duration: 5000,
});
```

### Error Alert Component

Full-featured error display with retry button (`components/ui/ErrorAlert.tsx`):

```tsx
<ErrorAlert
  error={error}
  onDismiss={() => setError(null)}
  onRetry={handleRetry}
  showRetry={true}
  showDismiss={true}
/>
```

Features:
- User-friendly error messages
- Recovery suggestions
- Retry button (for retryable errors)
- Dismiss button

### Warning Modals

Destructive operations show confirmation modals (`components/storyboard/SceneCardNew.tsx`):

**Edit text in non-text states:**
```typescript
const confirmed = window.confirm(
  'Editing text will erase image and video. This cannot be undone. Are you sure?'
);
```

**Edit duration in video state:**
```typescript
const confirmed = window.confirm(
  'Editing duration will erase video. This cannot be undone. Are you sure?'
);
```

**Regenerate all scenes:**
```typescript
const confirmed = window.confirm(
  'All scenes and progress will be erased. This cannot be undone. Are you sure?'
);
```

## Real-Time Updates

### Server-Sent Events (SSE)

Automatic real-time updates for async operations:

**SSE connection management:**
- Auto-connect when storyboard loads
- Auto-reconnect on connection loss (5s delay)
- Graceful disconnect on unmount

**Error handling:**
```typescript
connectSSE: (storyboardId) => {
  try {
    const eventSource = storyboardAPI.createSSEConnection(
      storyboardId,
      get().handleSSEUpdate,
      (error) => {
        console.error('SSE connection error:', error);
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          if (get().storyboard?.storyboard_id === storyboardId) {
            get().connectSSE(storyboardId);
          }
        }, 5000);
      }
    );
    set({ sseConnection: eventSource });
  } catch (error) {
    console.error('Failed to create SSE connection:', error);
  }
},
```

### Polling Fallback

When SSE is unavailable, automatic polling kicks in:

**Polling strategy:**
- Poll every 5 seconds
- Max 60 attempts (5 minutes)
- Only for scenes in 'generating' state
- Automatic cleanup when complete

```typescript
async function pollSceneStatus(sceneId: string, get: () => StoryboardState) {
  const maxAttempts = 60; // 5 minutes max
  let attempts = 0;

  const poll = async () => {
    if (attempts >= maxAttempts) return;

    try {
      const status = await storyboardAPI.getSceneStatus(sceneId);
      get().updateScene(sceneId, {
        state: status.state,
        generation_status: status.generation_status,
        error_message: status.error_message,
      });

      if (
        status.generation_status.image === 'generating' ||
        status.generation_status.video === 'generating'
      ) {
        attempts++;
        setTimeout(poll, 5000);
      }
    } catch (error) {
      console.error('Failed to poll scene status:', error);
    }
  };

  poll();
}
```

## Recovery Suggestions

Context-aware recovery suggestions based on error type:

**Image generation failure:**
> "This may be due to content policy violations. Try regenerating or adjusting the scene text."

**Video generation failure:**
> "Video generation can take 1-2 minutes. Check the timeline for status or try regenerating."

**SSE connection failure:**
> "Don't worry - the page will poll for updates automatically."

**General retryable errors:**
> "This is a temporary error. Please try again in a moment."

## Error Logging

Production-ready error logging with context:

```typescript
export function logError(
  error: unknown,
  context: string,
  additionalData?: Record<string, any>
) {
  console.error(`[${context}] Error:`, error);
  if (additionalData) {
    console.error(`[${context}] Additional data:`, additionalData);
  }

  // In production, send to error tracking service
  if (process.env.NODE_ENV === 'production') {
    // TODO: Send to Sentry, LogRocket, etc.
  }
}
```

## State Recovery

### LocalStorage Persistence

Zustand persist middleware auto-saves state:

**Persisted data:**
- Storyboard metadata
- All scenes
- Current scene index

**Not persisted:**
- SSE connection
- Loading states
- Error states

### Session Recovery

On page load, the `useStoryboardRecovery` hook:
1. Checks localStorage for saved state
2. Fetches latest data from backend
3. Merges with saved state
4. Re-establishes SSE connection
5. Starts polling for incomplete generations

## Best Practices

### For Developers

1. **Always wrap API calls with retry logic:**
   ```typescript
   await retryOperation(() => apiCall(), {
     maxRetries: 2,
     operationName: 'Descriptive Name',
   });
   ```

2. **Throw specific error types:**
   ```typescript
   throw new StoryboardError(
     message,
     ERROR_CODES.SCENE_IMAGE_GENERATION_FAILED,
     true,
     sceneId
   );
   ```

3. **Show toast feedback for all user actions:**
   ```typescript
   try {
     await operation();
     addToast({ type: 'success', message: 'Success message' });
   } catch (error) {
     addToast({ type: 'error', message: error.message });
   }
   ```

4. **Confirm destructive actions:**
   ```typescript
   const confirmed = window.confirm('Warning message');
   if (!confirmed) return;
   ```

### For Users

1. **Retry on failures** - Use the retry button or regenerate option
2. **Wait for async operations** - Video generation takes 1-2 minutes
3. **Check the timeline** - Color coding shows scene status
4. **Refresh if needed** - All state is persisted and recoverable

## Testing Error Scenarios

### Network Errors
- Disconnect network during operation
- Throttle network to simulate slow connections

### Server Errors
- Test with 500/502/503 responses
- Test with rate limiting (429)

### Content Policy
- Test with policy-violating content
- Verify user-friendly error messages

### SSE Failures
- Disable SSE in browser
- Verify polling fallback activates

### State Recovery
- Refresh page mid-operation
- Close and reopen tab
- Verify state restoration
