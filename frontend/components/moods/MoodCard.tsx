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
        relative rounded-xl transition-all duration-500 cursor-pointer w-auto h-[400px] sm:h-[500px] max-h-[80vh] flex flex-row
        border-2 hover:shadow-lg bg-card overflow-hidden
        ${isSelected 
          ? 'border-primary shadow-lg ring-2 ring-primary/20' 
          : 'border-border hover:border-primary/50'
        }
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
        <div className="absolute top-1.5 right-1.5 z-10 bg-primary text-primary-foreground rounded-full p-1 shadow-md animate-scaleIn">
          <svg
            className="w-3 h-3"
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

      {/* Image grid - Left side, takes priority */}
      <div className="p-2 w-[300px] sm:w-[400px] min-h-0 bg-gradient-to-b from-card to-card/50 overflow-hidden flex-shrink-0">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-1.5 h-full">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="bg-muted rounded-md animate-pulse"
              />
            ))}
          </div>
        ) : successfulImages.length > 0 ? (
          <div className="grid grid-cols-2 gap-1.5 h-full">
            {successfulImages.slice(0, 4).map((image, idx) => (
              <div
                key={`${image.url}-${idx}`}
                className="relative rounded-md overflow-hidden bg-muted shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300 border border-border"
              >
                <Image
                  src={image.url}
                  alt={`${mood.name} mood image ${idx + 1}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, 25vw"
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
          <div className="grid grid-cols-2 gap-1.5 h-full">
            {mood.images.slice(0, 4).map((image, idx) => (
              <div
                key={idx}
                className="relative rounded-md overflow-hidden bg-muted"
              >
                {image.url ? (
                  <Image
                    src={image.url}
                    alt={`${mood.name} mood image ${idx + 1}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, 25vw"
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
          <div className="bg-muted rounded-md flex items-center justify-center text-muted-foreground text-[10px] h-full">
            No images available
          </div>
        )}
      </div>

      {/* Text content - Right side, vertically centered */}
      <div className="p-2 sm:p-3 flex-shrink-0 w-48 sm:w-64 border-l border-border bg-card flex flex-col justify-center">
        <h3 className="font-display text-base font-bold mb-1.5 tracking-tight">{mood.name}</h3>
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
          {mood.description}
        </p>
        
        {/* Style keywords and Color palette */}
        {(mood.style_keywords.length > 0 || mood.color_palette.length > 0) && (
          <div className="flex flex-wrap gap-1.5 items-center">
            {/* Style keywords */}
            {mood.style_keywords.length > 0 && (
              <>
                {mood.style_keywords.slice(0, 3).map((keyword, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] font-bold px-2 py-0.5 bg-secondary rounded-full text-foreground border border-border"
                  >
                    {keyword}
                  </span>
                ))}
                {mood.style_keywords.length > 3 && (
                  <span className="text-[10px] font-bold px-1 text-muted-foreground">
                    +{mood.style_keywords.length - 3}
                  </span>
                )}
              </>
            )}
            
            {/* Color palette */}
            {mood.color_palette.length > 0 && (
              <div className="flex gap-1 mt-1.5">
                {mood.color_palette.slice(0, 4).map((color, idx) => (
                  <div
                    key={idx}
                    className="w-3 h-3 rounded-full border border-border/50 shadow-sm"
                    style={{
                      backgroundColor: color.startsWith('#') ? color : `var(--${color})`,
                    }}
                    title={color}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}


