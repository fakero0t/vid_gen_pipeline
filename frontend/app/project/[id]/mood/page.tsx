'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useMoodGeneration } from '@/hooks/useMoodGeneration';
import { useAppStore } from '@/store/appStore';
import { useProjectStore } from '@/store/projectStore';
import { MoodBoard } from '@/components/moods/MoodBoard';
import { StepSkeleton } from '@/components/ui/LoadingFallback';
import type { MoodGenerationRequest } from '@/types/mood.types';
import { STEPS } from '@/lib/steps';

/**
 * Mood selection page - allows users to select a mood board
 * for their video generation pipeline.
 */
export default function MoodPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const {
    creativeBrief,
    moods,
    selectedMoodId,
    setCurrentStep,
  } = useAppStore();
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

  const {
    isLoading: isMoodLoading,
    error: moodError,
    generateMoodsFromBrief,
    selectMood,
  } = useMoodGeneration();

  // Auto-generate moods when page loads if no moods exist
  useEffect(() => {
    if (moods.length === 0 && !isMoodLoading && creativeBrief) {
      const request: MoodGenerationRequest = {
        product_name: creativeBrief.product_name || 'Product',
        target_audience: creativeBrief.target_audience || 'General Audience',
        emotional_tone: creativeBrief.emotional_tone || [],
        visual_style_keywords: creativeBrief.visual_style_keywords || [],
        key_messages: creativeBrief.key_messages || [],
      };
      generateMoodsFromBrief(request);
    }
  }, [moods.length, isMoodLoading, creativeBrief, generateMoodsFromBrief]);

  // Auto-select first mood after moods are generated
  useEffect(() => {
    if (moods.length > 0 && !selectedMoodId) {
      selectMood(moods[0].id);
    }
  }, [moods, selectedMoodId, selectMood]);

  const handleGenerateMoods = async () => {
    if (!creativeBrief) return;
    
    const request: MoodGenerationRequest = {
      product_name: creativeBrief.product_name || 'Product',
      target_audience: creativeBrief.target_audience || 'General Audience',
      emotional_tone: creativeBrief.emotional_tone || [],
      visual_style_keywords: creativeBrief.visual_style_keywords || [],
      key_messages: creativeBrief.key_messages || [],
    };
    
    await generateMoodsFromBrief(request);
  };

  const handleContinue = () => {
    // Navigate to scenes page
    setCurrentStep(STEPS.SCENES);
    router.push(`/project/${projectId}/scenes`);
  };

  const handleBack = () => {
    // Navigate back to chat
    setCurrentStep(STEPS.CHAT);
    router.push(`/project/${projectId}/chat`);
  };

  return (
    <div className="flex min-h-[calc(100vh-80px)] sm:min-h-[calc(100vh-100px)] items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8 animate-fadeIn">
      <div className="w-full max-w-7xl space-y-3 sm:space-y-4 md:space-y-6 pt-4 sm:pt-6 md:pt-8">
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
          Back to Chat
        </button>

        {/* Mood Board Component */}
        <div className="animate-slideUp animation-delay-100">
          <Suspense fallback={<StepSkeleton />}>
            <MoodBoard
              moods={moods}
              selectedMoodId={selectedMoodId}
              onSelectMood={selectMood}
              onGenerate={handleGenerateMoods}
              onContinue={handleContinue}
              isLoading={isMoodLoading}
              error={moodError}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

