import { useState, useCallback } from 'react';
import { useAppStore } from '@/store/appStore';
import { generateAudio as apiGenerateAudio } from '@/lib/api/client';
import type { AudioGenerationRequest, AudioGenerationResponse } from '@/types/audio.types';

export function useAudioGeneration() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { setAudioUrl } = useAppStore();

  /**
   * Generate background music for a mood
   */
  const generateAudio = useCallback(
    async (request: AudioGenerationRequest): Promise<string | null> => {
      setIsLoading(true);
      setError(null);

      try {
        // Call actual API endpoint
        const response = await apiGenerateAudio(request);

        if (!response.success || !response.audio_url) {
          throw new Error(response.error || 'Failed to generate audio');
        }

        // Store audio URL
        setAudioUrl(response.audio_url);

        return response.audio_url;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate audio';
        setError(message);
        console.error('Audio generation error:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [setAudioUrl]
  );

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    generateAudio,
    isLoading,
    error,
    clearError,
  };
}
