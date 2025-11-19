import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CreativeBrief } from '@/types/chat.types';
import type { Mood } from '@/types/mood.types';
import type { ScenePlan } from '@/types/scene.types';
import type { COLMAPState, NeRFTrainingState, RenderingState } from '@/types/nerf.types';
import type { ProductImage } from '@/types/product.types';

/**
 * Global application state store using Zustand.
 * This store manages state across all pipeline steps.
 */
interface AppState {
  // Navigation
  currentStep: 1 | 2 | 3 | 4 | 5 | 6;
  setCurrentStep: (step: number) => void;

    // Step 1: Vision & Creative Brief
    creativeBrief: CreativeBrief | null;
    setCreativeBrief: (brief: CreativeBrief | null) => void;

  // Step 2: Product Upload (existing flow - NeRF mode)
  productImages: File[];
  setProductImages: (images: File[]) => void;
  
  // Step 2: Product Upload (product mode - single image)
  uploadedProduct: ProductImage | null;
  setUploadedProduct: (product: ProductImage | null) => void;
  
  // COLMAP State
  colmap: COLMAPState | null;
  setCOLMAP: (state: COLMAPState) => void;
  updateCOLMAP: (updates: Partial<COLMAPState>) => void;
  clearCOLMAP: () => void;
  
  // NeRF Training State
  nerfTraining: NeRFTrainingState | null;
  setNeRFTraining: (state: NeRFTrainingState) => void;
  updateNeRFTraining: (updates: Partial<NeRFTrainingState>) => void;
  clearNeRFTraining: () => void;
  
  // Rendering State
  rendering: RenderingState | null;
  setRendering: (state: RenderingState) => void;
  updateRendering: (updates: Partial<RenderingState>) => void;
  clearRendering: () => void;

  // Step 3: Moods
  moods: Mood[];
  selectedMoodId: string | null;
  setMoods: (moods: Mood[]) => void;
  selectMood: (moodId: string) => void;

  // Step 4: Storyboard (handles text, images, and videos)
  // Actual storyboard state is in storyboardStore, this just tracks we completed it
  storyboardCompleted: boolean;
  setStoryboardCompleted: (completed: boolean) => void;

  // Step 4: Scenes (optional, for scene planning flow)
  scenePlan: ScenePlan | null;
  setScenePlan: (plan: ScenePlan | null) => void;

  // Step 5: Video Clips
  videoJobId: string | null;
  generatedClips: any[];
  clipGenerationProgress: number;
  setVideoJobId: (jobId: string | null) => void;
  setGeneratedClips: (clips: any[]) => void;
  updateClipProgress: (progress: number) => void;

  // Audio
  audioUrl: string | null;
  setAudioUrl: (url: string | null) => void;

  // Step 6: Final Video Composition
  compositionJobId: string | null;
  finalVideo: any | null;
  compositionProgress: number;
  setCompositionJobId: (jobId: string | null) => void;
  setFinalVideo: (video: any) => void;
  updateCompositionProgress: (progress: number) => void;

  // Error Handling
  error: string | null;
  setError: (error: string | null) => void;

  // Reset
  reset: () => void;
}

