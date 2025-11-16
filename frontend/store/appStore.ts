import { create } from 'zustand';

/**
 * Global application state store using Zustand.
 * This store manages state across all pipeline steps.
 */
interface AppState {
  // Navigation
  currentStep: 1 | 2 | 3 | 4 | 5;
  setCurrentStep: (step: number) => void;

  // Step 1: Vision & Creative Brief
  creativeBrief: any | null; // Will be properly typed in Task 2
  setCreativeBrief: (brief: any) => void;

  // Step 2: Moods
  moods: any[]; // Will be properly typed in Task 3
  selectedMoodId: string | null;
  setMoods: (moods: any[]) => void;
  selectMood: (moodId: string) => void;

  // Step 3: Scenes
  scenePlan: any | null; // Will be properly typed in Task 4
  setScenePlan: (plan: any) => void;

  // Step 4: Video Clips
  generatedClips: any[]; // Will be properly typed in Task 5
  clipGenerationProgress: number;
  setGeneratedClips: (clips: any[]) => void;
  updateClipProgress: (progress: number) => void;

  // Step 5: Final Video
  finalVideo: any | null; // Will be properly typed in Task 7
  compositionProgress: number;
  setFinalVideo: (video: any) => void;
  updateCompositionProgress: (progress: number) => void;

  // Error Handling
  error: string | null;
  setError: (error: string | null) => void;

  // Reset
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Navigation
  currentStep: 1,
  setCurrentStep: (step) => set({ currentStep: step as 1 | 2 | 3 | 4 | 5 }),

  // Step 1: Vision
  creativeBrief: null,
  setCreativeBrief: (brief) => set({ creativeBrief: brief }),

  // Step 2: Moods
  moods: [],
  selectedMoodId: null,
  setMoods: (moods) => set({ moods }),
  selectMood: (moodId) => set({ selectedMoodId: moodId }),

  // Step 3: Scenes
  scenePlan: null,
  setScenePlan: (plan) => set({ scenePlan: plan }),

  // Step 4: Video Clips
  generatedClips: [],
  clipGenerationProgress: 0,
  setGeneratedClips: (clips) => set({ generatedClips: clips }),
  updateClipProgress: (progress) => set({ clipGenerationProgress: progress }),

  // Step 5: Final Video
  finalVideo: null,
  compositionProgress: 0,
  setFinalVideo: (video) => set({ finalVideo: video }),
  updateCompositionProgress: (progress) => set({ compositionProgress: progress }),

  // Error Handling
  error: null,
  setError: (error) => set({ error }),

  // Reset
  reset: () =>
    set({
      currentStep: 1,
      creativeBrief: null,
      moods: [],
      selectedMoodId: null,
      scenePlan: null,
      generatedClips: [],
      clipGenerationProgress: 0,
      finalVideo: null,
      compositionProgress: 0,
      error: null,
    }),
}));

