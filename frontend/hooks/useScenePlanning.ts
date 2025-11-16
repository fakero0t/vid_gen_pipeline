/**
 * Hook for managing scene planning and seed image generation.
 */
import { useState } from 'react';
import type {
  ScenePlanRequest,
  ScenePlanResponse,
  SeedImageRequest,
  SeedImageResponse,
  ScenePlan,
  Scene,
} from '@/types/scene.types';

interface UseScenePlanningReturn {
  scenePlan: ScenePlan | null;
  isLoading: boolean;
  error: string | null;
  generateScenePlan: (request: ScenePlanRequest) => Promise<ScenePlan | null>;
  generateSeedImages: (
    scenes: Scene[],
    moodStyleKeywords: string[],
    moodColorPalette: string[],
    moodAestheticDirection: string
  ) => Promise<Scene[] | null>;
  clearError: () => void;
}

export function useScenePlanning(): UseScenePlanningReturn {
  const [scenePlan, setScenePlan] = useState<ScenePlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  const generateScenePlan = async (
    request: ScenePlanRequest
  ): Promise<ScenePlan | null> => {
    setIsLoading(true);
    setError(null);

    try {
      // HARDCODED for testing
      const hardcodedScenePlan: ScenePlan = {
        total_duration: 30,
        scenes: [
          {
            scene_number: 1,
            duration: 5,
            description: "Wide shot of majestic mountain peaks at sunrise",
            style_prompt: "cinematic wide angle shot, dramatic mountain peaks, golden sunrise light, epic scale",
            seed_image_url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
            generation_success: true
          },
          {
            scene_number: 2,
            duration: 5,
            description: "Adventurer hiking up rocky terrain",
            style_prompt: "dynamic action shot, person hiking steep mountain trail, determined movement, adventure spirit",
            seed_image_url: "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=800",
            generation_success: true
          },
          {
            scene_number: 3,
            duration: 5,
            description: "Close-up of hiking boots on rugged path",
            style_prompt: "detail shot, hiking boots on rocky mountain path, texture and determination, ground perspective",
            seed_image_url: "https://images.unsplash.com/photo-1519904981063-b0cf448d479e?w=800",
            generation_success: true
          },
          {
            scene_number: 4,
            duration: 5,
            description: "Panoramic view from mountain ridge",
            style_prompt: "sweeping panoramic landscape, mountain ridge vista, vast wilderness, freedom and achievement",
            seed_image_url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
            generation_success: true
          },
          {
            scene_number: 5,
            duration: 5,
            description: "Silhouette of adventurer at summit",
            style_prompt: "hero shot silhouette, person standing at mountain summit, triumphant pose, golden hour backlight",
            seed_image_url: "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=800",
            generation_success: true
          },
          {
            scene_number: 6,
            duration: 5,
            description: "Sunset over mountain range finale",
            style_prompt: "epic closing shot, vibrant sunset over mountain range, dramatic clouds, inspirational mood",
            seed_image_url: "https://images.unsplash.com/photo-1519904981063-b0cf448d479e?w=800",
            generation_success: true
          }
        ]
      };

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setScenePlan(hardcodedScenePlan);
      return hardcodedScenePlan;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Scene plan generation error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const generateSeedImages = async (
    scenes: Scene[],
    moodStyleKeywords: string[],
    moodColorPalette: string[],
    moodAestheticDirection: string
  ): Promise<Scene[] | null> => {
    setIsLoading(true);
    setError(null);

    try {
      // HARDCODED for testing - images already included in scene plan
      // Just return the scenes as-is since they already have seed images
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));

      // Update scene plan with seed images (already present)
      if (scenePlan) {
        const updatedScenePlan = {
          ...scenePlan,
          scenes: scenes,
        };
        setScenePlan(updatedScenePlan);
      }

      return scenes;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Seed image generation error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    scenePlan,
    isLoading,
    error,
    generateScenePlan,
    generateSeedImages,
    clearError,
  };
}
