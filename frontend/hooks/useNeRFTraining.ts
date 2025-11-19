import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/appStore';
import { NeRFTrainingState } from '@/types/nerf.types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const POLLING_INTERVAL = 5000; // 5 seconds

interface StartTrainingParams {
  colmapJobId: string;
  config?: {
    num_iterations?: number;
    resolution?: [number, number];
    downscale_factor?: number;
  };
}

export const useNeRFTraining = () => {
  const { nerfTraining, setNeRFTraining, updateNeRFTraining, clearNeRFTraining, setError } = useAppStore();
  const [isPolling, setIsPolling] = useState(false);

  const startTraining = useCallback(async ({ colmapJobId, config }: StartTrainingParams) => {
    try {
      console.log('[Training] Starting NeRF training...', { colmapJobId, config });
      
      setNeRFTraining({
        job_id: null,
        status: "processing",
        progress: 0,
        stage_progress: 0,
        error: null,
      });

      console.log('[Training] Making API call to:', `${API_URL}/api/nerf/train`);
      const response = await fetch(`${API_URL}/api/nerf/train`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          colmap_job_id: colmapJobId,
          config: config || null,
        }),
      });
      
      console.log('[Training] API response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[Training] API error:', errorData);
        throw new Error(errorData.detail || 'Failed to start NeRF training');
      }

      const data = await response.json();
      console.log('[Training] Training started successfully:', {
        job_id: data.job_id,
        status: data.status,
        modal_call_ids: data.modal_call_ids,
      });

      updateNeRFTraining({
        job_id: data.job_id,
        status: data.status,
        progress: data.progress,
        stage_progress: 0,
        estimated_time_remaining: data.estimated_time_remaining,
      });

      setIsPolling(true);
      console.log('[Training] Started polling for status updates');
    } catch (err: any) {
      console.error('[Training] Failed to start training:', err);
      setError(err.message);
      updateNeRFTraining({ status: "failed", error: err.message });
    }
  }, [setNeRFTraining, updateNeRFTraining, setError]);

  const retryTraining = useCallback(async (jobId: string, config?: any) => {
    try {
      const response = await fetch(`${API_URL}/api/nerf/train/retry/${jobId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          colmap_job_id: jobId.replace('train_', 'colmap_'),
          config: config || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to retry NeRF training');
      }

      const data = await response.json();

      setNeRFTraining({
        job_id: data.job_id,
        status: data.status,
        progress: data.progress,
        stage_progress: 0,
        estimated_time_remaining: data.estimated_time_remaining,
        error: null,
      });

      setIsPolling(true);
    } catch (err: any) {
      setError(err.message);
      updateNeRFTraining({ status: "failed", error: err.message });
    }
  }, [setNeRFTraining, updateNeRFTraining, setError]);

  // Polling effect
  useEffect(() => {
    if (!nerfTraining?.job_id || !isPolling) {
      return;
    }

    if (nerfTraining.status === "complete" || nerfTraining.status === "failed") {
      setIsPolling(false);
      return;
    }

    const pollStatus = async () => {
      try {
        const response = await fetch(`${API_URL}/api/nerf/train/status/${nerfTraining.job_id}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to get training status');
        }

        const statusData = await response.json();
        console.log('[Training] Status update:', {
          job_id: nerfTraining.job_id,
          status: statusData.status,
          progress: statusData.progress,
          stage: statusData.stage,
        });

        updateNeRFTraining({
          status: statusData.status,
          progress: statusData.progress,
          stage_progress: statusData.stage_progress,
          current_iteration: statusData.current_iteration,
          total_iterations: statusData.total_iterations,
          loss: statusData.loss,
          psnr: statusData.psnr,
          ssim: statusData.ssim,
          gpu_type: statusData.gpu_type,
          estimated_time_remaining: statusData.estimated_time_remaining,
          elapsed_time: statusData.elapsed_time,
          cost_so_far: statusData.cost_so_far,
          checkpoint_path: statusData.model_path,
          stage_details: statusData.stage_details,
          error: statusData.error,
        });

        // Stop polling if training is complete or failed
        if (statusData.status === "complete" || statusData.status === "failed") {
          setIsPolling(false);
        }
      } catch (err: any) {
        console.error("Failed to poll training status:", err);
        setError(err.message);
        updateNeRFTraining({ error: err.message });
      }
    };

    const intervalId = setInterval(pollStatus, POLLING_INTERVAL);

    // Immediate first poll
    pollStatus();

    return () => clearInterval(intervalId);
  }, [nerfTraining?.job_id, nerfTraining?.status, isPolling, updateNeRFTraining, setError]);

  return {
    trainingState: nerfTraining,
    startTraining,
    retryTraining,
    clearTrainingState: clearNeRFTraining,
    isPolling,
  };
};

