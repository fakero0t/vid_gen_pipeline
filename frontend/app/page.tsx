'use client';

import { useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingFallback, StepSkeleton } from '@/components/ui/LoadingFallback';
import { SkipToContent } from '@/components/ui/SkipToContent';
import { useVisionChat } from '@/hooks/useVisionChat';
import { useMoodGeneration } from '@/hooks/useMoodGeneration';
import { useScenePlanning } from '@/hooks/useScenePlanning';
import { useAudioGeneration } from '@/hooks/useAudioGeneration';
import { useStoryboard } from '@/hooks/useStoryboard';
import { useAppStore } from '@/store/appStore';
import { StoryboardCarousel } from '@/components/storyboard';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { config } from '@/lib/config';
import { ProductImageUpload } from '@/components/product/ProductImageUpload';
import type { MoodGenerationRequest } from '@/types/mood.types';
import type { ScenePlanRequest } from '@/types/scene.types';
import type { AudioGenerationRequest } from '@/types/audio.types';

// Lazy load major components for code splitting
import * as LazyComponents from '@/components/LazyComponents';

/**
 * Main page that conditionally renders different steps based on currentStep.
 */
function HomeContent() {
  const router = useRouter();
  const {
    currentStep,
    setCurrentStep,
    creativeBrief,
    moods,
    selectedMoodId,
    audioUrl,
    setStoryboardCompleted,
    scenePlan,
    setScenePlan,
  } = useAppStore();

  // Step 1: Vision Chat
  const {
    messages,
    onSendMessage,
    isLoading: isChatLoading,
    isStreaming,
    error: chatError,
    creativeBrief: chatBrief,
    canProceed,
  } = useVisionChat();

  // Step 2: Product Upload (placeholder for future implementation)
  // Will be implemented in a future task

  // Step 3: Mood Generation
  const {
    isLoading: isMoodLoading,
    error: moodError,
    generateMoodsFromBrief,
    selectMood,
    clearError: clearMoodError,
  } = useMoodGeneration();

  // Step 4: Scene Planning
  const {
    scenePlan: generatedScenePlan,
    isLoading: isSceneLoading,
    error: sceneError,
    generateScenePlan,
    generateSeedImages,
    clearError: clearSceneError,
  } = useScenePlanning();

  // Audio Generation
  const {
    generateAudio,
    isLoading: isAudioLoading,
  } = useAudioGeneration();

  // Step 3: Storyboard
  const {
    storyboard,
    scenes,
    isLoading: isStoryboardLoading,
    isSaving,
    isRegeneratingAll,
    error: storyboardError,
    initializeStoryboard,
    regenerateAllScenes,
    approveText,
    regenerateText,
    editText,
    approveImage,
    regenerateImage,
    updateDuration,
    regenerateVideo,
  } = useStoryboard();

  // Use creativeBrief from store (persisted) or from chat hook
  const activeBrief = creativeBrief || chatBrief;

  // HARDCODED: Auto-generate moods when entering step 3
  useEffect(() => {
    if (currentStep === 3 && moods.length === 0 && !isMoodLoading) {
      const request: MoodGenerationRequest = {
        product_name: activeBrief?.product_name || 'Test Product',
        target_audience: activeBrief?.target_audience || 'Test Audience',
        emotional_tone: activeBrief?.emotional_tone || [],
        visual_style_keywords: activeBrief?.visual_style_keywords || [],
        key_messages: activeBrief?.key_messages || [],
      };
      generateMoodsFromBrief(request);
    }
  }, [currentStep, moods.length, isMoodLoading, activeBrief, generateMoodsFromBrief]);

  // HARDCODED: Auto-select first mood after moods are generated
  useEffect(() => {
    if (moods.length > 0 && !selectedMoodId) {
      console.log('Auto-selecting first mood:', moods[0].id);
      useAppStore.getState().selectMood(moods[0].id);
    }
  }, [moods, selectedMoodId]);

  // HARDCODED: Auto-generate audio when entering step 4
  useEffect(() => {
    if (currentStep === 4 && !audioUrl && selectedMoodId && activeBrief && !isAudioLoading) {
      const selectedMood = moods.find((m) => m.id === selectedMoodId);
      if (selectedMood) {
        console.log('🎵 Pre-generating audio for Step 5...');
        const audioRequest: AudioGenerationRequest = {
          mood_name: selectedMood.name,
          mood_description: selectedMood.description,
          emotional_tone: activeBrief.emotional_tone,
          aesthetic_direction: selectedMood.aesthetic_direction,
          style_keywords: selectedMood.style_keywords,
          duration: 30,
        };
        generateAudio(audioRequest);
      }
    }
  }, [currentStep, audioUrl, selectedMoodId, activeBrief, isAudioLoading, moods, generateAudio]);

  // Auto-initialize storyboard when entering step 4
  useEffect(() => {
    if (currentStep === 4 && !storyboard && !isStoryboardLoading && activeBrief && selectedMoodId) {
      const selectedMood = moods.find((m) => m.id === selectedMoodId);
      if (selectedMood) {
        console.log('[Page] Auto-initializing storyboard for step 4');
        initializeStoryboard(activeBrief, selectedMood);
      }
    }
  }, [currentStep, storyboard, isStoryboardLoading, activeBrief, selectedMoodId, moods, initializeStoryboard]);

  const handleContinueToProductUpload = () => {
    // HARDCODED: Skip validation for testing
    setCurrentStep(2);
  };

  const handleContinueToMoods = () => {
    // HARDCODED: Skip validation for testing
    setCurrentStep(3);
  };

  const handleGenerateMoods = async () => {
    // HARDCODED: Skip validation for testing
    const request: MoodGenerationRequest = {
      product_name: activeBrief?.product_name || 'Test Product',
      target_audience: activeBrief?.target_audience || 'Test Audience',
      emotional_tone: activeBrief?.emotional_tone || [],
      visual_style_keywords: activeBrief?.visual_style_keywords || [],
      key_messages: activeBrief?.key_messages || [],
    };
    
    await generateMoodsFromBrief(request);
  };

  const handleContinueFromMoods = () => {
    // HARDCODED: Skip validation for testing
    setCurrentStep(4);
  };

  const handleGenerateScenePlan = async () => {
    // HARDCODED: Skip validation for testing
    // Use first mood if none selected
    const selectedMood = selectedMoodId 
      ? moods.find((m) => m.id === selectedMoodId)
      : moods[0];

    if (!selectedMood) {
      console.error('No moods available');
      return;
    }

    const request: ScenePlanRequest = {
      product_name: activeBrief?.product_name || 'Test Product',
      target_audience: activeBrief?.target_audience || 'Test Audience',
      emotional_tone: activeBrief?.emotional_tone || [],
      visual_style_keywords: activeBrief?.visual_style_keywords || [],
      key_messages: activeBrief?.key_messages || [],
      mood_id: selectedMood.id,
      mood_name: selectedMood.name,
      mood_style_keywords: selectedMood.style_keywords,
      mood_color_palette: selectedMood.color_palette,
      mood_aesthetic_direction: selectedMood.aesthetic_direction,
    };

    const plan = await generateScenePlan(request);

    if (plan) {
      // Save to store
      setScenePlan(plan);

      // Generate seed images
      const scenesWithImages = await generateSeedImages(
        plan.scenes,
        selectedMood.style_keywords,
        selectedMood.color_palette,
        selectedMood.aesthetic_direction
      );

      // Update store with seed images
      if (scenesWithImages) {
        setScenePlan({
          ...plan,
          scenes: scenesWithImages,
        });
      }
    }
  };

  const handleGenerateFinalVideo = () => {
    // Mark storyboard as completed and navigate to video generation (Step 5)
    setStoryboardCompleted(true);
    setCurrentStep(5);
  };

  // Render based on current step
  return (
    <>
      <SkipToContent />
      <div className="min-h-screen bg-zinc-50 dark:bg-black">
        {/* Main content with semantic HTML */}
        <main id="main-content" tabIndex={-1} className="outline-none">

      {/* Content - Mobile-first responsive design */}
      {currentStep === 1 && (
        <div className="flex min-h-[calc(100vh-80px)] sm:min-h-[calc(100vh-100px)] items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8 animate-fadeIn">
          <div className="w-full max-w-7xl space-y-3 sm:space-y-4 md:space-y-6">
          {/* Creative Brief Summary */}
          {activeBrief && (
            <div className="animate-slideUp">
              <Suspense fallback={<LoadingFallback message="Loading summary..." />}>
                <LazyComponents.CreativeBriefSummary
                  brief={activeBrief}
                  onContinue={handleContinueToProductUpload}
                />
              </Suspense>
            </div>
          )}

          {/* Chat Interface - Responsive height */}
          <div className="animate-slideUp animation-delay-100">
            <Suspense fallback={<LoadingFallback message="Loading chat..." />}>
              <LazyComponents.ChatInterface
                messages={messages}
                onSendMessage={onSendMessage}
                isLoading={isChatLoading}
                isStreaming={isStreaming}
                error={chatError}
                className="h-[calc(100vh-250px)] sm:h-[calc(100vh-220px)] md:h-[calc(100vh-200px)]"
              />
            </Suspense>
          </div>
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div className="flex min-h-[calc(100vh-80px)] sm:min-h-[calc(100vh-100px)] items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8 animate-fadeIn">
          <div className="w-full max-w-7xl animate-slideUp">
            {config.isProductMode() ? (
              <ProductImageUpload 
                onComplete={(productId) => {
                  console.log('Product uploaded:', productId);
                  setCurrentStep(3);
                }}
                onBack={() => setCurrentStep(1)}
              />
            ) : (
              <>
                {/* Back button - Responsive */}
                <button
                  onClick={() => setCurrentStep(1)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-all duration-200 hover:gap-3 animate-slideUp mb-4"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  Back to Chat
                </button>
                
                {/* NeRF Pipeline View */}
                <Suspense fallback={<LoadingFallback message="Loading NeRF pipeline..." />}>
                  <LazyComponents.NeRFPipelineView />
                </Suspense>
              </>
            )}
          </div>
        </div>
      )}

      {currentStep === 3 && (
        <div className="flex min-h-[calc(100vh-80px)] sm:min-h-[calc(100vh-100px)] items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8 animate-fadeIn">
          <div className="w-full max-w-7xl space-y-3 sm:space-y-4 md:space-y-6">
          {/* Back button - Responsive */}
          <button
            onClick={() => setCurrentStep(2)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-all duration-200 hover:gap-3 animate-slideUp"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Product Upload
          </button>
          
          <div className="animate-slideUp animation-delay-100">
            <Suspense fallback={<StepSkeleton />}>
              <LazyComponents.MoodBoard
                moods={moods}
                selectedMoodId={selectedMoodId}
                onSelectMood={selectMood}
                onGenerate={handleGenerateMoods}
                onContinue={handleContinueFromMoods}
                isLoading={isMoodLoading}
                error={moodError}
              />
            </Suspense>
          </div>
          </div>
        </div>
      )}

      {/* Step 4: Storyboard - Embedded progressive workflow */}
      {currentStep === 4 && (
        <div className="flex min-h-[calc(100vh-80px)] sm:min-h-[calc(100vh-100px)] items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8 animate-fadeIn">
          <div className="w-full max-w-7xl space-y-3 sm:space-y-4 md:space-y-6">
          {/* Back button - Responsive */}
          <button
            onClick={() => setCurrentStep(3)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-all duration-200 hover:gap-3 animate-slideUp"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Moods
          </button>

            {/* Error display */}
            {storyboardError && (
              <div className="animate-slideUp animation-delay-100">
                <ErrorAlert error={storyboardError} />
              </div>
            )}

            {/* Loading state */}
            {(isStoryboardLoading || !storyboard) && !storyboardError && (
              <div className="animate-slideUp animation-delay-100">
                <LoadingFallback message="Initializing storyboard..." />
              </div>
            )}

            {/* Storyboard Carousel */}
            {storyboard && scenes.length > 0 && (
              <div className="animate-slideUp animation-delay-100">
                <StoryboardCarousel
                  storyboard={storyboard}
                  scenes={scenes}
                  onRegenerateAll={regenerateAllScenes}
                  onPreviewAll={() => console.log('Preview all')}
                  onGenerateFinalVideo={handleGenerateFinalVideo}
                  onApproveText={approveText}
                  onRegenerateText={regenerateText}
                  onEditText={editText}
                  onApproveImage={approveImage}
                  onRegenerateImage={regenerateImage}
                  onUpdateDuration={updateDuration}
                  onRegenerateVideo={regenerateVideo}
                  isLoading={isSaving || isRegeneratingAll}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {currentStep === 5 && (
        <div className="flex min-h-[calc(100vh-80px)] sm:min-h-[calc(100vh-100px)] items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8 animate-fadeIn">
          <div className="w-full max-w-7xl animate-slideUp">
            <Suspense fallback={<StepSkeleton />}>
              <LazyComponents.VideoGeneration
                onComplete={() => setCurrentStep(6)}
                onBack={() => setCurrentStep(4)}
              />
            </Suspense>
          </div>
        </div>
      )}

      {currentStep === 6 && (
        <div className="flex min-h-[calc(100vh-80px)] sm:min-h-[calc(100vh-100px)] items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8 animate-fadeIn">
          <div className="w-full max-w-6xl animate-slideUp">
            <Suspense fallback={<StepSkeleton />}>
              <LazyComponents.FinalComposition onBack={() => setCurrentStep(5)} />
            </Suspense>
          </div>
        </div>
      )}
        </main>
      </div>
    </>
  );
}

// Wrap with ToastProvider for storyboard functionality
export default function Home() {
  return (
    <ToastProvider>
      <HomeContent />
    </ToastProvider>
  );
}
