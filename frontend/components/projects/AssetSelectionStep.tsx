'use client';

import Image from 'next/image';
import { useFirebaseAuth } from '@/lib/firebase/AuthContext';
import type { AssetStatus } from '@/types/asset.types';
import { cn } from '@/lib/utils';

interface AssetSelectionStepProps {
  assetType: 'brand' | 'character';
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onNext: () => void;
  onBack?: () => void;
  isLoading: boolean;
  assets: AssetStatus[];
  getImageUrl: (assetId: string, userId: string, thumbnail: boolean) => string;
}

export function AssetSelectionStep({
  assetType,
  selectedIds,
  onSelectionChange,
  onNext,
  onBack,
  isLoading,
  assets,
  getImageUrl,
}: AssetSelectionStepProps) {
  const { userId } = useFirebaseAuth();
  const assetTypeLabel = assetType === 'brand' ? 'Brand' : 'Character';
  const isRequired = true; // Both are required
  const hasSelection = selectedIds.length > 0;

  const handleToggleAsset = (assetId: string) => {
    if (selectedIds.includes(assetId)) {
      onSelectionChange(selectedIds.filter(id => id !== assetId));
    } else {
      onSelectionChange([...selectedIds, assetId]);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-muted-foreground mt-4">Loading {assetTypeLabel.toLowerCase()} assets...</p>
        </div>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed rounded-lg">
          <svg className="w-16 h-16 text-muted-foreground mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-muted-foreground text-center">
            No {assetTypeLabel.toLowerCase()} assets available
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Select {assetTypeLabel} Assets</h3>
          <p className="text-sm text-muted-foreground">
            {hasSelection
              ? `${selectedIds.length} ${selectedIds.length === 1 ? 'asset' : 'assets'} selected`
              : `Select at least one ${assetTypeLabel.toLowerCase()} asset${isRequired ? ' (required)' : ''}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[600px] overflow-y-auto">
        {assets.map((asset) => {
          const isSelected = selectedIds.includes(asset.asset_id);
          return (
            <div
              key={asset.asset_id}
              className={cn(
                'border-2 rounded-lg p-3 cursor-pointer transition-all',
                isSelected
                  ? 'border-primary shadow-md'
                  : 'border-border hover:border-primary/50 hover:shadow-sm'
              )}
              onClick={() => handleToggleAsset(asset.asset_id)}
            >
              <div className="relative w-full aspect-square mb-2 bg-muted rounded overflow-hidden">
                {userId && (
                  <Image
                    src={getImageUrl(asset.asset_id, userId, false)}
                    alt={asset.metadata.filename || `${assetTypeLabel} asset`}
                    fill
                    className="object-cover rounded"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!hasSelection && isRequired && (
        <div className="p-3 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            Please select at least one {assetTypeLabel.toLowerCase()} asset to continue.
          </p>
        </div>
      )}
    </div>
  );
}

