'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { StepSkeleton } from '@/components/ui/LoadingFallback';
import { useAppStore } from '@/store/appStore';
import { useProjectStore } from '@/store/projectStore';
import { ToastProvider } from '@/components/ui/Toast';
import { FinalComposition } from '@/components/composition/FinalComposition';
import { STEPS } from '@/lib/steps';

/**
 * Final Composition page - allows users to compose the final video
 * with music and transitions from their storyboard scenes.
 */
function FinalPageContent() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const { setCurrentStep } = useAppStore();
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

  const handleBack = () => {
    // Navigate back to scenes
    setCurrentStep(STEPS.SCENES);
    router.push(`/project/${projectId}/scenes`);
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
          Back to Scenes
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

