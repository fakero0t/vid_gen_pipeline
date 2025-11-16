'use client';

import React from 'react';
import type { VideoJobStatus } from '@/types/video.types';

interface ProgressIndicatorProps {
  jobStatus: VideoJobStatus | null;
  showDetails?: boolean;
}

export function ProgressIndicator({ jobStatus, showDetails = true }: ProgressIndicatorProps) {
  // Show a starting state if no job status yet
  if (!jobStatus) {
    return (
      <div className="rounded-xl border-2 p-6 transition-all duration-300 text-blue-600 bg-blue-50 border-blue-200">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg">Starting video generation...</h3>
            <p className="text-sm opacity-75 mt-1">Initializing job and preparing scenes</p>
          </div>
          <div className="text-3xl font-bold">0%</div>
        </div>
        <div className="mb-4">
          <div className="h-3 bg-current/10 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full w-0 transition-all duration-500" />
          </div>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'processing':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'failed':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getProgressBarColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'processing':
        return 'bg-blue-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case 'processing':
        return (
          <svg className="w-6 h-6 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        );
      case 'failed':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      default:
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'All videos generated successfully!';
      case 'processing':
        return 'Generating videos...';
      case 'failed':
        return 'Video generation failed';
      default:
        return 'Waiting to start...';
    }
  };

  const getTimeElapsed = () => {
    const created = new Date(jobStatus.created_at);
    const updated = new Date(jobStatus.updated_at);
    const elapsed = Math.floor((updated.getTime() - created.getTime()) / 1000);

    if (elapsed < 60) {
      return `${elapsed}s`;
    } else {
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      return `${minutes}m ${seconds}s`;
    }
  };

  return (
    <div className={`rounded-xl border-2 p-6 transition-all duration-300 ${getStatusColor(jobStatus.status)}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-shrink-0">{getStatusIcon(jobStatus.status)}</div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg">{getStatusText(jobStatus.status)}</h3>
          {showDetails && (
            <p className="text-sm opacity-75 mt-1">
              {jobStatus.completed_scenes} of {jobStatus.total_scenes} clips completed
              {jobStatus.failed_scenes > 0 && ` • ${jobStatus.failed_scenes} failed`}
            </p>
          )}
        </div>
        <div className="text-3xl font-bold">{jobStatus.progress_percent}%</div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="h-3 bg-current/10 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ease-out rounded-full ${getProgressBarColor(jobStatus.status)}`}
            style={{ width: `${jobStatus.progress_percent}%` }}
          />
        </div>
      </div>

      {/* Details */}
      {showDetails && (
        <div className="flex items-center justify-between text-xs opacity-75">
          <div className="flex items-center gap-4">
            <span>Job ID: {jobStatus.job_id.slice(0, 8)}...</span>
            <span>Time: {getTimeElapsed()}</span>
          </div>
          <div>
            {jobStatus.status === 'processing' && (
              <span className="animate-pulse">● Generating in parallel</span>
            )}
            {jobStatus.status === 'completed' && <span>✓ Complete</span>}
            {jobStatus.status === 'failed' && <span>✗ Failed</span>}
          </div>
        </div>
      )}

      {/* Error message */}
      {jobStatus.error && (
        <div className="mt-4 p-3 bg-current/10 rounded-lg text-sm">
          <div className="font-medium mb-1">Error:</div>
          <div className="opacity-75">{jobStatus.error}</div>
        </div>
      )}

      {/* Success message */}
      {jobStatus.status === 'completed' && jobStatus.completed_scenes === jobStatus.total_scenes && (
        <div className="mt-4 p-3 bg-current/10 rounded-lg text-sm">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="font-medium">
              Successfully generated {jobStatus.completed_scenes} video clips!
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
