/**
 * TypeScript types for background assets and generation.
 */

import type { AssetStatus } from './asset.types';

/**
 * Background asset status (uses generic asset status)
 */
export type BackgroundAssetStatus = AssetStatus;

/**
 * Request model for generating background images from creative brief.
 */
export interface BackgroundGenerationRequest {
  product_name: string;
  target_audience: string;
  emotional_tone: string[];
  visual_style_keywords: string[];
  key_messages: string[];
}

/**
 * Response model for background generation.
 */
export interface BackgroundGenerationResponse {
  success: boolean;
  backgrounds: BackgroundAssetStatus[];
  message?: string | null;
}

