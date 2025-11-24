/**
 * Lazy-loaded components for code splitting and performance optimization
 * Each major pipeline step is split into its own chunk for faster initial load
 */
import { lazy } from 'react';

// Step 1: Vision Chat Components
export const ChatInterface = lazy(() =>
  import('@/components/vision/ChatInterface').then((module) => ({
    default: module.ChatInterface,
  }))
);

export const CreativeBriefSummary = lazy(() =>
  import('@/components/vision/CreativeBriefSummary').then((module) => ({
    default: module.CreativeBriefSummary,
  }))
);

// Step 2: Product Upload
export const ProductUpload = lazy(() =>
  import('@/components/product/ProductUpload').then((module) => ({
    default: module.ProductUpload,
  }))
);

// Step 3: Mood Generation
export const MoodBoard = lazy(() =>
  import('@/components/moods/MoodBoard').then((module) => ({
    default: module.MoodBoard,
  }))
);

// Step 3: Scene Planning
export const Storyboard = lazy(() =>
  import('@/components/scenes/Storyboard').then((module) => ({
    default: module.Storyboard,
  }))
);

// Step 4: Video Generation
export const VideoGeneration = lazy(() =>
  import('@/components/composition/VideoGeneration').then((module) => ({
    default: module.VideoGeneration,
  }))
);

// Step 5: Audio Page
export const AudioPage = lazy(() =>
  import('@/components/audio/AudioPage').then((module) => ({
    default: module.AudioPage,
  }))
);

export const AudioGenerationPage = lazy(() =>
  import('@/components/audio/AudioGenerationPage').then((module) => ({
    default: module.AudioGenerationPage,
  }))
);

// Step 6: Final Composition
export const FinalComposition = lazy(() =>
  import('@/components/composition/FinalComposition').then((module) => ({
    default: module.FinalComposition,
  }))
);

