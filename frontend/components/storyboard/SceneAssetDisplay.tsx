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

  return (
    <div className="flex flex-col gap-3 p-4 bg-muted/50 rounded-lg border min-w-[300px]">
      <h4 className="text-sm font-semibold text-foreground">Assets Used</h4>
      <div className="flex flex-col gap-3">
        {hasBrandAsset && userId && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">Brand</span>
            <div className="relative w-32 h-32 rounded border bg-background overflow-hidden">
              <Image
                src={getBrandAssetImageUrl(scene.brand_asset_id!, userId, true)}
                alt="Brand asset"
                fill
                className="object-contain"
              />
            </div>
          </div>
        )}
        {hasCharacterAsset && userId && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">Character</span>
            <div className="relative w-32 h-32 rounded border bg-background overflow-hidden">
              <Image
                src={getCharacterAssetImageUrl(scene.character_asset_id!, userId, true)}
                alt="Character asset"
                fill
                className="object-contain"
              />
            </div>
          </div>
        )}
        {hasBackgroundAsset && userId && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">Background</span>
            <div className="relative w-32 h-32 rounded border bg-background overflow-hidden">
              <Image
                src={getBackgroundImageUrl(scene.background_asset_id!, userId, true)}
                alt="Background asset"
                fill
                className="object-contain"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

