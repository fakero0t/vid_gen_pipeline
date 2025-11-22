'use client';

import React from 'react';
import type { VideoClip } from '@/types/video.types';

interface ClipProgressProps {
  clip: VideoClip;
  sceneDescription?: string;
}

export function ClipProgress({ clip, sceneDescription }: ClipProgressProps) {
  // Debug: Log when progress changes
  React.useEffect(() => {
    console.log(`📊 Scene ${clip.scene_number} progress update:`, {
      status: clip.status,
      progress: clip.progress_percent,
      hasVideo: !!clip.video_url
    });
  }, [clip.scene_number, clip.status, clip.progress_percent, clip.video_url]);

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        );
      case 'processing':
        return (
          <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        return 'Complete';
      case 'processing':
        return 'Generating...';
      case 'failed':
        return 'Failed';
      default:
        return 'Pending';
    }
  };

  return (
    <div className={`rounded-lg border-2 p-4 transition-all duration-300 ${getStatusColor(clip.status)}`}>
      <div className="flex items-center justify-between mb-3">
        {/* Scene number and status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-current/10 font-bold text-sm">
            {clip.scene_number}
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon(clip.status)}
            <span className="font-medium text-sm">{getStatusText(clip.status)}</span>
          </div>
        </div>

        {/* Duration */}
        <div className="text-xs font-medium opacity-75">
          {clip.duration.toFixed(1)}s
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="opacity-75">Progress</span>
          <span className="font-medium">{clip.progress_percent}%</span>
        </div>
        <div className="h-2 bg-current/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-current transition-all duration-500 ease-out rounded-full"
            style={{ width: `${clip.progress_percent}%` }}
          />
        </div>
      </div>

      {/* Scene description */}
      {sceneDescription && (
        <p className="text-xs opacity-75 line-clamp-2">{sceneDescription}</p>
      )}

      {/* Error message */}
      {clip.error && (
        <div className="mt-2 text-xs bg-current/10 rounded px-2 py-1">
          {clip.error}
        </div>
      )}

      {/* Video preview for completed clips */}
      {clip.status === 'completed' && clip.video_url && (
        <div className="mt-3 space-y-2">
          <div className="rounded-lg overflow-hidden bg-black border-2 border-current/20">
            <video
              controls
              preload="metadata"
              className="w-full aspect-video object-contain"
              style={{ maxHeight: '300px' }}
            >
              <source src={clip.video_url} type="video/mp4" />
              Your browser does not support the video element.
            </video>
          </div>
          <a
            href={clip.video_url}
            download={`scene-${clip.scene_number}.mp4`}
            className="text-xs font-medium hover:underline flex items-center gap-1 justify-center"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Download clip
          </a>
        </div>
      )}
    </div>
  );
}
