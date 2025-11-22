'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import type { AssetStatus } from '@/types/asset.types';

interface AssetListProps {
  assetType: string;
  title: string;
  emptyMessage: string;
  onAssetDeleted?: (assetId: string) => void;
  refreshTrigger?: number;
  listFn: () => Promise<AssetStatus[]>;
  deleteFn: (assetId: string) => Promise<void>;
  getImageUrl: (assetId: string, thumbnail: boolean) => string;
}

export function AssetList({
  assetType,
  title,
  emptyMessage,
  onAssetDeleted,
  refreshTrigger,
  listFn,
  deleteFn,
  getImageUrl,
}: AssetListProps) {
  const [assets, setAssets] = useState<AssetStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const loadAssets = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const assetList = await listFn();
      setAssets(assetList);
    } catch (err: any) {
      setError(err.message || `Failed to load ${assetType} assets`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, [refreshTrigger]);

  const handleDelete = async (assetId: string) => {
    if (!confirm(`Are you sure you want to delete this ${assetType} asset?`)) {
      return;
    }

    setDeletingIds(prev => new Set(prev).add(assetId));
    try {
      await deleteFn(assetId);
      setAssets(prev => prev.filter(asset => asset.asset_id !== assetId));
      onAssetDeleted?.(assetId);
    } catch (err: any) {
      alert(err.message || `Failed to delete ${assetType} asset`);
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(assetId);
        return next;
      });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border p-4 h-full flex flex-col">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex-shrink-0">{title}</h2>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-sm text-gray-600 mt-4">Loading {assetType} assets...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border p-4 h-full flex flex-col">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex-shrink-0">{title}</h2>
        <div className="flex-1 flex items-center justify-center">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={loadAssets}
              className="mt-4 text-xs text-red-600 hover:text-red-800 underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-4 h-full flex flex-col">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex-shrink-0">{title}</h2>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center justify-center py-8 px-4 border border-dashed rounded-lg">
            <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm text-muted-foreground text-center">
              {emptyMessage}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border p-4 h-full flex flex-col overflow-hidden">
      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex-shrink-0">{title}</h2>
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {assets.map((asset) => {
            const isDeleting = deletingIds.has(asset.asset_id);
            return (
              <div
                key={asset.asset_id}
                className="border rounded-lg p-3 hover:shadow-md transition-shadow"
              >
                <div className="relative w-full aspect-square mb-3 bg-gray-50 rounded min-h-[300px]">
                  <Image
                    src={getImageUrl(asset.asset_id, false)}
                    alt={asset.metadata.filename || `${assetType} asset`}
                    fill
                    className="object-contain rounded"
                  />
                </div>
                <div className="space-y-1">
                  <button
                    onClick={() => handleDelete(asset.asset_id)}
                    disabled={isDeleting}
                    className="w-full mt-2 px-3 py-1.5 text-xs border-2 border-[rgb(255,81,1)] bg-transparent text-[rgb(255,81,1)] rounded-full hover:bg-[rgb(255,81,1)]/10 transition-all duration-300 ease-out hover:scale-[1.02] active:scale-95 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


