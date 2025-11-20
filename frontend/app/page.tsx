'use client';

import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingFallback, StepSkeleton } from '@/components/ui/LoadingFallback';
import { SkipToContent } from '@/components/ui/SkipToContent';
import { useAppStore } from '@/store/appStore';
import { ToastProvider } from '@/components/ui/Toast';
import { config } from '@/lib/config';
import { ProductImageUpload } from '@/components/product/ProductImageUpload';

// Lazy load major components for code splitting
import * as LazyComponents from '@/components/LazyComponents';

/**
 * Main page that conditionally renders different steps based on currentStep.
 * Step 1 (chat) is handled on /project/[id]/chat route.
 * Step 3 (mood) is handled on /project/[id]/mood route.
 * Step 4 (scenes/storyboard) is handled on /project/[id]/scenes route.
 * Step 6 (final composition) is handled on /project/[id]/final route.
 */
function HomeContent() {
  const router = useRouter();
  const {
    currentStep,
    setCurrentStep,
  } = useAppStore();

  // Redirect to /project/new/chat if on step 1
  if (currentStep === 1) {
    router.push('/project/new/chat');
    return null;
  }

  // Redirect to /project/new/final if on step 6
  if (currentStep === 6) {
    router.push('/project/new/final');
    return null;
  }

  // Render based on current step
  return (
    <>
      <SkipToContent />
      <div className="min-h-screen bg-zinc-50 dark:bg-black">
        {/* Main content with semantic HTML */}
        <main id="main-content" tabIndex={-1} className="outline-none pt-16">

      {/* Content - Mobile-first responsive design */}
      {currentStep === 2 && (
        <div className="flex min-h-[calc(100vh-80px)] sm:min-h-[calc(100vh-100px)] items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8 animate-fadeIn">
          <div className="w-full max-w-7xl animate-slideUp">
            {config.isProductMode() ? (
              <ProductImageUpload 
                onComplete={(productId) => {
                  console.log('Product uploaded:', productId);
                  setCurrentStep(3);
                  router.push('/project/new/mood');
                }}
                onBack={() => {
                  setCurrentStep(1);
                  router.push('/project/new/chat');
                }}
              />
            ) : (
              <>
                {/* Back button - Responsive */}
                <button
                  onClick={() => {
                    setCurrentStep(1);
                    router.push('/project/new/chat');
                  }}
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


      {currentStep === 5 && (
        <div className="flex min-h-[calc(100vh-80px)] sm:min-h-[calc(100vh-100px)] items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8 animate-fadeIn">
          <div className="w-full max-w-7xl animate-slideUp">
            <Suspense fallback={<StepSkeleton />}>
              <LazyComponents.VideoGeneration
                onComplete={() => {
                  setCurrentStep(6);
                  router.push('/project/new/final');
                }}
                onBack={() => {
                  setCurrentStep(4);
                  router.push('/project/new/scenes');
                }}
              />
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
