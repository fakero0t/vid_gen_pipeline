/**
 * TypeScript types for video composition.
 */

/**
 * Composition job status.
 */
export type CompositionStatus =
  | 'pending'
  | 'downloading'
  | 'composing'
  | 'optimizing'
  | 'completed'
  | 'failed';

/**
 * Video clip input for composition.
 */
export interface VideoClipInput {
  scene_number: number;
  video_url: string;
  duration: number;
  trim_start_time?: number;
  trim_end_time?: number;
}

/**
 * Request payload for video composition.
 */
export interface CompositionRequest {
  clips: VideoClipInput[];
  audio_url?: string | null;
  include_crossfade?: boolean; // Default: true
  optimize_size?: boolean; // Default: true
  target_size_mb?: number; // Default: 50
}

/**
 * Response from composition initiation API.
 */
export interface CompositionResponse {
  success: boolean;
  job_id: string;
  message: string;
  total_clips: number;
}

/**
 * Composition job status.
 */
export interface CompositionJobStatus {
  job_id: string;
  status: CompositionStatus;
  progress_percent: number;
  total_clips: number;
  current_step: string | null;
  video_url: string | null;
  file_size_mb: number | null;
  duration_seconds: number | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Response from composition status polling API.
 */
export interface CompositionJobStatusResponse {
  success: boolean;
  job_status: CompositionJobStatus | null;
  message?: string;
}
