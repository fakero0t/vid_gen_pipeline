'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import type { Asset } from '@/types/asset.types';

interface AssetUploadProps<T extends Asset> {
  assetType: string;
  title: string;
  description: string;
  successTitle: string;
  successMessage: string;
  onUploadComplete?: (assetId: string) => void;
  uploadHook: {
    uploadedAsset: T | null;
    isUploading: boolean;
    uploadProgress: number;
    error: string | null;
    uploadAsset: (file: File) => Promise<T | null>;
    clearError: () => void;
    reset: () => void;
  };
  getImageUrl: (assetId: string, thumbnail: boolean) => string;
}

export function AssetUpload<T extends Asset>({
  assetType,
  title,
  description,
  successTitle,
  successMessage,
  onUploadComplete,
  uploadHook,
  getImageUrl,
}: AssetUploadProps<T>) {
  const {
    uploadedAsset,
    isUploading,
    uploadProgress,
    error,
    uploadAsset,
    clearError,
    reset,
  } = uploadHook;

  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    setSelectedFile(file);
    clearError();
    
    // Create preview
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    const result = await uploadAsset(selectedFile);
    if (result) {
      onUploadComplete?.(result.asset_id);
    }
  };

  const handleReset = () => {
    reset();
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Success state
  if (uploadedAsset) {
    return (
      <div className="bg-white rounded-lg border p-2">
        <div className="flex items-center gap-2 mb-2">
          <div className="inline-flex items-center justify-center w-5 h-5 bg-green-100 rounded-full flex-shrink-0">
            <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-xs text-gray-600 flex-1 truncate">Uploaded successfully</p>
          <button
            onClick={handleReset}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Upload Another
          </button>
        </div>
      </div>
    );
  }

  // Upload in progress
  if (isUploading) {
    return (
      <div className="bg-white rounded-lg border p-2">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1">
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-gray-600 whitespace-nowrap">{Math.round(uploadProgress)}%</p>
        </div>
      </div>
    );
  }

  // File selected but not uploaded
  if (selectedFile && previewUrl) {
    return (
      <div className="bg-white rounded-lg border p-2">
        {error && (
          <div className="mb-2 p-1.5 bg-red-50 border border-red-200 rounded text-xs text-red-600">
            {error}
          </div>
        )}

        <div className="flex items-center gap-2 mb-2">
          <div className="relative w-10 h-10 flex-shrink-0 bg-gray-50 rounded">
            <Image
              src={previewUrl}
              alt="Preview"
              fill
              className="object-contain rounded"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-xs text-gray-900 truncate">{selectedFile.name}</p>
            <p className="text-xs text-gray-500">
              {formatFileSize(selectedFile.size)}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleUpload}
            className="flex-1 bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition-colors text-xs font-medium"
          >
            Upload
          </button>
          <button
            onClick={() => {
              setSelectedFile(null);
              if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
              }
              setPreviewUrl(null);
              clearError();
            }}
            className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 transition-colors text-xs"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Initial state - drop zone
  return (
    <div className="bg-white rounded-lg border p-2">
      {error && (
        <div className="mb-2 p-1.5 bg-red-50 border border-red-200 rounded text-xs text-red-600">
          {error}
        </div>
      )}

      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-2 text-center cursor-pointer
          transition-colors
          ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
        `}
        onClick={() => document.getElementById(`${assetType}-file-input`)?.click()}
      >
        <div className="flex items-center justify-center gap-2">
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-xs font-medium text-gray-700">
            Drop or click to upload
          </p>
        </div>
      </div>

      <input
        id={`${assetType}-file-input`}
        type="file"
        accept="image/png,image/jpeg,.png,.jpg,.jpeg"
        onChange={handleFileInput}
        className="hidden"
      />
    </div>
  );
}


