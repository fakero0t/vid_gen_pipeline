'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import { useStoryboardStore } from '@/store/storyboardStore';
import { useVideoComposition } from '@/hooks/useVideoComposition';
import { useAudioGeneration } from '@/hooks/useAudioGeneration';
import { Button } from '@/components/ui/button';
import type { CompositionRequest, VideoClipInput } from '@/types/composition.types';
import type { AudioGenerationRequest } from '@/types/audio.types';

interface FinalCompositionProps {
  onBack: () => void;
}

type ProcessingPhase = 'idle' | 'audio' | 'composition' | 'complete';

export function FinalComposition({ onBack }: FinalCompositionProps) {
  const {
    audioUrl,
    finalVideo,
    compositionProgress,
    creativeBrief,
    selectedMoodId,
    moods,
  } = useAppStore();
  
  // Get storyboard scenes with videos
  const { storyboard, scenes } = useStoryboardStore();

  const {
    composeVideo,
    jobStatus,
    isLoading: isComposing,
    error: compositionError,
    clearError: clearCompositionError,
  } = useVideoComposition();

  const {
    generateAudio,
    isLoading: isGeneratingAudio,
    error: audioError,
    clearError: clearAudioError,
  } = useAudioGeneration();

  const [hasStarted, setHasStarted] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<ProcessingPhase>('idle');
  const [phaseProgress, setPhaseProgress] = useState({
    audio: 0,
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
      // Phase 1: Generate Audio (if not already generated)
      let finalAudioUrl = audioUrl;
      
      if (!audioUrl && creativeBrief && selectedMoodId && moods.length > 0) {
        console.log('🎵 Starting audio generation...');
        setCurrentPhase('audio');
        setPhaseProgress({ audio: 0, composition: 0 });

        const selectedMood = moods.find((m) => m.id === selectedMoodId);
        
        if (selectedMood) {
          // Simulate progress for audio generation
          const audioProgressInterval = setInterval(() => {
            setPhaseProgress((prev) => ({
              ...prev,
              audio: Math.min(prev.audio + 10, 90),
            }));
          }, 500);

          const audioRequest: AudioGenerationRequest = {
            mood_name: selectedMood.name,
            mood_description: selectedMood.aesthetic_direction || '',
            emotional_tone: creativeBrief.emotional_tone || [],
            aesthetic_direction: selectedMood.aesthetic_direction || '',
            style_keywords: selectedMood.style_keywords || [],
            duration: 30,
          };

          finalAudioUrl = await generateAudio(audioRequest);
          clearInterval(audioProgressInterval);
          setPhaseProgress((prev) => ({ ...prev, audio: 100 }));
          
          if (!finalAudioUrl) {
            console.warn('⚠️ Audio generation failed, continuing without audio');
          } else {
            console.log('✅ Audio generation complete');
          }
        }
      }

      // Phase 2: Compose Video
      console.log('🎬 Starting video composition...');
      setCurrentPhase('composition');

      const request: CompositionRequest = {
        clips: clips,  // Use the clips we prepared from storyboard scenes
        audio_url: finalAudioUrl || undefined,
        include_crossfade: true,
        optimize_size: true,
        target_size_mb: 50,
      };

      console.log(`🎬 Composing ${request.clips.length} clips${request.audio_url ? ' with audio' : ''}`);

      await composeVideo(request);
      setCurrentPhase('complete');
      
    } catch (error) {
      console.error('❌ Composition process failed:', error);
      setCurrentPhase('idle');
    }
  };

  const isComplete = jobStatus?.status === 'completed';
  const isFailed = jobStatus?.status === 'failed';
  const error = compositionError || audioError;

  // Update phase progress based on composition progress
  useEffect(() => {
    if (currentPhase === 'composition' && compositionProgress > 0) {
      setPhaseProgress((prev) => ({ ...prev, composition: compositionProgress }));
    }
  }, [compositionProgress, currentPhase]);

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
      {!hasStarted && !isComposing && !isGeneratingAudio && !jobStatus && (
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
      {(hasStarted || isGeneratingAudio || isComposing || (jobStatus && !isComplete && !isFailed)) && (
        <div className="bg-white dark:bg-zinc-900 border rounded-lg p-8 space-y-6">
          <div className="text-center space-y-6">
            {/* Phase Indicator */}
            <div className="text-4xl animate-pulse">
              {currentPhase === 'audio' && '🎵'}
              {currentPhase === 'composition' && '🎬'}
              {currentPhase === 'complete' && '✅'}
            </div>

            {/* Phase Description */}
            <h3 className="text-xl font-semibold">
              {currentPhase === 'audio' && 'Generating Background Music...'}
              {currentPhase === 'composition' && (jobStatus?.current_step || 'Composing Video...')}
              {currentPhase === 'complete' && 'Processing Complete!'}
            </h3>

            {/* Multi-Phase Progress */}
            <div className="space-y-4 max-w-md mx-auto">
              {/* Audio Phase */}
              {(currentPhase === 'audio' || phaseProgress.audio > 0) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Audio Generation</span>
                    <span className="font-medium">
                      {phaseProgress.audio === 100 ? '✓' : `${phaseProgress.audio}%`}
                    </span>
                  </div>
                  <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ease-out ${
                        phaseProgress.audio === 100 ? 'bg-green-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${phaseProgress.audio}%` }}
                    />
                  </div>
                </div>
              )}

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
              <div className="max-w-md mx-auto space-y-3">
                <h4 className="text-lg font-semibold text-center">Preview</h4>
                <div className="relative bg-black rounded-lg overflow-hidden shadow-xl aspect-[9/16]">
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
                <div className="text-2xl font-bold">9:16</div>
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
                {currentPhase === 'audio' ? 'Audio Generation Failed' : 'Composition Failed'}
              </h4>
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              {currentPhase === 'audio' && (
                <p className="text-xs text-red-700 dark:text-red-300 mt-2">
                  Don't worry! You can continue without audio or retry audio generation.
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                clearAudioError();
                clearCompositionError();
              }}
            >
              Dismiss
            </Button>
            <Button size="sm" onClick={handleStartComposition}>
              Retry
            </Button>
            {currentPhase === 'audio' && (
              <Button 
                size="sm" 
                variant="secondary"
                onClick={async () => {
                  clearAudioError();
                  setCurrentPhase('composition');
                  // Continue without audio
                  const videoScenes = scenes.filter(scene => 
                    scene.state === 'video' && 
                    scene.video_url && 
                    scene.generation_status.video === 'complete'
                  );
                  
                  const request: CompositionRequest = {
                    clips: videoScenes.map((scene, index) => ({
                        scene_number: index + 1,
                        video_url: scene.video_url!,
                        duration: scene.video_duration,
                      })),
                    include_crossfade: true,
                    optimize_size: true,
                    target_size_mb: 50,
                  };
                  await composeVideo(request);
                }}
              >
                Continue Without Audio
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
