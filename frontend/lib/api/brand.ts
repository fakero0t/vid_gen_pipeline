import type { BrandAsset, BrandAssetStatus } from '@/types/brand.types';
import * as assetAPI from './asset';

const API_PREFIX = 'brand';

export async function uploadBrandAsset(
  file: File,
  userId: string,
  onProgress?: (progress: number) => void
): Promise<BrandAsset> {
  return assetAPI.uploadAsset(API_PREFIX, file, userId, onProgress);
}

export async function getBrandAsset(assetId: string, userId: string): Promise<BrandAssetStatus> {
  return assetAPI.getAsset(API_PREFIX, assetId, userId);
}

export async function listBrandAssets(userId: string): Promise<BrandAssetStatus[]> {
  return assetAPI.listAssets(API_PREFIX, userId);
}

export async function deleteBrandAsset(assetId: string, userId: string): Promise<void> {
  return assetAPI.deleteAsset(API_PREFIX, assetId, userId);
}

export function getBrandAssetImageUrl(assetId: string, userId: string, thumbnail: boolean = false): string {
  return assetAPI.getAssetImageUrl(API_PREFIX, assetId, userId, thumbnail);
}

