'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useFirebaseAuth } from '@/lib/firebase/AuthContext';
import { Button } from '@/components/ui/button';
import type { AssetStatus } from '@/types/asset.types';

interface AssetListProps {
  assetType: string;
  title: string;
  emptyMessage: string;
  onAssetDeleted?: (assetId: string) => void;
  refreshTrigger?: number;
  listFn: (userId: string) => Promise<AssetStatus[]>;
  deleteFn: (assetId: string, userId: string) => Promise<void>;
}

export function AssetList({
  assetType,
  title,
  emptyMessage,
  onAssetDeleted,
  refreshTrigger,
  listFn,
  deleteFn,
}: AssetListProps) {
  const { userId } = useFirebaseAuth();
  const [assets, setAssets] = useState<AssetStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [assetToDelete, setAssetToDelete] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const loadAssets = async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const assetList = await listFn(userId);
      setAssets(assetList);
    } catch (err: any) {
      setError(err.message || `Failed to load ${assetType} assets`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      loadAssets();
    }
  }, [refreshTrigger, userId]);

  const handleDeleteClick = (assetId: string) => {
    setAssetToDelete(assetId);
    setShowConfirmDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!userId || !assetToDelete) return;

    setDeletingIds(prev => new Set(prev).add(assetToDelete));
    setShowConfirmDialog(false);
    try {
      await deleteFn(assetToDelete, userId);
      setAssets(prev => prev.filter(asset => asset.asset_id !== assetToDelete));
      onAssetDeleted?.(assetToDelete);
    } catch (err: any) {
      setError(err.message || `Failed to delete ${assetType} asset`);
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(assetToDelete);
        return next;
      });
      setAssetToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setShowConfirmDialog(false);
    setAssetToDelete(null);
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

  const assetToDeleteData = assetToDelete
    ? assets.find(a => a.asset_id === assetToDelete)
    : null;

  return (
    <>
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
                  <div className="relative w-full aspect-square mb-3 rounded overflow-hidden">
                    {asset.public_url && (
                      <Image
                        src={asset.public_url}
                        alt={asset.metadata.filename || `${assetType} asset`}
                        fill
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="space-y-1">
                    <button
                      onClick={() => handleDeleteClick(asset.asset_id)}
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

      {/* Confirmation Dialog */}
      {showConfirmDialog && assetToDelete && assetToDeleteData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleCancelDelete}>
          <div className="bg-card border border-border rounded-lg p-6 max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Delete {assetType.charAt(0).toUpperCase() + assetType.slice(1)} Asset?</h3>
            <div className="space-y-2 mb-4">
              <p className="text-sm text-muted-foreground">
                {assetToDeleteData.metadata?.filename || `This ${assetType} asset`}
              </p>
              <p className="text-sm font-medium" style={{ color: 'rgb(255, 81, 1)' }}>
                Warning: This action cannot be undone. The asset will be permanently deleted.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelDelete}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmDelete}
                className="bg-[rgb(255,81,1)] text-white hover:bg-[rgb(255,100,20)]"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


