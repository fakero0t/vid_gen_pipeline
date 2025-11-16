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
        const response = await generateMoods(brief);

        if (response.success && response.moods) {
          setMoods(response.moods);
        } else {
          throw new Error(response.message || 'Failed to generate moods');
        }
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

