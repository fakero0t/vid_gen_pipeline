import { useAuth } from '@clerk/nextjs';
import { uploadCharacterAsset, deleteCharacterAsset } from '@/lib/api/character';
import type { CharacterAsset, CharacterAssetStatus } from '@/types/character.types';
import { useAssetUpload } from './useAssetUpload';

export function useCharacterUpload() {
  const { userId } = useAuth();
  
  if (!userId) {
    throw new Error('User must be authenticated to upload character assets');
  }

  return useAssetUpload<CharacterAsset, CharacterAssetStatus>({
    uploadFn: uploadCharacterAsset,
    deleteFn: deleteCharacterAsset,
    userId,
  });
}

