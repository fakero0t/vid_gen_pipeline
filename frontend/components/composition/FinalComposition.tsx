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
      {/* Description text - centered (only show when not complete) */}
      {!(isComplete && finalVideo) && (
        <div className="text-center mb-3 flex-shrink-0 animate-fadeIn">
          <p className="text-[10px] sm:text-xs text-muted-foreground">
            Composing your final video with music and transitions
          </p>
      </div>
      )}

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

      {/* In Progress - Loading Animation */}
      {(hasStarted || isComposing || (jobStatus && !isComplete && !isFailed)) && !(isComplete && finalVideo && jobStatus?.video_url) && (
        <div className="min-h-[400px] flex items-center justify-center relative">
          <LoadingPhrases />
        </div>
      )}

      {/* Completed */}
      {isComplete && finalVideo && (
        <div className="flex flex-col items-center justify-center space-y-6">
            {/* Video Preview Player */}
            {jobStatus?.video_url && (
            <div className="w-full max-w-4xl mx-auto">
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
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
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <button
              onClick={handleDownload}
              className="text-xs px-4 py-2 rounded-full bg-[rgb(255,81,1)] text-[rgb(196,230,43)] hover:bg-[rgb(255,100,20)] font-bold shadow-md hover:shadow-lg transition-all duration-300 flex items-center gap-2"
            >
                <span>📥</span>
                Download Video
            </button>
            <button
              onClick={() => router.push('/projects')}
              className="text-xs px-4 py-2 rounded-full border-2 border-[rgb(255,81,1)] text-[rgb(255,81,1)] hover:bg-[rgb(255,81,1)]/10 transition-all duration-300 font-display font-bold"
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
