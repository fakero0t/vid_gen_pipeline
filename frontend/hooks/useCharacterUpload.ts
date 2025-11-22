import { useFirebaseAuth } from '@/lib/firebase/AuthContext';
import { uploadCharacterAsset, deleteCharacterAsset } from '@/lib/api/character';
import type { CharacterAsset, CharacterAssetStatus } from '@/types/character.types';
import { useAssetUpload } from './useAssetUpload';

export function useCharacterUpload() {
  const { userId, isLoaded } = useFirebaseAuth();
  
  // Wait for auth to load before throwing error
  if (isLoaded && !userId) {
    throw new Error('User must be authenticated to upload character assets');
  }

  return useAssetUpload<CharacterAsset, CharacterAssetStatus>({
    uploadFn: uploadCharacterAsset,
    deleteFn: deleteCharacterAsset,
    userId: userId || '', // Provide empty string while loading
  });
}

