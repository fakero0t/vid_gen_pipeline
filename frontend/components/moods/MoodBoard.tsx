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
  // HARDCODED: Always allow continuing for testing
  const canContinue = true;

  return (
    <div className={`space-y-6 ${className}`}>
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
      <div className="flex gap-4 items-center">
        {!hasMoods && (
          <Button
            onClick={onGenerate}
            disabled={isLoading}
            size="lg"
          >
            {isLoading ? 'Generating Moods...' : 'Generate Mood Boards'}
          </Button>
        )}
        {hasMoods && !canContinue && (
          <p className="text-sm text-muted-foreground">
            Please select a mood board to continue
          </p>
        )}
        {canContinue && (
          <Button
            onClick={onContinue}
            size="lg"
            className="ml-auto"
          >
            Continue with Selected Mood
          </Button>
        )}
      </div>

      {/* Mood gallery */}
      <MoodGallery
        moods={moods}
        selectedMoodId={selectedMoodId}
        onSelectMood={onSelectMood}
        isLoading={isLoading}
      />

      {/* Selected mood details */}
      {selectedMoodId && (
        <div className="mt-6 p-4 border rounded-lg bg-muted/30">
          <h3 className="font-semibold mb-2">Selected Mood Details</h3>
          {(() => {
            const selectedMood = moods.find(m => m.id === selectedMoodId);
            if (!selectedMood) return null;
            
            return (
              <div className="space-y-2 text-sm">
                <p><strong>Aesthetic:</strong> {selectedMood.aesthetic_direction}</p>
                <div>
                  <strong>Style Keywords:</strong>{' '}
                  {selectedMood.style_keywords.join(', ')}
                </div>
                {selectedMood.color_palette.length > 0 && (
                  <div>
                    <strong>Color Palette:</strong>{' '}
                    {selectedMood.color_palette.join(', ')}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

