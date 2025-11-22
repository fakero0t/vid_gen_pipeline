'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import type { StoryboardScene } from '@/types/storyboard.types';
import { Button } from '@/components/ui/button';
import { config } from '@/lib/config';
import { useAppStore } from '@/store/appStore';
import { useSceneStore } from '@/store/sceneStore';
import { SceneAssetDisplay } from './SceneAssetDisplay';
import { SceneAssetToggleSection } from './SceneAssetToggleSection';

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
}: SceneCardNewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(scene.text);
  const [duration, setDuration] = useState(scene.video_duration);

  // Handle text edit with warning
  const handleEditTextClick = () => {
    if (scene.state !== 'text') {
      const confirmed = window.confirm(
        'Editing text will erase image and video. This cannot be undone. Are you sure?'
      );
      if (!confirmed) return;
    }
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
      const confirmed = window.confirm(
        'Editing duration will erase video. This cannot be undone. Are you sure?'
      );
      if (!confirmed) return;
    }
    setDuration(newDuration);
    await onUpdateDuration(newDuration);
  };

  const isGeneratingImage = scene.generation_status.image === 'generating';
  const isGeneratingVideo = scene.generation_status.video === 'generating';
  const hasError = !!scene.error_message;

  return (
    <div className="w-full h-full max-w-4xl mx-auto bg-card border border-border rounded-lg overflow-hidden flex flex-col">
      {/* Scene number badge */}
      <div className="absolute top-3 left-3 z-10 bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm shadow-md">
        {sceneNumber}
      </div>

      {/* Error alert */}
      {hasError && (
        <div className="bg-destructive/10 border-b border-destructive px-6 py-3">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-destructive mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-medium text-destructive">Error</p>
              <p className="text-xs text-destructive/80">{scene.error_message}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
        {/* TEXT STATE */}
        {scene.state === 'text' && (
          <div className="space-y-4">
            {/* Text content */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Scene Description</h3>
              {isEditing ? (
                <textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className="w-full min-h-[120px] p-4 border-2 border-primary rounded-lg bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={isLoading}
                />
              ) : (
                <p className="text-base leading-relaxed">{scene.text}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-4 pt-4 border-t border-border">
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <Button size="sm" onClick={handleSaveText} disabled={isLoading}>
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => {
                      setEditedText(scene.text);
                      setIsEditing(false);
                    }} disabled={isLoading}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="outline" onClick={handleEditTextClick} disabled={isLoading}>
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={onRegenerateText} disabled={isLoading}>
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Regenerate
                    </Button>
                  </>
                )}
              </div>

              <Button onClick={onApproveText} disabled={isLoading || isEditing || isGeneratingImage} size="lg">
                {isGeneratingImage ? (
                  <>
                    <div className="w-5 h-5 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Generating Image...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Approve & Generate Image
                  </>
                )}
              </Button>
            </div>
            
            {/* Product Toggle */}
            {config.isProductMode() && (
              <div className="pt-4 border-t border-border">
                <ProductToggleSection scene={scene} />
              </div>
            )}
            
            {/* Asset Toggle Section */}
            <div className="pt-4 border-t border-border">
              <SceneAssetToggleSection scene={scene} />
            </div>
            
            {/* Asset Display (read-only, shows what's selected) */}
            <SceneAssetDisplay scene={scene} />
          </div>
        )}

        {/* IMAGE STATE */}
        {scene.state === 'image' && (
          <div className="space-y-4">
            {/* Image display */}
            <div className="relative aspect-video max-h-[600px] sm:max-h-[700px] rounded-lg overflow-hidden bg-muted border border-border">
              {isGeneratingImage ? (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                  <p className="text-sm text-muted-foreground">Generating image...</p>
                </div>
              ) : scene.image_url ? (
                <Image
                  src={scene.image_url.startsWith('http') 
                    ? scene.image_url 
                    : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${scene.image_url}`
                  }
                  alt={`Scene ${sceneNumber}`}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, 800px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <p className="text-muted-foreground">No image generated</p>
                </div>
              )}
            </div>

            {/* Text below image */}
            <div className="space-y-2">
              {isEditing ? (
                <div className="space-y-2">
                  <textarea
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    className="w-full min-h-[120px] p-4 border-2 border-primary rounded-lg bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={isLoading}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveText} disabled={isLoading}>
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => {
                      setEditedText(scene.text);
                      setIsEditing(false);
                    }} disabled={isLoading}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm leading-relaxed flex-1">{scene.text}</p>
                  <Button size="sm" variant="ghost" onClick={handleEditTextClick} disabled={isLoading} title="Edit text (will erase image/video)">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </Button>
                </div>
              )}
            </div>

            {/* Duration configuration */}
            <div className="space-y-2 pt-3 border-t border-border">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Video Duration</h4>
                <span className="text-sm font-semibold tabular-nums">{duration.toFixed(1)}s</span>
              </div>
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
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary hover:accent-primary/80 transition-all duration-200 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:duration-200 [&::-webkit-slider-thumb]:hover:scale-110 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-md"
                disabled={isLoading}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-4">
              <Button size="sm" variant="outline" onClick={onRegenerateImage} disabled={isLoading || isGeneratingImage || isGeneratingVideo}>
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Regenerate Image
              </Button>

              <Button onClick={onApproveImage} disabled={isLoading || isGeneratingImage || isGeneratingVideo} size="lg">
                {isGeneratingVideo ? (
                  <>
                    <div className="w-5 h-5 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Generating Video...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Approve & Generate Video
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* VIDEO STATE */}
        {scene.state === 'video' && (
          <div className="space-y-4">
            {/* Video player */}
            <div className="relative aspect-video max-h-[600px] sm:max-h-[700px] rounded-lg overflow-hidden bg-black border border-border">
              {isGeneratingVideo ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-white">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
                  <p className="text-sm">Generating video...</p>
                  <p className="text-xs text-white/60 mt-2">This may take up to 2 minutes</p>
                </div>
              ) : scene.video_url ? (
                <video
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

            {/* Image thumbnail and text below */}
            <div className="grid grid-cols-[100px_1fr] gap-3">
              {/* Thumbnail */}
              {scene.image_url && (
                <div className="relative aspect-video rounded-lg overflow-hidden bg-muted border border-border">
                  <Image
                    src={scene.image_url}
                    alt={`Scene ${sceneNumber} thumbnail`}
                    fill
                    className="object-cover"
                    sizes="120px"
                  />
                </div>
              )}

              {/* Text and duration */}
              <div className="space-y-2">
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editedText}
                      onChange={(e) => setEditedText(e.target.value)}
                      className="w-full min-h-[120px] p-4 border-2 border-primary rounded-lg bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                      disabled={isLoading}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveText} disabled={isLoading}>
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        setEditedText(scene.text);
                        setIsEditing(false);
                      }} disabled={isLoading}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-sm leading-relaxed flex-1">{scene.text}</p>
                      <Button size="sm" variant="ghost" onClick={handleEditTextClick} disabled={isLoading} title="Edit text (will erase image/video)">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Duration:</span>
                      <span className="text-sm font-medium">{scene.video_duration.toFixed(1)}s</span>
                      <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => handleDurationChange(duration)} title="Edit duration (will erase video)">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-4 pt-4 border-t border-border">
              <Button size="sm" variant="outline" onClick={onRegenerateImage} disabled={isLoading || isGeneratingImage || isGeneratingVideo}>
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Regenerate Image
              </Button>
              <Button size="sm" variant="outline" onClick={onRegenerateVideo} disabled={isLoading || isGeneratingVideo}>
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Regenerate Video
              </Button>
            </div>
          </div>
        )}
      </div>
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
    return (
      <div className="text-sm text-muted-foreground italic">
        Upload a product to enable compositing
      </div>
    );
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
