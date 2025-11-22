'use client';

import React from 'react';
import { MoodGallery } from './MoodGallery';
import { Mood } from '@/types/mood.types';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface MoodBoardProps {
  moods: Mood[];
  selectedMoodId: string | null;
  onSelectMood: (moodId: string) => void;
  onGenerate: () => void;
  onContinue: () => void;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
}

export function MoodBoard({
  moods,
  selectedMoodId,
  onSelectMood,
  onGenerate,
  onContinue,
  isLoading = false,
  error = null,
  className = '',
}: MoodBoardProps) {
  const hasMoods = moods.length > 0;
  
  // Check if the selected mood has loaded at least one image
  const selectedMood = selectedMoodId ? moods.find(m => m.id === selectedMoodId) : null;
  const selectedMoodIsLoaded = selectedMood ? selectedMood.images.some(img => img.success && img.url) : false;
  
  // Can continue when not loading and the selected mood has at least one image
  const canContinue = !isLoading && selectedMoodIsLoaded;

  return (
    <div className={`space-y-2 sm:space-y-3 w-full h-full flex flex-col ${className}`}>
      {/* Error display */}
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/50 p-1.5 animate-slideUp flex-shrink-0">
          <p className="text-[10px] font-medium text-destructive">{error}</p>
        </div>
      )}


      {/* Regenerate option when moods exist */}
      {hasMoods && !isLoading && (
        <div className="flex gap-2 items-center animate-slideUp animation-delay-100 flex-shrink-0">
          <button
            onClick={onGenerate}
            className="font-display font-bold text-[10px] px-3 py-1 rounded-full border border-foreground bg-transparent text-foreground hover:bg-secondary transition-all duration-300"
          >
            Regenerate
          </button>
          <p className="text-[10px] text-muted-foreground">
            Not satisfied? Try again
          </p>
        </div>
      )}

      {/* Mood gallery - takes remaining space */}
      <div className="flex-1 min-h-0">
        <MoodGallery
          moods={moods}
          selectedMoodId={selectedMoodId}
          onSelectMood={onSelectMood}
          isLoading={isLoading}
          onContinue={hasMoods ? onContinue : undefined}
          canContinue={canContinue}
        />
      </div>
    </div>
  );
}


