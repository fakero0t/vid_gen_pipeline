'use client';

import React, { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { useFirebaseAuth } from '@/lib/firebase/AuthContext';
import { Checkbox } from '@/components/ui/checkbox';
import type { BackgroundAssetStatus } from '@/types/background.types';

interface BackgroundGalleryProps {
  backgrounds: BackgroundAssetStatus[];
  selectedIds: string[];
  onSelect: (backgroundId: string, selected: boolean) => void;
  isLoading?: boolean;
  className?: string;
}

export function BackgroundGallery({
  backgrounds,
  selectedIds,
  onSelect,
  isLoading = false,
  className = '',
}: BackgroundGalleryProps) {
  const { userId } = useFirebaseAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const [maxImageSize, setMaxImageSize] = useState<number | null>(null);
  const gap = 16; // gap-4 = 1rem = 16px

  useEffect(() => {
    const updateLayout = () => {
      if (!containerRef.current) return;

      const width = window.innerWidth;
      let columns = 3;
      if (width < 640) {
        columns = 1;
      } else if (width < 1024) {
        columns = 2;
      }

      // Calculate available height
      const container = containerRef.current;
      const containerHeight = container.clientHeight;
      const containerWidth = container.clientWidth;
      const padding = 16; // px-2 = 0.5rem = 8px on each side
      const availableWidth = containerWidth - (padding * 2);
      
      // Calculate rows needed
      const rows = Math.ceil(backgrounds.length / columns);
      
      // Calculate max image size based on height
      // Available height = containerHeight
      // Total gap height = (rows - 1) * gap
      // Max image height = (containerHeight - (rows - 1) * gap) / rows
      const availableHeight = containerHeight;
      const totalGapHeight = (rows - 1) * gap;
      const maxHeight = rows > 0 ? (availableHeight - totalGapHeight) / rows : availableHeight;
      
      // Calculate max image size based on width
      const totalGapWidth = (columns - 1) * gap;
      const maxWidth = (availableWidth - totalGapWidth) / columns;
      
      // Use the smaller of the two to ensure it fits both dimensions
      const size = Math.min(maxHeight, maxWidth);
      setMaxImageSize(Math.max(150, size)); // Minimum 150px
    };

    // Small delay to ensure container is rendered
    const timeoutId = setTimeout(updateLayout, 0);
    window.addEventListener('resize', updateLayout);
    
    // Use ResizeObserver to watch for container size changes
    const resizeObserver = new ResizeObserver(() => {
      setTimeout(updateLayout, 0);
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updateLayout);
      resizeObserver.disconnect();
    };
  }, [backgrounds.length]);

  // Loading state is now handled by the page component with LoadingPhrases
  if (isLoading) {
    return null;
  }

  if (backgrounds.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <p className="text-muted-foreground">No backgrounds generated yet</p>
      </div>
    );
  }

  const imageSize = maxImageSize ? `${maxImageSize}px` : '200px';

  return (
    <div 
      ref={containerRef}
      className={`flex flex-wrap gap-4 justify-center items-center content-center h-full w-full overflow-hidden px-2 ${className}`}
    >
      {backgrounds.map((background) => {
        const isSelected = selectedIds.includes(background.asset_id);
        
        return (
          <div
            key={background.asset_id}
            className={`
              relative aspect-square rounded-xl overflow-hidden border-2 transition-all flex-shrink-0
              ${isSelected 
                ? 'border-primary ring-2 ring-primary/20' 
                : 'border-border hover:border-primary/50'
              }
              cursor-pointer group
            `}
            style={{
              width: imageSize,
              height: imageSize,
              maxWidth: imageSize,
              maxHeight: imageSize,
              minWidth: '150px',
              minHeight: '150px'
            }}
            onClick={() => onSelect(background.asset_id, !isSelected)}
          >
            {background.public_url && (
              <Image
                src={background.public_url}
                alt={`Background ${background.asset_id}`}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
            )}
            
            {/* Selection overlay */}
            <div
              className={`
                absolute inset-0 transition-all
                ${isSelected ? 'bg-primary/20' : 'bg-black/0 group-hover:bg-black/10'}
              `}
            />
            
            {/* Checkbox */}
            <div className="absolute top-2 right-2">
              <div
                className={`
                  w-6 h-6 rounded-full flex items-center justify-center
                  ${isSelected ? 'bg-primary' : 'bg-background/80'}
                  transition-all
                `}
              >
                {isSelected && (
                  <svg
                    className="w-4 h-4 text-primary-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

