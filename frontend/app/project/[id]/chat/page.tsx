'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { LoadingFallback } from '@/components/ui/LoadingFallback';
import { SkipToContent } from '@/components/ui/SkipToContent';
import { useVisionChat } from '@/hooks/useVisionChat';
import { useAppStore } from '@/store/appStore';
import { useProjectStore } from '@/store/projectStore';
import { ToastProvider } from '@/components/ui/Toast';
import * as LazyComponents from '@/components/LazyComponents';
import { STEPS } from '@/lib/steps';

/**
 * Chat page for vision chat interface and creative brief generation.
 */
function ChatContent() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const { creativeBrief, setCreativeBrief } = useAppStore();
  const { loadProject, getCurrentProject, currentProjectId } = useProjectStore();

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

  // Step 1: Vision Chat
  const {
    messages,
    onSendMessage,
    isLoading: isChatLoading,
    isStreaming,
    error: chatError,
    creativeBrief: chatBrief,
    isExtracting,
  } = useVisionChat();

  // Prioritize creativeBrief from store (persisted) - this ensures the brief
  // that was used to generate mood boards is displayed when navigating back
  // The store version is the source of truth for persisted briefs
  const activeBrief = creativeBrief || chatBrief;
  
  // Show second card only when brief exists or when brief extraction has started
  // Don't show it just when messages are being sent - only when extraction begins
  const shouldShowBriefCard = activeBrief || isExtracting;

  // Update store when brief is extracted from chat (only if store doesn't have one)
  // This syncs newly extracted briefs to the store for persistence
  useEffect(() => {
    if (chatBrief && !creativeBrief) {
      setCreativeBrief(chatBrief);
    }
  }, [chatBrief, creativeBrief, setCreativeBrief]);

  const handleContinueToMood = () => {
    // Set step to mood and navigate to mood page
    useAppStore.getState().setCurrentStep(STEPS.MOOD);
    router.push(`/project/${projectId}/mood`);
  };

  return (
    <>
      <SkipToContent />
      <div className="h-screen bg-zinc-50 dark:bg-black overflow-hidden">
        <main id="main-content" tabIndex={-1} className="outline-none pt-14 h-full">
          <div className="flex h-full items-center justify-center p-2 sm:p-3 animate-fadeIn overflow-hidden">
            <div className="w-full max-w-7xl h-full flex gap-2 sm:gap-3">
              {/* Chat Interface - Transitions from full width to half width when brief appears or extracting */}
              <div 
                className={`
                  min-h-0 animate-slideUp
                  transition-all duration-500 ease-in-out
                  ${shouldShowBriefCard ? 'w-1/2' : 'w-full'}
                `}
              >
                <Suspense fallback={<LoadingFallback message="Loading chat..." />}>
                  <LazyComponents.ChatInterface
                    messages={messages}
                    onSendMessage={onSendMessage}
                    isLoading={isChatLoading}
                    isStreaming={isStreaming}
                    error={chatError}
                    className="h-full"
                  />
                </Suspense>
              </div>

              {/* Creative Brief Summary - Slides in from right when generated or extracting */}
              <div 
                className={`
                  transition-all duration-500 ease-in-out
                  ${shouldShowBriefCard
                    ? 'w-1/2 opacity-100 translate-x-0' 
                    : 'w-0 opacity-0 translate-x-full overflow-hidden'
                  }
                `}
              >
                <Suspense fallback={<LoadingFallback message="Loading summary..." />}>
                  <LazyComponents.CreativeBriefSummary
                    brief={activeBrief}
                    onContinue={handleContinueToMood}
                    isExtracting={isExtracting}
                    isUpdating={isExtracting}
                    className="h-full"
                  />
                </Suspense>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

// Wrap with ToastProvider
export default function ChatPage() {
  return (
    <ToastProvider>
      <ChatContent />
    </ToastProvider>
  );
}

