import { useState, useCallback } from 'react';
import { useAppStore } from '@/store/appStore';
import type { AudioGenerationRequest, AudioGenerationResponse } from '@/types/audio.types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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
        // HARDCODED for testing
        const hardcodedAudioUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Store audio URL
        setAudioUrl(hardcodedAudioUrl);

        return hardcodedAudioUrl;
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
