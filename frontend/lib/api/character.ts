import type { CharacterAsset, CharacterAssetStatus } from '@/types/character.types';
import * as assetAPI from './asset';

const API_PREFIX = 'character';

export async function uploadCharacterAsset(
  file: File,
  userId: string,
  onProgress?: (progress: number) => void
): Promise<CharacterAsset> {
  return assetAPI.uploadAsset(API_PREFIX, file, userId, onProgress);
}

export async function getCharacterAsset(assetId: string, userId: string): Promise<CharacterAssetStatus> {
  return assetAPI.getAsset(API_PREFIX, assetId, userId);
}

export async function listCharacterAssets(userId: string): Promise<CharacterAssetStatus[]> {
  return assetAPI.listAssets(API_PREFIX, userId);
}

export async function deleteCharacterAsset(assetId: string, userId: string): Promise<void> {
  return assetAPI.deleteAsset(API_PREFIX, assetId, userId);
}

export function getCharacterAssetImageUrl(assetId: string, userId: string, thumbnail: boolean = false): string {
  return assetAPI.getAssetImageUrl(API_PREFIX, assetId, userId, thumbnail);
}

