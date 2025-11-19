/**
 * COLMAP Progress Component
 * 
 * Displays progress for COLMAP camera pose estimation,
 * including current stage, progress bar, and status information.
 */

'use client';

import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { COLMAPState, COLMAPStage } from '@/types/nerf.types';

interface COLMAPProgressProps {
  colmap: COLMAPState;
  onRetry?: () => void;
}

const STAGE_LABELS: Record<COLMAPStage, string> = {
  feature_extraction: 'Extracting Features',
  feature_matching: 'Matching Features',
  sfm: 'Reconstructing Scene',
  complete: 'Complete',
};

const STAGE_DESCRIPTIONS: Record<COLMAPStage, string> = {
  feature_extraction: 'Analyzing keypoints and descriptors in each image...',
  feature_matching: 'Finding corresponding points between image pairs...',
  sfm: 'Calculating camera positions and 3D structure...',
  complete: 'Camera poses successfully estimated',
};

export function COLMAPProgress({ colmap, onRetry }: COLMAPProgressProps) {
  const { status, stage, progress, current_operation, images_processed, total_images, estimated_time_remaining, error } = colmap;

  // Format estimated time remaining
  const formatTime = (seconds?: number) => {
    if (!seconds) return null;
    
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    
    if (minutes > 0) {
      return `~${minutes}m ${secs}s`;
    }
    return `~${secs}s`;
  };

  // Get stage color
  const getStageColor = (s: COLMAPStage) => {
    if (s === stage) return 'text-blue-600 dark:text-blue-400';
    if (status === 'complete' || Object.keys(STAGE_LABELS).indexOf(s) < Object.keys(STAGE_LABELS).indexOf(stage)) {
      return 'text-green-600 dark:text-green-400';
    }
    return 'text-gray-400 dark:text-gray-600';
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">COLMAP Processing</h3>
        {status === 'processing' && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            Processing...
          </div>
        )}
        {status === 'complete' && (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Complete
          </div>
        )}
      </div>

      {/* Stage Indicators */}
      <div className="flex items-center justify-between gap-2">
        {(Object.entries(STAGE_LABELS) as [COLMAPStage, string][]).map(([s, label], index) => (
          <React.Fragment key={s}>
            <div className="flex flex-col items-center gap-1 flex-1">
              <div className={`text-xs font-medium ${getStageColor(s)}`}>
                {label}
              </div>
              <div
                className={`h-2 w-full rounded-full ${
                  s === stage
                    ? 'bg-blue-200 dark:bg-blue-900'
                    : status === 'complete' || Object.keys(STAGE_LABELS).indexOf(s) < Object.keys(STAGE_LABELS).indexOf(stage)
                    ? 'bg-green-200 dark:bg-green-900'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                {s === stage && (
                  <div
                    className="h-full bg-blue-600 dark:bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                  />
                )}
              </div>
            </div>
            {index < Object.keys(STAGE_LABELS).length - 1 && (
              <div className="w-4 h-0.5 bg-gray-300 dark:bg-gray-700" />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Overall Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-700 dark:text-gray-300">Overall Progress</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">{Math.round(progress)}%</span>
        </div>
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 transition-all duration-500 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      </div>

      {/* Status Information */}
      <div className="space-y-3 rounded-lg bg-gray-50 dark:bg-gray-800 p-4">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600 dark:text-gray-400">Current Stage:</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {STAGE_LABELS[stage]}
          </span>
        </div>

        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600 dark:text-gray-400">Operation:</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {current_operation || STAGE_DESCRIPTIONS[stage]}
          </span>
        </div>

        {total_images > 0 && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600 dark:text-gray-400">Images Processed:</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {images_processed} / {total_images}
            </span>
          </div>
        )}

        {estimated_time_remaining && status === 'processing' && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600 dark:text-gray-400">Estimated Time Remaining:</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {formatTime(estimated_time_remaining)}
            </span>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {status === 'failed' && error && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-start justify-between">
            <div>
              <p className="font-medium mb-1">COLMAP Processing Failed</p>
              <p className="text-sm">{error}</p>
            </div>
            {onRetry && (
              <button
                onClick={onRetry}
                className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
              >
                Retry
              </button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Info Message */}
      {status === 'processing' && (
        <div className="text-sm text-gray-600 dark:text-gray-400 italic">
          COLMAP is analyzing your product photos to estimate camera positions. This typically takes 10-20 minutes.
        </div>
      )}
    </div>
  );
}

export default COLMAPProgress;
