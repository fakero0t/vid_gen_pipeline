'use client';

import Image from 'next/image';
import { useFirebaseAuth } from '@/lib/firebase/AuthContext';
import { getBrandAssetImageUrl } from '@/lib/api/brand';
import { getCharacterAssetImageUrl } from '@/lib/api/character';
import { getBackgroundImageUrl } from '@/lib/api/background';
import type { StoryboardScene } from '@/types/storyboard.types';

interface SceneAssetDisplayProps {
  scene: StoryboardScene;
}

export function SceneAssetDisplay({ scene }: SceneAssetDisplayProps) {
  const { userId } = useFirebaseAuth();
  const hasBrandAsset = !!scene.brand_asset_id;
  const hasCharacterAsset = !!scene.character_asset_id;
  const hasBackgroundAsset = !!scene.background_asset_id;

  if (!hasBrandAsset && !hasCharacterAsset && !hasBackgroundAsset) {
    return null;
  }

  // Collect all used assets
  const usedAssets: Array<{ id: string; label: string; imageUrl: string }> = [];
  
  if (hasBrandAsset && userId) {
    usedAssets.push({
      id: scene.brand_asset_id!,
      label: 'Brand',
      imageUrl: getBrandAssetImageUrl(scene.brand_asset_id!, userId, false)
    });
  }
  
  if (hasCharacterAsset && userId) {
    usedAssets.push({
      id: scene.character_asset_id!,
      label: 'Character',
      imageUrl: getCharacterAssetImageUrl(scene.character_asset_id!, userId, false)
    });
  }
  
  if (hasBackgroundAsset && userId) {
    usedAssets.push({
      id: scene.background_asset_id!,
      label: 'Background',
      imageUrl: getBackgroundImageUrl(scene.background_asset_id!, userId, false)
    });
  }

  return (
    <div className="flex flex-col gap-2 p-3 bg-muted/50 rounded-lg border min-w-[300px]">
      <h4 className="text-sm font-semibold text-foreground">Assets Used</h4>
      <div className="flex flex-row gap-2">
        {usedAssets.map((asset) => (
          <div key={asset.id} className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">{asset.label}</span>
            <div className="border-2 rounded-lg p-1.5 border-primary shadow-sm">
              <div className="relative w-16 h-16 bg-muted rounded overflow-hidden">
              <Image
                  src={asset.imageUrl}
                  alt={`${asset.label} asset`}
                fill
                  className="object-cover rounded"
              />
            </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

