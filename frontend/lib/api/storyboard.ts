/**
 * API Client for Storyboard Operations
 *
 * This module provides typed API client functions for the Unified Storyboard Interface.
 * Based on the PRD endpoint specifications.
 */

import type {
  StoryboardInitializeRequest,
  StoryboardInitializeResponse,
  StoryboardScene,
  SceneTextUpdateRequest,
  SceneTextGenerateRequest,
  SceneImageGenerateRequest,
  SceneDurationUpdateRequest,
  SceneVideoGenerateRequest,
  SceneVideoGenerateResponse,
  SceneStatusResponse,
  StoryboardPreviewResponse,
  Storyboard,
} from '@/types/storyboard.types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Base fetch wrapper with error handling
 */
async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    
    // Provide helpful error messages for common status codes
    if (response.status === 404) {
      throw new Error(
        `Backend endpoint not found: ${endpoint}. The backend API may not be fully implemented yet. Please check with the backend team.`
      );
    }
    
    // FastAPI returns errors in 'detail' field
    const errorMessage = error.detail || error.message || `API request failed: ${response.statusText}`;
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * 1. Initialize a new storyboard with generated scene texts
 * POST /api/storyboards/initialize
 */
export async function initializeStoryboard(
  request: StoryboardInitializeRequest
): Promise<StoryboardInitializeResponse> {
  return apiRequest<StoryboardInitializeResponse>('/api/storyboards/initialize', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * 2. Retrieve full storyboard with all scenes
 * GET /api/storyboards/{storyboard_id}
 */
export async function getStoryboard(
  storyboardId: string
): Promise<{ storyboard: Storyboard; scenes: StoryboardScene[] }> {
  return apiRequest<{ storyboard: Storyboard; scenes: StoryboardScene[] }>(
    `/api/storyboards/${storyboardId}`
  );
}

/**
 * 3. Update scene text manually
 * PUT /api/storyboards/{storyboard_id}/scenes/{scene_id}/text
 */
export async function updateSceneText(
  storyboardId: string,
  sceneId: string,
  newText: string
): Promise<StoryboardScene> {
  const result = await apiRequest<{ success: boolean; scene: StoryboardScene; message?: string }>(
    `/api/storyboards/${storyboardId}/scenes/${sceneId}/text`,
    {
      method: 'PUT',
      body: JSON.stringify({ new_text: newText } as SceneTextUpdateRequest),
    }
  );
  if (!result.scene) {
    throw new Error('Invalid response: scene not found');
  }
  return result.scene;
}

/**
 * 4. Regenerate scene text with AI
 * POST /api/storyboards/{storyboard_id}/scenes/{scene_id}/text/generate
 */
export async function generateSceneText(
  storyboardId: string,
  sceneId: string,
  creativeBrief: any
): Promise<StoryboardScene> {
  const result = await apiRequest<{ success: boolean; scene: StoryboardScene; message?: string }>(
    `/api/storyboards/${storyboardId}/scenes/${sceneId}/text/generate`,
    {
      method: 'POST',
      body: JSON.stringify({ creative_brief: creativeBrief } as SceneTextGenerateRequest),
    }
  );
  if (!result.scene) {
    throw new Error('Invalid response: scene not found');
  }
  return result.scene;
}

/**
 * 5. Generate image for scene
 * POST /api/storyboards/{storyboard_id}/scenes/{scene_id}/image/generate
 */
export async function generateSceneImage(
  storyboardId: string,
  sceneId: string
): Promise<StoryboardScene> {
  console.log('[API] generateSceneImage called with storyboardId:', storyboardId, 'sceneId:', sceneId);
  const result = await apiRequest<{ success: boolean; scene: StoryboardScene; message?: string }>(
    `/api/storyboards/${storyboardId}/scenes/${sceneId}/image/generate`,
    {
      method: 'POST',
    }
  );
  console.log('[API] generateSceneImage response:', result);
  if (!result.scene) {
    throw new Error('Invalid response: scene not found');
  }
  return result.scene;
}

/**
 * 6. Regenerate scene image
 * POST /api/storyboards/{storyboard_id}/scenes/{scene_id}/image/regenerate
 */
export async function regenerateSceneImage(
  storyboardId: string,
  sceneId: string
): Promise<StoryboardScene> {
  const result = await apiRequest<{ success: boolean; scene: StoryboardScene; message?: string }>(
    `/api/storyboards/${storyboardId}/scenes/${sceneId}/image/regenerate`,
    {
      method: 'POST',
    }
  );
  if (!result.scene) {
    throw new Error('Invalid response: scene not found');
  }
  return result.scene;
}

/**
 * 7. Update scene duration
 * PUT /api/storyboards/{storyboard_id}/scenes/{scene_id}/duration
 */
export async function updateSceneDuration(
  storyboardId: string,
  sceneId: string,
  newDuration: number
): Promise<StoryboardScene> {
  const result = await apiRequest<{ success: boolean; scene: StoryboardScene; message?: string }>(
    `/api/storyboards/${storyboardId}/scenes/${sceneId}/duration`,
    {
      method: 'PUT',
      body: JSON.stringify({ new_duration: newDuration } as SceneDurationUpdateRequest),
    }
  );
  if (!result.scene) {
    throw new Error('Invalid response: scene not found');
  }
  return result.scene;
}

/**
 * 8. Generate video for scene (async)
 * POST /api/storyboards/{storyboard_id}/scenes/{scene_id}/video/generate
 */
export async function generateSceneVideo(
  storyboardId: string,
  sceneId: string
): Promise<SceneVideoGenerateResponse> {
  return apiRequest<SceneVideoGenerateResponse>(
    `/api/storyboards/${storyboardId}/scenes/${sceneId}/video/generate`,
    {
      method: 'POST',
    }
  );
}

/**
 * 9. Regenerate scene video (async)
 * POST /api/storyboards/{storyboard_id}/scenes/{scene_id}/video/regenerate
 */
export async function regenerateSceneVideo(
  storyboardId: string,
  sceneId: string
): Promise<SceneVideoGenerateResponse> {
  return apiRequest<SceneVideoGenerateResponse>(
    `/api/storyboards/${storyboardId}/scenes/${sceneId}/video/regenerate`,
    {
      method: 'POST',
    }
  );
}

/**
 * 10. Get scene status (polling fallback for SSE)
 * GET /api/scenes/{scene_id}/status
 */
export async function getSceneStatus(
  sceneId: string
): Promise<SceneStatusResponse> {
  return apiRequest<SceneStatusResponse>(`/api/scenes/${sceneId}/status`);
}

/**
 * 11. Regenerate all scenes
 * POST /api/storyboards/{storyboard_id}/regenerate-all
 */
export async function regenerateAllScenes(
  storyboardId: string
): Promise<{ storyboard: Storyboard; scenes: StoryboardScene[] }> {
  return apiRequest<{ storyboard: Storyboard; scenes: StoryboardScene[] }>(
    `/api/storyboards/${storyboardId}/regenerate-all`,
    { method: 'POST' }
  );
}

/**
 * 12. Get preview data for concatenated video
 * GET /api/storyboards/{storyboard_id}/preview
 */
export async function getStoryboardPreview(
  storyboardId: string
): Promise<StoryboardPreviewResponse> {
  return apiRequest<StoryboardPreviewResponse>(`/api/storyboards/${storyboardId}/preview`);
}

/**
 * 13. Create SSE connection for real-time updates
 * GET /api/storyboards/{storyboard_id}/events (SSE)
 */
export function createSSEConnection(
  storyboardId: string,
  onUpdate: (event: MessageEvent) => void,
  onError?: (error: Event) => void
): EventSource {
  const url = `${API_BASE_URL}/api/storyboards/${storyboardId}/events`;
  console.log('[API] Creating EventSource with URL:', url);
  const eventSource = new EventSource(url);

  console.log('[API] Adding event listeners...');
  
  // Connection established
  eventSource.addEventListener('connected', (event) => {
    console.log('[API] SSE connection established:', event);
  });
  
  // Scene updates
  eventSource.addEventListener('scene_update', (event) => {
    console.log('[API] Received scene_update event:', event);
    onUpdate(event);
  });
  
  // Error handling
  eventSource.addEventListener('error', (e) => {
    console.error('[API] SSE error event:', e);
    console.error('[API] EventSource readyState:', eventSource.readyState);
    console.error('[API] EventSource url:', eventSource.url);
    
    // Check if backend is reachable
    if (eventSource.readyState === EventSource.CLOSED) {
      console.error('[API] SSE connection closed. Backend may be down or unreachable.');
    }
    
    if (onError) onError(e);
  });
  
  // Complete event
  eventSource.addEventListener('complete', (event) => {
    console.log('[API] Received complete event:', event);
    onUpdate(event);
  });
  
  // Connection opened
  eventSource.addEventListener('open', () => {
    console.log('[API] EventSource connection opened successfully');
  });

  // Also listen for ALL messages for debugging
  eventSource.onmessage = (event) => {
    console.log('[API] Generic onmessage event:', event);
  };

  console.log('[API] EventSource created, readyState:', eventSource.readyState);
  return eventSource;
}

/**
 * Close SSE connection
 */
export function closeSSEConnection(eventSource: EventSource): void {
  eventSource.close();
}
