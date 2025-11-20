import { create } from 'zustand';
import type { StepName } from '@/lib/steps';
import { STEPS } from '@/lib/steps';
import type { CreativeBrief } from '@/types/chat.types';
import type { Mood } from '@/types/mood.types';

/**
 * Global application state store using Zustand.
 * This store manages state across all pipeline steps.
 * 
 * NOTE: This store is NOT persisted to localStorage directly.
 * State is managed through projectStore which saves/loads snapshots.
 */
interface AppState {
  // Navigation
  currentStep: StepName;
  setCurrentStep: (step: StepName) => void;

  // Chat: Vision & Creative Brief
  creativeBrief: CreativeBrief | null;
  setCreativeBrief: (brief: CreativeBrief | null) => void;

  // Mood: Mood Selection
  moods: Mood[];
  selectedMoodId: string | null;
  setMoods: (moods: Mood[]) => void;
  selectMood: (moodId: string) => void;

  // Scenes: Storyboard tracking
  // Actual scene state is in sceneStore, this just tracks completion
  storyboardCompleted: boolean;
  setStoryboardCompleted: (completed: boolean) => void;

  // Final: Composition
  audioUrl: string | null;
  setAudioUrl: (url: string | null) => void;
  compositionJobId: string | null;
  finalVideo: any | null;
  setCompositionJobId: (jobId: string | null) => void;
  setFinalVideo: (video: any) => void;

  // Error Handling
  error: string | null;
  setError: (error: string | null) => void;

  // Reset
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Navigation
  currentStep: STEPS.CHAT,
  setCurrentStep: (step) => set({ currentStep: step }),

  // Chat: Vision & Creative Brief
  creativeBrief: null,
  setCreativeBrief: (brief) => set({ creativeBrief: brief }),

  // Mood: Mood Selection
  moods: [],
  selectedMoodId: null,
  setMoods: (moods) => set({ moods }),
  selectMood: (moodId) => set({ selectedMoodId: moodId }),

  // Scenes: Storyboard
  storyboardCompleted: false,
  setStoryboardCompleted: (completed) => set({ storyboardCompleted: completed }),

  // Final: Composition
  audioUrl: null,
  setAudioUrl: (url) => set({ audioUrl: url }),
  compositionJobId: null,
  finalVideo: null,
  setCompositionJobId: (jobId) => set({ compositionJobId: jobId }),
  setFinalVideo: (video) => set({ finalVideo: video }),

  // Error Handling
  error: null,
  setError: (error) => set({ error }),

  // Reset
  reset: () => {
    set({
      currentStep: STEPS.CHAT,
      creativeBrief: null,
      moods: [],
      selectedMoodId: null,
      storyboardCompleted: false,
      audioUrl: null,
      compositionJobId: null,
      finalVideo: null,
      error: null,
    });
  },
}));

