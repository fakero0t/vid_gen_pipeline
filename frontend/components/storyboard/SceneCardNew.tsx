'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import type { StoryboardScene } from '@/types/storyboard.types';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { config } from '@/lib/config';
import { useAppStore } from '@/store/appStore';
import { useSceneStore } from '@/store/sceneStore';
import { SceneAssetToggleSection } from './SceneAssetToggleSection';
import { VideoTrimmerOverlay } from './VideoTrimmerOverlay';

interface SceneCardNewProps {
  scene: StoryboardScene;
  sceneNumber: number;
  onApproveText: () => Promise<void>;
  onRegenerateText: () => Promise<void>;
  onEditText: (newText: string) => Promise<void>;
  onApproveImage: () => Promise<void>;
  onRegenerateImage: () => Promise<void>;
  onUpdateDuration: (newDuration: number) => Promise<void>;
  onRegenerateVideo: () => Promise<void>;
  isLoading?: boolean;
  isActive?: boolean;
}

export function SceneCardNew({
  scene,
  sceneNumber,
  onApproveText,
  onRegenerateText,
  onEditText,
  onApproveImage,
  onRegenerateImage,
  onUpdateDuration,
  onRegenerateVideo,
  isLoading = false,
  isActive = true,
}: SceneCardNewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(scene.text);
  const [duration, setDuration] = useState(scene.video_duration);
  const [showEditTextConfirm, setShowEditTextConfirm] = useState(false);
  const [showDurationConfirm, setShowDurationConfirm] = useState(false);
  const [showRegenerateImageConfirm, setShowRegenerateImageConfirm] = useState(false);
  const [pendingDuration, setPendingDuration] = useState<number | null>(null);
  // Show trimmer by default when video is available
  const [isTrimming, setIsTrimming] = useState(false);
  const [localTrimStart, setLocalTrimStart] = useState<number | null>(scene.trim_start_time ?? null);
  const [localTrimEnd, setLocalTrimEnd] = useState<number | null>(scene.trim_end_time ?? null);
  const [actualVideoDuration, setActualVideoDuration] = useState<number>(scene.video_duration);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Define derived state values
  const isGeneratingImage = scene.generation_status.image === 'generating';
  const isGeneratingVideo = scene.generation_status.video === 'generating';

  // Auto-show trimmer when video is available and complete
  useEffect(() => {
    if (scene.state === 'video' && scene.video_url && scene.generation_status.video === 'complete' && !isGeneratingVideo) {
      setIsTrimming(true);
    } else {
      setIsTrimming(false);
    }
  }, [scene.state, scene.video_url, scene.generation_status.video, isGeneratingVideo]);

  // Reset modal states when scene becomes inactive
  useEffect(() => {
    if (!isActive) {
      setShowEditTextConfirm(false);
      setShowDurationConfirm(false);
      setShowRegenerateImageConfirm(false);
      setPendingDuration(null);
    }
  }, [isActive]);

  // Handle text edit with warning
  const handleEditTextClick = () => {
    if (scene.state !== 'text') {
      setShowEditTextConfirm(true);
      return;
    }
    setIsEditing(true);
  };

  const handleConfirmEditText = () => {
    setShowEditTextConfirm(false);
    setIsEditing(true);
  };

  // Handle text save
  const handleSaveText = async () => {
    if (editedText !== scene.text) {
      try {
        await onEditText(editedText);
        setIsEditing(false);
      } catch (error) {
        // Error is handled by the store and displayed in the error alert
        // Keep editing mode open so user can fix and retry
        console.error('Failed to save text:', error);
      }
    } else {
      setIsEditing(false);
    }
  };

  // Handle duration edit with warning
  const handleDurationChange = async (newDuration: number) => {
    if (scene.state === 'video') {
      setPendingDuration(newDuration);
      setShowDurationConfirm(true);
      return;
    }
    setDuration(newDuration);
    await onUpdateDuration(newDuration);
  };

  const handleConfirmDurationChange = async () => {
    setShowDurationConfirm(false);
    if (pendingDuration !== null) {
      setDuration(pendingDuration);
      await onUpdateDuration(pendingDuration);
      setPendingDuration(null);
    }
  };

  // Handle regenerate image with warning if video exists
  const handleRegenerateImageClick = async () => {
    if (scene.state === 'video' && scene.video_url) {
      setShowRegenerateImageConfirm(true);
      return;
    }
    try {
      await onRegenerateImage();
    } catch (error) {
      console.error('Failed to regenerate image:', error);
      // Error is handled by the store and displayed in the error alert
    }
  };

  const handleConfirmRegenerateImage = async () => {
    setShowRegenerateImageConfirm(false);
    try {
      await onRegenerateImage();
    } catch (error) {
      console.error('Failed to regenerate image:', error);
      // Error is handled by the store and displayed in the error alert
    }
  };

  // Get actual video duration from video element
  useEffect(() => {
    if (videoRef.current && scene.video_url) {
      const video = videoRef.current;
      const handleLoadedMetadata = () => {
        setActualVideoDuration(video.duration);
      };
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      if (video.duration) {
        setActualVideoDuration(video.duration);
      }
      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      };
    }
  }, [scene.video_url]);

  // Sync trim times from scene
  useEffect(() => {
    setLocalTrimStart(scene.trim_start_time ?? null);
    setLocalTrimEnd(scene.trim_end_time ?? null);
  }, [scene.trim_start_time, scene.trim_end_time]);

  // Handle trim change - auto-save immediately
  const handleTrimChange = async (startTime: number, endTime: number) => {
    // Clamp endTime to not exceed actual video duration to avoid precision errors
    const clampedEndTime = Math.min(endTime, actualVideoDuration);
    
    setLocalTrimStart(startTime);
    setLocalTrimEnd(clampedEndTime);
    
    // Optimistically update the store immediately so total duration updates in real-time
    const { updateScene } = useSceneStore.getState();
    updateScene(scene.id, {
      trim_start_time: startTime,
      trim_end_time: clampedEndTime,
    });
    
    // Auto-save trim changes
    try {
      const { updateSceneTrim } = useSceneStore.getState();
      await updateSceneTrim(scene.id, startTime, clampedEndTime);
    } catch (error) {
      console.error('Failed to save trim:', error);
      // Error is handled by store
      // On error, revert to previous trim times
      updateScene(scene.id, {
        trim_start_time: scene.trim_start_time,
        trim_end_time: scene.trim_end_time,
      });
      setLocalTrimStart(scene.trim_start_time ?? null);
      setLocalTrimEnd(scene.trim_end_time ?? null);
    }
  };

  // Calculate effective duration (trimmed or original)
  const effectiveDuration = (localTrimStart !== null && localTrimEnd !== null)
    ? localTrimEnd - localTrimStart
    : scene.video_duration;

  return (
    <div className="w-full h-full bg-card border border-border rounded-lg overflow-hidden flex flex-col">
      <div className="flex-1 min-h-0 flex flex-col p-3 sm:p-4 space-y-3 overflow-visible">
        {/* TEXT STATE - only show if not generating image */}
        {scene.state === 'text' && !isGeneratingImage && (
          <div className="flex-1 min-h-0 flex gap-4 overflow-visible">
            {/* Left: Assets sections - 2/3 width */}
            <div className="w-2/3 flex-shrink-0 flex flex-col h-full min-w-0 gap-2 justify-between overflow-visible">
              <div className="flex-1 min-h-0 overflow-visible">
                <SceneAssetToggleSection scene={scene} />
              </div>
              
              {/* Product Toggle */}
              {config.isProductMode() && (
                <div className="flex-shrink-0">
                  <ProductToggleSection scene={scene} />
                </div>
              )}
            </div>

            {/* Right: Scene description and controls - 1/3 width */}
            <div className="w-1/3 flex-shrink-0 flex flex-col h-full min-w-0 justify-between">
              {/* Scene Description - takes available space */}
              <div className="flex-1 min-h-0 flex flex-col space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 flex-shrink-0">
                  Scene Description
                  <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={handleEditTextClick} disabled={isLoading} title="Edit text">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </Button>
                </h3>
                {isEditing ? (
                  <div className="flex-1 min-h-0 flex flex-col space-y-2">
                    <textarea
                      value={editedText}
                      onChange={(e) => setEditedText(e.target.value)}
                      className="flex-1 min-h-0 p-3 text-sm border-2 border-primary rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                      disabled={isLoading}
                    />
                    <div className="flex gap-2 flex-shrink-0">
                      <Button size="sm" className="h-8 text-xs px-3" onClick={handleSaveText} disabled={isLoading}>
                        Save
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-xs px-3" onClick={() => {
                        setEditedText(scene.text);
                        setIsEditing(false);
                      }} disabled={isLoading}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-base leading-relaxed flex-1 min-h-0 overflow-y-auto pr-2">{scene.text}</p>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col items-center gap-2.5 pt-4 flex-shrink-0">
                <Button size="sm" variant="outline" onClick={onRegenerateText} disabled={isLoading} className="w-3/5 h-[32px] text-xs px-3">
                  <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Regenerate
                </Button>

                <Button onClick={onApproveText} disabled={isLoading || isEditing || isGeneratingImage} size="sm" className="w-3/5 h-[32px] text-xs px-3">
                  {isGeneratingImage ? (
                    <>
                      <div className="w-3.5 h-3.5 mr-1.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Generating Image...
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Approve & Generate Image
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* IMAGE STATE - show when state is 'image' OR when generating image */}
        {(scene.state === 'image' || isGeneratingImage) && (
          <div className="flex-1 min-h-0 flex gap-4">
            {/* Left: Image preview - 2/3 width */}
            <div className="w-2/3 flex-shrink-0 relative rounded-lg overflow-hidden flex items-center justify-center">
              {isGeneratingImage ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-muted/50">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                  <p className="text-sm text-muted-foreground">Generating image...</p>
                </div>
              ) : scene.image_url ? (
                <div className="relative w-full h-full">
                  <Image
                    src={scene.image_url.startsWith('http') 
                      ? scene.image_url 
                      : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${scene.image_url}`
                    }
                    alt={`Scene ${sceneNumber}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 66vw, 800px"
                  />
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted/50">
                  <p className="text-muted-foreground">No image generated</p>
                </div>
              )}
            </div>

            {/* Right: Controls and text - 1/3 width */}
            <div className="w-1/3 flex-shrink-0 flex flex-col h-full min-w-0 justify-between">
              {/* Scene Description - takes available space */}
              <div className="flex-1 min-h-0 flex flex-col space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 flex-shrink-0">
                  Scene Description
                  <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={handleEditTextClick} disabled={isLoading} title="Edit text (will erase image/video)">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </Button>
                </h3>
                {isEditing ? (
                  <div className="flex-1 min-h-0 flex flex-col space-y-2">
                    <textarea
                      value={editedText}
                      onChange={(e) => setEditedText(e.target.value)}
                      className="flex-1 min-h-0 p-3 text-sm border-2 border-primary rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                      disabled={isLoading}
                    />
                    <div className="flex gap-2 flex-shrink-0">
                      <Button size="sm" className="h-8 text-xs px-3" onClick={handleSaveText} disabled={isLoading}>
                        Save
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-xs px-3" onClick={() => {
                        setEditedText(scene.text);
                        setIsEditing(false);
                      }} disabled={isLoading}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-base leading-relaxed flex-1 min-h-0 overflow-y-auto pr-2">{scene.text}</p>
                )}
              </div>

              {/* Duration configuration */}
              <div className="space-y-2 pt-4 flex-shrink-0">
                <div className="flex justify-center">
                  <div className="w-3/5 flex items-center justify-between">
                  <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Video Duration</h4>
                  <span className="text-base font-semibold tabular-nums">{duration.toFixed(1)}s</span>
                  </div>
                </div>
                <div className="flex justify-center">
                <input
                  type="range"
                  min="1"
                  max="8"
                  step="0.1"
                  value={duration}
                  onChange={(e) => {
                    const newValue = parseFloat(e.target.value);
                    setDuration(newValue);
                  }}
                  onMouseUp={(e) => {
                    const newValue = parseFloat((e.target as HTMLInputElement).value);
                    handleDurationChange(newValue);
                  }}
                  onTouchEnd={(e) => {
                    const newValue = parseFloat((e.target as HTMLInputElement).value);
                    handleDurationChange(newValue);
                  }}
                    className="w-3/5 h-2.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary hover:accent-primary/80 transition-all duration-200 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:duration-200 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isLoading || isGeneratingImage || isGeneratingVideo}
                />
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col items-center gap-2.5 pt-4 flex-shrink-0">
                <Button size="sm" variant="outline" onClick={handleRegenerateImageClick} disabled={isGeneratingImage || isGeneratingVideo} className="w-3/5 h-[32px] text-xs px-3">
                  <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Regenerate Image
                </Button>

                <Button onClick={onApproveImage} disabled={isLoading || isGeneratingImage || isGeneratingVideo} size="sm" className="w-3/5 h-[32px] text-xs px-3">
                  {isGeneratingVideo ? (
                    <>
                      <div className="w-3.5 h-3.5 mr-1.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Generating Video...
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Approve & Generate Video
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* VIDEO STATE */}
        {scene.state === 'video' && (
          <div className="flex-1 min-h-0 flex gap-4">
            {/* Left: Video player with trimmer below - 2/3 width */}
            <div className="w-2/3 flex-shrink-0 flex flex-col gap-2">
              {/* Video container - takes most space, trimmer below */}
              <div className="flex-1 min-h-0 relative rounded-lg overflow-hidden flex items-center justify-center bg-black border border-border">
                {isGeneratingVideo ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-white dark:bg-zinc-900 text-black dark:text-white">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black dark:border-white mb-4"></div>
                    <p className="text-sm">Generating video...</p>
                    <p className="text-xs text-black/60 dark:text-white/60 mt-2">This may take up to 2 minutes</p>
                  </div>
                ) : scene.video_url ? (
                  <video
                    ref={videoRef}
                    src={scene.video_url}
                    controls
                    className="w-full h-full object-contain"
                    poster={scene.image_url || undefined}
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white">
                    <p>No video generated</p>
                  </div>
                )}
              </div>
              {/* Trimmer below video */}
              {isTrimming && scene.video_url && (
                <VideoTrimmerOverlay
                  videoElement={videoRef.current}
                  originalDuration={actualVideoDuration}
                  trimStartTime={localTrimStart}
                  trimEndTime={localTrimEnd}
                  onTrimChange={handleTrimChange}
                  isVisible={isTrimming}
                  disabled={isLoading}
                />
              )}
            </div>

            {/* Right: Controls and text - 1/3 width */}
            <div className="w-1/3 flex-shrink-0 flex flex-col h-full min-w-0 justify-between">
              {/* Scene Description - takes available space */}
              <div className="flex-1 min-h-0 flex flex-col space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 flex-shrink-0">
                  Scene Description
                  <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={handleEditTextClick} disabled={isLoading} title="Edit text (will erase image/video)">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </Button>
                </h3>
                {isEditing ? (
                  <div className="flex-1 min-h-0 flex flex-col space-y-2">
                    <textarea
                      value={editedText}
                      onChange={(e) => setEditedText(e.target.value)}
                      className="flex-1 min-h-0 p-3 text-sm border-2 border-primary rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                      disabled={isLoading}
                    />
                    <div className="flex gap-2 flex-shrink-0">
                      <Button size="sm" className="h-8 text-xs px-3" onClick={handleSaveText} disabled={isLoading}>
                        Save
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-xs px-3" onClick={() => {
                        setEditedText(scene.text);
                        setIsEditing(false);
                      }} disabled={isLoading}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-base leading-relaxed flex-1 min-h-0 overflow-y-auto pr-2">{scene.text}</p>
                )}
              </div>

              {/* Duration configuration */}
              <div className="space-y-2 pt-4 flex-shrink-0">
                <div className="flex justify-center">
                  <div className="w-3/5 flex items-center justify-between">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Video Duration</h4>
                    <div className="flex flex-col items-end">
                      <span className="text-base font-semibold tabular-nums">{duration.toFixed(1)}s</span>
                      {localTrimStart !== null && localTrimEnd !== null && (
                        <span className="text-xs text-primary tabular-nums">
                          Trimmed: {effectiveDuration.toFixed(1)}s
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex justify-center">
                  <input
                    type="range"
                    min="1"
                    max="8"
                    step="0.1"
                    value={duration}
                    onChange={(e) => {
                      const newValue = parseFloat(e.target.value);
                      setDuration(newValue);
                    }}
                    onMouseUp={(e) => {
                      const newValue = parseFloat((e.target as HTMLInputElement).value);
                      handleDurationChange(newValue);
                    }}
                    onTouchEnd={(e) => {
                      const newValue = parseFloat((e.target as HTMLInputElement).value);
                      handleDurationChange(newValue);
                    }}
                    className="w-3/5 h-2.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary hover:accent-primary/80 transition-all duration-200 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:duration-200 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isLoading || isGeneratingImage || isGeneratingVideo}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col items-center gap-2.5 pt-4 flex-shrink-0">
                <Button size="sm" variant="outline" onClick={handleRegenerateImageClick} disabled={isGeneratingImage || isGeneratingVideo} className="w-3/5 h-[32px] text-xs px-3">
                  <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Regenerate Image
                </Button>
                <Button size="sm" variant="outline" onClick={onRegenerateVideo} disabled={isLoading || isGeneratingVideo} className="w-3/5 h-[32px] text-xs px-3">
                  <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Regenerate Video
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Dialogs - render always (fixed positioning), but only allow interaction when active */}
      <ConfirmDialog
        isOpen={showEditTextConfirm && isActive}
        title="Edit Scene Text"
        message="Editing text will erase image and video. This cannot be undone. Are you sure?"
        confirmText="Yes, Edit Text"
        cancelText="Cancel"
        onConfirm={handleConfirmEditText}
        onCancel={() => setShowEditTextConfirm(false)}
        variant="destructive"
      />

      <ConfirmDialog
        isOpen={showDurationConfirm && isActive}
        title="Edit Video Duration"
        message="Editing duration will erase video. This cannot be undone. Are you sure?"
        confirmText="Yes, Edit Duration"
        cancelText="Cancel"
        onConfirm={handleConfirmDurationChange}
        onCancel={() => {
          setShowDurationConfirm(false);
          setPendingDuration(null);
        }}
        variant="destructive"
      />

      <ConfirmDialog
        isOpen={showRegenerateImageConfirm && isActive}
        title="Regenerate Image"
        message="Regenerating image will erase video. This cannot be undone. Are you sure?"
        confirmText="Yes, Regenerate"
        cancelText="Cancel"
        onConfirm={handleConfirmRegenerateImage}
        onCancel={() => setShowRegenerateImageConfirm(false)}
        variant="destructive"
      />
    </div>
  );
}

// Product Toggle Section Component
function ProductToggleSection({ scene }: { scene: StoryboardScene }) {
  const uploadedProduct = useAppStore((s) => s.uploadedProduct);
  const { enableProductComposite, disableProductComposite } = useSceneStore();
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsToggling(true);
    try {
      if (e.target.checked && uploadedProduct) {
        await enableProductComposite(scene.id, uploadedProduct.product_id);
        
        if (scene.image_url) {
          // Show toast: scene will be regenerated
          console.log('Scene will be regenerated with product');
        }
      } else {
        await disableProductComposite(scene.id);
        
        if (scene.image_url) {
          console.log('Scene will be regenerated without product');
        }
      }
    } catch (error) {
      console.error('Failed to toggle product:', error);
    } finally {
      setIsToggling(false);
    }
  };

  if (!uploadedProduct) {
    return null;
  }

  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={scene.use_product_composite || false}
        onChange={handleToggle}
        disabled={isToggling}
        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
      />
      <div className="flex items-center gap-2">
        {scene.use_product_composite && (
          <div className="relative w-8 h-8 flex-shrink-0">
            <img
              src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${uploadedProduct.thumbnail_url}`}
              alt="Product"
              className="w-full h-full object-contain rounded"
            />
          </div>
        )}
        <span className="text-sm font-medium text-foreground">
          {scene.use_product_composite ? 'Product included' : 'Include product in this scene'}
        </span>
      </div>
    </label>
  );
}
