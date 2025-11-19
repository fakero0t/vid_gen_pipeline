'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/appStore';
import { useProductUpload } from '@/hooks/useProductUpload';
import { useCOLMAP } from '@/hooks/useCOLMAP';

interface ProductUploadProps {
  onContinue: () => void;
}

export function ProductUpload({ onContinue }: ProductUploadProps) {
  const { productImages, setProductImages } = useAppStore();
  const { upload, isUploading, uploadProgress, error, clearError } = useProductUpload();
  const { start: startCOLMAP } = useCOLMAP();
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const ACCEPTED_FORMATS = ['image/jpeg', 'image/jpg', 'image/png'];
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file

  const validateAndProcessFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const validFiles: File[] = [];
    const errors: string[] = [];

    Array.from(files).forEach((file) => {
      // Check file type
      if (!ACCEPTED_FORMATS.includes(file.type)) {
        errors.push(`${file.name}: Invalid format (must be JPEG, JPG, or PNG)`);
        return;
      }

      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: File too large (max 10MB)`);
        return;
      }

      validFiles.push(file);
    });

    if (errors.length > 0) {
      alert('Some files were skipped:\n\n' + errors.join('\n'));
    }

    if (validFiles.length > 0) {
      // Update store with valid files (no preview URLs needed)
      setProductImages(validFiles);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    validateAndProcessFiles(files);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    const files = e.target.files;
    validateAndProcessFiles(files);
  };

  const handleButtonClick = () => {
    inputRef.current?.click();
  };

  const handleRemoveAll = () => {
    setProductImages([]);
    clearError();
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleContinue = async () => {
    if (!productImages || productImages.length === 0) {
      return;
    }

    // Upload images (goes directly to Modal)
    const jobId = await upload();
    
    if (jobId) {
      // Upload successful, start COLMAP immediately
      console.log('[ProductUpload] Starting COLMAP for job:', jobId);
      await startCOLMAP({
        job_id: jobId,
      });
      
      // Proceed to next step (pipeline view)
      onContinue();
    }
    // If upload fails, error is already set and displayed
  };

  const hasImages = productImages.length > 0;

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 transition-all duration-200
          ${dragActive 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
            : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
          }
          ${hasImages ? 'bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700' : ''}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png"
          onChange={handleChange}
          className="hidden"
          // Note: webkitdirectory is non-standard but widely supported for folder selection
          {...({ webkitdirectory: '', directory: '' } as any)}
        />

        <div className="text-center space-y-4">
          <div className="text-4xl">
            {hasImages ? '✓' : '📁'}
          </div>
          
          {hasImages ? (
            <>
              <h3 className="text-xl font-semibold text-green-700 dark:text-green-400">
                {productImages.length} Image{productImages.length !== 1 ? 's' : ''} Selected
              </h3>
              <p className="text-sm text-muted-foreground">
                Your 3D product renders are ready to upload
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={handleButtonClick} variant="outline" size="sm">
                  Replace Images
                </Button>
                <Button onClick={handleRemoveAll} variant="outline" size="sm">
                  Remove All
                </Button>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-xl font-semibold">Upload Product Images</h3>
              <p className="text-muted-foreground">
                Upload many JPEG, JPG, or PNG images of your 3D product rendering
              </p>
              <p className="text-sm text-muted-foreground">
                Drag and drop a folder here, or click to select files
              </p>
              <Button onClick={handleButtonClick} size="lg">
                Select Folder or Images
              </Button>
            </>
          )}
        </div>
      </div>

      {/* File Info */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p>• Accepted formats: JPEG, JPG, PNG</p>
        <p>• Maximum file size: 10MB per image</p>
        <p>• Upload 50-200 images representing different angles of your 3D product</p>
        {productImages.length > 0 && productImages.length < 50 && (
          <p className="text-yellow-600 dark:text-yellow-400">
            ⚠️ Minimum 50 images required (you have {productImages.length})
          </p>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg text-sm text-red-600 dark:text-red-400">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Uploading images...</span>
            <span>{Math.round(uploadProgress)}%</span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Continue Button */}
      <div className="flex justify-center pt-4">
        <Button
          onClick={handleContinue}
          size="lg"
          disabled={!hasImages || isUploading || productImages.length < 50}
          className="min-w-[200px]"
        >
          {isUploading ? 'Uploading...' : 'Continue to Moods →'}
        </Button>
      </div>
    </div>
  );
}

