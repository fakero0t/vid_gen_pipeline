import { useAuth } from '@clerk/nextjs';
import { uploadBrandAsset, deleteBrandAsset } from '@/lib/api/brand';
import type { BrandAsset, BrandAssetStatus } from '@/types/brand.types';
import { useAssetUpload } from './useAssetUpload';

export function useBrandUpload() {
  const { userId } = useAuth();
  
  if (!userId) {
    throw new Error('User must be authenticated to upload brand assets');
  }

  return useAssetUpload<BrandAsset, BrandAssetStatus>({
    uploadFn: uploadBrandAsset,
    deleteFn: deleteBrandAsset,
    userId,
  });
}

