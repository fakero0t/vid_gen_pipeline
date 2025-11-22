/**
 * Generic asset upload hook
 * Can be used for any asset type (brand, character, etc.)
 */

import { useState } from 'react';
import type { Asset, AssetStatus } from '@/types/asset.types';

interface UseAssetUploadConfig<T extends Asset, S extends AssetStatus> {
  uploadFn: (file: File, onProgress?: (progress: number) => void) => Promise<T>;
  deleteFn: (assetId: string) => Promise<void>;
}

export function useAssetUpload<T extends Asset, S extends AssetStatus>(
  config: UseAssetUploadConfig<T, S>
) {
  const [uploadedAsset, setUploadedAsset] = useState<T | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    // Check file type (MUST match backend)
    const validTypes = ['image/png', 'image/jpeg'];
    if (!validTypes.includes(file.type)) {
      return { 
        valid: false, 
        error: `Only PNG and JPG images are supported. Got: ${file.type}` 
      };
    }
    
    // Check file size (50MB = 52,428,800 bytes exactly)
    const MAX_SIZE = 50 * 1024 * 1024;  // 52428800 bytes
    if (file.size === 0) {
      return { valid: false, error: 'File is empty' };
    }
    if (file.size > MAX_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return { 
        valid: false, 
        error: `File size must be under 50MB (got ${sizeMB}MB)` 
      };
    }
    
    return { valid: true };
  };

  const checkImageDimensions = async (file: File): Promise<{ valid: boolean; error?: string }> => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      // Set timeout for loading
      const timeout = setTimeout(() => {
        URL.revokeObjectURL(url);
        resolve({ valid: false, error: 'Image loading timed out' });
      }, 10000);  // 10 second timeout
      
      img.onload = () => {
        clearTimeout(timeout);
        URL.revokeObjectURL(url);
        
        // Check minimum dimensions (MUST match backend: 100x100)
        if (img.width < 100 || img.height < 100) {
          resolve({ 
            valid: false, 
            error: `Image must be at least 100×100 pixels (got ${img.width}×${img.height})` 
          });
        } 
        // Check maximum dimensions (optional, backend will also check)
        else if (img.width > 4096 || img.height > 4096) {
          resolve({ 
            valid: false, 
            error: `Image must not exceed 4096×4096 pixels (got ${img.width}×${img.height})` 
          });
        } 
        else {
          resolve({ valid: true });
        }
      };
      
      img.onerror = (e) => {
        clearTimeout(timeout);
        URL.revokeObjectURL(url);
        resolve({ valid: false, error: 'Could not load image. File may be corrupted.' });
      };
      
      img.src = url;
    });
  };

  const uploadAsset = async (file: File): Promise<T | null> => {
    setIsUploading(true);
    setError(null);
    setUploadProgress(0);
    
    try {
      // Client-side validation
      const typeCheck = validateFile(file);
      if (!typeCheck.valid) {
        setError(typeCheck.error!);
        setIsUploading(false);
        return null;
      }
      
      const dimensionCheck = await checkImageDimensions(file);
      if (!dimensionCheck.valid) {
        setError(dimensionCheck.error!);
        setIsUploading(false);
        return null;
      }
      
      // Upload with progress tracking
      const result = await config.uploadFn(file, (progress) => {
        setUploadProgress(progress);
      });
      
      setUploadedAsset(result);
      setUploadProgress(100);
      return result;
      
    } catch (err: any) {
      setError(err.message || 'Upload failed');
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const deleteAsset = async (assetId: string) => {
    try {
      await config.deleteFn(assetId);
      if (uploadedAsset?.asset_id === assetId) {
        setUploadedAsset(null);
      }
    } catch (err: any) {
      setError(err.message || 'Delete failed');
      throw err;
    }
  };

  const reset = () => {
    setUploadedAsset(null);
    setError(null);
    setUploadProgress(0);
    setIsUploading(false);
  };

  return {
    uploadedAsset,
    isUploading,
    uploadProgress,
    error,
    uploadAsset,
    deleteAsset,
    clearError: () => setError(null),
    reset,
  };
}


