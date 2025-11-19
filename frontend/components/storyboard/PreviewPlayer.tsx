'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import type { StoryboardScene, PreviewData } from '@/types/storyboard.types';
import { Button } from '@/components/ui/button';

interface PreviewPlayerProps {
  scenes: StoryboardScene[];
  sceneOrder: string[];
  isOpen: boolean;
  onClose: () => void;
}

/**
 * PreviewPlayer Component
 *
 * Displays a concatenated preview of all scenes with placeholders for incomplete scenes:
 * - Video: Play actual video if available
 * - Image: Display image for configured duration if no video
 * - Text: Display text for 5 seconds if no image
 */
export function PreviewPlayer({ scenes, sceneOrder, isOpen, onClose }: PreviewPlayerProps) {
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get preview data for all scenes in order
  const previewData: PreviewData[] = sceneOrder.map((sceneId) => {
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene) {
      return {
        scene_id: sceneId,
        type: 'text',
        text: 'Scene not found',
        duration: 5,
      };
    }

    // Video available - use it
    if (scene.video_url && scene.generation_status.video === 'complete') {
      return {
        scene_id: scene.id,
        type: 'video',
        url: scene.video_url,
        duration: scene.video_duration,
      };
    }

    // Image available - use it with duration
    if (scene.image_url && scene.generation_status.image === 'complete') {
      return {
        scene_id: scene.id,
        type: 'image',
        url: scene.image_url,
        duration: scene.video_duration || 5,
      };
    }

    // Fallback to text
    return {
      scene_id: scene.id,
      type: 'text',
      text: scene.text,
      duration: 5,
    };
  });

  const currentPreview = previewData[currentSceneIndex];
  const totalScenes = previewData.length;

  // Calculate total duration
  const totalDuration = previewData.reduce((sum, data) => sum + data.duration, 0);

  // Handle play/pause
  const handlePlayPause = () => {
    if (isPlaying) {
      pausePlayback();
    } else {
      startPlayback();
    }
  };

  // Start playback
  const startPlayback = () => {
    setIsPlaying(true);
    if (currentPreview.type === 'video' && videoRef.current) {
      videoRef.current.play();
    } else {
      // For image/text, set timeout for duration
      timeoutRef.current = setTimeout(() => {
        nextScene();
      }, currentPreview.duration * 1000);
    }
  };

  // Pause playback
  const pausePlayback = () => {
    setIsPlaying(false);
    if (currentPreview.type === 'video' && videoRef.current) {
      videoRef.current.pause();
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  // Go to next scene
  const nextScene = () => {
    if (currentSceneIndex < totalScenes - 1) {
      setCurrentSceneIndex(currentSceneIndex + 1);
      setProgress(0);
    } else {
      // Reached end
      setIsPlaying(false);
      setCurrentSceneIndex(0);
      setProgress(0);
    }
  };

  // Go to previous scene
  const prevScene = () => {
    if (currentSceneIndex > 0) {
      setCurrentSceneIndex(currentSceneIndex - 1);
      setProgress(0);
      setIsPlaying(false);
    }
  };

  // Reset when scene changes
  useEffect(() => {
    setProgress(0);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Auto-play next scene if currently playing
    if (isPlaying) {
      if (currentPreview.type === 'video' && videoRef.current) {
        videoRef.current.play();
      } else {
        timeoutRef.current = setTimeout(() => {
          nextScene();
        }, currentPreview.duration * 1000);
      }
    }
  }, [currentSceneIndex]);

  // Handle video end
  const handleVideoEnded = () => {
    nextScene();
  };

  // Update progress for video playback
  const handleVideoTimeUpdate = () => {
    if (videoRef.current) {
      const percent = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(percent);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentSceneIndex(0);
      setIsPlaying(false);
      setProgress(0);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-card border border-border rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-xl font-bold">Scene Preview</h2>
            <p className="text-sm text-muted-foreground">
              Scene {currentSceneIndex + 1} of {totalScenes} • {totalDuration.toFixed(1)}s total
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Preview Area */}
        <div className="relative aspect-[9/16] max-h-[600px] bg-black">
          {currentPreview.type === 'video' && currentPreview.url ? (
            <video
              ref={videoRef}
              src={currentPreview.url}
              className="w-full h-full object-contain"
              onEnded={handleVideoEnded}
              onTimeUpdate={handleVideoTimeUpdate}
            />
          ) : currentPreview.type === 'image' && currentPreview.url ? (
            <div className="relative w-full h-full">
              <Image
                src={currentPreview.url.startsWith('http') 
                  ? currentPreview.url 
                  : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${currentPreview.url}`
                }
                alt={`Scene ${currentSceneIndex + 1}`}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 800px"
              />
              <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-sm rounded-lg p-3">
                <p className="text-white text-sm">
                  {currentPreview.duration.toFixed(1)}s duration (placeholder)
                </p>
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center p-8">
              <div className="max-w-md text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                  <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-white text-lg leading-relaxed">{currentPreview.text}</p>
                <p className="text-white/60 text-sm mt-4">5s duration (text placeholder)</p>
              </div>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Controls */}
        <div className="p-4 space-y-4">
          {/* Scene indicator */}
          <div className="flex gap-1">
            {previewData.map((_, idx) => (
              <div
                key={idx}
                className={`flex-1 h-1 rounded-full transition-colors ${
                  idx === currentSceneIndex
                    ? 'bg-primary'
                    : idx < currentSceneIndex
                    ? 'bg-primary/50'
                    : 'bg-muted'
                }`}
              />
            ))}
          </div>

          {/* Playback controls */}
          <div className="flex items-center justify-center gap-4">
            <Button
              size="sm"
              variant="outline"
              onClick={prevScene}
              disabled={currentSceneIndex === 0}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" />
              </svg>
            </Button>

            <Button size="lg" onClick={handlePlayPause}>
              {isPlaying ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
              )}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={nextScene}
              disabled={currentSceneIndex === totalScenes - 1}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798l-5.445-3.63z" />
              </svg>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
