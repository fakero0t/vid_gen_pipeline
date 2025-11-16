'use client';

import { ChatInterface, CreativeBriefSummary } from '@/components/vision';
import { useVisionChat } from '@/hooks/useVisionChat';
import { useAppStore } from '@/store/appStore';

/**
 * Main page for Step 1: Vision Chat Interface and Creative Brief Synthesis.
 * Users chat with AI to refine their product vision and generate a creative brief.
 */
export default function Home() {
  const { setCurrentStep } = useAppStore();
  const {
    messages,
    onSendMessage,
    isLoading,
    isStreaming,
    error,
    creativeBrief,
    canProceed,
  } = useVisionChat();

  const handleContinue = () => {
    if (canProceed && creativeBrief) {
      setCurrentStep(2);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black p-4">
      <div className="w-full max-w-4xl space-y-4">
        {/* Creative Brief Summary */}
        {creativeBrief && (
          <CreativeBriefSummary
            brief={creativeBrief}
            onContinue={canProceed ? handleContinue : undefined}
          />
        )}

        {/* Chat Interface */}
        <ChatInterface
          messages={messages}
          onSendMessage={onSendMessage}
          isLoading={isLoading}
          isStreaming={isStreaming}
          error={error}
          className="h-[calc(100vh-200px)]"
        />
      </div>
    </div>
  );
}
