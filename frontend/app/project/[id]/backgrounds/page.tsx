'use client';

import { useEffect, Suspense, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useFirebaseAuth } from '@/lib/firebase/AuthContext';
import { useBackgroundGeneration } from '@/hooks/useBackgroundGeneration';
import { useAppStore } from '@/store/appStore';
import { useProjectStore } from '@/store/projectStore';
import { BackgroundGallery } from '@/components/backgrounds/BackgroundGallery';
import { StepSkeleton } from '@/components/ui/LoadingFallback';
import { listBackgroundAssets } from '@/lib/api/background';
import type { BackgroundGenerationRequest } from '@/types/background.types';
import { STEPS } from '@/lib/steps';

// Background-specific loading phrases that rotate
const LOADING_PHRASES = [
  "Painting beautiful backgrounds... 🎨",
  "Setting the perfect scene... 🖼️",
  "Curating stunning environments... ✨",
  "Crafting visual backdrops... 🌆",
  "Designing your backgrounds... 🎭",
  "Almost ready with your images... 🚀",
  "Creating atmospheric scenes... 🌈",
  "Polishing background details... 💎",
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

/**
 * Background selection page - allows users to select background images
 * for their video generation pipeline.
 */
export default function BackgroundsPage() {
  const router = useRouter();
  const params = useParams();
  const { userId } = useFirebaseAuth();
  const projectId = params.id as string;
  const {
    creativeBrief,
    backgroundAssets,
    selectedBackgroundIds,
    setCurrentStep,
  } = useAppStore();
  const { loadProject, getCurrentProject, currentProjectId, updateProject } = useProjectStore();

  // Load project on mount
  useEffect(() => {
    if (projectId && projectId !== currentProjectId) {
      try {
        loadProject(projectId);
      } catch (error) {
        console.error('Failed to load project:', error);
        router.push('/projects');
      }
    }
  }, [projectId, currentProjectId, loadProject, router]);

  // Verify project exists
  useEffect(() => {
    const project = getCurrentProject();
    if (projectId && !project) {
      console.error('Project not found:', projectId);
      router.push('/projects');
    }
  }, [projectId, getCurrentProject, router]);

  const {
    isLoading: isBackgroundLoading,
    error: backgroundError,
    generateBackgroundsFromBrief,
    selectBackgrounds,
  } = useBackgroundGeneration();

  // Load existing background assets if project has backgroundAssetIds
  useEffect(() => {
    const project = getCurrentProject();
    const projectBackgroundAssetIds = project?.backgroundAssetIds || [];
    
    if (projectBackgroundAssetIds.length > 0 && backgroundAssets.length === 0 && !isBackgroundLoading && userId) {
      // Try to load existing background assets
      listBackgroundAssets(userId)
        .then(allBackgrounds => {
          // Filter to only show assets that are in the project
          const projectBackgrounds = allBackgrounds.filter(asset => 
            projectBackgroundAssetIds.includes(asset.asset_id)
          );
          if (projectBackgrounds.length > 0) {
            const { setBackgroundAssets } = useAppStore.getState();
            setBackgroundAssets(projectBackgrounds);
            // Also restore selected IDs from project
            if (projectBackgroundAssetIds.length > 0) {
              const { setSelectedBackgroundIds } = useAppStore.getState();
              setSelectedBackgroundIds(projectBackgroundAssetIds);
            }
          }
        })
        .catch(error => {
          console.error('Failed to load background assets:', error);
        });
    }
  }, [getCurrentProject, backgroundAssets.length, isBackgroundLoading]);

  // Auto-generate backgrounds when page loads if no backgrounds exist
  useEffect(() => {
    if (backgroundAssets.length === 0 && !isBackgroundLoading && creativeBrief) {
      const request: BackgroundGenerationRequest = {
        product_name: creativeBrief.product_name || 'Product',
        target_audience: creativeBrief.target_audience || 'General Audience',
        emotional_tone: creativeBrief.emotional_tone || [],
        visual_style_keywords: creativeBrief.visual_style_keywords || [],
        key_messages: creativeBrief.key_messages || [],
      };
      generateBackgroundsFromBrief(request);
    }
  }, [backgroundAssets.length, isBackgroundLoading, creativeBrief, generateBackgroundsFromBrief]);

  const handleGenerateBackgrounds = async () => {
    if (!creativeBrief) return;
    
    // Clear existing backgrounds and selection when regenerating
    const { setBackgroundAssets, setSelectedBackgroundIds } = useAppStore.getState();
    setBackgroundAssets([]);
    setSelectedBackgroundIds([]);
    
    const request: BackgroundGenerationRequest = {
      product_name: creativeBrief.product_name || 'Product',
      target_audience: creativeBrief.target_audience || 'General Audience',
      emotional_tone: creativeBrief.emotional_tone || [],
      visual_style_keywords: creativeBrief.visual_style_keywords || [],
      key_messages: creativeBrief.key_messages || [],
    };
    
    await generateBackgroundsFromBrief(request);
  };

  const handleBackgroundSelect = (backgroundId: string, selected: boolean) => {
    const currentIds = selectedBackgroundIds || [];
    const newIds = selected
      ? [...currentIds, backgroundId]
      : currentIds.filter(id => id !== backgroundId);
    selectBackgrounds(newIds);
    
    // Update project with selected background IDs
    const project = getCurrentProject();
    if (project) {
      updateProject(projectId, {
        backgroundAssetIds: newIds,
      });
    }
  };

  const handleContinue = () => {
    // Save selected background IDs to project
    const project = getCurrentProject();
    if (project && selectedBackgroundIds.length > 0) {
      updateProject(projectId, {
        backgroundAssetIds: selectedBackgroundIds,
      });
    }
    
    // Navigate to scenes page
    setCurrentStep(STEPS.SCENES);
    router.push(`/project/${projectId}/scenes`);
  };

  const canContinue = backgroundAssets.length > 0 && selectedBackgroundIds.length > 0;

  return (
    <div className="min-h-screen pt-[calc(3.5rem+1.5rem)] pb-4 sm:pb-6 flex flex-col">
      <main className="flex-1 flex flex-col animate-fadeIn overflow-visible relative">
        <div className="flex-1 flex flex-col min-h-0 w-full">
          {/* Top bar with Title */}
          <div className="w-full flex justify-center px-4 sm:px-6 lg:px-8 mb-2 flex-shrink-0">
            <div className="w-full max-w-7xl flex items-center justify-center">
              {/* Title - centered */}
              <h2 className="text-base sm:text-lg font-display font-bold tracking-tight">
                Select your <span className="text-gradient">background images</span>
              </h2>
            </div>
          </div>

          {/* Loading state - absolutely positioned to center on screen */}
          {isBackgroundLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <LoadingPhrases />
            </div>
          )}

          {/* Content area - hidden when loading */}
          {!isBackgroundLoading && (
            <div className="flex-1 min-h-0 w-full flex justify-center animate-slideUp animation-delay-100 overflow-visible">
              <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col flex-1 min-h-0 overflow-visible">
                <Suspense fallback={<StepSkeleton />}>
                  {/* Error display */}
                  {backgroundError && (
                    <div className="rounded-lg bg-destructive/10 border border-destructive/50 p-1.5 animate-slideUp flex-shrink-0 mb-3">
                      <p className="text-[10px] font-medium text-destructive">{backgroundError}</p>
                    </div>
                  )}

                  {/* Description text - centered */}
                  {backgroundAssets.length > 0 && (
                    <div className="text-center mb-3 flex-shrink-0 animate-fadeIn">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        Choose one or more background images to use in your scenes. These will be available when creating scenes.
                      </p>
                    </div>
                  )}

                  {/* Gallery - takes up remaining space */}
                  <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pt-6 sm:pt-8">
                      <BackgroundGallery
                        backgrounds={backgroundAssets}
                        selectedIds={selectedBackgroundIds}
                        onSelect={handleBackgroundSelect}
                        isLoading={isBackgroundLoading}
                      />
                    </div>

                    {/* Continue button - positioned lower with less spacing */}
                    {backgroundAssets.length > 0 && (
                      <div className="flex justify-end mt-3 mb-2 flex-shrink-0 animate-slideUp animation-delay-200">
                        <button
                          onClick={handleContinue}
                          disabled={!canContinue || isBackgroundLoading}
                          className="btn-primary-bold text-xs px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Continue to Scenes
                        </button>
                      </div>
                    )}
                  </div>
                </Suspense>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

