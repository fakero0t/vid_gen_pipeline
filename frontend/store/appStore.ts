import { create } from 'zustand';
import type { StepName } from '@/lib/steps';
import { STEPS } from '@/lib/steps';
import type { CreativeBrief } from '@/types/chat.types';
import type { Mood } from '@/types/mood.types';
import type { ProductImage } from '@/types/product.types';
import type { COLMAPState, NeRFTrainingState, RenderingState } from '@/types/nerf.types';

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
  chatMessages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
  }>;
  setChatMessages: (messages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
  }>) => void;

  // Mood: Mood Selection
  moods: Mood[];
  selectedMoodId: string | null;
  setMoods: (moods: Mood[]) => void;
  selectMood: (moodId: string) => void;

  // Scenes: Storyboard tracking
  // Actual scene state is in sceneStore, this just tracks completion
  storyboardCompleted: boolean;
  setStoryboardCompleted: (completed: boolean) => void;

  // Product: Uploaded product image
  uploadedProduct: ProductImage | null;
  setUploadedProduct: (product: ProductImage | null) => void;

  // COLMAP: Camera pose estimation
  colmap: COLMAPState | null;
  setCOLMAP: (state: COLMAPState) => void;
  updateCOLMAP: (updates: Partial<COLMAPState>) => void;
  clearCOLMAP: () => void;

  // NeRF Training: Model training
  nerfTraining: NeRFTrainingState | null;
  setNeRFTraining: (state: NeRFTrainingState) => void;
  updateNeRFTraining: (updates: Partial<NeRFTrainingState>) => void;
  clearNeRFTraining: () => void;

  // Rendering: Frame rendering
  rendering: RenderingState | null;
  setRendering: (state: RenderingState) => void;
  updateRendering: (updates: Partial<RenderingState>) => void;
  clearRendering: () => void;

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
  chatMessages: [],
  setChatMessages: (messages) => set({ chatMessages: messages }),

  // Mood: Mood Selection
  moods: [],
  selectedMoodId: null,
  setMoods: (moods) => set({ moods }),
  selectMood: (moodId) => set({ selectedMoodId: moodId }),

  // Scenes: Storyboard
  storyboardCompleted: false,
  setStoryboardCompleted: (completed) => set({ storyboardCompleted: completed }),

  // Product: Uploaded product image
  uploadedProduct: null,
  setUploadedProduct: (product) => set({ uploadedProduct: product }),

  // COLMAP: Camera pose estimation
  colmap: null,
  setCOLMAP: (state) => set({ colmap: state }),
  updateCOLMAP: (updates) => set((s) => ({
    colmap: s.colmap ? { ...s.colmap, ...updates } : null,
  })),
  clearCOLMAP: () => set({ colmap: null }),

  // NeRF Training: Model training
  nerfTraining: null,
  setNeRFTraining: (state) => set({ nerfTraining: state }),
  updateNeRFTraining: (updates) => set((s) => ({
    nerfTraining: s.nerfTraining ? { ...s.nerfTraining, ...updates } : null,
  })),
  clearNeRFTraining: () => set({ nerfTraining: null }),

  // Rendering: Frame rendering
  rendering: null,
  setRendering: (state) => set({ rendering: state }),
  updateRendering: (updates) => set((s) => ({
    rendering: s.rendering ? { ...s.rendering, ...updates } : null,
  })),
  clearRendering: () => set({ rendering: null }),

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
      chatMessages: [],
      moods: [],
      selectedMoodId: null,
      storyboardCompleted: false,
      uploadedProduct: null,
      colmap: null,
      nerfTraining: null,
      rendering: null,
      audioUrl: null,
      compositionJobId: null,
      finalVideo: null,
      error: null,
    });
  },
}));

