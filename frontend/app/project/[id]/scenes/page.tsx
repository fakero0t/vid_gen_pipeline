'use client';

import React, { useEffect, Suspense, useRef, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { StoryboardCarousel } from '@/components/storyboard';
import { PreviewPlayer } from '@/components/storyboard/PreviewPlayer';
import { useStoryboard, useStoryboardRecovery } from '@/hooks/useStoryboard';
import { useAppStore } from '@/store/appStore';
import { useProjectStore } from '@/store/projectStore';
import { useSceneStore } from '@/store/sceneStore';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { Button } from '@/components/ui/button';
import { STEPS } from '@/lib/steps';

/**
 * Unified Storyboard Interface Page
 *
 * This page replaces the traditional Step 3 (Scenes) with a carousel-based
 * progressive workflow (Text → Image → Video).
 */
function ScenesPageContent() {
  const { addToast } = useToast();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const searchParams = useSearchParams();
  const urlStoryboardId = searchParams.get('id');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // App-level state for creative brief and mood
  const { creativeBrief, moods, selectedMoodId, setCurrentStep, setStoryboardCompleted } = useAppStore();
  const { loadProject, getCurrentProject, currentProjectId } = useProjectStore();
  
  // Get storyboardId from URL or from current project
  const currentProject = getCurrentProject();
  const storyboardId = urlStoryboardId || currentProject?.storyboardId;

  // Load project on mount
  useEffect(() => {
    if (projectId && projectId !== currentProjectId) {
      try {
        loadProject(projectId);
      } catch (error) {
        console.error('Failed to load project:', error);
        router.push('/projects');
      }
    }
  }, [projectId, currentProjectId, loadProject, router]);

  // Verify project exists
  useEffect(() => {
    const project = getCurrentProject();
    if (projectId && !project) {
      console.error('Project not found:', projectId);
      router.push('/projects');
    }
  }, [projectId, getCurrentProject, router]);

  // Storyboard store
  const {
    storyboard,
    scenes,
    isLoading,
    isSaving,
    isRegeneratingAll,
    error,
    initializeStoryboard,
    loadStoryboard,
    regenerateAllScenes,
    approveText,
    regenerateText,
    editText,
    approveImage,
    regenerateImage,
    updateDuration,
    regenerateVideo,
    addScene,
    removeScene,
    reorderScenes,
  } = useStoryboard();

  // Session recovery
  const { isRecovering } = useStoryboardRecovery();

  // Track failed storyboard loads to prevent endless retries
  const failedStoryboardIdsRef = useRef<Set<string>>(new Set());
  
  // Initialize or load storyboard
  useEffect(() => {
    // Skip if already loading or if storyboard exists and matches
    if (isLoading || isRecovering) return;
    if (storyboard && storyboardId && storyboard.storyboard_id === storyboardId) return;
    
    // If we have a storyboardId (from URL or project), load it
    if (storyboardId) {
      // Skip if we've already tried and failed to load this storyboard
      if (failedStoryboardIdsRef.current.has(storyboardId)) {
        console.log('[Page] Skipping storyboard load - already failed:', storyboardId);
        // Clear the storyboardId from project if it's not from URL
        if (!urlStoryboardId && currentProject?.storyboardId === storyboardId) {
          console.log('[Page] Clearing invalid storyboardId from project');
          const { updateProject } = useProjectStore.getState();
          updateProject(projectId, { storyboardId: undefined });
        }
        return;
      }
      
      console.log('[Page] Loading storyboard:', storyboardId, urlStoryboardId ? '(from URL)' : '(from project)');
      loadStoryboard(storyboardId).catch((err) => {
        // Mark as failed if it's a 404 or not found error
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (errorMessage.includes('404') || 
            errorMessage.includes('not found') || 
            errorMessage.includes('STORYBOARD_NOT_FOUND')) {
          console.warn('[Page] Storyboard load failed, marking as failed:', storyboardId);
          failedStoryboardIdsRef.current.add(storyboardId);
          
          // Clear the storyboardId from project if it's not from URL
          if (!urlStoryboardId && currentProject?.storyboardId === storyboardId) {
            console.log('[Page] Clearing invalid storyboardId from project');
            const { updateProject } = useProjectStore.getState();
            updateProject(projectId, { storyboardId: undefined });
          }
        }
      });
    } 
    // Only initialize new storyboard if we don't have one and we have the required data
    else if (!storyboard && creativeBrief && selectedMoodId) {
      const selectedMood = moods.find((m) => m.id === selectedMoodId);
      const project = getCurrentProject();
      if (selectedMood) {
        console.log('[Page] Initializing new storyboard');
        initializeStoryboard(
          creativeBrief, 
          selectedMood, 
          projectId,
          project?.brandAssetIds || null,
          project?.characterAssetIds || null
        );
      }
    }
  }, [storyboardId, urlStoryboardId, storyboard, creativeBrief, selectedMoodId, moods, isLoading, isRecovering, loadStoryboard, initializeStoryboard, currentProject, projectId]);

  // Save storyboardId to project immediately when storyboard is created
  useEffect(() => {
    if (storyboard && currentProjectId) {
      const project = getCurrentProject();
      // If project doesn't have this storyboardId yet, save it immediately
      if (project && project.storyboardId !== storyboard.storyboard_id) {
        console.log('[Page] Saving new storyboardId to project:', storyboard.storyboard_id);
        useProjectStore.getState().saveCurrentProject();
      }
    }
  }, [storyboard, currentProjectId, getCurrentProject]);

  // Update project thumbnail when scene images are generated
  useEffect(() => {
    if (scenes.length > 0 && currentProjectId) {
      const firstSceneWithImage = scenes.find(scene => scene.image_url);
      if (firstSceneWithImage && firstSceneWithImage.image_url) {
        const project = getCurrentProject();
        // Update thumbnail if it's different or doesn't exist
        // Convert null to undefined to match UpdateProjectRequest type
        const thumbnailUrl = firstSceneWithImage.image_url ?? undefined;
        if (project && project.thumbnail !== thumbnailUrl) {
          console.log('[Page] Updating project thumbnail with scene image');
          useProjectStore.getState().updateProject(currentProjectId, {
            thumbnail: thumbnailUrl
          });
        }
      }
    }
  }, [scenes, currentProjectId, getCurrentProject]);

  // Handle operations with toast feedback
  const handleApproveText = async (sceneId: string) => {
    try {
      await approveText(sceneId);
      addToast({
        type: 'success',
        message: 'Image generation started',
        duration: 3000,
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to generate image',
        duration: 5000,
      });
    }
  };

  const handleRegenerateText = async (sceneId: string) => {
    try {
      await regenerateText(sceneId);
      addToast({
        type: 'success',
        message: 'Scene text regenerated',
        duration: 3000,
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to regenerate text',
        duration: 5000,
      });
    }
  };

  const handleEditText = async (sceneId: string, newText: string) => {
    try {
      await editText(sceneId, newText);
      addToast({
        type: 'success',
        message: 'Scene text updated',
        duration: 3000,
      });
    } catch (error) {
      // Extract error message properly
      let errorMessage = 'Failed to update text';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      }
      addToast({
        type: 'error',
        message: errorMessage,
        duration: 5000,
      });
    }
  };

  const handleApproveImage = async (sceneId: string) => {
    try {
      await approveImage(sceneId);
      addToast({
        type: 'success',
        message: 'Video generation started',
        duration: 3000,
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to generate video',
        duration: 5000,
      });
    }
  };

  const handleRegenerateImage = async (sceneId: string) => {
    try {
      await regenerateImage(sceneId);
      addToast({
        type: 'success',
        message: 'Image regeneration started',
        duration: 3000,
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to regenerate image',
        duration: 5000,
      });
    }
  };

  const handleUpdateDuration = async (sceneId: string, newDuration: number) => {
    try {
      await updateDuration(sceneId, newDuration);
      addToast({
        type: 'success',
        message: 'Duration updated',
        duration: 3000,
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to update duration',
        duration: 5000,
      });
    }
  };

  const handleRegenerateVideo = async (sceneId: string) => {
    try {
      await regenerateVideo(sceneId);
      addToast({
        type: 'success',
        message: 'Video regeneration started',
        duration: 3000,
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to regenerate video',
        duration: 5000,
      });
    }
  };

  const handleAddScene = async () => {
    try {
      await addScene();
      addToast({
        type: 'success',
        message: 'Scene added successfully',
        duration: 3000,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add scene';
      addToast({
        type: 'error',
        message: errorMessage,
        duration: 5000,
      });
    }
  };

  const handleRemoveScene = async (sceneId: string) => {
    try {
      await removeScene(sceneId);
      addToast({
        type: 'success',
        message: 'Scene removed successfully',
        duration: 3000,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove scene';
      addToast({
        type: 'error',
        message: errorMessage,
        duration: 5000,
      });
    }
  };

  const handleReorderScenes = async (newOrder: string[]) => {
    try {
      await reorderScenes(newOrder);
      addToast({
        type: 'success',
        message: 'Scenes reordered successfully',
        duration: 3000,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reorder scenes';
      addToast({
        type: 'error',
        message: errorMessage,
        duration: 5000,
      });
    }
  };

  const handleRegenerateAll = async () => {
    try {
      await regenerateAllScenes();
      addToast({
        type: 'success',
        message: 'All scenes regenerated successfully',
        duration: 3000,
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to regenerate all scenes',
        duration: 5000,
      });
    }
  };

  // Handle preview all scenes
  const handlePreviewAll = () => {
    // Preview modal is now part of StoryboardCarousel
    console.log('Preview all scenes');
  };

  // Handle generate final video
  const handleGenerateFinalVideo = () => {
    // Mark storyboard as completed and navigate to final composition
    setStoryboardCompleted(true);
    setCurrentStep(STEPS.FINAL);
    router.push(`/project/${projectId}/final`);
  };

  // Loading state
  if (isLoading || isRecovering) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] sm:min-h-[calc(100vh-100px)] items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8 animate-fadeIn">
        <div className="w-full max-w-7xl space-y-3 sm:space-y-4 md:space-y-6 pt-4 sm:pt-6 md:pt-8">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">
              Loading Storyboard
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !storyboard) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] sm:min-h-[calc(100vh-100px)] items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8 animate-fadeIn">
        <div className="w-full max-w-7xl space-y-3 sm:space-y-4 md:space-y-6 pt-4 sm:pt-6 md:pt-8">
          <div className="max-w-md w-full bg-card border border-destructive rounded-lg p-6 space-y-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-6 h-6 text-destructive mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <h3 className="font-semibold text-destructive mb-1">Error Loading Storyboard</h3>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
            <button
              onClick={() => router.push(`/project/${projectId}/chat`)}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Return to Project
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No storyboard state
  if (!storyboard || scenes.length === 0) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] sm:min-h-[calc(100vh-100px)] items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8 animate-fadeIn">
        <div className="w-full max-w-7xl space-y-3 sm:space-y-4 md:space-y-6 pt-4 sm:pt-6 md:pt-8">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold">No Storyboard Found</h3>
            <p className="text-sm text-muted-foreground">
              Please complete the creative brief and mood selection first.
            </p>
            <button
              onClick={() => router.push(`/project/${projectId}/chat`)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Go to Creative Brief
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-[calc(3.5rem+1rem)] h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden animate-fadeIn">
      {/* Compact header bar */}
      <div className="flex-shrink-0 px-4 sm:px-6 py-2 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/project/${projectId}/mood`)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <div>
              <h1 className="text-lg font-bold leading-tight">Scene Storyboard</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {error && (
              <div className="flex-1 max-w-md mr-2">
                <ErrorAlert
                  error={error}
                  onDismiss={() => useSceneStore.getState().setError(null)}
                  showRetry={false}
                />
              </div>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs"
              onClick={() => setIsPreviewOpen(true)}
              disabled={isSaving || isRegeneratingAll || scenes.length === 0}
            >
              <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Preview
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-8 px-3 text-xs"
              onClick={handleRegenerateAll}
              disabled={isSaving || isRegeneratingAll}
            >
              {isRegeneratingAll ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
              ) : (
                <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              Regenerate All
            </Button>
          </div>
        </div>
      </div>

      {/* Main content area - fills remaining viewport */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <StoryboardCarousel
          storyboard={storyboard}
          scenes={scenes}
          onRegenerateAll={handleRegenerateAll}
          onPreviewAll={handlePreviewAll}
          onGenerateFinalVideo={handleGenerateFinalVideo}
          onApproveText={handleApproveText}
          onRegenerateText={handleRegenerateText}
          onEditText={handleEditText}
          onApproveImage={handleApproveImage}
          onRegenerateImage={handleRegenerateImage}
          onUpdateDuration={handleUpdateDuration}
          onRegenerateVideo={handleRegenerateVideo}
          onAddScene={handleAddScene}
          onRemoveScene={handleRemoveScene}
          onReorderScenes={handleReorderScenes}
          isLoading={isSaving || isRegeneratingAll}
        />
      </div>

      {/* Loading overlay for regenerate all */}
      {isRegeneratingAll && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 space-y-4 max-w-sm">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-center font-medium">Regenerating all scenes...</p>
            <p className="text-xs text-center text-muted-foreground">
              This may take a moment
            </p>
          </div>
        </div>
      )}

      {/* Preview Player Modal */}
      {storyboard && (
        <PreviewPlayer
          scenes={scenes}
          sceneOrder={storyboard.scene_order}
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
        />
      )}
    </div>
  );
}

// Wrap with ToastProvider and Suspense
export default function ScenesPage() {
  return (
    <ToastProvider>
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }>
        <ScenesPageContent />
      </Suspense>
    </ToastProvider>
  );
}
