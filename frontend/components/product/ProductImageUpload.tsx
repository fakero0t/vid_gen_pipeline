'use client';

import { useState, useCallback } from 'react';
import { useProductUpload } from '@/hooks/useProductUpload';
import Image from 'next/image';

interface ProductImageUploadProps {
  onComplete: (productId: string) => void;
  onBack?: () => void;
}

export function ProductImageUpload({ onComplete, onBack }: ProductImageUploadProps) {
  const {
    uploadedProduct,
    isUploading,
    uploadProgress,
    error,
    uploadProduct,
    deleteProduct,
    clearError,
  } = useProductUpload();

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
    await uploadProduct(selectedFile);
  };

  const handleDelete = async () => {
    if (!uploadedProduct) return;
    await deleteProduct(uploadedProduct.product_id);
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const handleReplace = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Success state
  if (uploadedProduct) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Product Ready ✓</h2>
            <p className="text-gray-600">Your product image has been uploaded successfully</p>
          </div>

          <div className="flex items-center gap-6 p-6 bg-gray-50 rounded-lg mb-6">
            <div className="relative w-32 h-32 flex-shrink-0">
              <Image
                src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${uploadedProduct.thumbnail_url}`}
                alt="Product thumbnail"
                fill
                className="object-contain rounded"
              />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900 mb-2">{uploadedProduct.filename}</p>
              <p className="text-sm text-gray-600">
                {uploadedProduct.dimensions.width} × {uploadedProduct.dimensions.height} pixels
              </p>
              <p className="text-sm text-gray-600">
                {formatFileSize(uploadedProduct.size)} • {uploadedProduct.format.toUpperCase()}
                {uploadedProduct.has_alpha && ' • Transparent'}
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => onComplete(uploadedProduct.product_id)}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Continue to Mood Selection →
            </button>
            <button
              onClick={handleReplace}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Replace
            </button>
            <button
              onClick={handleDelete}
              className="px-6 py-3 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Upload in progress
  if (isUploading) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Uploading Product...</h2>
          <div className="mb-4">
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-center text-gray-600 mt-2">{Math.round(uploadProgress)}%</p>
          </div>
        </div>
      </div>
    );
  }

  // File selected but not uploaded
  if (selectedFile && previewUrl) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Review Your Product</h2>
          
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          <div className="flex items-center gap-6 p-6 bg-gray-50 rounded-lg mb-6">
            <div className="relative w-32 h-32 flex-shrink-0">
              <Image
                src={previewUrl}
                alt="Preview"
                fill
                className="object-contain rounded"
              />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900 mb-2">{selectedFile.name}</p>
              <p className="text-sm text-gray-600">
                {formatFileSize(selectedFile.size)} • {selectedFile.type.split('/')[1].toUpperCase()}
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleUpload}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Upload Product
            </button>
            <button
              onClick={() => {
                setSelectedFile(null);
                setPreviewUrl(null);
                clearError();
              }}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Initial state - drop zone
  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Upload Product Photo</h2>
        <p className="text-gray-600 mb-8 text-center">
          Upload a single PNG or JPG image of your product
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
            transition-colors
            ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          `}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <div className="flex flex-col items-center">
            <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-lg font-medium text-gray-900 mb-2">
              Drop your product photo here or click to browse
            </p>
            <p className="text-sm text-gray-500">
              Supports PNG (recommended) or JPG • Max 50MB • Min 512×512
            </p>
          </div>
        </div>

        <input
          id="file-input"
          type="file"
          accept="image/png,image/jpeg"
          onChange={handleFileInput}
          className="hidden"
        />

        {onBack && (
          <button
            onClick={onBack}
            className="mt-6 text-gray-600 hover:text-gray-900 transition-colors"
          >
            ← Back
          </button>
        )}
      </div>
    </div>
  );
}

