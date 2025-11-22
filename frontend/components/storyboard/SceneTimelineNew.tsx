'use client';

import React from 'react';
import type { StoryboardScene, SceneState, GenerationStatus } from '@/types/storyboard.types';

interface SceneTimelineNewProps {
  scenes: StoryboardScene[];
  sceneOrder: string[];
  currentSceneIndex: number;
  onSceneClick: (index: number) => void;
}

// Color coding based on PRD specifications
const getSceneColor = (state: SceneState, generationStatus: GenerationStatus | undefined, hasError: boolean): string => {
  if (hasError) {
    return 'hsl(0, 70%, 50%)'; // Red for errors
  }

  switch (state) {
    case 'text':
      return 'hsl(220, 10%, 40%)'; // Gray
    case 'image':
      return 'hsl(45, 90%, 60%)'; // Yellow
    case 'video':
      return 'hsl(140, 70%, 50%)'; // Green
    default:
      return 'hsl(220, 10%, 40%)'; // Default gray
  }
};

const getSceneLabel = (state: SceneState): string => {
  switch (state) {
    case 'text':
      return 'Text';
    case 'image':
      return 'Image';
    case 'video':
      return 'Video';
    default:
      return 'Unknown';
  }
};

const isGenerating = (scene: StoryboardScene): boolean => {
  return (
    scene.generation_status.image === 'generating' ||
    scene.generation_status.video === 'generating'
  );
};

export function SceneTimelineNew({
  scenes,
  sceneOrder,
  currentSceneIndex,
  onSceneClick,
}: SceneTimelineNewProps) {
  return (
    <div className="w-full">
      {/* Compact horizontal timeline - just scene numbers */}
      <div className="flex items-center gap-1.5">
        {sceneOrder.map((sceneId, index) => {
          const scene = scenes.find(s => s.id === sceneId);
          if (!scene) return null;

          const hasError = scene.error_message !== null && scene.error_message !== undefined;
          const color = getSceneColor(
            scene.state,
            scene.state === 'image' ? scene.generation_status.image : scene.generation_status.video,
            hasError
          );
          const isActive = index === currentSceneIndex;
          const isSceneGenerating = isGenerating(scene);

          return (
            <button
              key={scene.id}
              onClick={() => onSceneClick(index)}
              className={`
                w-8 h-8 rounded-md border-2 transition-all duration-200 flex items-center justify-center
                hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
                ${isActive ? 'border-primary shadow-md scale-110 ring-2 ring-primary/20' : 'border-transparent'}
                ${isSceneGenerating ? 'animate-pulse' : ''}
              `}
              style={{ backgroundColor: color }}
              aria-label={`Scene ${index + 1}: ${getSceneLabel(scene.state)} state${isActive ? ' (current)' : ''}`}
              aria-current={isActive ? 'true' : undefined}
              title={`Scene ${index + 1}: ${getSceneLabel(scene.state)}${hasError ? ' (Error)' : ''}`}
            >
              {/* Scene number - compact */}
              <span className="text-xs font-bold text-white drop-shadow-sm">
                {index + 1}
              </span>
              
              {/* Error indicator - small dot */}
              {hasError && !isSceneGenerating && (
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border border-white" />
              )}
              
              {/* Generating indicator - small spinner */}
              {isSceneGenerating && (
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 border border-white border-t-transparent rounded-full animate-spin" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
