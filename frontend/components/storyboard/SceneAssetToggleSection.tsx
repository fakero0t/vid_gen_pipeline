'use client';

import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import Image from 'next/image';
import { useFirebaseAuth } from '@/lib/firebase/AuthContext';
import { Checkbox } from '@/components/ui/checkbox';
import { useProjectStore } from '@/store/projectStore';
import { useSceneStore } from '@/store/sceneStore';
import { listBrandAssets, getBrandAssetImageUrl } from '@/lib/api/brand';
import { listCharacterAssets, getCharacterAssetImageUrl } from '@/lib/api/character';
import { listBackgroundAssets, getBackgroundImageUrl } from '@/lib/api/background';
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
    if (projectBrandAssetIds.length === 0) return;
    
    setIsLoadingBrand(true);
    listBrandAssets(userId!)
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
  }, [projectBrandAssetIds]);

  // Load character assets
  useEffect(() => {
    if (projectCharacterAssetIds.length === 0) return;
    
    setIsLoadingCharacter(true);
    listCharacterAssets(userId!)
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
  }, [projectCharacterAssetIds]);

  // Load background assets
  useEffect(() => {
    if (projectBackgroundAssetIds.length === 0) return;
    
    setIsLoadingBackground(true);
    listBackgroundAssets(userId!)
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
  }, [projectBackgroundAssetIds]);

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

  // Memoized asset image component to prevent re-renders
  const AssetImage = memo(({ 
    assetId, 
    imageUrl, 
    alt, 
    isSelected 
  }: { 
    assetId: string; 
    imageUrl: string; 
    alt: string; 
    isSelected: boolean;
  }) => (
    <Image
      key={assetId}
      src={imageUrl}
      alt={alt}
      fill
      className="object-contain"
      unoptimized
      priority={false}
    />
  ));
  AssetImage.displayName = 'AssetImage';

  // Carousel component for assets - memoized to prevent recreation
  const AssetCarousel = memo(({ 
    assets, 
    selectedId, 
    onToggle, 
    getImageUrl, 
    isLoading, 
    isToggling,
    label,
    userId
  }: { 
    assets: (BrandAssetStatus | CharacterAssetStatus | BackgroundAssetStatus)[]; 
    selectedId: string | null;
    onToggle: (checked: boolean, assetId: string) => void;
    getImageUrl: (assetId: string, userId: string, thumbnail: boolean) => string;
    isLoading: boolean;
    isToggling: boolean;
    label: string;
    userId: string | null | undefined;
  }) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(false);
    const scrollCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Debounced scroll check to prevent excessive re-renders
    const checkScroll = useCallback(() => {
      if (scrollCheckTimeoutRef.current) {
        clearTimeout(scrollCheckTimeoutRef.current);
      }
      scrollCheckTimeoutRef.current = setTimeout(() => {
        if (!scrollContainerRef.current) return;
        const container = scrollContainerRef.current;
        const newShowLeft = container.scrollLeft > 0;
        const newShowRight = container.scrollLeft < container.scrollWidth - container.clientWidth - 1;
        
        // Only update state if values actually changed
        setShowLeftArrow(prev => prev !== newShowLeft ? newShowLeft : prev);
        setShowRightArrow(prev => prev !== newShowRight ? newShowRight : prev);
      }, 50);
    }, []);

    // Check if scrolling is needed - optimized to prevent flicker
    useEffect(() => {
      // Initial check after DOM is ready
      const timeoutId = setTimeout(checkScroll, 100);
      const container = scrollContainerRef.current;
      
      if (container) {
        container.addEventListener('scroll', checkScroll, { passive: true });
        window.addEventListener('resize', checkScroll, { passive: true });
        
        return () => {
          clearTimeout(timeoutId);
          if (scrollCheckTimeoutRef.current) {
            clearTimeout(scrollCheckTimeoutRef.current);
          }
          container.removeEventListener('scroll', checkScroll);
          window.removeEventListener('resize', checkScroll);
        };
      }
      return () => {
        clearTimeout(timeoutId);
        if (scrollCheckTimeoutRef.current) {
          clearTimeout(scrollCheckTimeoutRef.current);
        }
      };
    }, [checkScroll, assets.length]);

    const scroll = useCallback((direction: 'left' | 'right') => {
      if (!scrollContainerRef.current) return;
      const container = scrollContainerRef.current;
      const scrollAmount = 200;
      container.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }, []);

    if (isLoading) {
      return (
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground w-24 flex-shrink-0">{label}</label>
          <div className="text-xs text-muted-foreground">Loading...</div>
        </div>
      );
    }

    if (assets.length === 0) {
      return (
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground w-24 flex-shrink-0">{label}</label>
          <div className="text-xs text-muted-foreground italic">No assets available</div>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-muted-foreground w-24 flex-shrink-0">{label}</label>
        <div className="relative flex-1 min-w-0">
          {/* Left Arrow */}
          {showLeftArrow && (
            <button
              onClick={() => scroll('left')}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-background/90 backdrop-blur-sm border border-border rounded-full w-6 h-6 flex items-center justify-center hover:bg-background shadow-md"
              aria-label="Scroll left"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          
          {/* Scrollable Container */}
          <div
            ref={scrollContainerRef}
            className="flex items-center gap-2 overflow-x-auto scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {assets.map((asset) => {
              const isSelected = selectedId === asset.asset_id;
              const imageUrl = userId ? getImageUrl(asset.asset_id, userId, true) : '';
              return (
                <button
                  key={asset.asset_id}
                  onClick={() => onToggle(!isSelected, asset.asset_id)}
                  disabled={isToggling}
                  className="relative w-16 h-16 flex-shrink-0 rounded border-2 bg-background overflow-hidden cursor-pointer hover:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    borderColor: isSelected ? 'rgb(255, 81, 1)' : undefined
                  }}
                >
                  {imageUrl && (
                    <AssetImage
                      assetId={asset.asset_id}
                      imageUrl={imageUrl}
                      alt={asset.metadata?.filename || `${label} asset`}
                      isSelected={isSelected}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Right Arrow */}
          {showRightArrow && (
            <button
              onClick={() => scroll('right')}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-background/90 backdrop-blur-sm border border-border rounded-full w-6 h-6 flex items-center justify-center hover:bg-background shadow-md"
              aria-label="Scroll right"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  });
  AssetCarousel.displayName = 'AssetCarousel';

  return (
    <div className="flex flex-col gap-3 p-4 bg-muted/50 rounded-lg border min-w-[400px]">
      <h4 className="text-sm font-semibold text-foreground">Assets</h4>
      
      {/* Brand Asset Carousel */}
      {projectBrandAssetIds.length > 0 && (
        <AssetCarousel
          assets={brandAssets}
          selectedId={scene.brand_asset_id ?? null}
          onToggle={handleBrandToggle}
          getImageUrl={getBrandAssetImageUrl}
          isLoading={isLoadingBrand}
          isToggling={isTogglingBrand}
          label="Brand Asset"
          userId={userId}
        />
      )}

      {/* Character Asset Carousel */}
      {projectCharacterAssetIds.length > 0 && (
        <AssetCarousel
          assets={characterAssets}
          selectedId={scene.character_asset_id ?? null}
          onToggle={handleCharacterToggle}
          getImageUrl={getCharacterAssetImageUrl}
          isLoading={isLoadingCharacter}
          isToggling={isTogglingCharacter}
          label="Character Asset"
          userId={userId}
        />
      )}

      {/* Background Asset Carousel */}
      {projectBackgroundAssetIds.length > 0 && (
        <AssetCarousel
          assets={backgroundAssets}
          selectedId={scene.background_asset_id ?? null}
          onToggle={handleBackgroundToggle}
          getImageUrl={getBackgroundImageUrl}
          isLoading={isLoadingBackground}
          isToggling={isTogglingBackground}
          label="Background Asset"
          userId={userId}
        />
      )}
    </div>
  );
}

