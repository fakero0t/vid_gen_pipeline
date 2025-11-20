import { useEffect } from 'react';
import { useSceneStore } from '@/store/sceneStore';

/**
 * Custom hook for storyboard operations
 *
 * Provides convenient access to storyboard state and actions,
 * with automatic SSE connection management and session recovery.
 */
export function useStoryboard() {
  const store = useSceneStore();

  // Auto-connect SSE when storyboard is loaded
  useEffect(() => {
    if (store.storyboard && !store.sseConnection) {
      store.connectSSE(store.storyboard.storyboard_id);
    }

    // Cleanup on unmount
    return () => {
      if (store.sseConnection) {
        store.disconnectSSE();
      }
    };
  }, [store.storyboard?.storyboard_id]);

  return store;
}

/**
 * Hook for session recovery
 *
 * Automatically recovers storyboard state from the backend on page load
 * if a storyboard ID is present in the persisted state.
 */
export function useStoryboardRecovery() {
  const store = useSceneStore();

  useEffect(() => {
    // Only run once on mount
    if (store.storyboard && !store.isLoading) {
      // Refresh storyboard data from backend
      store.loadStoryboard(store.storyboard.storyboard_id);
    }
  }, []); // Empty dependency array - only run on mount

  return {
    isRecovering: store.isLoading,
    error: store.error,
  };
}

/**
 * Hook for getting current scene
 */
export function useCurrentScene() {
  const { storyboard, scenes, currentSceneIndex } = useSceneStore();

  if (!storyboard || scenes.length === 0) {
    return null;
  }

  const currentSceneId = storyboard.scene_order[currentSceneIndex];
  return scenes.find((s) => s.id === currentSceneId) || null;
}

/**
 * Hook for checking if all scenes are ready for final video
 */
export function useAllScenesReady() {
  const { scenes } = useSceneStore();

  const allReady = scenes.every(
    (scene) => scene.state === 'video' && scene.generation_status.video === 'complete'
  );

  const readyCount = scenes.filter(
    (scene) => scene.state === 'video' && scene.generation_status.video === 'complete'
  ).length;

  return {
    allReady,
    readyCount,
    totalCount: scenes.length,
  };
}