const STORAGE_KEY = 'jant-vid-pipe-app-state';

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Navigation
      currentStep: 1,
      setCurrentStep: (step) => set({ currentStep: step as 1 | 2 | 3 | 4 | 5 | 6 }),

      // Step 1: Vision
      creativeBrief: null,
      setCreativeBrief: (brief) => set({ creativeBrief: brief }),

      // Step 2: Product Upload (existing flow - NeRF mode)
      productImages: [],
      setProductImages: (images) => set({ productImages: images }),
      
      // Step 2: Product Upload (product mode - single image)
      uploadedProduct: null,
      setUploadedProduct: (product) => set({ uploadedProduct: product }),
      
      // COLMAP State
      colmap: null,
      setCOLMAP: (colmapState) => set({ colmap: colmapState }),
      updateCOLMAP: (updates) => set((state) => ({
        colmap: state.colmap ? { ...state.colmap, ...updates } : null
      })),
      clearCOLMAP: () => set({ colmap: null }),
      
      // NeRF Training State
      nerfTraining: null,
      setNeRFTraining: (trainingState) => set({ nerfTraining: trainingState }),
      updateNeRFTraining: (updates) => set((state) => ({
        nerfTraining: state.nerfTraining ? { ...state.nerfTraining, ...updates } : null
      })),
      clearNeRFTraining: () => set({ nerfTraining: null }),
      
      // Rendering State
      rendering: null,
      setRendering: (renderingState) => set({ rendering: renderingState }),
      updateRendering: (updates) => set((state) => ({
        rendering: state.rendering ? { ...state.rendering, ...updates } : null
      })),
      clearRendering: () => set({ rendering: null }),

      // Step 3: Moods
      moods: [],
      selectedMoodId: null,
      setMoods: (moods) => set({ moods }),
      selectMood: (moodId) => set({ selectedMoodId: moodId }),

      // Step 4: Storyboard
      storyboardCompleted: false,
      setStoryboardCompleted: (completed) => set({ storyboardCompleted: completed }),

      // Step 4: Scenes (optional, for scene planning flow)
      scenePlan: null,
      setScenePlan: (plan) => set({ scenePlan: plan }),

      // Step 5: Video Clips
      videoJobId: null,
      generatedClips: [],
      clipGenerationProgress: 0,
      setVideoJobId: (jobId) => set({ videoJobId: jobId }),
      setGeneratedClips: (clips) => set({ generatedClips: clips }),
      updateClipProgress: (progress) => set({ clipGenerationProgress: progress }),

      // Audio
      audioUrl: null,
      setAudioUrl: (url) => set({ audioUrl: url }),

      // Step 6: Final Video Composition
      compositionJobId: null,
      finalVideo: null,
      compositionProgress: 0,
      setCompositionJobId: (jobId) => set({ compositionJobId: jobId }),
      setFinalVideo: (video) => set({ finalVideo: video }),
      updateCompositionProgress: (progress) => set({ compositionProgress: progress }),

      // Error Handling
      error: null,
      setError: (error) => set({ error }),

      // Reset
      reset: () => {
        // Clear localStorage for this app
        if (typeof window !== 'undefined') {
          localStorage.removeItem(STORAGE_KEY);
        }
        // Reset state
        set({
          currentStep: 1,
          creativeBrief: null,
          productImages: [],
          uploadedProduct: null,
          colmap: null,
          nerfTraining: null,
          rendering: null,
          moods: [],
          selectedMoodId: null,
          storyboardCompleted: false,
          scenePlan: null,
          videoJobId: null,
          generatedClips: [],
          clipGenerationProgress: 0,
          audioUrl: null,
          compositionJobId: null,
          finalVideo: null,
          compositionProgress: 0,
          error: null,
        });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Only persist certain fields (exclude error state and temporary progress)
      partialize: (state) => {
        return {
          currentStep: state.currentStep,
          creativeBrief: state.creativeBrief,
          // Don't persist productImages (files can't be serialized)
          uploadedProduct: state.uploadedProduct,
          colmap: state.colmap,
          nerfTraining: state.nerfTraining,
          rendering: state.rendering,
          moods: state.moods,
          selectedMoodId: state.selectedMoodId,
          storyboardCompleted: state.storyboardCompleted,
          scenePlan: state.scenePlan,
          videoJobId: state.videoJobId,
          generatedClips: state.generatedClips,
          audioUrl: state.audioUrl,
          compositionJobId: state.compositionJobId,
          finalVideo: state.finalVideo,
          // Don't persist: error, clipGenerationProgress, compositionProgress, productImages
        };
      },
    }
  )
);

