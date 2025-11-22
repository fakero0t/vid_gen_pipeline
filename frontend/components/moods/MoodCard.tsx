'use client';

import React from 'react';
import { Mood } from '@/types/mood.types';
import Image from 'next/image';

interface MoodCardProps {
  mood: Mood;
  isSelected: boolean;
  onSelect: (moodId: string) => void;
  isLoading?: boolean;
}

export function MoodCard({ mood, isSelected, onSelect, isLoading = false }: MoodCardProps) {
  const handleClick = () => {
    if (!isLoading) {
      onSelect(mood.id);
    }
  };

  // Filter successful images only
  const successfulImages = mood.images.filter(img => img.success && img.url);
  
  // Debug: Log image state
  React.useEffect(() => {
    if (mood.images.length > 0) {
      console.log(`MoodCard ${mood.name}:`, {
        totalImages: mood.images.length,
        successfulImages: successfulImages.length,
        images: mood.images.map(img => ({
          hasUrl: !!img.url,
          success: img.success,
          url: img.url?.substring(0, 50) + '...'
        }))
      });
    }
  }, [mood.images, mood.name, successfulImages.length]);

  return (
    <div
      className={`
        relative rounded-xl transition-all duration-300 ease-out cursor-pointer w-full h-full flex flex-col
        border-2 bg-card overflow-hidden
        ${isSelected 
          ? 'border-primary ring-2 ring-primary/20 scale-[1.01]' 
          : 'border-border hover:border-primary/50 hover:scale-[1.02] hover:-translate-y-2'
        }
        ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      style={{
        boxShadow: isSelected 
          ? '0 10px 30px -5px rgba(0, 0, 0, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.1)' 
          : '0 4px 12px -2px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        ...(!isSelected && {
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        })
      }}
      onMouseEnter={(e) => {
        if (!isSelected && !isLoading) {
          e.currentTarget.style.boxShadow = '0 12px 40px -8px rgba(0, 0, 0, 0.2), 0 8px 16px -4px rgba(0, 0, 0, 0.12)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected && !isLoading) {
          e.currentTarget.style.boxShadow = '0 4px 12px -2px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
        }
      }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={`Select mood: ${mood.name}`}
      aria-pressed={isSelected}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2 z-20 bg-primary text-primary-foreground rounded-full p-1.5 shadow-lg animate-scaleIn">
          <svg
            className="w-4 h-4"
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
        </div>
      )}

      {/* Image grid - Takes up almost all space */}
      <div className="flex-1 min-h-0 p-2 overflow-hidden">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2 h-full">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="bg-muted rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : successfulImages.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 h-full">
            {successfulImages.slice(0, 4).map((image, idx) => (
              <div
                key={`${image.url}-${idx}`}
                className="relative rounded-lg overflow-hidden bg-muted"
              >
                <Image
                  src={image.url}
                  alt={`${mood.name} mood image ${idx + 1}`}
                  fill
                  className="object-cover"
                  sizes="50vw"
                  unoptimized
                  onError={(e) => {
                    console.error(`Failed to load image ${idx + 1} for ${mood.name}:`, image.url);
                  }}
                />
              </div>
            ))}
          </div>
        ) : mood.images.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 h-full">
            {mood.images.slice(0, 4).map((image, idx) => (
              <div
                key={idx}
                className="relative rounded-lg overflow-hidden bg-muted"
              >
                {image.url ? (
                  <Image
                    src={image.url}
                    alt={`${mood.name} mood image ${idx + 1}`}
                    fill
                    className="object-cover"
                    sizes="50vw"
                    unoptimized
                    onError={(e) => {
                      console.error(`Failed to load image ${idx + 1}:`, image.url);
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[9px] text-muted-foreground">
                    {image.success ? 'Loading...' : 'Failed'}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-muted rounded-lg flex items-center justify-center text-muted-foreground text-[10px] h-full">
            No images available
          </div>
        )}
      </div>

      {/* Text content - Minimal space at bottom */}
      <div className="px-3 py-2 bg-card/95 backdrop-blur-sm border-t border-border flex-shrink-0">
        <div className="flex items-center gap-2 overflow-hidden">
          <h3 className="font-display text-lg sm:text-xl font-bold tracking-tight truncate flex-shrink-0">{mood.name}</h3>
          {mood.style_keywords.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide min-w-0 flex-1">
              {mood.style_keywords.map((keyword, idx) => (
                <span
                  key={idx}
                  className="text-[10px] font-medium px-2 py-1 bg-secondary rounded-full text-foreground whitespace-nowrap flex-shrink-0"
                >
                  {keyword}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}


