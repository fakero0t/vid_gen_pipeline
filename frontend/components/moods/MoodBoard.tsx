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
  const selectedMoodIsLoaded = selectedMood && selectedMood.images.some(img => img.success && img.url);
  
  // Can continue when not loading and the selected mood has at least one image
  const canContinue = !isLoading && selectedMoodIsLoaded;

  return (
    <div className={`space-y-6 w-full overflow-x-hidden ${className}`}>
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Select a Mood Board</h2>
        <p className="text-muted-foreground">
          Choose the visual style direction that best represents your vision. Each mood board contains 4 sample images.
        </p>
      </div>

      {/* Error display */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Action buttons */}
      {!hasMoods && (
        <div className="flex gap-4 items-center">
          <Button
            onClick={onGenerate}
            disabled={isLoading}
            size="lg"
          >
            {isLoading ? 'Generating Moods...' : 'Generate Mood Boards'}
          </Button>
        </div>
      )}

      {/* Mood gallery */}
      <MoodGallery
        moods={moods}
        selectedMoodId={selectedMoodId}
        onSelectMood={onSelectMood}
        isLoading={isLoading}
        onContinue={hasMoods ? onContinue : undefined}
        canContinue={canContinue}
      />
    </div>
  );
}


