import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/appStore';
import { RenderingState } from '@/types/nerf.types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const POLLING_INTERVAL = 5000; // 5 seconds

interface StartRenderingParams {
  trainJobId: string;
  trajectoryConfig?: {
    trajectory_type?: string;
    num_frames?: number;
    radius?: number;
    elevation?: number;
    center?: [number, number, number];
  };
}

export const useRendering = () => {
  const { rendering, setRendering, updateRendering, clearRendering, setError } = useAppStore();
  const [isPolling, setIsPolling] = useState(false);

  const startRendering = useCallback(async ({ trainJobId, trajectoryConfig }: StartRenderingParams) => {
    try {
      setRendering({
        job_id: null,
        status: "processing",
        progress: 0,
        frames_rendered: 0,
        total_frames: trajectoryConfig?.num_frames || 1440,
        current_frame: 0,
        current_batch: 0,
        total_batches: 15,
        sample_frames: [],
        error: null,
      });

      const response = await fetch(`${API_URL}/api/nerf/render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          train_job_id: trainJobId,
          trajectory_config: trajectoryConfig || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to start frame rendering');
      }

      const data = await response.json();

      updateRendering({
        job_id: data.job_id,
        status: data.status,
        progress: data.progress,
        frames_rendered: data.frames_rendered,
        total_frames: data.total_frames,
        current_batch: data.current_batch,
        total_batches: data.total_batches,
        estimated_time_remaining: data.estimated_time_remaining,
      });

      setIsPolling(true);
    } catch (err: any) {
      setError(err.message);
      updateRendering({ status: "failed", error: err.message });
    }
  }, [setRendering, updateRendering, setError]);

  const retryRendering = useCallback(async (jobId: string, trajectoryConfig?: any) => {
    try {
      const response = await fetch(`${API_URL}/api/nerf/render/retry/${jobId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          train_job_id: jobId.replace('render_', 'train_'),
          trajectory_config: trajectoryConfig || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to retry frame rendering');
      }

      const data = await response.json();

      setRendering({
        job_id: data.job_id,
        status: data.status,
        progress: data.progress,
        frames_rendered: data.frames_rendered,
        total_frames: data.total_frames,
        current_frame: 0,
        current_batch: data.current_batch,
        total_batches: data.total_batches,
        estimated_time_remaining: data.estimated_time_remaining,
        sample_frames: [],
        error: null,
      });

      setIsPolling(true);
    } catch (err: any) {
      setError(err.message);
      updateRendering({ status: "failed", error: err.message });
    }
  }, [setRendering, updateRendering, setError]);

  // Polling effect
  useEffect(() => {
    if (!rendering?.job_id || !isPolling) {
      return;
    }

    if (rendering.status === "complete" || rendering.status === "failed") {
      setIsPolling(false);
      return;
    }

    const pollStatus = async () => {
      try {
        const response = await fetch(`${API_URL}/api/nerf/render/status/${rendering.job_id}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to get rendering status');
        }

        const statusData = await response.json();

        // Build sample frames array (every 10th frame)
        const sampleFrames: string[] = [];
        if (statusData.frames_rendered > 0) {
          for (let i = 10; i <= statusData.frames_rendered; i += 10) {
            sampleFrames.push(`${API_URL}/api/nerf/frames/${rendering.job_id}/${i}`);
          }
        }

        updateRendering({
          status: statusData.status,
          progress: statusData.progress,
          frames_rendered: statusData.frames_rendered,
          total_frames: statusData.total_frames,
          current_frame: statusData.current_frame,
          current_batch: statusData.current_batch,
          total_batches: statusData.total_batches,
          rendering_speed: statusData.rendering_speed,
          estimated_time_remaining: statusData.estimated_time_remaining,
          output_directory: statusData.local_path,
          sample_frames: sampleFrames,
          error: statusData.error,
        });

        // Stop polling if rendering is complete or failed
        if (statusData.status === "complete" || statusData.status === "failed") {
          setIsPolling(false);
        }
      } catch (err: any) {
        console.error("Failed to poll rendering status:", err);
        setError(err.message);
        updateRendering({ error: err.message });
      }
    };

    const intervalId = setInterval(pollStatus, POLLING_INTERVAL);

    // Immediate first poll
    pollStatus();

    return () => clearInterval(intervalId);
  }, [rendering?.job_id, rendering?.status, isPolling, updateRendering, setError, API_URL]);

  return {
    renderingState: rendering,
    startRendering,
    retryRendering,
    clearRenderingState: clearRendering,
    isPolling,
  };
};

