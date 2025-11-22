/**
 * React hook for background generation and state management.
 */
import { useState, useCallback } from 'react';
import { generateBackgrounds } from '@/lib/api/background';
import type { BackgroundAssetStatus, BackgroundGenerationRequest } from '@/types/background.types';
import { useAppStore } from '@/store/appStore';

interface UseBackgroundGenerationReturn {
  backgrounds: BackgroundAssetStatus[];
  selectedBackgroundIds: string[];
  isLoading: boolean;
  error: string | null;
  generateBackgroundsFromBrief: (brief: BackgroundGenerationRequest) => Promise<void>;
  selectBackgrounds: (backgroundIds: string[]) => void;
  clearError: () => void;
}

export function useBackgroundGeneration(): UseBackgroundGenerationReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Get state from Zustand store
  const backgrounds = useAppStore((state) => (state.backgroundAssets || []) as BackgroundAssetStatus[]);
  const selectedBackgroundIds = useAppStore((state) => state.selectedBackgroundIds || []);
  const setBackgroundAssets = useAppStore((state) => state.setBackgroundAssets);
  const setSelectedBackgroundIds = useAppStore((state) => state.setSelectedBackgroundIds);
  const setStoreError = useAppStore((state) => state.setError);
  
  // Use local error, fallback to store error
  const storeError = useAppStore((state) => state.error);
  const error = localError || storeError;

  const generateBackgroundsFromBrief = useCallback(
    async (brief: BackgroundGenerationRequest) => {
      setIsLoading(true);
      setLocalError(null);
      setStoreError(null);

      try {
        // Call actual API endpoint
        const response = await generateBackgrounds(brief);

        if (!response.success || !response.backgrounds) {
          throw new Error(response.message || 'Failed to generate backgrounds');
        }

        setBackgroundAssets(response.backgrounds);

        // Warn if some images failed
        const totalImages = 6;
        const successfulImages = response.backgrounds.length;

        if (successfulImages < totalImages) {
          console.warn(`${totalImages - successfulImages} background images failed to generate`);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'An unexpected error occurred';
        setLocalError(errorMessage);
        setStoreError(errorMessage);
        console.error('Background generation error:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [setBackgroundAssets, setStoreError]
  );

  const handleSelectBackgrounds = useCallback(
    (backgroundIds: string[]) => {
      setSelectedBackgroundIds(backgroundIds);
    },
    [setSelectedBackgroundIds]
  );

  const clearError = useCallback(() => {
    setLocalError(null);
    setStoreError(null);
  }, [setStoreError]);

  return {
    backgrounds,
    selectedBackgroundIds,
    isLoading,
    error,
    generateBackgroundsFromBrief,
    selectBackgrounds: handleSelectBackgrounds,
    clearError,
  };
}

