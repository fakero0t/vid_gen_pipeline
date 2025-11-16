'use client';

import React from 'react';
import { ClipProgress } from './ClipProgress';
import { ProgressIndicator } from './ProgressIndicator';
import type { VideoJobStatus } from '@/types/video.types';
import type { Scene } from '@/types/scene.types';

interface VideoGenerationProgressProps {
  jobStatus: VideoJobStatus | null;
  scenes?: Scene[];
  onCancel?: () => void;
}

export function VideoGenerationProgress({
  jobStatus,
  scenes = [],
  onCancel,
}: VideoGenerationProgressProps) {
  // Force re-render when jobStatus changes
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);
  
  React.useEffect(() => {
    if (jobStatus) {
      console.log('🔄 FORCING component re-render due to jobStatus change');
      forceUpdate();
    }
  }, [jobStatus]);

  // Create a map of scene descriptions for easier lookup
  const sceneDescriptions = React.useMemo(() => {
    const map: Record<number, string> = {};
    scenes.forEach((scene) => {
      map[scene.scene_number] = scene.description;
    });
    return map;
  }, [scenes]);

  console.log('🎬 VideoGenerationProgress RENDER - jobStatus:', {
    timestamp: new Date().toISOString(),
    exists: !!jobStatus,
    hasClips: !!jobStatus?.clips,
    clipsLength: jobStatus?.clips?.length,
    jobProgress: jobStatus?.progress_percent,
    firstClipProgress: jobStatus?.clips?.[0]?.progress_percent,
    clipsData: jobStatus?.clips
  });
  
  // CRITICAL: Always prefer real data from jobStatus over placeholders
  let displayClips;
  
  if (jobStatus?.clips && jobStatus.clips.length > 0) {
    // Use real data from API
    console.log('🎬 ✅ Using REAL clips from API:', jobStatus.clips.map(c => ({
      scene: c.scene_number,
      progress: c.progress_percent,
      status: c.status
    })));
    displayClips = jobStatus.clips;
  } else {
    // Only use placeholders if we don't have real data yet
    console.log('🎬 ⚠️ No jobStatus yet, using placeholder clips');
    displayClips = scenes
      .filter(scene => scene.seed_image_url)
      .map((scene) => ({
        scene_number: scene.scene_number,
        status: 'pending' as const,
        progress_percent: 0,
        duration: scene.duration,
        video_url: null,
        error: null,
      }));
    console.log('🎬 Created', displayClips.length, 'placeholder clips');
  }

  return (
    <div className="space-y-6">
      {/* Overall progress indicator */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Video Generation Progress</h2>
        <ProgressIndicator jobStatus={jobStatus} />
      </div>

      {/* Individual clip progress */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Individual Clips</h3>
          {jobStatus?.status === 'processing' && onCancel && (
            <button
              onClick={onCancel}
              className="text-sm text-red-600 hover:text-red-700 font-medium transition-colors"
            >
              Cancel Generation
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayClips.map((clip) => (
            <ClipProgress
              key={`clip-${clip.scene_number}`}
              clip={clip}
              sceneDescription={sceneDescriptions[clip.scene_number]}
            />
          ))}
        </div>
      </div>

      {/* Action buttons */}
      {jobStatus?.status === 'completed' && (
        <div className="flex gap-3 justify-center pt-4">
          <button className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity">
            Download All Videos
          </button>
          <button className="px-6 py-3 border-2 border-border rounded-lg font-medium hover:bg-accent transition-colors">
            View Final Video
          </button>
        </div>
      )}

      {/* Retry option for failed generation */}
      {jobStatus?.status === 'failed' && (
        <div className="flex gap-3 justify-center pt-4">
          <button className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity">
            Retry Generation
          </button>
          <button className="px-6 py-3 border-2 border-border rounded-lg font-medium hover:bg-accent transition-colors">
            Back to Scenes
          </button>
        </div>
      )}
    </div>
  );
}
