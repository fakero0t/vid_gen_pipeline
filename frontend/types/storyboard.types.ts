/**
 * TypeScript types for the Unified Storyboard Interface.
 * Based on PRD data models for storyboard and scene persistence.
 */

import type { CreativeBriefInput, Mood } from './mood.types';

/**
 * Scene state types
 */
export type SceneState = 'text' | 'image' | 'video';

/**
 * Generation status for images and videos
 */
export type GenerationStatus = 'pending' | 'generating' | 'complete' | 'error';

/**
 * Scene generation status object
 */
export interface SceneGenerationStatus {
  image?: GenerationStatus;
  video?: GenerationStatus;
}

/**
 * Scene model with UUID and state-based workflow
 */
export interface StoryboardScene {
  id: string; // UUID (backend-generated)
  storyboard_id: string; // Foreign key
  state: SceneState;
  text: string;
  style_prompt: string;
  image_url?: string | null;
  seed_image_urls?: string[] | null;
  video_url?: string | null;
  video_duration: number; // Default 5 seconds
  generation_status: SceneGenerationStatus;
  error_message?: string | null;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
  
  // Product compositing (for product mode)
  use_product_composite?: boolean;
  product_id?: string | null;
}

/**
 * Storyboard model
 */
export interface Storyboard {
  storyboard_id: string; // UUID
  session_id: string; // From auth layer
  user_id: string; // From auth layer
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
  scene_order: string[]; // Array of scene IDs (UUIDs)
  creative_brief: CreativeBriefInput; // From previous step
  selected_mood: Mood; // From previous step
}

/**
 * Request payload for storyboard initialization
 */
export interface StoryboardInitializeRequest {
  creative_brief: CreativeBriefInput;
  selected_mood: Mood;
}

/**
 * Response from storyboard initialization
 */
export interface StoryboardInitializeResponse {
  success: boolean;
  storyboard: Storyboard;
  scenes: StoryboardScene[];
  message?: string | null;
}

/**
 * Request payload for text update/regeneration
 */
export interface SceneTextUpdateRequest {
  scene_id: string;
  new_text: string;
}

/**
 * Request payload for AI text generation
 */
export interface SceneTextGenerateRequest {
  scene_id: string;
  creative_brief: CreativeBriefInput;
}

/**
 * Request payload for image generation
 */
export interface SceneImageGenerateRequest {
  scene_id: string;
}

/**
 * Request payload for duration update
 */
export interface SceneDurationUpdateRequest {
  scene_id: string;
  new_duration: number; // 1-10 seconds
}

/**
 * Request payload for video generation
 */
export interface SceneVideoGenerateRequest {
  scene_id: string;
}

/**
 * Response from async video generation
 */
export interface SceneVideoGenerateResponse {
  success: boolean;
  job_id: string;
  scene_id: string;
  message?: string | null;
}

/**
 * Scene status response
 */
export interface SceneStatusResponse {
  scene_id: string;
  state: SceneState;
  generation_status: SceneGenerationStatus;
  error_message?: string | null;
}

/**
 * Preview data for concatenated video playback
 */
export interface PreviewData {
  scene_id: string;
  type: 'video' | 'image' | 'text';
  url?: string | null;
  text?: string | null;
  duration: number;
}

/**
 * Storyboard preview response
 */
export interface StoryboardPreviewResponse {
  success: boolean;
  preview_data: PreviewData[];
  total_duration: number;
}

/**
 * Server-Sent Event types
 */
export type SSEEventType = 'scene_update' | 'error' | 'complete';

/**
 * SSE Event data
 */
export interface SSESceneUpdate {
  scene_id: string;
  state: SceneState;
  image_status: GenerationStatus;
  video_status: GenerationStatus;
  progress_percent?: number;
  video_url?: string | null;
  image_url?: string | null;
  error?: string | null;
}

/**
 * SSE Event
 */
export interface SSEEvent {
  type: SSEEventType;
  data: SSESceneUpdate | { error: string } | { message: string };
}
