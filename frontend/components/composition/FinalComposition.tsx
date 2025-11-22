'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import { useSceneStore } from '@/store/sceneStore';
import { useVideoComposition } from '@/hooks/useVideoComposition';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { CompositionRequest, VideoClipInput } from '@/types/composition.types';

interface FinalCompositionProps {
  onBack: () => void;
}

type ProcessingPhase = 'idle' | 'composition' | 'complete';

export function FinalComposition({ onBack }: FinalCompositionProps) {
  const {
    audioUrl,
    finalVideo,
    creativeBrief,
    selectedMoodId,
    moods,
  } = useAppStore();
  
  // Get storyboard scenes with videos
  const { storyboard, scenes } = useSceneStore();

  const {
    composeVideo,
    jobStatus,
    isLoading: isComposing,
    error: compositionError,
    clearError: clearCompositionError,
  } = useVideoComposition();

  const [hasStarted, setHasStarted] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<ProcessingPhase>('idle');
  const [phaseProgress, setPhaseProgress] = useState({
    composition: 0,
  });

  const handleStartComposition = async () => {
    // Convert storyboard scenes to video clips
    const videoScenes = scenes.filter(scene => 
      scene.state === 'video' && 
      scene.video_url && 
      scene.generation_status.video === 'complete'
    );
    
    if (videoScenes.length === 0) {
      alert('No completed video scenes available. Please ensure all scenes have generated videos.');
      return;
    }
    
    // Convert scenes to VideoClipInput format
    const clips: VideoClipInput[] = videoScenes.map((scene, index) => ({
      scene_number: index + 1,
      video_url: scene.video_url!,
      duration: scene.video_duration,
    }));

    console.log(`📹 Preparing ${clips.length} video clips for composition`);
    setHasStarted(true);

    try {
      // Use audio from storyboard (generated earlier in mood step or storyboard page)
      console.log('🎬 Starting video composition...');
      console.log('🎵 Audio URL from store:', audioUrl);
      setCurrentPhase('composition');

      const request: CompositionRequest = {
        clips: clips,  // Use the clips we prepared from storyboard scenes
        audio_url: audioUrl || undefined,  // Use audio from storyboard
        include_crossfade: false,
        optimize_size: true,
        target_size_mb: 50,
      };

      console.log(`🎬 Composing ${request.clips.length} clips${request.audio_url ? ' with audio' : ' without audio'}`);
      if (request.audio_url) {
        console.log('🎵 Audio URL being used:', request.audio_url);
      } else {
        console.warn('⚠️ No audio URL found - video will be composed without audio');
      }

      await composeVideo(request);
      // Don't set phase to 'complete' here - wait for jobStatus to update
      
    } catch (error) {
      console.error('❌ Composition process failed:', error);
      setCurrentPhase('idle');
    }
  };

  const isComplete = jobStatus?.status === 'completed';
  const isFailed = jobStatus?.status === 'failed';
  const error = compositionError;

  // Update phase based on actual job status
  useEffect(() => {
    if (isComplete) {
      setCurrentPhase('complete');
    } else if (isComposing || (jobStatus && !isComplete && !isFailed)) {
      setCurrentPhase('composition');
    }
  }, [isComplete, isComposing, jobStatus, isFailed]);

  // Update phase progress based on composition progress
  useEffect(() => {
    if (currentPhase === 'composition' && jobStatus?.progress_percent) {
      setPhaseProgress((prev) => ({ ...prev, composition: jobStatus.progress_percent }));
    }
  }, [jobStatus?.progress_percent, currentPhase]);

  // Auto-start composition when component mounts (if not already started)
  useEffect(() => {
    const hasCompletedVideos = scenes.some(scene => 
      scene.state === 'video' && 
      scene.video_url && 
      scene.generation_status.video === 'complete'
    );
    
    if (!hasStarted && !finalVideo && hasCompletedVideos) {
      handleStartComposition();
    }
  }, []);

  const handleDownload = () => {
    if (jobStatus?.video_url) {
      // Download URL is relative to API
      const downloadUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${jobStatus.video_url}`;
      window.open(downloadUrl, '_blank');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Step 5: Final Video Composition</h2>
          <p className="text-muted-foreground mt-1">
            Composing your final video with music and transitions
          </p>
        </div>
        <Button variant="ghost" onClick={onBack}>
          ← Back to Video Generation
        </Button>
      </div>

      {/* Not Started */}
      {!hasStarted && !isComposing && !jobStatus && (
        <div className="bg-white dark:bg-zinc-900 border rounded-lg p-8 text-center space-y-4">
          <div className="text-4xl">🎥</div>
          <h3 className="text-xl font-semibold">Ready to Compose Final Video</h3>
          <p className="text-muted-foreground">
            We'll stitch together {scenes.filter(s => s.state === 'video' && s.video_url && s.generation_status.video === 'complete').length} scenes
            with crossfade transitions and background music.
          </p>
          <Button onClick={handleStartComposition} size="lg">
            Start Final Composition
          </Button>
        </div>
      )}

      {/* In Progress */}
      {(hasStarted || isComposing || (jobStatus && !isComplete && !isFailed)) && (
        <div className="bg-white dark:bg-zinc-900 border rounded-lg p-8 space-y-6">
          <div className="text-center space-y-6">
            {/* Phase Indicator */}
            <div className="flex justify-center">
              {currentPhase === 'composition' && (
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
              )}
              {currentPhase === 'complete' && (
                <div className="text-4xl">✅</div>
              )}
            </div>

            {/* Phase Description */}
            <h3 className="text-xl font-semibold">
              {currentPhase === 'composition' && (jobStatus?.current_step || 'Composing Video...')}
              {currentPhase === 'complete' && 'Processing Complete!'}
            </h3>

            {/* Progress */}
            <div className="space-y-4 max-w-md mx-auto">
              {/* Composition Phase */}
              {(currentPhase === 'composition' || phaseProgress.composition > 0) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Video Composition</span>
                    <span className="font-medium">
                      {phaseProgress.composition === 100 ? '✓' : `${phaseProgress.composition}%`}
                    </span>
                  </div>
                  <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ease-out ${
                        phaseProgress.composition === 100 ? 'bg-green-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${phaseProgress.composition}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Additional Details */}
            {jobStatus && currentPhase === 'composition' && (
              <div className="text-xs text-muted-foreground space-y-1 pt-2">
                <p>Total clips: {jobStatus.total_clips}</p>
                {jobStatus.file_size_mb && (
                  <p>Current size: {jobStatus.file_size_mb.toFixed(2)} MB</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Completed */}
      {isComplete && finalVideo && (
        <div className="bg-white dark:bg-zinc-900 border rounded-lg p-8 space-y-6">
          <div className="space-y-6">
            {/* Success Header */}
            <div className="text-center space-y-4">
              <div className="text-6xl">🎉</div>
              <h3 className="text-2xl font-bold">Your Video is Ready!</h3>
              <p className="text-muted-foreground">
                Your 30-second video has been successfully created
              </p>
            </div>

            {/* Video Preview Player */}
            {jobStatus?.video_url && (
              <div className="max-w-4xl mx-auto space-y-3">
                <h4 className="text-lg font-semibold text-center">Preview</h4>
                <div className="relative bg-black rounded-lg overflow-hidden shadow-xl aspect-video">
                  <video
                    controls
                    autoPlay
                    loop
                    playsInline
                    className="w-full h-full object-contain"
                    src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${jobStatus.video_url}`}
                  >
                    Your browser does not support video playback.
                  </video>
                </div>
              </div>
            )}

            {/* Video Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto pt-4">
              {jobStatus?.duration_seconds && (
                <div className="text-center p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                  <div className="text-2xl font-bold">{jobStatus.duration_seconds.toFixed(1)}s</div>
                  <div className="text-xs text-muted-foreground">Duration</div>
                </div>
              )}
              {jobStatus?.file_size_mb && (
                <div className="text-center p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                  <div className="text-2xl font-bold">{jobStatus.file_size_mb.toFixed(1)} MB</div>
                  <div className="text-xs text-muted-foreground">File Size</div>
                </div>
              )}
              <div className="text-center p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                <div className="text-2xl font-bold">{scenes.filter(s => s.state === 'video' && s.video_url).length}</div>
                <div className="text-xs text-muted-foreground">Scenes</div>
              </div>
              <div className="text-center p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                <div className="text-2xl font-bold">16:9</div>
                <div className="text-xs text-muted-foreground">Aspect Ratio</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-4">
              <Button onClick={handleDownload} size="lg" className="gap-2">
                <span>📥</span>
                Download Video
              </Button>
              <Button variant="outline" size="lg" onClick={() => window.location.reload()}>
                Create Another Video
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <h4 className="font-semibold text-red-900 dark:text-red-100 mb-1">
                Composition Failed
              </h4>
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                clearCompositionError();
              }}
            >
              Dismiss
            </Button>
            <Button size="sm" onClick={handleStartComposition}>
              Retry
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
