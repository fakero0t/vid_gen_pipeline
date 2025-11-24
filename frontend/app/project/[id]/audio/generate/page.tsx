'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { StepSkeleton } from '@/components/ui/LoadingFallback';
import { useAppStore } from '@/store/appStore';
import { ToastProvider } from '@/components/ui/Toast';
import { STEPS } from '@/lib/steps';
import * as LazyComponents from '@/components/LazyComponents';

/**
 * Audio generation page - allows users to customize and generate audio
 */
function AudioGenerationPageContent() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const { setCurrentStep } = useAppStore();

  // Set current step
  useEffect(() => {
    setCurrentStep(STEPS.AUDIO);
  }, [setCurrentStep]);

  return (
    <div className="h-screen pt-[calc(3.5rem+1.5rem)] flex flex-col overflow-hidden">
      <main className="flex-1 flex flex-col animate-fadeIn overflow-hidden relative">
        <div className="flex-1 flex flex-col min-h-0 w-full">
          {/* Top bar with Title */}
          <div className="w-full flex justify-center px-4 sm:px-6 lg:px-8 mb-2 flex-shrink-0">
            <div className="w-full max-w-7xl flex items-center justify-center">
              {/* Title - centered */}
              <h2 className="text-base sm:text-lg font-display font-bold tracking-tight">
                <span className="text-gradient">Generate Audio</span>
              </h2>
            </div>
          </div>

          {/* Content area - centered vertically when video is complete */}
          <div className="flex-1 min-h-0 w-full flex items-center justify-center animate-slideUp animation-delay-100 overflow-hidden">
            <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center overflow-y-auto py-8">
              <Suspense fallback={<StepSkeleton />}>
                <LazyComponents.AudioGenerationPage />
              </Suspense>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Wrap with ToastProvider
export default function AudioGenerationPage() {
  return (
    <ToastProvider>
      <AudioGenerationPageContent />
    </ToastProvider>
  );
}

