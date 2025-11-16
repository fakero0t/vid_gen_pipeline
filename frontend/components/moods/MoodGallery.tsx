'use client';

import React from 'react';
import { Mood } from '@/types/mood.types';
import { MoodCard } from './MoodCard';

interface MoodGalleryProps {
  moods: Mood[];
  selectedMoodId: string | null;
  onSelectMood: (moodId: string) => void;
  isLoading?: boolean;
  className?: string;
}

export function MoodGallery({
  moods,
  selectedMoodId,
  onSelectMood,
  isLoading = false,
  className = '',
}: MoodGalleryProps) {
  if (moods.length === 0 && !isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No mood boards available. Generate moods to get started.</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          // Loading skeleton
          [...Array(3)].map((_, i) => (
            <div
              key={i}
              className="rounded-lg border-2 border-border bg-card animate-pulse"
            >
              <div className="p-4 border-b border-border">
                <div className="h-6 bg-muted rounded mb-2 w-3/4" />
                <div className="h-4 bg-muted rounded w-full" />
                <div className="h-4 bg-muted rounded w-5/6 mt-1" />
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 gap-2">
                  {[...Array(4)].map((_, j) => (
                    <div
                      key={j}
                      className="aspect-[9/16] bg-muted rounded"
                    />
                  ))}
                </div>
              </div>
            </div>
          ))
        ) : (
          moods.map((mood) => (
            <MoodCard
              key={mood.id}
              mood={mood}
              isSelected={selectedMoodId === mood.id}
              onSelect={onSelectMood}
              isLoading={isLoading}
            />
          ))
        )}
      </div>
    </div>
  );
}

