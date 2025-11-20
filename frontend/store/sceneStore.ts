import { create } from 'zustand';
import type { Storyboard, StoryboardScene, SSESceneUpdate } from '@/types/storyboard.types';
import * as storyboardAPI from '@/lib/api/storyboard';
import { retryOperation, StoryboardError, ERROR_CODES, isSensitiveContentError, extractErrorMessage } from '@/lib/errors';

/**
 * Scene Store
 *
 * Manages scene/storyboard state with real-time updates via SSE.
 * 
 * NOTE: This store is NOT persisted to localStorage directly.
 * Storyboards are stored in the backend database and referenced by ID in the projectStore.
 * Each project has a storyboardId that's used to load the correct storyboard from the API.
 */
interface SceneState {
  // Core data
  storyboard: Storyboard | null;
  scenes: StoryboardScene[];
  currentSceneIndex: number;

  // SSE connection
  sseConnection: EventSource | null;

  // Loading states
  isLoading: boolean;
  isSaving: boolean;
  isRegeneratingAll: boolean;

  // Error handling
  error: string | null;

  // Actions - Storyboard operations
  initializeStoryboard: (creativeBrief: any, selectedMood: any) => Promise<void>;
  loadStoryboard: (storyboardId: string) => Promise<void>;
  regenerateAllScenes: () => Promise<void>;

  // Actions - Scene operations
  setCurrentSceneIndex: (index: number) => void;
  approveText: (sceneId: string) => Promise<void>;
  regenerateText: (sceneId: string) => Promise<void>;
  editText: (sceneId: string, newText: string) => Promise<void>;
  approveImage: (sceneId: string) => Promise<void>;
  regenerateImage: (sceneId: string) => Promise<void>;
  updateDuration: (sceneId: string, newDuration: number) => Promise<void>;
  regenerateVideo: (sceneId: string) => Promise<void>;
  
  // Actions - Product compositing
  enableProductComposite: (sceneId: string, productId: string) => Promise<void>;
  disableProductComposite: (sceneId: string) => Promise<void>;

  // Actions - SSE
  connectSSE: (storyboardId: string) => void;
  disconnectSSE: () => void;
  handleSSEUpdate: (event: MessageEvent) => void;

