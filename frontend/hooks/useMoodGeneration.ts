/**
 * React hook for mood generation and state management.
 */
import { useState, useCallback } from 'react';
import { generateMoods } from '@/lib/api/client';
import type { Mood, MoodGenerationRequest } from '@/types/mood.types';
import { useAppStore } from '@/store/appStore';

interface UseMoodGenerationReturn {
  moods: Mood[];
  selectedMoodId: string | null;
  isLoading: boolean;
  error: string | null;
  generateMoodsFromBrief: (brief: MoodGenerationRequest) => Promise<void>;
  selectMood: (moodId: string) => void;
  clearError: () => void;
}

export function useMoodGeneration(): UseMoodGenerationReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Get state from Zustand store
  const moods = useAppStore((state) => state.moods as Mood[]);
  const selectedMoodId = useAppStore((state) => state.selectedMoodId);
  const setMoods = useAppStore((state) => state.setMoods);
  const selectMood = useAppStore((state) => state.selectMood);
  const setStoreError = useAppStore((state) => state.setError);
  
  // Use local error, fallback to store error
  const storeError = useAppStore((state) => state.error);
  const error = localError || storeError;

  const generateMoodsFromBrief = useCallback(
    async (brief: MoodGenerationRequest) => {
      setIsLoading(true);
      setLocalError(null);
      setStoreError(null);

      try {
        // HARDCODED for testing
        const hardcodedMoods: Mood[] = [
          {
            id: "mood-1",
            name: "Epic Adventure",
            description: "Dramatic mountain landscapes with golden hour lighting",
            aesthetic_direction: "Dramatic mountain landscapes with golden hour lighting",
            style_keywords: ["cinematic", "epic", "dramatic", "golden-hour"],
            color_palette: ["#FF6B35", "#F7931E", "#FDC830", "#4ECDC4"],
            images: [
              { url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4", prompt: "Mountain landscape", success: true },
              { url: "https://images.unsplash.com/photo-1454496522488-7a8e488e8606", prompt: "Epic sunset", success: true },
              { url: "https://images.unsplash.com/photo-1519904981063-b0cf448d479e", prompt: "Peak view", success: true },
              { url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4", prompt: "Alpine vista", success: true }
            ]
          },
          {
            id: "mood-2",
            name: "Serene Journey",
            description: "Calm misty peaks with soft blue tones",
            aesthetic_direction: "Calm misty peaks with soft blue tones",
            style_keywords: ["peaceful", "misty", "ethereal", "blue-hour"],
            color_palette: ["#3E5C76", "#748CAB", "#A7C4C2", "#E8F1F5"],
            images: [
              { url: "https://images.unsplash.com/photo-1519904981063-b0cf448d479e", prompt: "Misty peak", success: true },
              { url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4", prompt: "Calm mountain", success: true },
              { url: "https://images.unsplash.com/photo-1454496522488-7a8e488e8606", prompt: "Serene view", success: true },
              { url: "https://images.unsplash.com/photo-1519904981063-b0cf448d479e", prompt: "Peaceful landscape", success: true }
            ]
          },
          {
            id: "mood-3",
            name: "Bold Exploration",
            description: "Vibrant sunset colors over rugged terrain",
            aesthetic_direction: "Vibrant sunset colors over rugged terrain",
            style_keywords: ["vibrant", "bold", "sunset", "adventure"],
            color_palette: ["#E63946", "#F77F00", "#FCBF49", "#06A77D"],
            images: [
              { url: "https://images.unsplash.com/photo-1454496522488-7a8e488e8606", prompt: "Vibrant sunset", success: true },
              { url: "https://images.unsplash.com/photo-1519904981063-b0cf448d479e", prompt: "Bold landscape", success: true },
              { url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4", prompt: "Rugged terrain", success: true },
              { url: "https://images.unsplash.com/photo-1454496522488-7a8e488e8606", prompt: "Adventure scene", success: true }
            ]
          },
          {
            id: "mood-4",
            name: "Mystical Heights",
            description: "Dark moody mountains with dramatic clouds",
            aesthetic_direction: "Dark moody mountains with dramatic clouds",
            style_keywords: ["mysterious", "dark", "moody", "atmospheric"],
            color_palette: ["#2D3142", "#4F5D75", "#BFC0C0", "#FFFFFF"],
            images: [
              { url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4", prompt: "Moody mountain", success: true },
              { url: "https://images.unsplash.com/photo-1454496522488-7a8e488e8606", prompt: "Dramatic clouds", success: true },
              { url: "https://images.unsplash.com/photo-1519904981063-b0cf448d479e", prompt: "Dark peaks", success: true },
              { url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4", prompt: "Atmospheric view", success: true }
            ]
          },
          {
            id: "mood-5",
            name: "Energetic Summit",
            description: "Bright daylight with high contrast and clear skies",
            aesthetic_direction: "Bright daylight with high contrast and clear skies",
            style_keywords: ["energetic", "bright", "clear", "dynamic"],
            color_palette: ["#0077B6", "#00B4D8", "#90E0EF", "#CAF0F8"],
            images: [
              { url: "https://images.unsplash.com/photo-1519904981063-b0cf448d479e", prompt: "Bright summit", success: true },
              { url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4", prompt: "Clear skies", success: true },
              { url: "https://images.unsplash.com/photo-1454496522488-7a8e488e8606", prompt: "Dynamic peak", success: true },
              { url: "https://images.unsplash.com/photo-1519904981063-b0cf448d479e", prompt: "High contrast", success: true }
            ]
          },
          {
            id: "mood-6",
            name: "Warm Wanderlust",
            description: "Warm earth tones with afternoon light",
            aesthetic_direction: "Warm earth tones with afternoon light",
            style_keywords: ["warm", "earthy", "natural", "inviting"],
            color_palette: ["#8B4513", "#D2691E", "#F4A460", "#FFDAB9"],
            images: [
              { url: "https://images.unsplash.com/photo-1454496522488-7a8e488e8606", prompt: "Warm landscape", success: true },
              { url: "https://images.unsplash.com/photo-1519904981063-b0cf448d479e", prompt: "Earth tones", success: true },
              { url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4", prompt: "Afternoon light", success: true },
              { url: "https://images.unsplash.com/photo-1454496522488-7a8e488e8606", prompt: "Natural beauty", success: true }
            ]
          }
        ];
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        setMoods(hardcodedMoods);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'An unexpected error occurred';
        setLocalError(errorMessage);
        setStoreError(errorMessage);
        console.error('Mood generation error:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [setMoods, setStoreError]
  );

  const handleSelectMood = useCallback(
    (moodId: string) => {
      selectMood(moodId);
    },
    [selectMood]
  );

  const clearError = useCallback(() => {
    setLocalError(null);
    setStoreError(null);
  }, [setStoreError]);

  return {
    moods,
    selectedMoodId,
    isLoading,
    error,
    generateMoodsFromBrief,
    selectMood: handleSelectMood,
    clearError,
  };
}

