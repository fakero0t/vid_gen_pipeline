'use client';

import React, { useEffect, useState } from 'react';
import { SceneCard } from './SceneCard';
import { SceneTimeline } from './SceneTimeline';
import type { ScenePlan } from '@/types/scene.types';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

interface StoryboardProps {
  scenePlan: ScenePlan | null;
  onGenerate: () => Promise<void>;
  onContinue: () => void;
  isLoading?: boolean;
  isGeneratingImages?: boolean;
  error?: string | null;
}

export function Storyboard({
  scenePlan,
  onGenerate,
  onContinue,
  isLoading = false,
  isGeneratingImages = false,
  error,
}: StoryboardProps) {
  const [hasImages, setHasImages] = useState(false);

  // Check if all scenes have seed images
  useEffect(() => {
    // HARDCODED: Always allow continuing for testing
    setHasImages(true);
  }, [scenePlan]);

  return (
    <div className="w-full max-w-7xl space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-3xl font-bold">Scene Storyboard</h2>
        <p className="text-muted-foreground">
          {!scenePlan
            ? 'Generate a scene breakdown for your 30-second video.'
            : 'Review and refine your video scenes.'}
        </p>
      </div>

      {/* Error display */}
      {error && (
        <Alert variant="destructive">
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 mt-0.5"
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
            <div>
              <h3 className="font-semibold mb-1">Error</h3>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        </Alert>
      )}

      {/* Generate button (if no scene plan yet) */}
      {!scenePlan && !isLoading && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="text-center space-y-2 mb-4">
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
            <h3 className="text-lg font-semibold">Ready to Plan Your Scenes</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Click below to generate a 5-7 scene breakdown for your 30-second video,
              complete with descriptions and seed images.
            </p>
          </div>
          <Button onClick={onGenerate} size="lg">
            Generate Scene Plan
          </Button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">
            {isGeneratingImages ? 'Generating seed images...' : 'Creating scene breakdown...'}
          </p>
          <p className="text-sm text-muted-foreground">This may take up to a minute</p>
        </div>
      )}

      {/* Scene plan display */}
      {scenePlan && !isLoading && (
        <>
          {/* Timeline visualization */}
          <div className="bg-card border border-border rounded-lg p-6">
            <SceneTimeline scenes={scenePlan.scenes} totalDuration={scenePlan.total_duration} />
          </div>

          {/* Scene cards grid */}
          <div>
            <h3 className="text-xl font-semibold mb-4">
              Scenes ({scenePlan.scenes.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {scenePlan.scenes.map((scene) => (
                <SceneCard
                  key={scene.scene_number}
                  scene={scene}
                  isLoading={isGeneratingImages}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Button variant="outline" onClick={onGenerate} disabled={isLoading}>
              Regenerate Scenes
            </Button>
            <div className="flex items-center gap-3">
              {hasImages ? (
                <Button onClick={onContinue} size="lg">
                  Continue to Video Generation
                  <svg
                    className="w-4 h-4 ml-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Waiting for seed images to complete...
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
