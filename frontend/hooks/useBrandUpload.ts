import { useFirebaseAuth } from '@/lib/firebase/AuthContext';
import { uploadBrandAsset, deleteBrandAsset } from '@/lib/api/brand';
import type { BrandAsset, BrandAssetStatus } from '@/types/brand.types';
import { useAssetUpload } from './useAssetUpload';

export function useBrandUpload() {
  const { userId, isLoaded } = useFirebaseAuth();
  
  // Wait for auth to load before throwing error
  if (isLoaded && !userId) {
    throw new Error('User must be authenticated to upload brand assets');
  }

  return useAssetUpload<BrandAsset, BrandAssetStatus>({
    uploadFn: uploadBrandAsset,
    deleteFn: deleteBrandAsset,
    userId: userId || '', // Provide empty string while loading
  });
}

