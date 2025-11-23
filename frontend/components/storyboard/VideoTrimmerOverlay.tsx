'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface VideoTrimmerOverlayProps {
  videoElement: HTMLVideoElement | null;
  originalDuration: number;
  trimStartTime?: number | null;
  trimEndTime?: number | null;
  onTrimChange: (startTime: number, endTime: number) => void;
  disabled?: boolean;
  isVisible: boolean;
}

export function VideoTrimmerOverlay({
  videoElement,
  originalDuration,
  trimStartTime,
  trimEndTime,
  onTrimChange,
  disabled = false,
  isVisible,
}: VideoTrimmerOverlayProps) {
  const [localStart, setLocalStart] = useState<number>(trimStartTime ?? 0);
  const [localEnd, setLocalEnd] = useState<number>(trimEndTime ?? originalDuration);
  const [isDragging, setIsDragging] = useState<'start' | 'end' | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const timelineRef = useRef<HTMLDivElement>(null);
  const startHandleRef = useRef<HTMLDivElement>(null);
  const endHandleRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize from props
  useEffect(() => {
    if (trimStartTime !== null && trimStartTime !== undefined) {
      setLocalStart(trimStartTime);
    } else {
      setLocalStart(0);
    }
    if (trimEndTime !== null && trimEndTime !== undefined) {
      setLocalEnd(trimEndTime);
    } else {
      setLocalEnd(originalDuration);
    }
  }, [trimStartTime, trimEndTime, originalDuration]);

  // Sync video currentTime to overlay and constrain playback to trimmed range
  useEffect(() => {
    if (!videoElement || !isVisible) return;

    const updateCurrentTime = () => {
      const current = videoElement.currentTime;
      setCurrentTime(current);
      
      // Constrain playback to trimmed range
      if (localStart !== null && localEnd !== null) {
        if (current < localStart) {
          videoElement.currentTime = localStart;
        } else if (current > localEnd) {
          videoElement.currentTime = localStart; // Loop back to start
          videoElement.pause();
        }
      }
    };

    const handlePlay = () => {
      // When play is pressed, start from trim start if outside range
      if (localStart !== null && localEnd !== null) {
        if (videoElement.currentTime < localStart || videoElement.currentTime > localEnd) {
          videoElement.currentTime = localStart;
        }
      }
    };

    videoElement.addEventListener('timeupdate', updateCurrentTime);
    videoElement.addEventListener('play', handlePlay);
    
    return () => {
      videoElement.removeEventListener('timeupdate', updateCurrentTime);
      videoElement.removeEventListener('play', handlePlay);
    };
  }, [videoElement, isVisible, localStart, localEnd]);

  // Calculate positions as percentages
  const startPercent = (localStart / originalDuration) * 100;
  const endPercent = (localEnd / originalDuration) * 100;
  const currentPercent = (currentTime / originalDuration) * 100;
  const trimmedDuration = localEnd - localStart;

  // Handle mouse/touch events for dragging
  const handleMouseDown = useCallback((handle: 'start' | 'end', e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragging(handle);
  }, [disabled]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !timelineRef.current || disabled) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const time = (percent / 100) * originalDuration;

    if (isDragging === 'start') {
      const newStart = Math.max(0, Math.min(time, localEnd - 0.5)); // Min 0.5s duration
      setLocalStart(newStart);
      if (videoElement) {
        videoElement.currentTime = newStart;
      }
    } else {
      const newEnd = Math.max(localStart + 0.5, Math.min(time, originalDuration)); // Min 0.5s duration
      setLocalEnd(newEnd);
      if (videoElement) {
        videoElement.currentTime = newEnd;
      }
    }
  }, [isDragging, localStart, localEnd, originalDuration, videoElement, disabled]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(null);
      // Auto-save trim changes (debounced)
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        onTrimChange(localStart, localEnd);
      }, 300); // Debounce by 300ms
    }
  }, [isDragging, localStart, localEnd, onTrimChange]);

  // Global mouse events
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Handle timeline click to scrub
  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (!timelineRef.current || disabled) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const time = (percent / 100) * originalDuration;
    if (videoElement) {
      videoElement.currentTime = time;
    }
  }, [originalDuration, videoElement, disabled]);

  if (!isVisible) return null;

  return (
    <div className="w-full flex-shrink-0">
      {/* Timeline container - compact */}
      <div className="w-full">
        <div
          ref={timelineRef}
          className="relative h-10 bg-black/90 backdrop-blur-sm rounded-lg cursor-pointer border border-white/20"
          onClick={handleTimelineClick}
        >
            {/* Unselected portions (dimmed) */}
            {startPercent > 0 && (
              <div
                className="absolute left-0 top-0 h-full bg-zinc-900/60 rounded-l-lg"
                style={{ width: `${startPercent}%` }}
              />
            )}
            {endPercent < 100 && (
              <div
                className="absolute right-0 top-0 h-full bg-zinc-900/60 rounded-r-lg"
                style={{ width: `${100 - endPercent}%` }}
              />
            )}

            {/* Selected portion (highlighted) */}
            <div
              className="absolute top-0 h-full bg-primary/80"
              style={{
                left: `${startPercent}%`,
                width: `${endPercent - startPercent}%`,
              }}
            />

            {/* Current playhead */}
            <div
              className="absolute top-0 h-full w-0.5 bg-white z-10"
              style={{ left: `${currentPercent}%` }}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full -translate-y-1/2" />
            </div>

            {/* Start handle */}
            <div
              ref={startHandleRef}
              className="absolute top-0 h-full w-1.5 bg-primary border border-white rounded-l cursor-ew-resize z-20 hover:bg-primary/90"
              style={{ left: `${startPercent}%`, transform: 'translateX(-50%)' }}
              onMouseDown={(e) => handleMouseDown('start', e)}
            >
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-white text-[10px] font-semibold whitespace-nowrap bg-black/80 px-1 rounded">
                {localStart.toFixed(1)}s
              </div>
            </div>

            {/* End handle */}
            <div
              ref={endHandleRef}
              className="absolute top-0 h-full w-1.5 bg-primary border border-white rounded-r cursor-ew-resize z-20 hover:bg-primary/90"
              style={{ left: `${endPercent}%`, transform: 'translateX(50%)' }}
              onMouseDown={(e) => handleMouseDown('end', e)}
            >
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-white text-[10px] font-semibold whitespace-nowrap bg-black/80 px-1 rounded">
                {localEnd.toFixed(1)}s
              </div>
            </div>

            {/* Time labels - smaller and positioned inside */}
            <div className="absolute -bottom-5 left-0 right-0 flex justify-between text-xs text-white/70">
              <span>0s</span>
              <span>{originalDuration.toFixed(1)}s</span>
            </div>
          </div>

          {/* Duration info - compact */}
          <div className="mt-1 flex items-center justify-center">
            <div className="text-xs bg-black/80 px-2 py-1 rounded">
              <span className="text-white/60">Original: </span>
              <span className="font-semibold text-white">{originalDuration.toFixed(1)}s</span>
              <span className="text-white/60 mx-1.5">|</span>
              <span className="text-white/60">Trimmed: </span>
              <span className="font-semibold text-primary">{trimmedDuration.toFixed(1)}s</span>
            </div>
          </div>
        </div>
    </div>
  );
}

