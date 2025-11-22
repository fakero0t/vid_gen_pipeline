'use client';

import React from 'react';
import { useVideoGeneration } from '@/hooks/useVideoGeneration';
import { VideoGenerationProgress } from './VideoGenerationProgress';
import type { Scene } from '@/types/scene.types';

interface VideoGenerationDemoProps {
  scenes: Scene[];
  moodStyleKeywords?: string[];
  moodAestheticDirection?: string;
  onComplete?: () => void;
}

/**
 * Example component demonstrating how to use the useVideoGeneration hook
 * with the progress UI components.
 */
export function VideoGenerationDemo({
  scenes,
  moodStyleKeywords = [],
  moodAestheticDirection = '',
  onComplete,
}: VideoGenerationDemoProps) {
  const {
    jobStatus,
    isGenerating,
    error,
    startGeneration,
    stopPolling,
    clearError,
    retryGeneration,
  } = useVideoGeneration();

  const handleStartGeneration = async () => {
    // Validate scenes have seed images
    const scenesWithoutImages = scenes.filter((s) => !s.seed_image_url);
    if (scenesWithoutImages.length > 0) {
      alert(
        `Please generate seed images for all scenes first. Missing images for scenes: ${scenesWithoutImages.map((s) => s.scene_number).join(', ')}`
      );
      return;
    }

    // Prepare request
    const request = {
      scenes: scenes.map((scene) => ({
        scene_number: scene.scene_number,
        duration: scene.duration,
        description: scene.description,
        style_prompt: scene.style_prompt,
        seed_image_url: scene.seed_image_url!,
      })),
      mood_style_keywords: moodStyleKeywords,
      mood_aesthetic_direction: moodAestheticDirection,
    };

    // Start generation
    const jobId = await startGeneration(request);
    if (jobId) {
      console.log('Video generation started:', jobId);
    }
  };

  const handleCancel = () => {
    stopPolling();
  };

  const handleRetry = async () => {
    clearError();
    await retryGeneration();
  };

  // Call onComplete when generation finishes
  React.useEffect(() => {
    if (jobStatus?.status === 'completed' && onComplete) {
      onComplete();
    }
  }, [jobStatus?.status, onComplete]);

  return (
    <div className="space-y-6">
      {/* Start button */}
      {!jobStatus && !isGenerating && (
        <div className="text-center">
          <button
            onClick={handleStartGeneration}
            className="px-8 py-4 bg-primary text-primary-foreground rounded-lg font-semibold text-lg hover:opacity-90 transition-opacity shadow-lg"
            disabled={scenes.length === 0}
          >
            Generate {scenes.length} Video Clips
          </button>
          {scenes.length === 0 && (
            <p className="text-sm text-muted-foreground mt-2">
              No scenes available. Please create a scene plan first.
            </p>
          )}
        </div>
      )}

      {/* Error display */}
      {error && !isGenerating && (
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg
              className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1">
              <h4 className="font-semibold text-red-900 mb-1">Generation Error</h4>
              <p className="text-sm text-red-700">{error}</p>
              <button
                onClick={handleRetry}
                className="mt-3 px-4 py-2 bg-[rgb(255,81,1)] text-[rgb(196,230,43)] rounded-full text-sm font-bold transition-all duration-300 ease-out hover:bg-[rgb(255,100,20)] hover:scale-[1.02] active:scale-95 shadow-md hover:shadow-lg"
              >
                Retry Generation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress display */}
      {jobStatus && (
        <VideoGenerationProgress
          jobStatus={jobStatus}
          scenes={scenes}
          onCancel={isGenerating ? handleCancel : undefined}
        />
      )}

      {/* Loading state */}
      {isGenerating && !jobStatus && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mb-4" />
          <p className="text-lg font-medium">Initializing video generation...</p>
          <p className="text-sm text-muted-foreground mt-2">
            This may take a moment
          </p>
        </div>
      )}
    </div>
  );
}
