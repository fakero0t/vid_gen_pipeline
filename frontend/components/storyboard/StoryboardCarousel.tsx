'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { Storyboard, StoryboardScene } from '@/types/storyboard.types';
import { Button } from '@/components/ui/button';
import { SceneTimelineNew } from './SceneTimelineNew';
import { SceneCardNew } from './SceneCardNew';

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
  // Final video generation props
  allScenesReady?: boolean;
  readyCount?: number;
  totalScenes?: number;
  // Footer action props
  totalVideoDuration?: number;
  isRegeneratingAll?: boolean;
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
  allScenesReady = false,
  readyCount = 0,
  totalScenes = 0,
  totalVideoDuration = 0,
  isRegeneratingAll = false,
}: StoryboardCarouselProps) {
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [currentSceneId, setCurrentSceneId] = useState<string | null>(null);


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

  // Note: allScenesReady, readyCount, and totalScenes are passed as props from parent

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



  if (!currentScene) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">No scene found</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col w-full px-4 sm:px-6">
      {/* Top bar with timeline - compact */}
      <div className="flex-shrink-0 py-2">
        <div className="flex items-center justify-between gap-4">
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
        </div>
      </div>

      {/* Carousel Container - fills remaining space */}
      <div className="flex-1 min-h-0 overflow-hidden py-2">
        <div className="h-full relative">
          <div
            className="flex h-full transition-transform duration-300 ease-in-out"
            style={{ transform: `translateX(-${currentSceneIndex * 100}%)` }}
          >
            {storyboard.scene_order.map((sceneId, index) => {
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
                      sceneNumber={index + 1}
                      onApproveText={() => onApproveText(scene.id)}
                      onRegenerateText={() => onRegenerateText(scene.id)}
                      onEditText={(newText) => onEditText(scene.id, newText)}
                      onApproveImage={() => onApproveImage(scene.id)}
                      onRegenerateImage={() => onRegenerateImage(scene.id)}
                      onUpdateDuration={(newDuration) => onUpdateDuration(scene.id, newDuration)}
                      onRegenerateVideo={() => onRegenerateVideo(scene.id)}
                      isLoading={isLoading}
                      isActive={index === currentSceneIndex}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom bar: duration/actions on left, scenes ready and generate final video on right */}
      <div className="flex-shrink-0 py-2 flex items-center justify-between gap-4">
        {/* Left side: duration, regenerate all, preview */}
        <div className="flex items-center gap-4">
          {/* Total video length display */}
          {totalVideoDuration > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 border border-border">
              <svg className="w-3 h-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span className="text-xs font-semibold text-foreground tabular-nums">
                {totalVideoDuration.toFixed(1)}s
              </span>
            </div>
          )}
          
          {onRegenerateAll && (
            <Button
              size="sm"
              variant="outline"
              onClick={onRegenerateAll}
              disabled={isRegeneratingAll || isLoading}
              className="h-7 text-xs px-2 border-[rgb(255,81,1)] text-[rgb(255,81,1)] hover:bg-[rgb(255,81,1)]/10"
            >
              {isRegeneratingAll ? (
                <div className="w-3 h-3 border-2 border-[rgb(255,81,1)] border-t-transparent rounded-full animate-spin mr-1" />
              ) : (
                <svg className="w-3 h-3 mr-1 text-[rgb(255,81,1)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              Regenerate All
            </Button>
          )}
          
          {onPreviewAll && (
            <Button
              size="sm"
              variant="default"
              onClick={onPreviewAll}
              disabled={isRegeneratingAll || isLoading || scenes.length === 0}
              className="h-7 text-xs px-2 bg-[rgb(255,81,1)] text-[rgb(196,230,43)] hover:bg-[rgb(255,100,20)]"
            >
              <svg className="w-3 h-3 mr-1 text-[rgb(196,230,43)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Preview
            </Button>
          )}
        </div>
        
        {/* Right side: scenes ready and generate final video */}
        {allScenesReady && (
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground">
              {readyCount}/{totalScenes} scenes ready
            </span>
            <Button
              size="lg"
              onClick={onGenerateFinalVideo}
              disabled={!allScenesReady || isLoading}
              className="h-10 text-sm px-6 bg-[rgb(255,81,1)] text-[rgb(196,230,43)] hover:bg-[rgb(255,100,20)] font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Render Video
              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Button>
          </div>
        )}
      </div>

    </div>
  );
}
