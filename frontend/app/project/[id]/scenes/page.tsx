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
import { Button } from '@/components/ui/button';
import { STEPS } from '@/lib/steps';
import { useAudioGeneration } from '@/hooks/useAudioGeneration';
import type { AudioGenerationRequest } from '@/types/audio.types';

// Storyboard-specific loading phrases that rotate
const LOADING_PHRASES = [
  "Planning your storyboard... 📝",
  "Crafting scene narratives... 🎬",
  "Designing your story flow... 🎭",
  "Building scene sequences... 🎞️",
  "Creating visual storyboards... ✨",
  "Almost ready with your scenes... 🚀",
  "Weaving scenes together... 🧵",
  "Polishing storyboard details... 💎",
  "Almost there, promise! ⏳"
];

function LoadingPhrases() {
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Rotate phrases every 2.5 seconds
    intervalRef.current = setInterval(() => {
      setIsVisible(false);
      
      // After fade out, change phrase and fade in
      setTimeout(() => {
        setCurrentPhraseIndex((prev) => (prev + 1) % LOADING_PHRASES.length);
        setIsVisible(true);
      }, 400); // Match fadeOutDown animation duration
    }, 2500);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return (
    <div className="flex-shrink-0 w-full h-full flex items-center justify-center">
      <div className="text-center px-4">
        <div 
          className={`
            text-sm sm:text-base font-display font-bold
            bg-gradient-to-r from-primary via-primary/80 to-primary
            bg-clip-text text-transparent
            ${isVisible ? 'animate-fadeInUp' : 'animate-fadeOutDown'}
          `}
        >
          {LOADING_PHRASES[currentPhraseIndex]}
        </div>
        <div className="mt-6 flex justify-center gap-2">
          {LOADING_PHRASES.map((_, index) => (
            <div
              key={index}
              className={`
                w-2 h-2 rounded-full transition-all duration-300
                ${index === currentPhraseIndex 
                  ? 'bg-primary scale-125 animate-gentleBounce' 
                  : 'bg-muted-foreground/30'
                }
              `}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

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
  const { creativeBrief, moods, selectedMoodId, audioUrl, setCurrentStep, setStoryboardCompleted } = useAppStore();
  const { loadProject, getCurrentProject, currentProjectId } = useProjectStore();
  
  // Audio generation hook
  const { generateAudio, isLoading: isGeneratingAudio, error: audioError } = useAudioGeneration();
  
  // Audio ref to stop playback when switching projects
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Stop audio when audioUrl changes or component unmounts
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    return () => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    };
  }, [audioUrl]);
  
  // Handle regenerate audio
  const handleRegenerateAudio = async () => {
    if (!creativeBrief || !selectedMoodId || !moods.length) {
      console.error('Missing required data for audio generation');
      return;
    }

    const selectedMood = moods.find((m) => (m as any).mood_id === selectedMoodId || m.id === selectedMoodId);
    if (!selectedMood) {
      console.error('Selected mood not found');
      return;
    }

    const moodName = (selectedMood as any).style_name || selectedMood.name;

    const audioRequest: AudioGenerationRequest = {
      mood_name: moodName,
      mood_description: selectedMood.aesthetic_direction || '',
      emotional_tone: creativeBrief.emotional_tone || [],
      aesthetic_direction: selectedMood.aesthetic_direction || '',
      style_keywords: selectedMood.style_keywords || [],
      duration: 30,
    };

    await generateAudio(audioRequest);
  };
  
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

  // Show toast for audio errors
  useEffect(() => {
    if (audioError) {
      addToast({
        type: 'error',
        message: audioError,
        duration: 5000,
      });
    }
  }, [audioError, addToast]);
  
  // Show toast for storyboard errors
  useEffect(() => {
    if (error && storyboard) {
      addToast({
        type: 'error',
        message: error,
        duration: 5000,
      });
      // Clear error after showing toast
      useSceneStore.getState().setError(null);
    }
  }, [error, storyboard, addToast]);

  // Show toast for video generation errors from scenes
  const shownErrorRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    scenes.forEach((scene) => {
      // Check if scene has a video error that hasn't been shown yet
      if (
        scene.error_message &&
        scene.generation_status.video === 'error' &&
        !shownErrorRef.current.has(scene.id)
      ) {
        // Mark this error as shown
        shownErrorRef.current.add(scene.id);
        
        // Show toast notification
        addToast({
          type: 'error',
          message: scene.error_message,
          duration: 5000,
        });
      }
      
      // Remove from shown errors if error is cleared
      if (!scene.error_message && shownErrorRef.current.has(scene.id)) {
        shownErrorRef.current.delete(scene.id);
      }
    });
  }, [scenes, addToast]);

  // Track failed storyboard loads to prevent endless retries
  const failedStoryboardIdsRef = useRef<Set<string>>(new Set());
  const initializationAttemptedRef = useRef<string | null>(null);
  
  // Reset initialization attempt tracking when key dependencies change
  useEffect(() => {
    const key = `${projectId}-${selectedMoodId}-${creativeBrief?.product_name || ''}`;
    if (initializationAttemptedRef.current !== key) {
      initializationAttemptedRef.current = null;
    }
  }, [projectId, selectedMoodId, creativeBrief?.product_name]);
  
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
      const key = `${projectId}-${selectedMoodId}-${creativeBrief?.product_name || ''}`;
      // Skip if we've already attempted initialization for this combination
      if (initializationAttemptedRef.current === key) {
        console.log('[Page] Skipping storyboard initialization - already attempted for this combination');
        return;
      }
      
      const selectedMood = moods.find((m) => m.id === selectedMoodId);
      const project = getCurrentProject();
      if (selectedMood) {
        console.log('[Page] Initializing new storyboard');
        initializationAttemptedRef.current = key;
        initializeStoryboard(
          creativeBrief, 
          selectedMood, 
          projectId,
          project?.brandAssetIds || null,
          project?.characterAssetIds || null
        ).catch((err) => {
          // Log error but keep the attempt marker to prevent infinite retries
          console.error('[Page] Storyboard initialization failed:', err);
        });
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
      // No success notification - duration updates silently
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
    setIsPreviewOpen(true);
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
        <div className="w-full max-w-7xl h-full flex items-center justify-center">
          <LoadingPhrases />
        </div>
      </div>
    );
  }

  // Error state
  if (error && !storyboard) {
    return (
      <div className="h-screen flex items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8 animate-fadeIn">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-destructive"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold">Error Loading Storyboard</h3>
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => router.push(`/project/${projectId}/chat`)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Return to Project
          </button>
        </div>
      </div>
    );
  }

  // No storyboard state
  if (!storyboard || scenes.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8 animate-fadeIn">
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
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden animate-fadeIn">
      {/* Top bar with Title */}
      <div className="w-full flex justify-center px-4 sm:px-6 lg:px-8 pt-[calc(3.5rem+1rem)] pb-1 flex-shrink-0">
        <div className="w-full max-w-7xl flex items-center justify-between">
          {/* Title - centered (spacer on left for balance) */}
          <div className="flex-1"></div>
          <h2 className="text-base sm:text-lg font-display font-bold tracking-tight">
            Generate your <span className="text-gradient">scenes</span>
          </h2>
          {/* Spacer for balance */}
          <div className="flex-1"></div>
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
          audioUrl={audioUrl}
          isGeneratingAudio={isGeneratingAudio}
          onRegenerateAudio={handleRegenerateAudio}
          audioRef={audioRef}
          canGenerateAudio={!!(creativeBrief && selectedMoodId)}
          allScenesReady={scenes.every(scene => scene.state === 'video' && scene.generation_status.video === 'complete')}
          readyCount={scenes.filter(scene => scene.state === 'video' && scene.generation_status.video === 'complete').length}
          totalScenes={scenes.length}
          totalVideoDuration={scenes.reduce((total, scene) => {
            // Calculate effective duration: trimmed if trim times exist, otherwise original
            const effectiveDuration = (scene.trim_start_time !== null && scene.trim_end_time !== null)
              ? scene.trim_end_time - scene.trim_start_time
              : (scene.video_duration || 0);
            return total + effectiveDuration;
          }, 0)}
          isRegeneratingAll={isRegeneratingAll}
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
