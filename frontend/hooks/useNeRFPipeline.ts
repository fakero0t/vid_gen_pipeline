import { useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/appStore';
import { useCOLMAP } from './useCOLMAP';
import { useNeRFTraining } from './useNeRFTraining';
import { useRendering } from './useRendering';

/**
 * Pipeline orchestration hook that coordinates all three stages:
 * 1. COLMAP Processing
 * 2. NeRF Training
 * 3. Frame Rendering
 * 
 * Automatically transitions between stages as each completes.
 */
export const useNeRFPipeline = () => {
  const { colmap, nerfTraining, rendering } = useAppStore();
  
  const { start: startCOLMAP, colmap: colmapState } = useCOLMAP();
  const { startTraining, trainingState } = useNeRFTraining();
  const { startRendering, renderingState } = useRendering();

  // Calculate overall pipeline progress (weighted)
  const calculateOverallProgress = useCallback((): number => {
    let progress = 0;
    
    // COLMAP: 25% of total
    if (colmapState) {
      progress += (colmapState.progress / 100) * 25;
    }
    
    // Training: 50% of total
    if (trainingState) {
      progress += (trainingState.progress / 100) * 50;
    }
    
    // Rendering: 25% of total
    if (renderingState) {
      progress += (renderingState.progress / 100) * 25;
    }
    
    return Math.round(progress);
  }, [colmapState, trainingState, renderingState]);

  // Determine overall pipeline status
  const getPipelineStatus = useCallback((): 'idle' | 'processing' | 'complete' | 'failed' => {
    if (renderingState?.status === 'complete') {
      return 'complete';
    }
    
    if (colmapState?.status === 'failed' || trainingState?.status === 'failed' || renderingState?.status === 'failed') {
      return 'failed';
    }
    
    if (colmapState?.status === 'processing' || trainingState?.status === 'processing' || renderingState?.status === 'processing') {
      return 'processing';
    }
    
    if (colmapState || trainingState || renderingState) {
      return 'processing';
    }
    
    return 'idle';
  }, [colmapState, trainingState, renderingState]);

  // Get current active stage
  const getCurrentStage = useCallback((): 'colmap' | 'training' | 'rendering' | 'complete' | null => {
    if (renderingState?.status === 'complete') {
      return 'complete';
    }
    
    if (renderingState?.status === 'processing') {
      return 'rendering';
    }
    
    if (trainingState?.status === 'complete' && !renderingState) {
      return 'rendering'; // Ready to start
    }
    
    if (trainingState?.status === 'processing') {
      return 'training';
    }
    
    if (colmapState?.status === 'complete' && !trainingState) {
      return 'training'; // Ready to start
    }
    
    if (colmapState?.status === 'processing') {
      return 'colmap';
    }
    
    return null;
  }, [colmapState, trainingState, renderingState]);

  // Note: COLMAP is now triggered directly from ProductUpload component
  // after upload completes, so no auto-start needed here

  // Auto-start Training when COLMAP completes
  useEffect(() => {
    if (
      colmapState?.status === 'complete' &&
      colmapState.job_id &&
      !trainingState
    ) {
      console.log('[Pipeline] Auto-starting NeRF training...');
      startTraining({
        colmapJobId: colmapState.job_id,
        config: {
          num_iterations: 15000,
        },
      });
    }
  }, [colmapState, trainingState, startTraining]);

  // Auto-start Rendering when Training completes
  useEffect(() => {
    if (
      trainingState?.status === 'complete' &&
      trainingState.job_id &&
      !renderingState
    ) {
      console.log('[Pipeline] Auto-starting frame rendering...');
      startRendering({
        trainJobId: trainingState.job_id,
        trajectoryConfig: {
          trajectory_type: 'circular_orbit',
          num_frames: 1440,
          radius: 2.5,
          elevation: 35,
          center: [0, 0, 0],
        },
      });
    }
  }, [trainingState, renderingState, startRendering]);

  // Get estimated total time remaining
  const getEstimatedTimeRemaining = useCallback((): number | null => {
    const currentStage = getCurrentStage();
    
    if (!currentStage || currentStage === 'complete') {
      return null;
    }
    
    let timeRemaining = 0;
    
    if (currentStage === 'colmap' && colmapState?.estimated_time_remaining) {
      timeRemaining += colmapState.estimated_time_remaining;
      // Add estimated time for training and rendering
      timeRemaining += 1500; // ~25 min for training
      timeRemaining += 1200; // ~20 min for rendering
    } else if (currentStage === 'training' && trainingState?.estimated_time_remaining) {
      timeRemaining += trainingState.estimated_time_remaining;
      // Add estimated time for rendering
      timeRemaining += 1200; // ~20 min for rendering
    } else if (currentStage === 'rendering' && renderingState?.estimated_time_remaining) {
      timeRemaining += renderingState.estimated_time_remaining;
    }
    
    return timeRemaining > 0 ? timeRemaining : null;
  }, [getCurrentStage, colmapState, trainingState, renderingState]);

  // Get error information
  const getError = useCallback((): { stage: string; message: string } | null => {
    if (colmapState?.error) {
      return { stage: 'COLMAP', message: colmapState.error };
    }
    if (trainingState?.error) {
      return { stage: 'Training', message: trainingState.error };
    }
    if (renderingState?.error) {
      return { stage: 'Rendering', message: renderingState.error };
    }
    return null;
  }, [colmapState, trainingState, renderingState]);

  return {
    // Overall state
    overallProgress: calculateOverallProgress(),
    pipelineStatus: getPipelineStatus(),
    currentStage: getCurrentStage(),
    estimatedTimeRemaining: getEstimatedTimeRemaining(),
    error: getError(),
    
    // Stage states
    colmapState,
    trainingState,
    renderingState,
    
    // Stage check helpers
    isColmapComplete: colmapState?.status === 'complete',
    isTrainingComplete: trainingState?.status === 'complete',
    isRenderingComplete: renderingState?.status === 'complete',
    isPipelineComplete: renderingState?.status === 'complete',
    
    // Manual trigger functions (in case auto-start fails)
    manualStartCOLMAP: startCOLMAP,
    manualStartTraining: startTraining,
    manualStartRendering: startRendering,
  };
};

