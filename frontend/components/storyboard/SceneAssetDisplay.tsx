'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useFirebaseAuth } from '@/lib/firebase/AuthContext';
import { getBrandAsset } from '@/lib/api/brand';
import { getCharacterAsset } from '@/lib/api/character';
import { getBackgroundAsset } from '@/lib/api/background';
import type { StoryboardScene } from '@/types/storyboard.types';
import type { BrandAssetStatus } from '@/types/brand.types';
import type { CharacterAssetStatus } from '@/types/character.types';
import type { BackgroundAssetStatus } from '@/types/background.types';

interface SceneAssetDisplayProps {
  scene: StoryboardScene;
}

export function SceneAssetDisplay({ scene }: SceneAssetDisplayProps) {
  const { userId } = useFirebaseAuth();
  const [brandAsset, setBrandAsset] = useState<BrandAssetStatus | null>(null);
  const [characterAsset, setCharacterAsset] = useState<CharacterAssetStatus | null>(null);
  const [backgroundAsset, setBackgroundAsset] = useState<BackgroundAssetStatus | null>(null);

  const hasBrandAsset = !!scene.brand_asset_id;
  const hasCharacterAsset = !!scene.character_asset_id;
  const hasBackgroundAsset = !!scene.background_asset_id;

  // Fetch asset details to get URLs
  useEffect(() => {
    if (!userId) return;

    if (scene.brand_asset_id) {
      getBrandAsset(scene.brand_asset_id, userId)
        .then(setBrandAsset)
        .catch((err) => console.error('Failed to load brand asset:', err));
    }

    if (scene.character_asset_id) {
      getCharacterAsset(scene.character_asset_id, userId)
        .then(setCharacterAsset)
        .catch((err) => console.error('Failed to load character asset:', err));
    }

    if (scene.background_asset_id) {
      getBackgroundAsset(scene.background_asset_id, userId)
        .then(setBackgroundAsset)
        .catch((err) => console.error('Failed to load background asset:', err));
    }
  }, [scene.brand_asset_id, scene.character_asset_id, scene.background_asset_id, userId]);

  if (!hasBrandAsset && !hasCharacterAsset && !hasBackgroundAsset) {
    return null;
  }

  // Collect all used assets from fetched data
  const usedAssets: Array<{ id: string; label: string; imageUrl: string | null }> = [];

  if (hasBrandAsset && brandAsset?.public_thumbnail_url) {
    usedAssets.push({
      id: scene.brand_asset_id!,
      label: 'Brand',
      imageUrl: brandAsset.public_thumbnail_url
    });
  }

  if (hasCharacterAsset && characterAsset?.public_thumbnail_url) {
    usedAssets.push({
      id: scene.character_asset_id!,
      label: 'Character',
      imageUrl: characterAsset.public_thumbnail_url
    });
  }

  if (hasBackgroundAsset && backgroundAsset?.public_thumbnail_url) {
    usedAssets.push({
      id: scene.background_asset_id!,
      label: 'Background',
      imageUrl: backgroundAsset.public_thumbnail_url
    });
  }

  return (
    <div className="flex flex-col gap-2 p-3 bg-muted/50 rounded-lg border min-w-[300px]">
      <h4 className="text-sm font-semibold text-foreground">Assets Used</h4>
      <div className="flex flex-row gap-2">
        {usedAssets.map((asset) => (
          <div key={asset.id} className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">{asset.label}</span>
            <div className="rounded-lg p-1.5">
              <div className="relative w-16 h-16 rounded overflow-hidden bg-muted">
                {asset.imageUrl && (
                  <Image
                    src={asset.imageUrl}
                    alt={`${asset.label} asset`}
                    fill
                    className="object-cover"
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

