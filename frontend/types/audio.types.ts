/**
 * TypeScript types for audio generation.
 */

/**
 * Request payload for audio generation.
 */
export interface AudioGenerationRequest {
  mood_name: string;
  mood_description: string;
  emotional_tone: string[];
  aesthetic_direction: string;
  style_keywords?: string[];
  duration?: number; // Default: 30 seconds
  custom_prompt?: string; // Optional custom prompt to use instead of building from fields
}

/**
 * Response from audio generation API.
 */
export interface AudioGenerationResponse {
  success: boolean;
  audio_url: string | null;
  prompt: string;
  duration: number;
  error: string | null;
}
