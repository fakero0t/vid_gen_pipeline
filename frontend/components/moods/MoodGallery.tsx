'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mood } from '@/types/mood.types';
import { MoodCard } from './MoodCard';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';

// Cheeky loading phrases that rotate
const LOADING_PHRASES = [
  "Crafting your perfect mood... ✨",
  "Gathering inspiration just for you... 🎨",
  "Setting the vibe... 🌈",
  "Curating your mood board masterpiece... 🎭",
  "Hang tight, creativity in progress... 🚀",
  "Brewing some visual magic... ☕",
  "Channeling your aesthetic... 🔮",
  "Weaving together your vision... 🧵",
  "Polishing every pixel... 💎",
  "Almost there, promise! ⏳"
];

function LoadingPhrases() {
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Rotate phrases every 2.5 seconds
    intervalRef.current = setInterval(() => {
      setIsVisible(false);
      
      // After fade out, change phrase and fade in
      setTimeout(() => {
        setCurrentPhraseIndex((prev) => (prev + 1) % LOADING_PHRASES.length);
        setIsVisible(true);
      }, 400); // Match fadeOutDown animation duration
    }, 2500);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return (
    <div className="flex-shrink-0 w-full h-full flex items-center justify-center">
      <div className="text-center px-4">
        <div 
          className={`
            text-sm sm:text-base font-display font-bold
            bg-gradient-to-r from-primary via-primary/80 to-primary
            bg-clip-text text-transparent
            ${isVisible ? 'animate-fadeInUp' : 'animate-fadeOutDown'}
          `}
        >
          {LOADING_PHRASES[currentPhraseIndex]}
        </div>
        <div className="mt-6 flex justify-center gap-2">
          {LOADING_PHRASES.map((_, index) => (
            <div
              key={index}
              className={`
                w-2 h-2 rounded-full transition-all duration-300
                ${index === currentPhraseIndex 
                  ? 'bg-primary scale-125 animate-gentleBounce' 
                  : 'bg-muted-foreground/30'
                }
              `}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

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

  // Calculate card width based on viewport - full width
  useEffect(() => {
    const calculateCardWidth = () => {
      setCardWidth(window.innerWidth);
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
    <div className={`w-full h-full flex flex-col overflow-visible ${className}`}>
      {/* Carousel Container */}
      <div className="relative w-full flex-1 min-h-0 flex flex-col overflow-visible">
        {/* Navigation Arrows - Full screen prominent */}
        {moods.length > 1 && !isLoading && (
          <>
            <Button
              variant="outline"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 z-20 h-12 w-12 rounded-full bg-background/90 backdrop-blur-md shadow-lg hover:bg-background hover:scale-110 transition-all duration-300 border-2"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                goToPrevious();
              }}
              aria-label="Previous mood board"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 z-20 h-12 w-12 rounded-full bg-background/90 backdrop-blur-md shadow-lg hover:bg-background hover:scale-110 transition-all duration-300 border-2"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                goToNext();
              }}
              aria-label="Next mood board"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </>
        )}

        {/* Carousel Track */}
        <div
          ref={carouselRef}
          className="relative w-full flex-1 min-h-0 overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="relative w-full h-full py-4">
            <div
              className="flex transition-transform duration-500 ease-in-out h-full"
              style={{ 
                transform: isLoading 
                  ? 'translateX(0)' 
                  : `translateX(calc(-${currentIndex * 100}%))`
              }}
            >
              {isLoading ? (
                // Loading phrases with animation
                <div className="flex-shrink-0 w-full h-full">
                  <LoadingPhrases />
                </div>
              ) : (
                moods.map((mood, index) => (
                  <div
                    key={mood.id}
                    ref={(el) => { cardRefs.current[index] = el; }}
                    className="flex-shrink-0 w-full h-full px-4"
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
          <div className="flex items-center justify-between mt-2 px-4 sm:px-6 lg:px-8 flex-shrink-0">
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

      </div>
    </div>
  );
}


