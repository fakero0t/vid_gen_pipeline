/**
 * NeRF Pipeline API Client
 * 
 * This module provides API client functions for the NeRF processing pipeline,
 * including COLMAP, training, and rendering endpoints.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

import type {
  COLMAPRequest,
  COLMAPResponse,
  COLMAPStatus,
  TrainingRequest,
  TrainingResponse,
  TrainingStatus,
  RenderRequest,
  RenderResponse,
  RenderStatus,
} from '@/types/nerf.types';

/**
 * Base fetch wrapper with error handling
 */
async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `API request failed: ${response.statusText}`);
  }

  return response.json();
}

// ============================================================================
// COLMAP Endpoints
// ============================================================================

/**
 * Start COLMAP camera pose estimation
 */
export async function startCOLMAP(request: COLMAPRequest): Promise<COLMAPResponse> {
  return apiRequest<COLMAPResponse>('/api/nerf/colmap', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Get COLMAP processing status
 */
export async function getCOLMAPStatus(jobId: string): Promise<COLMAPStatus> {
  return apiRequest<COLMAPStatus>(`/api/nerf/colmap/status/${jobId}`);
}

/**
 * Retry failed COLMAP processing
 */
export async function retryCOLMAP(jobId: string, request: COLMAPRequest): Promise<COLMAPResponse> {
  return apiRequest<COLMAPResponse>(`/api/nerf/colmap/retry/${jobId}`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

// ============================================================================
// Training Endpoints
// ============================================================================

/**
 * Start NeRF training
 */
export async function startTraining(request: TrainingRequest): Promise<TrainingResponse> {
  return apiRequest<TrainingResponse>('/api/nerf/train', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Get training status
 */
export async function getTrainingStatus(jobId: string): Promise<TrainingStatus> {
  return apiRequest<TrainingStatus>(`/api/nerf/train/status/${jobId}`);
}

/**
 * Retry failed training
 */
export async function retryTraining(jobId: string, request: TrainingRequest): Promise<TrainingResponse> {
  return apiRequest<TrainingResponse>(`/api/nerf/train/retry/${jobId}`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

// ============================================================================
// Rendering Endpoints
// ============================================================================

/**
 * Start frame rendering
 */
export async function startRendering(request: RenderRequest): Promise<RenderResponse> {
  return apiRequest<RenderResponse>('/api/nerf/render', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Get rendering status
 */
export async function getRenderingStatus(jobId: string): Promise<RenderStatus> {
  return apiRequest<RenderStatus>(`/api/nerf/render/status/${jobId}`);
}

/**
 * Retry failed rendering
 */
export async function retryRendering(jobId: string, request: RenderRequest): Promise<RenderResponse> {
  return apiRequest<RenderResponse>(`/api/nerf/render/retry/${jobId}`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Get a specific rendered frame
 */
export async function getFrame(jobId: string, frameNumber: number): Promise<Blob> {
  const url = `${API_BASE_URL}/api/nerf/frames/${jobId}/${frameNumber}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch frame ${frameNumber}: ${response.statusText}`);
  }
  
  return response.blob();
}

/**
 * Export API base URL for use in other modules
 */
export { API_BASE_URL as API_URL };
