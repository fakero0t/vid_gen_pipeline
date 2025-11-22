'use client';

import Image from 'next/image';
import { useAuth } from '@clerk/nextjs';
import { getBrandAssetImageUrl } from '@/lib/api/brand';
import { getCharacterAssetImageUrl } from '@/lib/api/character';
import { getBackgroundImageUrl } from '@/lib/api/background';
import type { StoryboardScene } from '@/types/storyboard.types';

interface SceneAssetDisplayProps {
  scene: StoryboardScene;
}

export function SceneAssetDisplay({ scene }: SceneAssetDisplayProps) {
  const { userId } = useAuth();
  const hasBrandAsset = !!scene.brand_asset_id;
  const hasCharacterAsset = !!scene.character_asset_id;
  const hasBackgroundAsset = !!scene.background_asset_id;

  if (!hasBrandAsset && !hasCharacterAsset && !hasBackgroundAsset) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 p-4 bg-muted/50 rounded-lg border">
      <h4 className="text-sm font-semibold text-foreground">Assets Used</h4>
      <div className="flex flex-wrap gap-3">
        {hasBrandAsset && userId && (
          <div className="flex items-center gap-2">
            <div className="relative w-64 h-64 rounded border bg-background overflow-hidden">
              <Image
                src={getBrandAssetImageUrl(scene.brand_asset_id!, userId, false)}
                alt="Brand asset"
                fill
                className="object-contain"
              />
            </div>
            <span className="text-xs text-muted-foreground">Brand</span>
          </div>
        )}
        {hasCharacterAsset && userId && (
          <div className="flex items-center gap-2">
            <div className="relative w-64 h-64 rounded border bg-background overflow-hidden">
              <Image
                src={getCharacterAssetImageUrl(scene.character_asset_id!, userId, false)}
                alt="Character asset"
                fill
                className="object-contain"
              />
            </div>
            <span className="text-xs text-muted-foreground">Character</span>
          </div>
        )}
        {hasBackgroundAsset && userId && (
          <div className="flex items-center gap-2">
            <div className="relative w-64 h-64 rounded border bg-background overflow-hidden">
              <Image
                src={getBackgroundImageUrl(scene.background_asset_id!, userId, false)}
                alt="Background asset"
                fill
                className="object-contain"
              />
            </div>
            <span className="text-xs text-muted-foreground">Background</span>
          </div>
        )}
      </div>
    </div>
  );
}

