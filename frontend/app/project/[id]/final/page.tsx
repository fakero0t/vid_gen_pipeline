'use client';

import { Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { StepSkeleton } from '@/components/ui/LoadingFallback';
import { useAppStore } from '@/store/appStore';
import { ToastProvider } from '@/components/ui/Toast';
import { STEPS } from '@/lib/steps';
import * as LazyComponents from '@/components/LazyComponents';

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
    // Navigate back to scenes
    setCurrentStep(STEPS.SCENES);
    router.push(`/project/${projectId}/scenes`);
  };

  return (
    <div className="pt-[calc(3.5rem+1.5rem)] flex min-h-[calc(100vh-80px)] sm:min-h-[calc(100vh-100px)] items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8 animate-fadeIn">
      <div className="w-full max-w-6xl animate-slideUp">
        <Suspense fallback={<StepSkeleton />}>
          <LazyComponents.FinalComposition onBack={handleBack} />
        </Suspense>
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

