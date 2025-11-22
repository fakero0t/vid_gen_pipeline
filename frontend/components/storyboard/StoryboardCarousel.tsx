'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { Storyboard, StoryboardScene } from '@/types/storyboard.types';
import { Button } from '@/components/ui/button';
import { SceneTimelineNew } from './SceneTimelineNew';
import { SceneCardNew } from './SceneCardNew';
import { useAppStore } from '@/store/appStore';
import { useAudioGeneration } from '@/hooks/useAudioGeneration';
import type { AudioGenerationRequest } from '@/types/audio.types';

interface StoryboardCarouselProps {
  storyboard: Storyboard;
  scenes: StoryboardScene[];
  onRegenerateAll: () => Promise<void>;
  onPreviewAll: () => void;
  onGenerateFinalVideo: () => void;
  // Scene actions
  onApproveText: (sceneId: string) => Promise<void>;
  onRegenerateText: (sceneId: string) => Promise<void>;
  onEditText: (sceneId: string, newText: string) => Promise<void>;
  onApproveImage: (sceneId: string) => Promise<void>;
  onRegenerateImage: (sceneId: string) => Promise<void>;
  onUpdateDuration: (sceneId: string, newDuration: number) => Promise<void>;
  onRegenerateVideo: (sceneId: string) => Promise<void>;
  // Scene management actions
  onAddScene?: () => Promise<void>;
  onRemoveScene?: (sceneId: string) => Promise<void>;
  onReorderScenes?: (newOrder: string[]) => Promise<void>;
  isLoading?: boolean;
}

