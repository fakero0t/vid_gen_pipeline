/**
 * Hook for managing video generation with polling and progress tracking.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  VideoGenerationRequest,
  VideoGenerationResponse,
  VideoJobStatus,
  VideoJobStatusResponse,
} from '@/types/video.types';

interface UseVideoGenerationReturn {
  jobStatus: VideoJobStatus | null;
  isGenerating: boolean;
  error: string | null;
  startGeneration: (request: VideoGenerationRequest) => Promise<string | null>;
  stopPolling: () => void;
  clearError: () => void;
  retryGeneration: () => Promise<void>;
}

const POLLING_INTERVAL = 3000; // 3 seconds
const MAX_POLL_RETRIES = 3; // Max retries for failed poll requests

export function useVideoGeneration(): UseVideoGenerationReturn {
  const [jobStatus, setJobStatus] = useState<VideoJobStatus | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<VideoGenerationRequest | null>(null);

  // Refs for cleanup and polling control
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollRetryCountRef = useRef(0);
  const isUnmountedRef = useRef(false);

  const clearError = useCallback(() => setError(null), []);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      console.log('🛑 stopPolling called - clearing interval:', pollingIntervalRef.current);
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    } else {
      console.log('⚠️ stopPolling called but no interval to clear');
    }
    pollRetryCountRef.current = 0;
  }, []);

  const pollJobStatus = useCallback(async (jobId: string): Promise<boolean> => {
    console.log('🔍 pollJobStatus called for job:', jobId);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/video/status/${jobId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: VideoJobStatusResponse = await response.json();

      if (!data.success || !data.job_status) {
        throw new Error(data.message || 'Failed to get job status');
      }

      // Update job status - CRITICAL: Always update regardless of mount status
      console.log('📥 Received job status:', data.job_status.status, 'Progress:', data.job_status.progress_percent);
      console.log('📥 Clip progress details:', data.job_status.clips.map(c => `Scene ${c.scene_number}: ${c.progress_percent}%`).join(', '));
      
      // FORCE a completely new object reference to trigger React re-render
      setJobStatus({
        job_id: data.job_status.job_id,
        status: data.job_status.status,
        total_scenes: data.job_status.total_scenes,
        completed_scenes: data.job_status.completed_scenes,
        failed_scenes: data.job_status.failed_scenes,
        progress_percent: data.job_status.progress_percent,
        clips: data.job_status.clips.map(clip => ({
          scene_number: clip.scene_number,
          video_url: clip.video_url,
          duration: clip.duration,
          status: clip.status,
          error: clip.error,
          progress_percent: clip.progress_percent,
        })),
        error: data.job_status.error,
        created_at: data.job_status.created_at,
        updated_at: data.job_status.updated_at,
      });
      
      console.log('✅ State updated - React should re-render now');
      pollRetryCountRef.current = 0; // Reset retry count on success
      
      // Check if job is complete, failed, or all clips are generated (progress = 100%)
      const isFinished =
        data.job_status.status === 'completed' || 
        data.job_status.status === 'failed' ||
        data.job_status.progress_percent === 100;

      if (isFinished) {
        console.log('🛑 Job finished, stopping polling. Status:', data.job_status.status, 'Progress:', data.job_status.progress_percent);
        setIsGenerating(false);
        return true; // Stop polling
      }

      console.log('⏩ Continuing to poll - job still in progress');
      return false; // Continue polling
    } catch (err) {
      console.error('Polling error:', err);
      pollRetryCountRef.current++;

      // If we've exceeded max retries, stop polling and set error
      if (pollRetryCountRef.current >= MAX_POLL_RETRIES) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to poll job status';
        if (!isUnmountedRef.current) {
          setError(`Polling failed: ${errorMessage}`);
          setIsGenerating(false);
        }
        return true; // Stop polling
      }

      return false; // Continue polling (retry)
    }
  }, []);

  const startPolling = useCallback(
    (jobId: string) => {
      console.log('🚀 Starting polling for job:', jobId);
      
      // Clear any existing polling interval
      stopPolling();

      // Start polling
      console.log('⏰ Setting up interval to poll every', POLLING_INTERVAL, 'ms');
      pollingIntervalRef.current = setInterval(async () => {
        console.log('🔄 Polling interval fired, checking job status...');
        const shouldStop = await pollJobStatus(jobId);
        if (shouldStop) {
          console.log('🛑 Clearing polling interval');
          stopPolling();
        }
      }, POLLING_INTERVAL);
      
      console.log('✅ Interval created with ID:', pollingIntervalRef.current);

      // Also poll immediately
      console.log('🔄 Polling immediately on startup...');
      pollJobStatus(jobId).then((shouldStop) => {
        if (shouldStop) {
          stopPolling();
        }
      });
    },
    [pollJobStatus, stopPolling]
  );

  const startGeneration = useCallback(
    async (request: VideoGenerationRequest): Promise<string | null> => {
      setIsGenerating(true);
      setError(null);
      setJobStatus(null);
      setLastRequest(request);

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/video/generate`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(request),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data: VideoGenerationResponse = await response.json();

        if (!data.success || !data.job_id) {
          throw new Error(data.message || 'Failed to start video generation');
        }

        // Start polling for job status
        console.log('🎯 About to call startPolling with job_id:', data.job_id);
        startPolling(data.job_id);
        console.log('✅ startPolling has been called');

        return data.job_id;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMessage);
        setIsGenerating(false);
        console.error('Video generation error:', err);
        return null;
      }
    },
    [startPolling]
  );

  const retryGeneration = useCallback(async (): Promise<void> => {
    if (!lastRequest) {
      setError('No previous request to retry');
      return;
    }

    await startGeneration(lastRequest);
  }, [lastRequest, startGeneration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
      stopPolling();
    };
  }, [stopPolling]);

  // Auto-stop polling when job is complete, failed, or all clips generated
  useEffect(() => {
    if (jobStatus) {
      const isFinished =
        jobStatus.status === 'completed' || 
        jobStatus.status === 'failed' ||
        jobStatus.progress_percent === 100;
      if (isFinished) {
        stopPolling();
      }
    }
  }, [jobStatus, stopPolling]);

  return {
    jobStatus,
    isGenerating,
    error,
    startGeneration,
    stopPolling,
    clearError,
    retryGeneration,
  };
}
