'use client';

import { useEffect, Suspense, useRef } from 'react';
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

  // Track the last brief used for mood generation
  const lastBriefRef = useRef<string | null>(null);

  // Create a hash of the brief to detect changes
  const getBriefHash = (brief: typeof creativeBrief): string => {
    if (!brief) return '';
    return JSON.stringify({
      product_name: brief.product_name,
      target_audience: brief.target_audience,
      emotional_tone: brief.emotional_tone,
      visual_style_keywords: brief.visual_style_keywords,
      key_messages: brief.key_messages,
    });
  };

  // Auto-generate or regenerate moods when brief changes
  useEffect(() => {
    if (!creativeBrief || isMoodLoading) return;

    const currentBriefHash = getBriefHash(creativeBrief);
    const lastBriefHash = lastBriefRef.current;

    // Regenerate if:
    // 1. No moods exist (first time)
    // 2. Brief hash changed (brief was updated)
    // 3. Moods exist but we don't have a hash (component remounted - regenerate to be safe)
    const shouldRegenerate = 
      moods.length === 0 || // No moods yet
      (currentBriefHash !== lastBriefHash && currentBriefHash !== ''); // Brief changed

    if (shouldRegenerate) {
      const request: MoodGenerationRequest = {
        product_name: creativeBrief.product_name || 'Product',
        target_audience: creativeBrief.target_audience || 'General Audience',
        emotional_tone: creativeBrief.emotional_tone || [],
        visual_style_keywords: creativeBrief.visual_style_keywords || [],
        key_messages: creativeBrief.key_messages || [],
      };

      // Clear existing moods and selection when regenerating
      if (moods.length > 0) {
        const { setMoods } = useAppStore.getState();
        setMoods([]);
        useAppStore.setState({ selectedMoodId: null });
      }

      generateMoodsFromBrief(request);
      lastBriefRef.current = currentBriefHash;
    }
  }, [creativeBrief, isMoodLoading, moods.length, generateMoodsFromBrief]);

  // Auto-select first mood after moods are generated
  useEffect(() => {
    if (moods.length > 0 && !selectedMoodId) {
      selectMood(moods[0].id);
    }
  }, [moods, selectedMoodId, selectMood]);

  const handleGenerateMoods = async () => {
    if (!creativeBrief) return;
    
    // Clear existing moods and selection when regenerating
    const { setMoods } = useAppStore.getState();
    setMoods([]);
    useAppStore.setState({ selectedMoodId: null });
    
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
    // Navigate to backgrounds page
    setCurrentStep(STEPS.BACKGROUNDS);
    router.push(`/project/${projectId}/backgrounds`);
  };

  const handleBack = () => {
    // Navigate back to chat
    setCurrentStep(STEPS.CHAT);
    router.push(`/project/${projectId}/chat`);
  };

  return (
    <div className="min-h-screen pt-[calc(3.5rem+1.5rem)] pb-4 sm:pb-6 flex flex-col">
      <main className="flex-1 flex flex-col animate-fadeIn overflow-visible">
        <div className="flex-1 flex flex-col min-h-0 w-full">
          {/* Top bar with Title */}
          <div className="w-full flex justify-center px-4 sm:px-6 lg:px-8 mb-2">
            <div className="w-full max-w-7xl flex items-center justify-center">
              {/* Title - centered */}
              <h2 className="text-base sm:text-lg font-display font-bold tracking-tight">
                Select your <span className="text-gradient">mood board</span>
              </h2>
            </div>
          </div>

          {/* Mood Board Component - centered, full width available, overflow allowed */}
          <div className="flex-1 min-h-0 w-full flex justify-center animate-slideUp animation-delay-100 overflow-visible">
            <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 overflow-visible">
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
      </main>
    </div>
  );
}

