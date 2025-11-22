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
  const [cardWidth, setCardWidth] = useState(600);
  const carouselRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const isUserNavigation = useRef(false);
  const skipSyncRef = useRef(false);

  // Calculate card width based on viewport
  useEffect(() => {
    const calculateCardWidth = () => {
      const imageWidth = window.innerWidth < 640 ? 300 : 400;
      const textWidth = window.innerWidth < 640 ? 192 : 256;
      setCardWidth(imageWidth + textWidth + 16); // 16px for gap
    };
    
    calculateCardWidth();
    window.addEventListener('resize', calculateCardWidth);
    return () => window.removeEventListener('resize', calculateCardWidth);
  }, []);

  // Sync currentIndex with selectedMoodId (only when selectedMoodId changes externally)
  // This ensures the carousel shows the selected mood board
  useEffect(() => {
    if (skipSyncRef.current) {
      skipSyncRef.current = false;
      return;
    }
    if (selectedMoodId && moods.length > 0) {
      const index = moods.findIndex(m => m.id === selectedMoodId);
      if (index !== -1 && index !== currentIndex) {
        setCurrentIndex(index);
      }
    }
  }, [selectedMoodId, moods.length, currentIndex]);

  // Reset navigation flag - navigation arrows should NOT auto-select
  // Selection only happens when user explicitly clicks on a card
  useEffect(() => {
    if (isUserNavigation.current) {
      isUserNavigation.current = false;
    }
  }, [currentIndex]);

  const goToPrevious = useCallback(() => {
    if (moods.length === 0) return;
    isUserNavigation.current = true;
    skipSyncRef.current = true; // Prevent sync from overriding navigation
    setCurrentIndex((prev) => (prev === 0 ? moods.length - 1 : prev - 1));
  }, [moods.length]);

  const goToNext = useCallback(() => {
    if (moods.length === 0) return;
    isUserNavigation.current = true;
    skipSyncRef.current = true; // Prevent sync from overriding navigation
    setCurrentIndex((prev) => (prev === moods.length - 1 ? 0 : prev + 1));
  }, [moods.length]);

  const goToIndex = useCallback((index: number) => {
    if (index >= 0 && index < moods.length && index !== currentIndex) {
      // Navigation via thumbnails should only navigate, not select
      isUserNavigation.current = true;
      skipSyncRef.current = true; // Prevent sync from overriding navigation
      setCurrentIndex(index);
    }
  }, [moods.length, currentIndex]);

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
    <div className={`w-full h-full flex flex-col ${className}`}>
      {/* Carousel Container */}
      <div className="relative w-full flex-1 min-h-0 flex flex-col">
        {/* Navigation Arrows */}
        {moods.length > 1 && !isLoading && (
          <>
            <Button
              variant="outline"
              size="icon"
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm shadow-md hover:bg-background transition-all duration-300"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                goToPrevious();
              }}
              aria-label="Previous mood board"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm shadow-md hover:bg-background transition-all duration-300"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                goToNext();
              }}
              aria-label="Next mood board"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}

        {/* Carousel Track */}
        <div
          ref={carouselRef}
          className="relative w-full flex-1 min-h-0 overflow-visible"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="relative w-full h-full flex items-center justify-center">
            <div
              className="flex transition-transform duration-500 ease-in-out h-full items-center gap-4"
              style={{ 
                transform: isLoading 
                  ? 'translateX(0)' 
                  : `translateX(calc(50% - ${currentIndex * (cardWidth + 16)}px - ${cardWidth / 2}px))`
              }}
            >
              {isLoading ? (
                // Loading skeleton - show one large card, always centered
                <div 
                  ref={(el) => { cardRefs.current[0] = el; }}
                  className="flex-shrink-0 h-full flex items-center justify-center"
                >
                  <div className="w-auto h-[400px] sm:h-[500px] max-h-[80vh] rounded-xl border-2 border-border bg-card animate-pulse flex flex-row">
                    <div className="p-2 w-[300px] sm:w-[400px] min-h-0 flex-shrink-0">
                      <div className="grid grid-cols-2 gap-1.5 h-full">
                        {[...Array(4)].map((_, j) => (
                          <div
                            key={j}
                            className="bg-muted rounded-md"
                          />
                        ))}
                      </div>
                    </div>
                    <div className="p-2 sm:p-3 w-48 sm:w-64 border-l border-border flex-shrink-0 flex flex-col justify-center">
                      <div className="h-5 bg-muted rounded mb-2 w-3/4" />
                      <div className="h-3 bg-muted rounded w-full mb-2" />
                      <div className="h-3 bg-muted rounded w-5/6" />
                    </div>
                  </div>
                </div>
              ) : (
                moods.map((mood, index) => (
                  <div
                    key={mood.id}
                    ref={(el) => { cardRefs.current[index] = el; }}
                    className="flex-shrink-0 h-full flex items-center"
                  >
                    <MoodCard
                      mood={mood}
                      isSelected={selectedMoodId === mood.id}
                      onSelect={onSelectMood}
                      isLoading={isLoading}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Thumbnail Indicators and Continue Button */}
        {!isLoading && (
          <div className="flex items-center justify-between mt-2 flex-shrink-0">
            <div className="flex-1" /> {/* Spacer for centering */}
            {moods.length > 1 ? (
              <div className="flex justify-center gap-1 flex-1">
                {moods.map((mood, index) => {
                  const successfulImages = mood.images.filter(img => img.success && img.url);
                  const firstImage = successfulImages[0];
                  
                  return (
                    <button
                      key={mood.id}
                      onClick={() => goToIndex(index)}
                      className={`
                        relative w-8 h-8 rounded-md overflow-hidden border transition-all duration-300
                        ${currentIndex === index
                          ? 'border-primary ring-1 ring-primary scale-105'
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
                          sizes="32px"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <span className="text-[9px] text-muted-foreground">{index + 1}</span>
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
                <button
                  onClick={onContinue}
                  disabled={!canContinue}
                  className="group btn-primary-bold disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-1 text-xs px-3 py-1.5"
                >
                  <span>Continue</span>
                  <svg className="w-3 h-3 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Mood Counter */}
        {moods.length > 1 && !isLoading && (
          <div className="text-center mt-1 text-[10px] text-muted-foreground flex-shrink-0">
            {currentIndex + 1} of {moods.length}
          </div>
        )}
      </div>
    </div>
  );
}


