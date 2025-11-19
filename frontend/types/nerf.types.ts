/**
 * TypeScript types for NeRF pipeline
 * 
 * These types define the data structures for the NeRF processing pipeline,
 * including upload, COLMAP, training, and rendering stages.
 */

// ============================================================================
// Common Types
// ============================================================================

export type JobStatus = "idle" | "processing" | "complete" | "failed";

export type UploadStatus = "idle" | "uploading" | "validating" | "complete" | "failed";

export type COLMAPStage = "feature_extraction" | "feature_matching" | "sfm" | "complete";

export type TrainingStage = "data_preparation" | "training" | "validation" | "complete";

export type ImageStatus = "pending" | "uploading" | "valid" | "warning" | "error";

// ============================================================================
// Product Upload Types
// ============================================================================

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ProductPhoto {
  file_id: string;
  filename: string;
  file: File;
  url: string;
  size: number;
  dimensions: ImageDimensions;
  status: ImageStatus;
  upload_progress: number;
  warnings: string[];
  errors: string[];
}

export interface ValidationSummary {
  total: number;
  valid: number;
  warnings: number;
  errors: number;
}

export interface ProductPhotos {
  job_id: string | null;
  images: ProductPhoto[];
  upload_status: UploadStatus;
  upload_progress: number;
  total_size: number;
  validation_summary: ValidationSummary;
  validation_errors: string[];
  can_proceed: boolean;
}

export interface UploadResponse {
  job_id: string;
  status: UploadStatus;
  uploaded_count: number;
  total_count: number;
  validated_images: Array<{
    file_id: string;
    filename: string;
    url: string;
    size: number;
    dimensions: ImageDimensions;
    status: ImageStatus;
    warnings: string[];
    errors: string[];
  }>;
  validation_summary: ValidationSummary;
  errors: string[];
  auto_start_nerf: boolean;
}

export interface UploadStatusResponse {
  job_id: string;
  status: UploadStatus;
  progress: number;
  uploaded_count: number;
  total_count: number;
  upload_speed_mbps?: number;
  estimated_time_remaining?: number;
}

// ============================================================================
// COLMAP Types
// ============================================================================

export interface COLMAPRequest {
  job_id: string;
  image_paths?: string[]; // Optional, images already in Modal
}

export interface COLMAPResponse {
  job_id: string;
  status: JobStatus;
  stage: COLMAPStage;
  progress: number;
  estimated_time_remaining?: number;
}

export interface COLMAPStatus {
  job_id: string;
  status: JobStatus;
  stage: COLMAPStage;
  progress: number;
  current_operation: string;
  images_processed: number;
  total_images: number;
  estimated_time_remaining?: number;
  output_path?: string;
  error?: string;
}

export interface COLMAPState {
  job_id: string | null;
  status: JobStatus;
  stage: COLMAPStage;
  progress: number;
  current_operation: string;
  images_processed: number;
  total_images: number;
  estimated_time_remaining?: number;
  output_path?: string;
  error?: string;
}

// ============================================================================
// Training Types
// ============================================================================

export interface TrainingConfig {
  num_iterations?: number;
  resolution?: [number, number];
  downscale_factor?: number;
}

export interface CostBreakdown {
  colmap: number;
  training: number;
  rendering: number;
}

export interface EstimatedCost {
  total_usd: number;
  breakdown: CostBreakdown;
}

export interface ModalCallIDs {
  prepare?: string;
  train?: string;
  validation?: string;
}

export interface TrainingRequest {
  colmap_job_id: string;
  config?: TrainingConfig;
}

export interface TrainingResponse {
  job_id: string;
  modal_call_ids: ModalCallIDs;
  status: JobStatus;
  stage: TrainingStage;
  progress: number;
  estimated_time_remaining?: number;
  estimated_cost: EstimatedCost;
}

export interface StageDetail {
  status: "pending" | "in_progress" | "complete" | "failed";
  duration?: number;
}

export interface StageDetails {
  prepare: StageDetail;
  train: StageDetail;
  validation: StageDetail;
}

export interface TrainingStatus {
  job_id: string;
  modal_call_ids: ModalCallIDs;
  status: JobStatus;
  stage: TrainingStage;
  progress: number;
  stage_progress: number;
  current_iteration?: number;
  total_iterations?: number;
  loss?: number;
  psnr?: number;
  ssim?: number;
  gpu_type: string;
  estimated_time_remaining?: number;
  elapsed_time: number;
  cost_so_far: number;
  model_path?: string;
  checkpoint_paths: string[];
  error?: string;
  stage_details: StageDetails;
}

export interface NeRFTrainingState {
  job_id: string | null;
  status: JobStatus;
  progress: number;
  stage_progress: number;
  current_iteration?: number;
  total_iterations?: number;
  loss?: number;
  psnr?: number;
  ssim?: number;
  gpu_type?: string;
  estimated_time_remaining?: number;
  elapsed_time?: number;
  cost_so_far?: number;
  checkpoint_path?: string;
  stage_details?: StageDetails;
  error?: string;
}

// ============================================================================
// Rendering Types
// ============================================================================

export interface TrajectoryConfig {
  trajectory_type?: "circular_orbit";
  center?: [number, number, number];
  radius?: number;
  elevation?: number;
  start_angle?: number;
  end_angle?: number;
  num_frames?: number;
  resolution?: [number, number];
}

export interface RenderRequest {
  train_job_id: string;
  trajectory_config?: TrajectoryConfig;
}

export interface RenderResponse {
  job_id: string;
  modal_call_id: string;
  status: JobStatus;
  progress: number;
  frames_rendered: number;
  total_frames: number;
  current_batch: number;
  total_batches: number;
  gpu_type: string;
  estimated_time_remaining?: number;
}

export interface RenderStatus {
  job_id: string;
  modal_call_id: string;
  status: JobStatus;
  progress: number;
  frames_rendered: number;
  total_frames: number;
  current_batch: number;
  total_batches: number;
  current_frame: number;
  rendering_speed?: number;
  gpu_type: string;
  estimated_time_remaining?: number;
  volume_path?: string;
  local_path?: string;
  frames_available: number;
  error?: string;
}

export interface RenderingState {
  job_id: string | null;
  status: JobStatus;
  progress: number;
  frames_rendered: number;
  total_frames: number;
  current_frame: number;
  current_batch: number;
  total_batches: number;
  rendering_speed?: number;
  estimated_time_remaining?: number;
  output_directory?: string;
  sample_frames: string[];
  error?: string;
}

// ============================================================================
// Complete NeRF Pipeline State
// ============================================================================

export interface NeRFState {
  // Overall pipeline state
  status: JobStatus;
  overall_progress: number;
  
  // Sub-stage states
  colmap: COLMAPState | null;
  training: NeRFTrainingState | null;
  rendering: RenderingState | null;
  
  // Final output
  product_frames: string[];
  frame_count: number;
  
  // Metadata
  total_processing_time?: number;
  started_at?: string;
  completed_at?: string;
  
  // Error handling
  error_message?: string;
  failed_stage?: "colmap" | "training" | "rendering" | null;
}

