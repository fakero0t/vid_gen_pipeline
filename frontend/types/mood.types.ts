/**
 * TypeScript types for mood generation and selection system.
 */

/**
 * Represents a single image in a mood board.
 */
export interface MoodImage {
  url: string;
  prompt: string;
  success: boolean;
  error?: string | null;
}

/**
 * Represents a complete mood board with images and metadata.
 */
export interface Mood {
  id: string;
  name: string;
  description: string;
  style_keywords: string[];
  color_palette: string[];
  aesthetic_direction: string;
  images: MoodImage[];
}

/**
 * Response from mood generation API.
 */
export interface MoodGenerationResponse {
  success: boolean;
  moods: Mood[];
  message?: string | null;
}

/**
 * Request payload for mood generation API.
 */
export interface MoodGenerationRequest {
  product_name: string;
  target_audience: string;
  emotional_tone: string[];
  visual_style_keywords: string[];
  key_messages: string[];
}

