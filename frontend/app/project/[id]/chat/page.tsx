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
  } = useVisionChat();

  // Use creativeBrief from store (persisted) or from chat hook
  const activeBrief = creativeBrief || chatBrief;

  // Update store when brief is extracted from chat
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
      <div className="min-h-screen bg-zinc-50 dark:bg-black">
        <main id="main-content" tabIndex={-1} className="outline-none pt-16">
          <div className="flex h-[calc(100vh-80px)] sm:h-[calc(100vh-100px)] items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8 animate-fadeIn overflow-hidden">
            <div className="w-full max-w-7xl h-full flex flex-col gap-3 sm:gap-4 md:gap-6">
              {/* Chat Interface - Takes available space */}
              <div className="flex-1 min-h-0 animate-slideUp">
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

              {/* Creative Brief Summary - Collapsible at bottom, always rendered to prevent layout shift */}
              <div className="shrink-0 animate-slideUp animation-delay-100">
                <Suspense fallback={<LoadingFallback message="Loading summary..." />}>
                  <LazyComponents.CreativeBriefSummary
                    brief={activeBrief}
                    onContinue={handleContinueToMood}
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

