'use client';

import { Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { StepSkeleton } from '@/components/ui/LoadingFallback';
import { useAppStore } from '@/store/appStore';
import { ToastProvider } from '@/components/ui/Toast';
import { FinalComposition } from '@/components/composition/FinalComposition';

/**
 * Final Composition page - allows users to compose the final video
 * with music and transitions from their storyboard scenes.
 */
function FinalPageContent() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const { setCurrentStep } = useAppStore();

  const handleBack = () => {
    // Navigate back to video generation (Step 5)
    setCurrentStep(5);
    router.push('/');
  };

  return (
    <div className="flex min-h-[calc(100vh-80px)] sm:min-h-[calc(100vh-100px)] items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8 animate-fadeIn">
      <div className="w-full max-w-6xl space-y-3 sm:space-y-4 md:space-y-6 pt-4 sm:pt-6 md:pt-8">
        {/* Back button */}
        <button
          onClick={handleBack}
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
          Back to Video Generation
        </button>

        {/* Final Composition Component */}
        <div className="animate-slideUp animation-delay-100">
          <Suspense fallback={<StepSkeleton />}>
            <FinalComposition onBack={handleBack} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

// Wrap with ToastProvider
export default function FinalPage() {
  return (
    <ToastProvider>
      <FinalPageContent />
    </ToastProvider>
  );
}

