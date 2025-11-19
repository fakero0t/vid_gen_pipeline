import { useState } from 'react';
import { uploadProductImage, deleteProductImage as deleteProductAPI } from '@/lib/api/product';
import type { ProductImage } from '@/types/product.types';
import { useAppStore } from '@/store/appStore';

export function useProductUpload() {
  const [uploadedProduct, setUploadedProduct] = useState<ProductImage | null>(null);
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
        
        // Check minimum dimensions (MUST match backend: 512x512)
        if (img.width < 512 || img.height < 512) {
          resolve({ 
            valid: false, 
            error: `Image must be at least 512×512 pixels (got ${img.width}×${img.height})` 
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

  const uploadProduct = async (file: File) => {
    setIsUploading(true);
    setError(null);
    setUploadProgress(0);
    
    try {
      // Client-side validation
      const typeCheck = validateFile(file);
      if (!typeCheck.valid) {
        setError(typeCheck.error!);
        setIsUploading(false);
        return;
      }
      
      const dimensionCheck = await checkImageDimensions(file);
      if (!dimensionCheck.valid) {
        setError(dimensionCheck.error!);
        setIsUploading(false);
        return;
      }
      
      // Upload with progress tracking
      const result = await uploadProductImage(file, (progress) => {
        setUploadProgress(progress);
      });
      
      setUploadedProduct(result);
      setUploadProgress(100);
      
      // Store in app state
      useAppStore.getState().setUploadedProduct(result);
      
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const deleteProduct = async (productId: string) => {
    try {
      await deleteProductAPI(productId);
      setUploadedProduct(null);
      useAppStore.getState().setUploadedProduct(null);
    } catch (err: any) {
      setError(err.message || 'Delete failed');
    }
  };

  return {
    uploadedProduct,
    isUploading,
    uploadProgress,
    error,
    uploadProduct,
    deleteProduct,
    clearError: () => setError(null),
  };
}