export function StoryboardCarousel({
  storyboard,
  scenes,
  onRegenerateAll,
  onPreviewAll,
  onGenerateFinalVideo,
  onApproveText,
  onRegenerateText,
  onEditText,
  onApproveImage,
  onRegenerateImage,
  onUpdateDuration,
  onRegenerateVideo,
  onAddScene,
  onRemoveScene,
  onReorderScenes,
  isLoading = false,
}: StoryboardCarouselProps) {
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [currentSceneId, setCurrentSceneId] = useState<string | null>(null);

  // Get audio URL and mood data from app store
  const { audioUrl, creativeBrief, moods, selectedMoodId } = useAppStore();
  
  // Audio generation hook
  const { generateAudio, isLoading: isGeneratingAudio, error: audioError } = useAudioGeneration();

  // Audio ref to stop playback when switching projects
  const audioRef = useRef<HTMLAudioElement>(null);

  // Stop audio when audioUrl changes or component unmounts
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      // Stop and reset audio when audioUrl changes
      audio.pause();
      audio.currentTime = 0;
    }
    
    // Cleanup: stop audio when component unmounts
    return () => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    };
  }, [audioUrl]);

  // Initialize current scene ID on mount
  useEffect(() => {
    if (storyboard.scene_order.length > 0 && !currentSceneId) {
      const initialSceneId = storyboard.scene_order[currentSceneIndex];
      setCurrentSceneId(initialSceneId);
    }
  }, [storyboard.scene_order, currentSceneIndex, currentSceneId]);

  // Track current scene by ID and adjust index when scenes change
  useEffect(() => {
    if (storyboard.scene_order.length > 0) {
      if (currentSceneId) {
        const newIndex = storyboard.scene_order.indexOf(currentSceneId);
        if (newIndex !== -1 && newIndex !== currentSceneIndex) {
          setCurrentSceneIndex(newIndex);
        } else if (newIndex === -1) {
          // Current scene was deleted, stay on same position (scene 5 becomes scene 4)
          const adjustedIndex = Math.min(currentSceneIndex, storyboard.scene_order.length - 1);
          if (adjustedIndex >= 0 && adjustedIndex < storyboard.scene_order.length) {
            setCurrentSceneIndex(adjustedIndex);
            setCurrentSceneId(storyboard.scene_order[adjustedIndex]);
          }
        }
      } else {
        // No current scene ID set, use current index
        if (currentSceneIndex >= 0 && currentSceneIndex < storyboard.scene_order.length) {
          setCurrentSceneId(storyboard.scene_order[currentSceneIndex]);
        }
      }
    }
  }, [storyboard.scene_order, currentSceneId, currentSceneIndex]);

  // Get current scene based on scene_order
  const currentSceneIdFromOrder = storyboard.scene_order[currentSceneIndex];
  const currentScene = scenes.find(s => s.id === currentSceneIdFromOrder);
  
  // Check if any scene is generating
  const isAnySceneGenerating = scenes.some(
    (scene) =>
      scene.generation_status.image === 'generating' ||
      scene.generation_status.video === 'generating'
  );

  // Calculate readiness for final video generation
  const allScenesReady = scenes.every(scene => scene.state === 'video' && scene.generation_status.video === 'complete');
  const readyCount = scenes.filter(scene => scene.state === 'video' && scene.generation_status.video === 'complete').length;
  const totalScenes = scenes.length;

  // Handle timeline click to navigate to scene
  const handleTimelineClick = (index: number) => {
    if (index >= 0 && index < storyboard.scene_order.length) {
      setCurrentSceneIndex(index);
      setCurrentSceneId(storyboard.scene_order[index]);
    }
  };

  // Handle add scene
  const handleAddScene = async () => {
    if (onAddScene) {
      try {
        await onAddScene();
        // New scene will be added at the end, navigate to it after state updates
        // The useEffect will handle the navigation when storyboard.scene_order updates
      } catch (error) {
        console.error('Failed to add scene:', error);
      }
    }
  };

  // Handle remove scene
  const handleRemoveScene = async (sceneId: string) => {
    if (onRemoveScene) {
      try {
        await onRemoveScene(sceneId);
        // Index adjustment is handled by useEffect above
      } catch (error) {
        console.error('Failed to remove scene:', error);
      }
    }
  };

  // Handle reorder scenes
  const handleReorderScenes = async (newOrder: string[]) => {
    if (onReorderScenes) {
      try {
        await onReorderScenes(newOrder);
        // Index adjustment is handled by useEffect above
      } catch (error) {
        console.error('Failed to reorder scenes:', error);
      }
    }
  };


  // Handle regenerate audio
  const handleRegenerateAudio = async () => {
    if (!creativeBrief || !selectedMoodId || !moods.length) {
      console.error('Missing required data for audio generation');
      return;
    }

    // Find mood - check both id and mood_id for compatibility
    const selectedMood = moods.find((m) => (m as any).mood_id === selectedMoodId || m.id === selectedMoodId);
    if (!selectedMood) {
      console.error('Selected mood not found');
      return;
    }

    // Use style_name if available, otherwise use name
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

  if (!currentScene) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">No scene found</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col w-full px-4 sm:px-6">
      {/* Top bar with timeline, audio - compact */}
      <div className="flex-shrink-0 py-2 border-b border-border">
        <div className="flex items-center justify-between gap-3">
          {/* Compact Timeline */}
          <div className="flex-shrink-0">
            <SceneTimelineNew
              scenes={scenes}
              sceneOrder={storyboard.scene_order}
              currentSceneIndex={currentSceneIndex}
              onSceneClick={handleTimelineClick}
              onAddScene={onAddScene ? handleAddScene : undefined}
              onRemoveScene={onRemoveScene ? handleRemoveScene : undefined}
              onReorderScenes={onReorderScenes ? handleReorderScenes : undefined}
              isGenerating={isAnySceneGenerating}
            />
          </div>

          {/* Compact audio */}
          {/* Compact Audio Component */}
          <div className="flex-1 min-w-0">
            {audioUrl ? (
              <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-md px-3 py-1.5">
                <span className="text-green-600 dark:text-green-400 text-xs">✓</span>
                <audio
                  ref={audioRef}
                  controls
                  src={audioUrl}
                  className="flex-1 h-7"
                  preload="metadata"
                  style={{ accentColor: '#22c55e' }}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={handleRegenerateAudio}
                  disabled={isGeneratingAudio || isLoading || !creativeBrief || !selectedMoodId}
                  title="Regenerate audio"
                >
                  {isGeneratingAudio ? (
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-muted/50 border border-border rounded-md px-3 py-1.5">
                {isGeneratingAudio ? (
                  <>
                    <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-muted-foreground">Generating audio...</span>
                  </>
                ) : (
                  <>
                    <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full" />
                    <span className="text-xs text-muted-foreground">No audio</span>
                  </>
                )}
                {!isGeneratingAudio && creativeBrief && selectedMoodId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs ml-auto"
                    onClick={handleRegenerateAudio}
                    disabled={isLoading}
                  >
                    Generate
                  </Button>
                )}
              </div>
            )}
            {audioError && (
              <div className="text-xs text-destructive mt-1">{audioError}</div>
            )}
          </div>

        </div>
      </div>

      {/* Carousel Container - fills remaining space */}
      <div className="flex-1 min-h-0 overflow-hidden py-2">
        <div className="h-full relative">
          <div
            className="flex h-full transition-transform duration-300 ease-in-out"
            style={{ transform: `translateX(-${currentSceneIndex * 100}%)` }}
          >
            {storyboard.scene_order.map((sceneId) => {
              const scene = scenes.find(s => s.id === sceneId);
              if (!scene) return null;

              // Show placeholder for generating scenes (newly added)
              const isGeneratingScene = scene.text === 'Generating...' && 
                (scene.generation_status.image === 'generating' || scene.id.startsWith('temp-'));

              return (
                <div
                  key={scene.id}
                  className="w-full h-full flex-shrink-0"
                  style={{ minWidth: '100%' }}
                >
                  {isGeneratingScene ? (
                    <div className="w-full h-full flex items-center justify-center bg-card border border-border rounded-lg p-8">
                      <div className="text-center space-y-4">
                        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                        <p className="text-muted-foreground">Generating scene...</p>
                      </div>
                    </div>
                  ) : (
                    <SceneCardNew
                      scene={scene}
                      sceneNumber={storyboard.scene_order.indexOf(scene.id) + 1}
                      onApproveText={() => onApproveText(scene.id)}
                      onRegenerateText={() => onRegenerateText(scene.id)}
                      onEditText={(newText) => onEditText(scene.id, newText)}
                      onApproveImage={() => onApproveImage(scene.id)}
                      onRegenerateImage={() => onRegenerateImage(scene.id)}
                      onUpdateDuration={(newDuration) => onUpdateDuration(scene.id, newDuration)}
                      onRegenerateVideo={() => onRegenerateVideo(scene.id)}
                      isLoading={isLoading}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Generate Final Video Button - compact footer */}
      {allScenesReady && (
        <div className="flex-shrink-0 flex items-center justify-center gap-3 py-3 border-t border-border">
          <span className="text-xs text-muted-foreground">
            {readyCount}/{totalScenes} scenes ready
          </span>
          <Button
            size="sm"
            onClick={onGenerateFinalVideo}
            disabled={!allScenesReady || isLoading}
          >
            Generate Final Video
            <svg className="w-3.5 h-3.5 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Button>
        </div>
      )}

    </div>
  );
}
