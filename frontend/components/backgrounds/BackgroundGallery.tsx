'use client';

import React from 'react';
import Image from 'next/image';
import { useFirebaseAuth } from '@/lib/firebase/AuthContext';
import { Checkbox } from '@/components/ui/checkbox';
import type { BackgroundAssetStatus } from '@/types/background.types';
import { getBackgroundImageUrl } from '@/lib/api/background';

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

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`} style={{ gridAutoRows: 'minmax(250px, 1fr)' }}>
      {backgrounds.map((background) => {
        const isSelected = selectedIds.includes(background.asset_id);
        
        return (
          <div
            key={background.asset_id}
            className={`
              relative rounded-xl overflow-hidden border-2 transition-all
              ${isSelected 
                ? 'border-primary ring-2 ring-primary/20' 
                : 'border-border hover:border-primary/50'
              }
              cursor-pointer group
            `}
            onClick={() => onSelect(background.asset_id, !isSelected)}
          >
            {userId && (
              <Image
                src={getBackgroundImageUrl(background.asset_id, userId, false)}
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

