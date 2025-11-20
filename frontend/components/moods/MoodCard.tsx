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
        relative rounded-lg transition-all duration-300 cursor-pointer w-full max-w-full max-h-[calc(100vh-200px)] overflow-hidden flex flex-col
        ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
      `}
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
        <div className="absolute top-2 right-2 z-10 bg-primary text-primary-foreground rounded-full p-1.5">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
      )}

      {/* Mood header */}
      <div className="p-4 md:p-6 border-b border-border bg-card">
        <h3 className="font-semibold text-lg md:text-xl mb-2">{mood.name}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {mood.description}
        </p>
        
        {/* Style keywords and Color palette */}
        {(mood.style_keywords.length > 0 || mood.color_palette.length > 0) && (
          <div className="flex flex-wrap gap-2 items-center">
            {/* Style keywords */}
            {mood.style_keywords.length > 0 && (
              <>
                {mood.style_keywords.slice(0, 4).map((keyword, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-2.5 py-1 bg-muted/50 rounded-full text-muted-foreground"
                  >
                    {keyword}
                  </span>
                ))}
                {mood.style_keywords.length > 4 && (
                  <span className="text-xs px-2.5 py-1 text-muted-foreground">
                    +{mood.style_keywords.length - 4} more
                  </span>
                )}
              </>
            )}
            
            {/* Color palette */}
            {mood.color_palette.length > 0 && (
              <>
                <span className="text-xs text-muted-foreground font-medium">Color Palette:</span>
                <div className="flex gap-1.5">
                  {mood.color_palette.slice(0, 6).map((color, idx) => (
                    <div
                      key={idx}
                      className="w-4 h-4 rounded-full border border-border/50 shadow-sm"
                      style={{
                        backgroundColor: color.startsWith('#') ? color : `var(--${color})`,
                      }}
                      title={color}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Image grid */}
      <div className="p-4 md:p-6 flex-1 min-h-0 overflow-hidden">
        {isLoading ? (
          <div className="grid grid-cols-4 gap-3 md:gap-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="bg-muted rounded-lg animate-pulse aspect-[9/16] max-h-[calc(100vh-400px)]"
              />
            ))}
          </div>
        ) : successfulImages.length > 0 ? (
          <div className="grid grid-cols-4 gap-3 md:gap-4">
            {successfulImages.slice(0, 4).map((image, idx) => (
              <div
                key={`${image.url}-${idx}`}
                className="relative rounded-lg overflow-hidden bg-muted shadow-md hover:shadow-lg transition-shadow aspect-[9/16] max-h-[calc(100vh-400px)]"
              >
                <Image
                  src={image.url}
                  alt={`${mood.name} mood image ${idx + 1}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 25vw, (max-width: 1024px) 25vw, 25vw"
                  unoptimized
                  onError={(e) => {
                    console.error(`Failed to load image ${idx + 1} for ${mood.name}:`, image.url);
                  }}
                />
              </div>
            ))}
          </div>
        ) : mood.images.length > 0 ? (
          // Show images even if they're not marked as successful, or show error state
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              {mood.images.length} image(s) available but not loaded yet
            </div>
            <div className="grid grid-cols-4 gap-3 md:gap-4">
              {mood.images.slice(0, 4).map((image, idx) => (
                <div
                  key={idx}
                  className="relative rounded-lg overflow-hidden bg-muted aspect-[9/16] max-h-[calc(100vh-400px)]"
                >
                  {image.url ? (
                    <Image
                      src={image.url}
                      alt={`${mood.name} mood image ${idx + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 25vw, (max-width: 1024px) 25vw, 25vw"
                      unoptimized
                      onError={(e) => {
                        console.error(`Failed to load image ${idx + 1}:`, image.url);
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                      {image.success ? 'Loading...' : 'Failed'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-muted rounded-lg flex items-center justify-center text-muted-foreground text-sm h-64">
            No images available
          </div>
        )}
      </div>

    </div>
  );
}


