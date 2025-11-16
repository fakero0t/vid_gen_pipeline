'use client';

import { ChatInterface, CreativeBriefSummary } from '@/components/vision';
import { MoodBoard } from '@/components/moods';
import { useVisionChat } from '@/hooks/useVisionChat';
import { useMoodGeneration } from '@/hooks/useMoodGeneration';
import { useAppStore } from '@/store/appStore';
import type { MoodGenerationRequest } from '@/types/mood.types';

/**
 * Main page that conditionally renders different steps based on currentStep.
 */
export default function Home() {
  const { currentStep, setCurrentStep, creativeBrief } = useAppStore();
  
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

  // Step 2: Mood Generation
  const {
    moods,
    selectedMoodId,
    isLoading: isMoodLoading,
    error: moodError,
    generateMoodsFromBrief,
    selectMood,
    clearError: clearMoodError,
  } = useMoodGeneration();

  // Use creativeBrief from store (persisted) or from chat hook
  const activeBrief = creativeBrief || chatBrief;

  const handleContinueToMoods = () => {
    if (canProceed && activeBrief) {
      setCurrentStep(2);
    }
  };

  const handleGenerateMoods = async () => {
    if (!activeBrief) return;
    
    const request: MoodGenerationRequest = {
      product_name: activeBrief.product_name,
      target_audience: activeBrief.target_audience,
      emotional_tone: activeBrief.emotional_tone,
      visual_style_keywords: activeBrief.visual_style_keywords,
      key_messages: activeBrief.key_messages,
    };
    
    await generateMoodsFromBrief(request);
  };

  const handleContinueFromMoods = () => {
    if (selectedMoodId) {
      setCurrentStep(3);
    }
  };

  // Render based on current step
  if (currentStep === 1) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black p-4">
        <div className="w-full max-w-4xl space-y-4">
          {/* Creative Brief Summary */}
          {activeBrief && (
            <CreativeBriefSummary
              brief={activeBrief}
              onContinue={canProceed ? handleContinueToMoods : undefined}
            />
          )}

          {/* Chat Interface */}
          <ChatInterface
            messages={messages}
            onSendMessage={onSendMessage}
            isLoading={isChatLoading}
            isStreaming={isStreaming}
            error={chatError}
            className="h-[calc(100vh-200px)]"
          />
        </div>
      </div>
    );
  }

  if (currentStep === 2) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black p-4">
        <div className="w-full max-w-6xl space-y-4">
          {/* Back button */}
          <button
            onClick={() => setCurrentStep(1)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
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
          
          <MoodBoard
            moods={moods}
            selectedMoodId={selectedMoodId}
            onSelectMood={selectMood}
            onGenerate={handleGenerateMoods}
            onContinue={handleContinueFromMoods}
            isLoading={isMoodLoading}
            error={moodError}
          />
        </div>
      </div>
    );
  }

  // Steps 3-5: Placeholder for now
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black p-4">
      <div className="w-full max-w-4xl text-center">
        <h1 className="text-2xl font-bold mb-4">Step {currentStep}</h1>
        <p className="text-muted-foreground">This step is coming soon.</p>
        <button
          onClick={() => setCurrentStep(1)}
          className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Back to Step 1
        </button>
      </div>
    </div>
  );
}