  // Actions - Utilities
  updateScene: (sceneId: string, updates: Partial<StoryboardScene>) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useSceneStore = create<SceneState>((set, get) => ({
  // Initial state
  storyboard: null,
  scenes: [],
  currentSceneIndex: 0,
  sseConnection: null,
  isLoading: false,
  isSaving: false,
  isRegeneratingAll: false,
  error: null,

      // Initialize new storyboard
      initializeStoryboard: async (creativeBrief, selectedMood) => {
        // Prevent duplicate initialization calls
        const currentState = get();
        if (currentState.isLoading || currentState.storyboard) {
          console.log('[StoryboardStore] Skipping duplicate initializeStoryboard call (already loading or storyboard exists)');
          return;
        }

        console.log('[StoryboardStore] Starting storyboard initialization for product:', creativeBrief?.product_name);
        set({ isLoading: true, error: null });
        try {
          const response = await retryOperation(
            () => storyboardAPI.initializeStoryboard({
              creative_brief: creativeBrief,
              selected_mood: selectedMood,
            }),
            {
              maxRetries: 2,
              operationName: 'Initialize Storyboard',
              onRetry: (attempt) => {
                console.log(`Retrying storyboard initialization (attempt ${attempt})...`);
              },
            }
          );

          if (response.success) {
            console.log('[StoryboardStore] Storyboard initialized:', {
              storyboardId: response.storyboard.storyboard_id,
              product: creativeBrief?.product_name,
              sceneCount: response.scenes.length
            });
            set({
              storyboard: response.storyboard,
              scenes: response.scenes,
              currentSceneIndex: 0,
              isLoading: false,
            });

            // Connect SSE for real-time updates
            get().connectSSE(response.storyboard.storyboard_id);
          } else {
            throw new StoryboardError(
              response.message || 'Failed to initialize storyboard',
              ERROR_CODES.STORYBOARD_INIT_FAILED,
              true
            );
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to initialize storyboard';
          set({
            error: errorMessage,
            isLoading: false,
          });
          throw error;
        }
      },

      // Load existing storyboard
      loadStoryboard: async (storyboardId) => {
        console.log('[StoryboardStore] Loading storyboard:', storyboardId);
        set({ isLoading: true, error: null });
        try {
          const { storyboard, scenes } = await retryOperation(
            () => storyboardAPI.getStoryboard(storyboardId),
            {
              maxRetries: 3,
              operationName: 'Load Storyboard',
            }
          );

          console.log('[StoryboardStore] Storyboard loaded successfully:', {
            storyboardId: storyboard.storyboard_id,
            creativeBriefProduct: storyboard.creative_brief?.product_name,
            sceneCount: scenes.length,
            firstSceneText: scenes[0]?.text?.substring(0, 50)
          });

          set({
            storyboard,
            scenes,
            currentSceneIndex: 0,
            isLoading: false,
          });

          // Connect SSE
          get().connectSSE(storyboardId);

          // Check for any ongoing generations and poll status
          const generatingScenes = scenes.filter(
            (s) =>
              s.generation_status.image === 'generating' ||
              s.generation_status.video === 'generating'
          );

          if (generatingScenes.length > 0 && !get().sseConnection) {
            // Fallback to polling if SSE not available
            generatingScenes.forEach((scene) => {
              pollSceneStatus(scene.id, get);
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load storyboard';
          
          // Check if it's a 404 (storyboard not found)
          const isNotFound = errorMessage.includes('404') || 
                            errorMessage.includes('not found') ||
                            errorMessage.includes('Backend endpoint not found');
          
          if (isNotFound) {
            console.warn('[StoryboardStore] Storyboard not found, clearing reference:', storyboardId);
            // Reset storyboard state instead of throwing error
            set({
              storyboard: null,
              scenes: [],
              isLoading: false,
              error: null, // Don't show error for missing storyboard
            });
            // Return a special error that projectStore can handle
            throw new StoryboardError(
              'STORYBOARD_NOT_FOUND',
              ERROR_CODES.STORYBOARD_LOAD_FAILED,
              false, // Not retryable
              storyboardId
            );
          }
          
          set({
            error: errorMessage,
            isLoading: false,
          });
          throw new StoryboardError(
            errorMessage,
            ERROR_CODES.STORYBOARD_LOAD_FAILED,
            true
          );
        }
      },

      // Regenerate all scenes
      regenerateAllScenes: async () => {
        const { storyboard } = get();
        if (!storyboard) return;

        set({ isRegeneratingAll: true, error: null });
        try {
          const { storyboard: newStoryboard, scenes: newScenes } =
            await storyboardAPI.regenerateAllScenes(storyboard.storyboard_id);

          set({
            storyboard: newStoryboard,
            scenes: newScenes,
            currentSceneIndex: 0,
            isRegeneratingAll: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to regenerate scenes',
            isRegeneratingAll: false,
          });
        }
      },

      // Set current scene index
      setCurrentSceneIndex: (index) => set({ currentSceneIndex: index }),

      // Approve text and generate image
      approveText: async (sceneId) => {
        console.log('[Store] approveText called for scene:', sceneId);
        set({ isSaving: true, error: null });
        try {
          const storyboard = get().storyboard;
          console.log('[Store] Current storyboard:', storyboard?.storyboard_id);
          if (!storyboard) {
            throw new Error('No storyboard loaded');
          }
          console.log('[Store] Calling generateSceneImage API with storyboardId:', storyboard.storyboard_id, 'sceneId:', sceneId);
          const updatedScene = await retryOperation(
            () => storyboardAPI.generateSceneImage(storyboard.storyboard_id, sceneId),
            {
              maxRetries: 2,
              operationName: 'Generate Scene Image',
            }
          );
          console.log('[Store] generateSceneImage returned:', updatedScene);
          get().updateScene(sceneId, updatedScene);
          set({ isSaving: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to generate image';
          set({
            error: errorMessage,
            isSaving: false,
          });
          throw new StoryboardError(
            errorMessage,
            ERROR_CODES.SCENE_IMAGE_GENERATION_FAILED,
            true,
            sceneId
          );
        }
      },

      // Regenerate text
      regenerateText: async (sceneId) => {
        const { storyboard } = get();
        if (!storyboard) return;

        set({ isSaving: true, error: null });
        try {
          const updatedScene = await retryOperation(
            () => storyboardAPI.generateSceneText(storyboard.storyboard_id, sceneId, storyboard.creative_brief),
            {
              maxRetries: 2,
              operationName: 'Regenerate Scene Text',
            }
          );
          get().updateScene(sceneId, updatedScene);
          set({ isSaving: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to regenerate text';
          set({
            error: errorMessage,
            isSaving: false,
          });
          throw new StoryboardError(
            errorMessage,
            ERROR_CODES.SCENE_TEXT_GENERATION_FAILED,
            true,
            sceneId
          );
        }
      },

      // Edit text
      editText: async (sceneId, newText) => {
        set({ isSaving: true, error: null });
        try {
          const storyboard = get().storyboard;
          if (!storyboard) {
            throw new Error('No storyboard loaded');
          }
          const updatedScene = await retryOperation(
            () => storyboardAPI.updateSceneText(storyboard.storyboard_id, sceneId, newText),
            {
              maxRetries: 2,
              operationName: 'Update Scene Text',
            }
          );
          get().updateScene(sceneId, updatedScene);
          set({ isSaving: false });
        } catch (error) {
          // Extract error message using the helper function
          const errorMessage = extractErrorMessage(error, 'Failed to update text');
          
          set({
            error: errorMessage,
            isSaving: false,
          });
          throw new StoryboardError(
            errorMessage,
            ERROR_CODES.SCENE_TEXT_UPDATE_FAILED,
            true,
            sceneId
          );
        }
      },

      // Approve image and generate video
      approveImage: async (sceneId) => {
        set({ isSaving: true, error: null });
        try {
          const storyboard = get().storyboard;
          if (!storyboard) {
            throw new Error('No storyboard loaded');
          }
          await storyboardAPI.generateSceneVideo(storyboard.storyboard_id, sceneId);
          // SSE will handle the update
          set({ isSaving: false });
        } catch (error) {
          // Check if error is due to sensitive content
          if (isSensitiveContentError(error)) {
            const errorMessage = 'Your input prompt contains sensitive content. Please modify the scene description and try again.';
            set({
              error: errorMessage,
              isSaving: false,
            });
            // Update scene with error message
            const scene = get().scenes.find(s => s.id === sceneId);
            if (scene) {
              get().updateScene(sceneId, {
                error_message: errorMessage,
                generation_status: {
                  ...scene.generation_status,
                  video: 'error',
                },
              });
            }
            throw new StoryboardError(
              errorMessage,
              ERROR_CODES.API_CONTENT_POLICY,
              false, // Not retryable - user must change input
              sceneId
            );
          }
          set({
            error: error instanceof Error ? error.message : 'Failed to generate video',
            isSaving: false,
          });
        }
      },

      // Regenerate image
      regenerateImage: async (sceneId) => {
        set({ isSaving: true, error: null });
        try {
          const storyboard = get().storyboard;
          if (!storyboard) {
            throw new Error('No storyboard loaded');
          }
          const updatedScene = await retryOperation(
            () => storyboardAPI.regenerateSceneImage(storyboard.storyboard_id, sceneId),
            {
              maxRetries: 2,
              operationName: 'Regenerate Scene Image',
            }
          );
          get().updateScene(sceneId, updatedScene);
          set({ isSaving: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to regenerate image';
          set({
            error: errorMessage,
            isSaving: false,
          });
          throw new StoryboardError(
            errorMessage,
            ERROR_CODES.SCENE_IMAGE_GENERATION_FAILED,
            true,
            sceneId
          );
        }
      },

      // Update duration
      updateDuration: async (sceneId, newDuration) => {
        set({ isSaving: true, error: null });
        try {
          const storyboard = get().storyboard;
          if (!storyboard) {
            throw new Error('No storyboard loaded');
          }
          const updatedScene = await retryOperation(
            () => storyboardAPI.updateSceneDuration(storyboard.storyboard_id, sceneId, newDuration),
            {
              maxRetries: 2,
              operationName: 'Update Scene Duration',
            }
          );
          get().updateScene(sceneId, updatedScene);
          set({ isSaving: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to update duration';
          set({
            error: errorMessage,
            isSaving: false,
          });
          throw new StoryboardError(
            errorMessage,
            ERROR_CODES.SCENE_DURATION_UPDATE_FAILED,
            true,
            sceneId
          );
        }
      },

      // Regenerate video
      regenerateVideo: async (sceneId) => {
        set({ isSaving: true, error: null });
        try {
          const storyboard = get().storyboard;
          if (!storyboard) {
            throw new Error('No storyboard loaded');
          }
          
          // Retry logic for sensitive content errors (output flagged as sensitive)
          let lastError: unknown = null;
          let retryCount = 0;
          const maxRetries = 2;
          
          while (retryCount <= maxRetries) {
            try {
              await storyboardAPI.regenerateSceneVideo(storyboard.storyboard_id, sceneId);
              // SSE will handle the update
              set({ isSaving: false });
              return; // Success
            } catch (error) {
              lastError = error;
              
              // If it's a sensitive content error and we haven't exceeded retries, retry
              if (isSensitiveContentError(error) && retryCount < maxRetries) {
                retryCount++;
                // Wait a bit before retrying
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
              }
              
              // If it's sensitive content and we've exhausted retries, or it's a different error, throw
              throw error;
            }
          }
          
          // If we get here, all retries failed
          throw lastError;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to regenerate video';
          set({
            error: errorMessage,
            isSaving: false,
          });
          // Update scene with error if it's a sensitive content error after retries
          if (isSensitiveContentError(error)) {
            const scene = get().scenes.find(s => s.id === sceneId);
            if (scene) {
              get().updateScene(sceneId, {
                error_message: 'Video generation failed due to sensitive content. Please try adjusting the scene description.',
                generation_status: {
                  ...scene.generation_status,
                  video: 'error',
                },
              });
            }
          }
        }
      },
      
      // Enable product compositing for a scene
      enableProductComposite: async (sceneId, productId) => {
        set({ isSaving: true, error: null });
        try {
          const storyboard = get().storyboard;
          if (!storyboard) {
            throw new Error('No storyboard loaded');
          }
          
          const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
          const response = await fetch(
            `${API_URL}/api/storyboards/${storyboard.storyboard_id}/scenes/${sceneId}/product-composite`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ product_id: productId }),
            }
          );
          
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to enable product');
          }
          
          const data = await response.json();
          
          // Update scene in state
          get().updateScene(sceneId, data.scene);
          set({ isSaving: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to enable product composite',
            isSaving: false,
          });
          throw error;
        }
      },
      
      // Disable product compositing for a scene
      disableProductComposite: async (sceneId) => {
        set({ isSaving: true, error: null });
        try {
          const storyboard = get().storyboard;
          if (!storyboard) {
            throw new Error('No storyboard loaded');
          }
          
          const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
          const response = await fetch(
            `${API_URL}/api/storyboards/${storyboard.storyboard_id}/scenes/${sceneId}/product-composite`,
            { method: 'DELETE' }
          );
          
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to disable product');
          }
          
          const data = await response.json();
          
          // Update scene in state
          get().updateScene(sceneId, data.scene);
          set({ isSaving: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to disable product composite',
            isSaving: false,
          });
          throw error;
        }
      },

      // Connect SSE
      connectSSE: (storyboardId) => {
        // Check if already connected to this storyboard
        const { sseConnection, storyboard } = get();
        if (sseConnection && storyboard?.storyboard_id === storyboardId) {
          console.log('[SSE] Already connected to storyboard', storyboardId);
          return;
        }

        // Disconnect existing connection if it's for a different storyboard
        if (sseConnection) {
          console.log('[SSE] Disconnecting from previous storyboard');
          get().disconnectSSE();
        }

        try {
          console.log('[SSE] Connecting to storyboard', storyboardId);
          const eventSource = storyboardAPI.createSSEConnection(
            storyboardId,
            (event) => {
              console.log('[SSE] Event received, calling handleSSEUpdate');
              get().handleSSEUpdate(event);
            },
            (error) => {
              console.error('[SSE] Connection error:', error);
              // Attempt to reconnect after 5 seconds
              setTimeout(() => {
                if (get().storyboard?.storyboard_id === storyboardId) {
                  console.log('[SSE] Attempting to reconnect...');
                  get().connectSSE(storyboardId);
                }
              }, 5000);
            }
          );

          eventSource.onopen = () => {
            console.log('[SSE] Connection opened for storyboard', storyboardId);
          };

          set({ sseConnection: eventSource });
          console.log('[SSE] SSE connection established for storyboard', storyboardId);
        } catch (error) {
          console.error('[SSE] Failed to create SSE connection:', error);
        }
      },

      // Disconnect SSE
      disconnectSSE: () => {
        const { sseConnection } = get();
        if (sseConnection) {
          storyboardAPI.closeSSEConnection(sseConnection);
          set({ sseConnection: null });
        }
      },

      // Handle SSE updates
      handleSSEUpdate: (event) => {
        try {
          console.log('[SSE] Received event:', event.type, event.data);
          const data: SSESceneUpdate = JSON.parse(event.data);
          const { scene_id, state, image_status, video_status, video_url, image_url, error } = data;
          console.log('[SSE] Parsed data:', { scene_id, state, image_status, video_status, image_url, video_url, error });

          const currentScene = get().scenes.find((s) => s.id === scene_id);
          console.log('[SSE] Current scene before update:', currentScene);
          
          // Build updates object with new statuses
          const updates: Partial<StoryboardScene> = {
            state,
            generation_status: {
              image: image_status,
              video: video_status,
            },
            error_message: error || null,
          };

          // Update URLs if provided
          if (image_url !== undefined) {
            updates.image_url = image_url;
          }
          if (video_url !== undefined) {
            updates.video_url = video_url;
          }
          
          console.log('[SSE] Applying updates:', updates);
          get().updateScene(scene_id, updates);
          
          const updatedScene = get().scenes.find((s) => s.id === scene_id);
          console.log('[SSE] Scene after update:', updatedScene);
        } catch (err) {
          console.error('[SSE] Failed to parse SSE event:', err, event);
        }
      },

      // Update a specific scene
      updateScene: (sceneId, updates) => {
        set((state) => ({
          scenes: state.scenes.map((scene) =>
            scene.id === sceneId ? { ...scene, ...updates } : scene
          ),
        }));
      },

      // Set error
      setError: (error) => set({ error }),

  // Reset state
  reset: () => {
    console.log('[StoryboardStore] Resetting storyboard state');
    get().disconnectSSE();
    set({
      storyboard: null,
      scenes: [],
      currentSceneIndex: 0,
      sseConnection: null,
      isLoading: false,
      isSaving: false,
      isRegeneratingAll: false,
      error: null,
    });
  },
}));

/**
 * Polling fallback for scene status when SSE is not available
 */
async function pollSceneStatus(sceneId: string, get: () => StoryboardState) {
  const maxAttempts = 60; // 5 minutes max (5s intervals)
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

      // Continue polling if still generating
      if (
        status.generation_status.image === 'generating' ||
        status.generation_status.video === 'generating'
      ) {
        attempts++;
        setTimeout(poll, 5000); // Poll every 5 seconds
      }
    } catch (error) {
      console.error('Failed to poll scene status:', error);
    }
  };

  poll();
}
