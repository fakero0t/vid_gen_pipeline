import type { BackgroundAssetStatus, BackgroundGenerationRequest, BackgroundGenerationResponse } from '@/types/background.types';
import * as assetAPI from './asset';

const API_PREFIX = 'background';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function generateBackgrounds(
  creativeBrief: BackgroundGenerationRequest
): Promise<BackgroundGenerationResponse> {
  const response = await fetch(`${API_URL}/api/background/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(creativeBrief),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to generate backgrounds' }));
    throw new Error(error.detail || error.message || 'Failed to generate backgrounds');
  }
  
  return response.json();
}

export async function getBackgroundAsset(assetId: string, userId: string): Promise<BackgroundAssetStatus> {
  return assetAPI.getAsset(API_PREFIX, assetId, userId);
}

export async function listBackgroundAssets(userId: string): Promise<BackgroundAssetStatus[]> {
  return assetAPI.listAssets(API_PREFIX, userId);
}

export async function deleteBackgroundAsset(assetId: string, userId: string): Promise<void> {
  return assetAPI.deleteAsset(API_PREFIX, assetId, userId);
}

export function getBackgroundImageUrl(assetId: string, userId: string, thumbnail: boolean = false): string {
  return assetAPI.getAssetImageUrl(API_PREFIX, assetId, userId, thumbnail);
}

