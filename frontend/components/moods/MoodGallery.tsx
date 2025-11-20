'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mood } from '@/types/mood.types';
import { MoodCard } from './MoodCard';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';

interface MoodGalleryProps {
  moods: Mood[];
  selectedMoodId: string | null;
  onSelectMood: (moodId: string) => void;
  isLoading?: boolean;
  className?: string;
  onContinue?: () => void;
  canContinue?: boolean;
}

export function MoodGallery({
  moods,
  selectedMoodId,
  onSelectMood,
  isLoading = false,
  className = '',
  onContinue,
  canContinue = false,
}: MoodGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Sync currentIndex with selectedMoodId (only when selectedMoodId changes externally)
  useEffect(() => {
    if (selectedMoodId && moods.length > 0) {
      const index = moods.findIndex(m => m.id === selectedMoodId);
      if (index !== -1 && index !== currentIndex) {
        setCurrentIndex(index);
      }
    }
  }, [selectedMoodId, moods.length]); // Removed currentIndex from deps to prevent loop

  const goToPrevious = useCallback(() => {
    if (moods.length === 0) return;
    setCurrentIndex((prev) => {
      const newIndex = prev === 0 ? moods.length - 1 : prev - 1;
      // Auto-select the mood when navigating
      const newMood = moods[newIndex];
      if (newMood) {
        onSelectMood(newMood.id);
      }
      return newIndex;
    });
  }, [moods, onSelectMood]);

  const goToNext = useCallback(() => {
    if (moods.length === 0) return;
    setCurrentIndex((prev) => {
      const newIndex = prev === moods.length - 1 ? 0 : prev + 1;
      // Auto-select the mood when navigating
      const newMood = moods[newIndex];
      if (newMood) {
        onSelectMood(newMood.id);
      }
      return newIndex;
    });
  }, [moods, onSelectMood]);

  const goToIndex = useCallback((index: number) => {
    if (index >= 0 && index < moods.length) {
      setCurrentIndex((prev) => {
        if (prev === index) return prev; // Prevent unnecessary updates
        // Auto-select the mood when navigating
        const newMood = moods[index];
        if (newMood) {
          onSelectMood(newMood.id);
        }
        return index;
      });
    }
  }, [moods, onSelectMood]);

  // Touch handlers for swipe support
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const distance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;

    if (distance > minSwipeDistance) {
      goToNext();
    } else if (distance < -minSwipeDistance) {
      goToPrevious();
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (moods.length === 0) return;
      
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevious();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrevious, goToNext, moods.length]);

  if (moods.length === 0 && !isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No mood boards available. Generate moods to get started.</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 w-full ${className}`}>
      {/* Carousel Container */}
      <div className="relative w-full">
        {/* Navigation Arrows */}
        {moods.length > 1 && !isLoading && (
          <>
            <Button
              variant="outline"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm shadow-lg hover:bg-background"
              onClick={goToPrevious}
              aria-label="Previous mood board"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm shadow-lg hover:bg-background"
              onClick={goToNext}
              aria-label="Next mood board"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </>
        )}

        {/* Carousel Track */}
        <div
          ref={carouselRef}
          className="relative w-full overflow-hidden rounded-lg"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="flex transition-transform duration-500 ease-in-out w-full"
            style={{ transform: `translateX(-${currentIndex * 100}%)` }}
          >
            {isLoading ? (
              // Loading skeleton - show one large card
              <div className="w-full flex-shrink-0 min-w-0 px-4 md:px-8">
                <div className="w-full max-w-6xl mx-auto rounded-lg border-2 border-border bg-card animate-pulse max-h-[calc(100vh-300px)] overflow-y-auto">
                  <div className="p-6 border-b border-border">
                    <div className="h-8 bg-muted rounded mb-3 w-3/4" />
                    <div className="h-5 bg-muted rounded w-full" />
                    <div className="h-5 bg-muted rounded w-5/6 mt-2" />
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-2 gap-4">
                      {[...Array(4)].map((_, j) => (
                        <div
                          key={j}
                          className="aspect-[9/16] bg-muted rounded"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              moods.map((mood, index) => (
                <div
                  key={mood.id}
                  className="w-full flex-shrink-0 min-w-0 px-4 md:px-8"
                >
                  <div className="w-full max-w-6xl mx-auto">
                    <MoodCard
                      mood={mood}
                      isSelected={selectedMoodId === mood.id}
                      onSelect={onSelectMood}
                      isLoading={isLoading}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Thumbnail Indicators and Continue Button */}
        {!isLoading && (
          <div className="flex items-center justify-between mt-6">
            <div className="flex-1" /> {/* Spacer for centering */}
            {moods.length > 1 ? (
              <div className="flex justify-center gap-2 flex-1">
                {moods.map((mood, index) => {
                  const successfulImages = mood.images.filter(img => img.success && img.url);
                  const firstImage = successfulImages[0];
                  
                  return (
                    <button
                      key={mood.id}
                      onClick={() => goToIndex(index)}
                      className={`
                        relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-all duration-300
                        ${currentIndex === index
                          ? 'border-primary ring-2 ring-primary ring-offset-2 scale-110'
                          : 'border-border hover:border-primary/50 opacity-70 hover:opacity-100'
                        }
                      `}
                      aria-label={`Go to mood board ${index + 1}: ${mood.name}`}
                    >
                      {firstImage ? (
                        <Image
                          src={firstImage.url}
                          alt={mood.name}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">{index + 1}</span>
                        </div>
                      )}
                      {currentIndex === index && (
                        <div className="absolute inset-0 bg-primary/20" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex-1">{/* Spacer when no thumbnails */}</div>
            )}
            <div className="flex-1 flex justify-end">
              {onContinue && (
                <Button
                  onClick={onContinue}
                  disabled={!canContinue}
                  size="lg"
                >
                  Continue with Selected Mood
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Mood Counter */}
        {moods.length > 1 && !isLoading && (
          <div className="text-center mt-4 text-sm text-muted-foreground">
            {currentIndex + 1} of {moods.length}
          </div>
        )}
      </div>
    </div>
  );
}


