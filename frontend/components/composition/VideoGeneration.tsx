'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import { useVideoGeneration } from '@/hooks/useVideoGeneration';
import { useAudioGeneration } from '@/hooks/useAudioGeneration';
import { VideoGenerationProgress } from '@/components/video';
import { Button } from '@/components/ui/button';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { VideoGenerationError, ERROR_CODES } from '@/lib/errors';
import type { VideoGenerationRequest } from '@/types/video.types';
import type { AudioGenerationRequest } from '@/types/audio.types';

interface VideoGenerationProps {
  onComplete: () => void;
  onBack: () => void;
}

export function VideoGeneration({ onComplete, onBack }: VideoGenerationProps) {
  const {
    scenePlan,
    moods,
    selectedMoodId,
    creativeBrief,
    generatedClips,
    audioUrl,
    setGeneratedClips,
    setVideoJobId,
  } = useAppStore();

  const {
    jobStatus: videoStatus,
    isGenerating,
    error: videoError,
    startGeneration,
    retryFailedClips,
    clearError: clearVideoError,
    failedClips,
  } = useVideoGeneration();
  
  // Debug: Log whenever videoStatus changes
  useEffect(() => {
    console.log('🔄 VideoGeneration component - videoStatus changed:', {
      exists: !!videoStatus,
      progress: videoStatus?.progress_percent,
      clipsCount: videoStatus?.clips?.length,
      fullObject: videoStatus
    });
  }, [videoStatus]);

  const {
    generateAudio,
    isLoading: isAudioLoading,
    error: audioError,
    clearError: clearAudioError,
  } = useAudioGeneration();

  const [hasStarted, setHasStarted] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);

  const selectedMood = moods.find((m) => m.id === selectedMoodId);

  // Debug: Log what's in the store
  useEffect(() => {
    console.log('🔍 Checking for existing clips:', {
      generatedClips,
      length: generatedClips?.length,
      hasClips: generatedClips && generatedClips.length > 0
    });
  }, []);

  // Check if we have existing clips (from previous session or page refresh)
  useEffect(() => {
    if (generatedClips && generatedClips.length > 0) {
      console.log('✅ Found existing clips, setting hasStarted to true');
      setHasStarted(true);
    }
  }, [generatedClips]);

  // Sync video clips from job status to store
  useEffect(() => {
    console.log('📊 VideoGeneration - Job Status Update:', {
      hasVideoStatus: !!videoStatus,
      status: videoStatus?.status,
      progress: videoStatus?.progress_percent,
      clipsLength: videoStatus?.clips?.length,
      clipsProgress: videoStatus?.clips?.map(c => `Scene ${c.scene_number}: ${c.progress_percent}%`)
    });

    if (videoStatus?.clips && videoStatus.clips.length > 0) {
      console.log('💾 Saving clips to store:', videoStatus.clips.map(c => ({
        scene: c.scene_number,
        progress: c.progress_percent,
        status: c.status
      })));
      setGeneratedClips(videoStatus.clips);
      
      console.log('✅ Clips saved to store');
    }
  }, [videoStatus, setGeneratedClips]);

  // Auto-generate audio when component mounts (if not already generated)
  useEffect(() => {
    if (!audioUrl && selectedMood && creativeBrief && !isAudioLoading && !isGeneratingAudio) {
      setIsGeneratingAudio(true);
      handleGenerateAudio();
    }
  }, []);

  const handleGenerateAudio = async () => {
    if (!selectedMood || !creativeBrief) return;

    const audioRequest: AudioGenerationRequest = {
      mood_name: selectedMood.name,
      mood_description: selectedMood.description,
      emotional_tone: creativeBrief.emotional_tone,
      aesthetic_direction: selectedMood.aesthetic_direction,
      style_keywords: selectedMood.style_keywords,
      duration: 30,
    };

    await generateAudio(audioRequest);
    setIsGeneratingAudio(false);
  };

  const handleStartGeneration = async () => {
    console.log('🎬 Starting video generation...');
    console.log('📋 Scene Plan:', scenePlan);
    console.log('🎨 Selected Mood:', selectedMood);

    // Validation 1: Check required data
    if (!scenePlan || !selectedMood) {
      console.error('❌ Missing requirements:', {
        scenePlan: !!scenePlan,
        selectedMood: !!selectedMood
      });
      alert('Missing scene plan or mood selection. Please go back and complete previous steps.');
      return;
    }

    // Validation 2: Check scenes exist
    if (!scenePlan.scenes || scenePlan.scenes.length === 0) {
      console.error('❌ No scenes in scene plan');
      alert('No scenes found in scene plan. Please go back to Step 3.');
      return;
    }

    // Validation 3: Filter and validate scenes with seed images
    const scenesWithImages = scenePlan.scenes.filter((s) => {
      const hasUrl = !!s.seed_image_url;
      const isValidUrl = hasUrl && s.seed_image_url!.trim().length > 0;
      return isValidUrl;
    });

    console.log('📸 Scene validation:', {
      totalScenes: scenePlan.scenes.length,
      scenesWithImages: scenesWithImages.length,
      sceneDetails: scenePlan.scenes.map(s => ({
        number: s.scene_number,
        hasImage: !!s.seed_image_url,
        url: s.seed_image_url?.substring(0, 50) + '...',
        urlLength: s.seed_image_url?.length || 0
      }))
    });

    if (scenesWithImages.length === 0) {
      const scenesWithoutImages = scenePlan.scenes
        .filter(s => !s.seed_image_url)
        .map(s => s.scene_number)
        .join(', ');
      
      console.error('❌ No valid seed images found');
      alert(
        `No scenes with valid seed images found.\n\n` +
        `Scenes missing images: ${scenesWithoutImages}\n\n` +
        `Please go back to Step 3 and regenerate the scene plan.`
      );
      return;
    }

    // Validation 4: Warn if some scenes are missing images
    if (scenesWithImages.length < scenePlan.scenes.length) {
      const missingCount = scenePlan.scenes.length - scenesWithImages.length;
      const scenesWithoutImages = scenePlan.scenes
        .filter(s => !s.seed_image_url)
        .map(s => s.scene_number)
        .join(', ');
      
      console.warn(`⚠️ ${missingCount} scene(s) missing images: ${scenesWithoutImages}`);
      
      const proceed = confirm(
        `Warning: ${missingCount} scene(s) are missing seed images (scenes: ${scenesWithoutImages}).\n\n` +
        `Only ${scenesWithImages.length} scene(s) will be generated.\n\n` +
        `Continue anyway?`
      );
      
      if (!proceed) return;
    }

    // Validation 5: Test if URLs are accessible (sample check)
    const firstImageUrl = scenesWithImages[0].seed_image_url!;
    console.log('🔗 Testing first seed image URL:', firstImageUrl);
    
    try {
      // Quick check if URL format is valid
      new URL(firstImageUrl);
      console.log('✅ URL format is valid');
    } catch (e) {
      console.error('❌ Invalid URL format:', e);
      alert(
        `Seed image URL appears to be invalid:\n\n${firstImageUrl}\n\n` +
        `Please go back to Step 3 and regenerate scenes.`
      );
      return;
    }

    // Build request with validated scenes
    const request: VideoGenerationRequest = {
      scenes: scenesWithImages.map((scene) => ({
        scene_number: scene.scene_number,
        duration: scene.duration,
        description: scene.description,
        style_prompt: scene.style_prompt,
        seed_image_url: scene.seed_image_url!,
      })),
      mood_style_keywords: selectedMood.style_keywords,
      mood_aesthetic_direction: selectedMood.aesthetic_direction,
    };

    console.log('📤 Sending validated request:', {
      sceneCount: request.scenes.length,
      scenes: request.scenes.map(s => ({
        scene: s.scene_number,
        imageUrl: s.seed_image_url.substring(0, 50) + '...'
      })),
      moodKeywords: request.mood_style_keywords
    });

    setHasStarted(true);
    const jobId = await startGeneration(request);

    if (jobId) {
      setVideoJobId(jobId);
      console.log('✅ Video generation started successfully. Job ID:', jobId);
    } else {
      console.error('❌ No job ID returned - generation may have failed');
      setHasStarted(false);
    }
  };

  const isComplete = videoStatus?.status === 'completed' ||
    (generatedClips.length > 0 && generatedClips.every(c => c.status === 'completed'));
  const hasFailed = videoStatus?.status === 'failed';
  const hasExistingClips = generatedClips && generatedClips.length > 0;

  // Debug button state
  useEffect(() => {
    console.log('🔘 Button state:', {
      hasStarted,
      isGenerating,
      hasExistingClips,
      audioUrl: !!audioUrl,
      isAudioLoading,
      buttonShouldBeVisible: !hasStarted && !isGenerating && !hasExistingClips,
      buttonShouldBeEnabled: !!audioUrl && !isAudioLoading
    });
  }, [hasStarted, isGenerating, hasExistingClips, audioUrl, isAudioLoading]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Step 4: Generate Video Clips</h2>
          <p className="text-muted-foreground mt-1">
            Generate video clips from your storyboard scenes
          </p>
        </div>
        <Button variant="ghost" onClick={onBack}>
          ← Back to Storyboard
        </Button>
      </div>

      {/* Audio Generation Status */}
      {isAudioLoading && (
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            🎵 Generating background music...
          </p>
        </div>
      )}

      {audioUrl && !isAudioLoading && (
        <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-green-600 dark:text-green-400">✓</span>
            <p className="text-sm font-semibold text-green-900 dark:text-green-100">
              Background music ready!
            </p>
          </div>

          {/* Audio Player */}
          <div className="bg-white dark:bg-zinc-900 rounded-md p-3 border border-green-200 dark:border-green-700">
            <div className="flex items-center gap-3">
              <span className="text-xl">🎵</span>
              <div className="flex-1">
                <audio
                  controls
                  src={audioUrl}
                  className="w-full"
                  preload="metadata"
                  style={{
                    height: '32px',
                    accentColor: '#22c55e',
                  }}
                >
                  Your browser does not support the audio element.
                </audio>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Preview your 30-second background music
            </p>
          </div>
        </div>
      )}

      {audioError && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-900 dark:text-red-100">{audioError}</p>
        </div>
      )}

      {/* Video Generation Status */}
      {!hasStarted && !isGenerating && (
        <div className="bg-white dark:bg-zinc-900 border rounded-lg p-8 space-y-6">
          <div className="text-center space-y-4">
            <div className="text-4xl">🎬</div>
            <h3 className="text-xl font-semibold">
              {hasExistingClips ? 'Regenerate Video Clips' : 'Ready to Generate Video Clips'}
            </h3>
            <p className="text-muted-foreground">
              {hasExistingClips ? (
                <>
                  You have {generatedClips.length} existing clip{generatedClips.length > 1 ? 's' : ''}.
                  <br />
                  Click below to regenerate all {scenePlan?.scenes.filter(s => s.seed_image_url).length || 0} video clips.
                </>
              ) : (
                <>
                  We'll generate {scenePlan?.scenes.filter(s => s.seed_image_url).length || 0} video clips from your storyboard.
                  <br />
                  This may take several minutes.
                </>
              )}
            </p>
          </div>

          {/* Scene Validation Display */}
          {scenePlan && scenePlan.scenes && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Scene Status:</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                {scenePlan.scenes.map((scene) => (
                  <div
                    key={scene.scene_number}
                    className={`flex items-center gap-2 px-3 py-2 rounded ${
                      scene.seed_image_url
                        ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300'
                        : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300'
                    }`}
                  >
                    <span>{scene.seed_image_url ? '✓' : '✗'}</span>
                    <span>Scene {scene.scene_number}</span>
                    {!scene.seed_image_url && (
                      <span className="text-xs">(no image)</span>
                    )}
                  </div>
                ))}
              </div>
              {scenePlan.scenes.some(s => !s.seed_image_url) && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-3">
                  ⚠️ Some scenes are missing seed images. Only scenes with images will be generated.
                </p>
              )}
            </div>
          )}

          <div className="text-center">
            <Button
              onClick={handleStartGeneration}
              size="lg"
              disabled={!audioUrl || isAudioLoading}
            >
              {hasExistingClips ? 'Regenerate Video Clips' : 'Start Video Generation'}
            </Button>
          </div>
        </div>
      )}

      {/* Progress Display */}
      {(hasStarted || isGenerating || isComplete || hasExistingClips) && (
        <>
          {/* Debug info */}
          {videoStatus && (
            <div className="text-xs bg-yellow-50 dark:bg-yellow-950 p-2 rounded font-mono">
              Debug: Overall {videoStatus.progress_percent}% | Clips: {videoStatus.clips.map(c => `${c.scene_number}:${c.progress_percent}%`).join(', ')}
            </div>
          )}
          <VideoGenerationProgress
            jobStatus={videoStatus}
            scenes={scenePlan?.scenes}
          />
        </>
      )}

      {/* Show clips even without job status (for resumed sessions) */}
      {hasExistingClips && !videoStatus && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Generated Video Clips</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {generatedClips.map((clip) => (
              <div key={clip.scene_number} className="bg-white dark:bg-zinc-900 border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 font-bold text-sm text-green-600 dark:text-green-400">
                      {clip.scene_number}
                    </div>
                    <span className="font-medium text-sm text-green-600 dark:text-green-400">Complete</span>
                  </div>
                  <div className="text-xs font-medium opacity-75">
                    {clip.duration.toFixed(1)}s
                  </div>
                </div>
                {clip.video_url && (
                  <div className="space-y-2">
                    <div className="rounded-lg overflow-hidden bg-black border-2 border-green-200 dark:border-green-800">
                      <video
                        controls
                        preload="metadata"
                        className="w-full aspect-[9/16] object-contain"
                        style={{ maxHeight: '300px' }}
                      >
                        <source src={clip.video_url} type="video/mp4" />
                        Your browser does not support the video element.
                      </video>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Display with Retry */}
      {videoError && (
        <ErrorAlert
          error={
            new VideoGenerationError(
              videoError,
              failedClips.length > 0 ? ERROR_CODES.VIDEO_GENERATION_PARTIAL : ERROR_CODES.VIDEO_GENERATION_FAILED,
              true,
              failedClips
            )
          }
          onRetry={async () => {
            if (failedClips.length > 0 && videoStatus?.job_id) {
              // Retry only failed clips
              const success = await retryFailedClips(videoStatus.job_id);
              if (success) {
                clearVideoError();
              }
            } else {
              // Retry entire generation
              clearVideoError();
              handleStartGeneration();
            }
          }}
          onDismiss={clearVideoError}
        />
      )}

      {/* Continue Button */}
      {(isComplete || hasExistingClips) && generatedClips.length > 0 && (
        <div className="flex justify-center">
          <Button onClick={onComplete} size="lg">
            Continue to Final Composition →
          </Button>
        </div>
      )}
    </div>
  );
}
