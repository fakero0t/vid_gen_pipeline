/**
 * useCOLMAP Hook
 * 
 * Custom React hook for managing COLMAP camera pose estimation process.
 * Handles starting COLMAP processing, polling for status updates, and state management.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '@/store/appStore';
import { startCOLMAP, getCOLMAPStatus, retryCOLMAP } from '@/lib/api/nerf';
import type { COLMAPRequest, COLMAPState } from '@/types/nerf.types';
import { logger } from '@/lib/logger';

const POLL_INTERVAL = 3000; // 3 seconds

export function useCOLMAP() {
  const { colmap, setCOLMAP, updateCOLMAP, clearCOLMAP } = useAppStore();
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, []);

  /**
   * Start COLMAP processing
   */
  const start = useCallback(async (request: COLMAPRequest) => {
    try {
      logger.info('Starting COLMAP processing', { jobId: request.job_id });

      // Initialize COLMAP state
      setCOLMAP({
        job_id: null,
        status: 'processing',
        stage: 'feature_extraction',
        progress: 0,
        current_operation: 'Starting COLMAP processing...',
        images_processed: 0,
        total_images: 0, // Will be updated from status polling
      });

      // Start COLMAP processing
      const response = await startCOLMAP(request);

      // Update state with response
      updateCOLMAP({
        job_id: response.job_id,
        status: response.status,
        stage: response.stage,
        progress: response.progress,
        estimated_time_remaining: response.estimated_time_remaining,
      });

      // Start polling for status updates
      startPolling(response.job_id);

      return response;
    } catch (error) {
      logger.error('Failed to start COLMAP processing', { error });
      updateCOLMAP({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Failed to start COLMAP processing',
      });
      throw error;
    }
  }, [setCOLMAP, updateCOLMAP]);

  /**
   * Start polling for COLMAP status updates
   */
  const startPolling = useCallback((jobId: string) => {
    // Clear any existing timer
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
    }

    // Poll immediately
    pollStatus(jobId);

    // Set up polling interval
    pollTimerRef.current = setInterval(() => {
      pollStatus(jobId);
    }, POLL_INTERVAL);
  }, []);

  /**
   * Stop polling for status updates
   */
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  /**
   * Poll for COLMAP status
   */
  const pollStatus = useCallback(async (jobId: string) => {
    if (!isMountedRef.current) {
      return;
    }

    try {
      const status = await getCOLMAPStatus(jobId);

      if (!isMountedRef.current) {
        return;
      }

      // Update state
      updateCOLMAP({
        status: status.status,
        stage: status.stage,
        progress: status.progress,
        current_operation: status.current_operation,
        images_processed: status.images_processed,
        total_images: status.total_images,
        estimated_time_remaining: status.estimated_time_remaining,
        output_path: status.output_path,
        error: status.error,
      });

      // Stop polling if complete or failed
      if (status.status === 'complete' || status.status === 'failed') {
        stopPolling();

        if (status.status === 'complete') {
          logger.info('COLMAP processing completed', { jobId, outputPath: status.output_path });
        } else {
          logger.error('COLMAP processing failed', { jobId, error: status.error });
        }
      }
    } catch (error) {
      logger.error('Failed to get COLMAP status', { error });
      // Don't stop polling on errors - might be temporary
    }
  }, [updateCOLMAP, stopPolling]);

  /**
   * Retry COLMAP processing
   */
  const retry = useCallback(async (request: COLMAPRequest) => {
    try {
      logger.info('Retrying COLMAP processing', { jobId: request.job_id });

      // Reset state
      updateCOLMAP({
        status: 'processing',
        stage: 'feature_extraction',
        progress: 0,
        current_operation: 'Retrying COLMAP processing...',
        error: undefined,
      });

      // Retry COLMAP processing
      const response = await retryCOLMAP(request.job_id, request);

      // Update state with response
      updateCOLMAP({
        job_id: response.job_id,
        status: response.status,
        stage: response.stage,
        progress: response.progress,
        estimated_time_remaining: response.estimated_time_remaining,
      });

      // Start polling for status updates
      startPolling(response.job_id);

      return response;
    } catch (error) {
      logger.error('Failed to retry COLMAP processing', { error });
      updateCOLMAP({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Failed to retry COLMAP processing',
      });
      throw error;
    }
  }, [updateCOLMAP, startPolling]);

  /**
   * Reset COLMAP state
   */
  const reset = useCallback(() => {
    stopPolling();
    clearCOLMAP();
  }, [stopPolling, clearCOLMAP]);

  return {
    colmap,
    start,
    retry,
    reset,
    isProcessing: colmap?.status === 'processing',
    isComplete: colmap?.status === 'complete',
    isFailed: colmap?.status === 'failed',
  };
}

