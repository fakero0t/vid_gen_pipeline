'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useFirebaseAuth } from '@/lib/firebase/AuthContext';
import { useProjectStore } from '@/store/projectStore';
import { useSceneStore } from '@/store/sceneStore';
import { listBrandAssets } from '@/lib/api/brand';
import { listCharacterAssets } from '@/lib/api/character';
import { listBackgroundAssets } from '@/lib/api/background';
import { cn } from '@/lib/utils';
import type { StoryboardScene } from '@/types/storyboard.types';
import type { BrandAssetStatus } from '@/types/brand.types';
import type { CharacterAssetStatus } from '@/types/character.types';
import type { BackgroundAssetStatus } from '@/types/background.types';

interface SceneAssetToggleSectionProps {
  scene: StoryboardScene;
}

export function SceneAssetToggleSection({ scene }: SceneAssetToggleSectionProps) {
  const { userId } = useFirebaseAuth();
  const { getCurrentProject } = useProjectStore();
  const { enableBrandAsset, disableBrandAsset, enableCharacterAsset, disableCharacterAsset, enableBackgroundAsset, disableBackgroundAsset } = useSceneStore();
  
  const [brandAssets, setBrandAssets] = useState<BrandAssetStatus[]>([]);
  const [characterAssets, setCharacterAssets] = useState<CharacterAssetStatus[]>([]);
  const [backgroundAssets, setBackgroundAssets] = useState<BackgroundAssetStatus[]>([]);
  const [isLoadingBrand, setIsLoadingBrand] = useState(false);
  const [isLoadingCharacter, setIsLoadingCharacter] = useState(false);
  const [isLoadingBackground, setIsLoadingBackground] = useState(false);
  const [isTogglingBrand, setIsTogglingBrand] = useState(false);
  const [isTogglingCharacter, setIsTogglingCharacter] = useState(false);
  const [isTogglingBackground, setIsTogglingBackground] = useState(false);

  const project = getCurrentProject();
  const projectBrandAssetIds = project?.brandAssetIds || [];
  const projectCharacterAssetIds = project?.characterAssetIds || [];
  const projectBackgroundAssetIds = project?.backgroundAssetIds || [];

  // Load brand assets
  useEffect(() => {
    if (projectBrandAssetIds.length === 0 || !userId) return;

    setIsLoadingBrand(true);
    listBrandAssets(userId)
      .then(allBrandAssets => {
        // Filter to only show assets that are in the project
        const projectBrandAssets = allBrandAssets.filter(asset =>
          projectBrandAssetIds.includes(asset.asset_id)
        );
        setBrandAssets(projectBrandAssets);
      })
      .catch(error => {
        console.error('Failed to load brand assets:', error);
      })
      .finally(() => {
        setIsLoadingBrand(false);
      });
  }, [projectBrandAssetIds, userId]);

  // Load character assets
  useEffect(() => {
    if (projectCharacterAssetIds.length === 0 || !userId) return;

    setIsLoadingCharacter(true);
    listCharacterAssets(userId)
      .then(allCharacterAssets => {
        // Filter to only show assets that are in the project
        const projectCharacterAssets = allCharacterAssets.filter(asset =>
          projectCharacterAssetIds.includes(asset.asset_id)
        );
        setCharacterAssets(projectCharacterAssets);
      })
      .catch(error => {
        console.error('Failed to load character assets:', error);
      })
      .finally(() => {
        setIsLoadingCharacter(false);
      });
  }, [projectCharacterAssetIds, userId]);

  // Load background assets
  useEffect(() => {
    if (projectBackgroundAssetIds.length === 0 || !userId) return;

    setIsLoadingBackground(true);
    listBackgroundAssets(userId)
      .then(allBackgroundAssets => {
        // Filter to only show assets that are in the project
        const projectBackgroundAssets = allBackgroundAssets.filter(asset =>
          projectBackgroundAssetIds.includes(asset.asset_id)
        );
        setBackgroundAssets(projectBackgroundAssets);
      })
      .catch(error => {
        console.error('Failed to load background assets:', error);
      })
      .finally(() => {
        setIsLoadingBackground(false);
      });
  }, [projectBackgroundAssetIds, userId]);

  const handleBrandToggle = async (checked: boolean, assetId: string) => {
    setIsTogglingBrand(true);
    try {
      if (checked) {
        // If another brand asset is already selected, it will be replaced
        await enableBrandAsset(scene.id, assetId);
        if (scene.image_url) {
          console.log('Scene will be regenerated with brand asset');
        }
      } else {
        // Only disable if this is the currently selected asset
        if (scene.brand_asset_id === assetId) {
          await disableBrandAsset(scene.id);
          if (scene.image_url) {
            console.log('Scene will be regenerated without brand asset');
          }
        }
      }
    } catch (error) {
      console.error('Failed to toggle brand asset:', error);
    } finally {
      setIsTogglingBrand(false);
    }
  };

  const handleCharacterToggle = async (checked: boolean, assetId: string) => {
    setIsTogglingCharacter(true);
    try {
      if (checked) {
        // If another character asset is already selected, it will be replaced
        await enableCharacterAsset(scene.id, assetId);
        if (scene.image_url) {
          console.log('Scene will be regenerated with character asset');
        }
      } else {
        // Only disable if this is the currently selected asset
        if (scene.character_asset_id === assetId) {
          await disableCharacterAsset(scene.id);
          if (scene.image_url) {
            console.log('Scene will be regenerated without character asset');
          }
        }
      }
    } catch (error) {
      console.error('Failed to toggle character asset:', error);
    } finally {
      setIsTogglingCharacter(false);
    }
  };

  const handleBackgroundToggle = async (checked: boolean, assetId: string) => {
    setIsTogglingBackground(true);
    try {
      if (checked) {
        // If another background asset is already selected, it will be replaced
        await enableBackgroundAsset(scene.id, assetId);
        if (scene.image_url) {
          console.log('Scene will be regenerated with background asset');
        }
      } else {
        // Only disable if this is the currently selected asset
        if (scene.background_asset_id === assetId) {
          await disableBackgroundAsset(scene.id);
          if (scene.image_url) {
            console.log('Scene will be regenerated without background asset');
          }
        }
      }
    } catch (error) {
      console.error('Failed to toggle background asset:', error);
    } finally {
      setIsTogglingBackground(false);
    }
  };

  // Don't show if project has no assets
  if (projectBrandAssetIds.length === 0 && projectCharacterAssetIds.length === 0 && projectBackgroundAssetIds.length === 0) {
    return null;
  }

  // Asset grid component - uses same style as project creation modal
  const AssetGrid = ({
    assets,
    selectedId,
    onToggle,
    isLoading,
    isToggling,
    label
  }: {
    assets: (BrandAssetStatus | CharacterAssetStatus | BackgroundAssetStatus)[];
    selectedId: string | null;
    onToggle: (checked: boolean, assetId: string) => void;
    isLoading: boolean;
    isToggling: boolean;
    label: string;
  }) => {
    // Always render the same structure to maintain consistent layout
    return (
      <div className="flex items-center gap-2 min-h-[3rem]">
        <h5 className="text-xs font-semibold text-foreground whitespace-nowrap w-28 flex-shrink-0">{label}</h5>
        <div className="flex flex-wrap gap-2 flex-1 items-center min-h-[3rem]">
          {isLoading ? (
            <div className="text-xs text-muted-foreground">Loading...</div>
          ) : assets.length === 0 ? (
            <div className="text-xs text-muted-foreground italic">No assets available</div>
          ) : (
            assets.map((asset) => {
              const isSelected = selectedId === asset.asset_id;
              const imageUrl = asset.public_thumbnail_url || asset.public_url || '';
              return (
                <div
                  key={asset.asset_id}
                  className={cn(
                    'border-2 rounded p-1.5 cursor-pointer transition-all flex-shrink-0',
                    isSelected
                      ? 'border-primary shadow-sm'
                      : 'border-border hover:border-primary/50 hover:shadow-sm',
                    isToggling && 'opacity-50 cursor-not-allowed'
                  )}
                  onClick={() => !isToggling && onToggle(!isSelected, asset.asset_id)}
                >
                  <div className="relative w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 aspect-square bg-muted rounded overflow-hidden">
                    {imageUrl && (
                      <Image
                        src={imageUrl}
                        alt={asset.metadata?.filename || `${label} asset`}
                        fill
                        className="object-cover rounded"
                      />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2 p-2 bg-muted/50 rounded-lg border min-w-[400px] h-full overflow-hidden">
      <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
      {/* Brand Asset Grid */}
      {projectBrandAssetIds.length > 0 && (
        <AssetGrid
          assets={brandAssets}
          selectedId={scene.brand_asset_id ?? null}
          onToggle={handleBrandToggle}
          isLoading={isLoadingBrand}
          isToggling={isTogglingBrand}
          label="Brand Asset"
        />
      )}

      {/* Character Asset Grid */}
      {projectCharacterAssetIds.length > 0 && (
        <AssetGrid
          assets={characterAssets}
          selectedId={scene.character_asset_id ?? null}
          onToggle={handleCharacterToggle}
          isLoading={isLoadingCharacter}
          isToggling={isTogglingCharacter}
          label="Character Asset"
        />
      )}

      {/* Background Asset Grid */}
      {projectBackgroundAssetIds.length > 0 && (
        <AssetGrid
          assets={backgroundAssets}
          selectedId={scene.background_asset_id ?? null}
          onToggle={handleBackgroundToggle}
          isLoading={isLoadingBackground}
          isToggling={isTogglingBackground}
          label="Background Asset"
        />
      )}
      </div>
    </div>
  );
}

