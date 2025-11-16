/**
 * API Client for FastAPI Backend
 * 
 * This module provides typed API client functions for communicating
 * with the FastAPI backend at localhost:8000.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `API request failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Health check endpoint
 */
export async function checkHealth(): Promise<{ status: string }> {
  return apiRequest<{ status: string }>('/health');
}

import type { MoodGenerationRequest, MoodGenerationResponse } from '@/types/mood.types';

/**
 * Generate mood boards from a creative brief
 */
export async function generateMoods(
  creativeBrief: MoodGenerationRequest
): Promise<MoodGenerationResponse> {
  return apiRequest<MoodGenerationResponse>('/api/moods/generate', {
    method: 'POST',
    body: JSON.stringify(creativeBrief),
  });
}

// Additional API client functions will be added in later tasks:
// - Scene planning endpoints (Task 4)
// - Video generation endpoints (Task 5)
// - Video composition endpoints (Task 7)

