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

  return (
    <div
      className={`
        relative rounded-lg border-2 transition-all duration-300 cursor-pointer
        ${isSelected 
          ? 'border-primary shadow-lg scale-105 ring-2 ring-primary ring-offset-2' 
          : 'border-border hover:border-primary/50 hover:shadow-md'
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
      <div className="p-4 border-b border-border bg-card">
        <h3 className="font-semibold text-lg mb-1">{mood.name}</h3>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {mood.description}
        </p>
      </div>

      {/* Image grid */}
      <div className="p-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="aspect-[9/16] bg-muted rounded animate-pulse"
              />
            ))}
          </div>
        ) : successfulImages.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {successfulImages.slice(0, 4).map((image, idx) => (
              <div
                key={idx}
                className="relative aspect-[9/16] rounded overflow-hidden bg-muted"
              >
                <Image
                  src={image.url}
                  alt={`${mood.name} mood image ${idx + 1}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, 25vw"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="aspect-[9/16] bg-muted rounded flex items-center justify-center text-muted-foreground text-sm">
            No images available
          </div>
        )}
      </div>

      {/* Mood metadata footer */}
      <div className="p-4 border-t border-border bg-muted/30">
        <div className="flex flex-wrap gap-2 mb-2">
          {mood.style_keywords.slice(0, 3).map((keyword, idx) => (
            <span
              key={idx}
              className="text-xs px-2 py-1 bg-background rounded-full text-muted-foreground"
            >
              {keyword}
            </span>
          ))}
          {mood.style_keywords.length > 3 && (
            <span className="text-xs px-2 py-1 text-muted-foreground">
              +{mood.style_keywords.length - 3} more
            </span>
          )}
        </div>
        {mood.color_palette.length > 0 && (
          <div className="flex gap-1.5 items-center">
            <span className="text-xs text-muted-foreground">Colors:</span>
            <div className="flex gap-1">
              {mood.color_palette.slice(0, 5).map((color, idx) => (
                <div
                  key={idx}
                  className="w-4 h-4 rounded-full border border-border"
                  style={{
                    backgroundColor: color.startsWith('#') ? color : `var(--${color})`,
                  }}
                  title={color}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

