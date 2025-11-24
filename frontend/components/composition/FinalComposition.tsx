'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/appStore';
import { useSceneStore } from '@/store/sceneStore';
import { useVideoComposition } from '@/hooks/useVideoComposition';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { CompositionRequest, VideoClipInput } from '@/types/composition.types';

interface FinalCompositionProps {
  onBack?: () => void;
}

type ProcessingPhase = 'idle' | 'composition' | 'complete';

// Video composition-specific loading phrases that rotate
const LOADING_PHRASES = [
  "Composing video with transitions... 🎬",
  "Stitching scenes together... 🧵",
  "Adding smooth crossfades... ✨",
  "Syncing with background music... 🎵",
  "Optimizing video quality... 🎞️",
  "Almost ready with your final video... 🚀",
  "Polishing the final composition... 💎",
  "Creating seamless transitions... 🌊",
  "Almost there, promise! ⏳"
];

function LoadingPhrases() {
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Rotate phrases every 2.5 seconds
    intervalRef.current = setInterval(() => {
      setIsVisible(false);
      
      // After fade out, change phrase and fade in
      setTimeout(() => {
        setCurrentPhraseIndex((prev) => (prev + 1) % LOADING_PHRASES.length);
        setIsVisible(true);
      }, 400); // Match fadeOutDown animation duration
    }, 2500);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return (
    <div className="flex-shrink-0 w-full h-full flex items-center justify-center">
      <div className="text-center px-4">
        <div 
          className={`
            text-sm sm:text-base font-display font-bold
            bg-gradient-to-r from-primary via-primary/80 to-primary
            bg-clip-text text-transparent
            ${isVisible ? 'animate-fadeInUp' : 'animate-fadeOutDown'}
          `}
        >
          {LOADING_PHRASES[currentPhraseIndex]}
        </div>
        <div className="mt-6 flex justify-center gap-2">
          {LOADING_PHRASES.map((_, index) => (
            <div
              key={index}
              className={`
                w-2 h-2 rounded-full transition-all duration-300
                ${index === currentPhraseIndex 
                  ? 'bg-primary scale-125 animate-gentleBounce' 
                  : 'bg-muted-foreground/30'
                }
              `}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function FinalComposition({ onBack }: FinalCompositionProps) {
  const router = useRouter();
  const {
    audioUrl,
    finalVideo,
    renderedVideoUrl,
    renderedVideoDuration,
    creativeBrief,
    selectedMoodId,
    moods,
    setFinalVideo,
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
    // If rendered video exists, use it (with or without audio)
    if (renderedVideoUrl) {
      console.log('📹 Using rendered video:', renderedVideoUrl);
      setHasStarted(true);
      setCurrentPhase('composition');

      // If audio exists, compose rendered video with audio
      if (audioUrl) {
        console.log('🎵 Adding audio to rendered video...');
        try {
          // Use rendered video as a single clip with audio
          const request: CompositionRequest = {
            clips: [{
              scene_number: 1,
              video_url: renderedVideoUrl,
              duration: renderedVideoDuration || 0,
            }],
            audio_url: audioUrl,
            include_crossfade: false,
            optimize_size: true,
            target_size_mb: 50,
          };

          await composeVideo(request);
        } catch (error) {
          console.error('❌ Failed to add audio to rendered video:', error);
          // Fall back to showing rendered video without audio
          setFinalVideo({
            video_url: renderedVideoUrl,
            duration_seconds: renderedVideoDuration || 0,
            file_size_mb: null,
          });
          setCurrentPhase('complete');
        }
      } else {
        // No audio, use rendered video as-is
        console.log('📹 Using rendered video without audio');
        setFinalVideo({
          video_url: renderedVideoUrl,
          duration_seconds: renderedVideoDuration || 0,
          file_size_mb: null,
        });
        setCurrentPhase('complete');
      }
      return;
    }

    // Fall back to original behavior: compose from clips
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
      duration: scene.trim_end_time && scene.trim_start_time
        ? scene.trim_end_time - scene.trim_start_time
        : scene.video_duration,
      trim_start_time: scene.trim_start_time ?? undefined,
      trim_end_time: scene.trim_end_time ?? undefined,
    }));

    console.log(`📹 Preparing ${clips.length} video clips for composition`);
    setHasStarted(true);

    try {
      console.log('🎬 Starting video composition...');
      console.log('🎵 Audio URL from store:', audioUrl);
      setCurrentPhase('composition');

      const request: CompositionRequest = {
        clips: clips,
        audio_url: audioUrl || undefined,
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
    // If rendered video exists, use it
    if (renderedVideoUrl && !hasStarted && !finalVideo) {
      handleStartComposition();
      return;
    }

    // Otherwise, check for completed scenes
    const hasCompletedVideos = scenes.some(scene => 
      scene.state === 'video' && 
      scene.video_url && 
      scene.generation_status.video === 'complete'
    );
    
    if (!hasStarted && !finalVideo && hasCompletedVideos) {
      handleStartComposition();
    }
  }, [renderedVideoUrl]);

  const handleDownload = () => {
    const videoUrl = jobStatus?.video_url || finalVideo?.video_url || renderedVideoUrl;
    if (videoUrl) {
      // Download URL is relative to API
      const downloadUrl = videoUrl.startsWith('http') 
        ? videoUrl 
        : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${videoUrl}`;
      window.open(downloadUrl, '_blank');
    }
  };

  // Get video URL for display
  const getVideoUrl = () => {
    if (jobStatus?.video_url) {
      const url = jobStatus.video_url;
      return url.startsWith('http') ? url : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${url}`;
    }
    if (finalVideo?.video_url) {
      const url = finalVideo.video_url;
      return url.startsWith('http') ? url : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${url}`;
    }
    if (renderedVideoUrl) {
      const url = renderedVideoUrl;
      return url.startsWith('http') ? url : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${url}`;
    }
    return null;
  };

  return (
    <div className="space-y-6">

      {/* In Progress - Loading Animation */}
      {(hasStarted || isComposing || (jobStatus && !isComplete && !isFailed)) && !(isComplete && finalVideo && jobStatus?.video_url) && (
        <div className="flex items-center justify-center min-h-[70vh] w-full">
          <LoadingPhrases />
        </div>
      )}

      {/* Completed or Rendered Video Ready */}
      {((isComplete && finalVideo) || (renderedVideoUrl && !isComposing)) && (
        <div className="w-full h-full flex flex-col items-center justify-center space-y-4 sm:space-y-6 min-h-0">
            {/* Video Preview Player - takes up most of the space */}
            {getVideoUrl() && (
            <div className="w-full flex-1 min-h-0 flex items-center justify-center px-2 sm:px-4">
                <div className="relative bg-black rounded-lg overflow-hidden shadow-xl w-full h-full max-h-[70vh] aspect-video">
                  <video
                    controls
                    autoPlay
                    loop
                    playsInline
                    className="w-full h-full object-contain"
                    src={getVideoUrl() || ''}
                  >
                    Your browser does not support video playback.
                  </video>
                </div>
              </div>
            )}

            {/* Video Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 w-full max-w-4xl mx-auto px-4 flex-shrink-0">
              {(jobStatus?.duration_seconds || renderedVideoDuration || finalVideo?.duration_seconds) && (
                <div className="text-center p-3 sm:p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                  <div className="text-xl sm:text-2xl font-bold">{(jobStatus?.duration_seconds || renderedVideoDuration || finalVideo?.duration_seconds || 0).toFixed(1)}s</div>
                  <div className="text-xs text-muted-foreground mt-1">Duration</div>
                </div>
              )}
              {(jobStatus?.file_size_mb || finalVideo?.file_size_mb) && (
                <div className="text-center p-3 sm:p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                  <div className="text-xl sm:text-2xl font-bold">{(jobStatus?.file_size_mb || finalVideo?.file_size_mb || 0).toFixed(1)} MB</div>
                  <div className="text-xs text-muted-foreground mt-1">File Size</div>
                </div>
              )}
              <div className="text-center p-3 sm:p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                <div className="text-xl sm:text-2xl font-bold">{scenes.filter(s => s.state === 'video' && s.video_url).length}</div>
                <div className="text-xs text-muted-foreground mt-1">Scenes</div>
              </div>
              <div className="text-center p-3 sm:p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                <div className="text-xl sm:text-2xl font-bold">16:9</div>
                <div className="text-xs text-muted-foreground mt-1">Aspect Ratio</div>
              </div>
            </div>

            {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-center gap-3 flex-shrink-0 pb-2 sm:pb-4">
            <button
              onClick={handleDownload}
              className="text-sm sm:text-base px-6 sm:px-8 py-2.5 sm:py-3 rounded-full bg-[rgb(255,81,1)] text-[rgb(196,230,43)] hover:bg-[rgb(255,100,20)] font-bold shadow-md hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2"
            >
                <span>📥</span>
                Download Video
            </button>
            <button
              onClick={() => router.push('/projects')}
              className="text-sm sm:text-base px-6 sm:px-8 py-2.5 sm:py-3 rounded-full border-2 border-[rgb(255,81,1)] text-[rgb(255,81,1)] hover:bg-[rgb(255,81,1)]/10 transition-all duration-300 font-display font-bold"
            >
                Create Another Video
            </button>
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
                Video Composition Failed
              </h4>
              <p className="text-sm text-red-800 dark:text-red-200">
                {error.includes('composition') || error.includes('video') 
                  ? error 
                  : `Failed to compose final video: ${error}`}
              </p>
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
              Retry Composition
            </Button>
          </div>
        </div>
      )}
      
      {/* Failed Status Error */}
      {isFailed && !error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <h4 className="font-semibold text-red-900 dark:text-red-100 mb-1">
                Video Composition Failed
              </h4>
              <p className="text-sm text-red-800 dark:text-red-200">
                The video composition process encountered an error. Please try again.
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button size="sm" onClick={handleStartComposition}>
              Retry Composition
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
