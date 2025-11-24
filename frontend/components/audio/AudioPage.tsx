'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAppStore } from '@/store/appStore';
import { useAudioGeneration } from '@/hooks/useAudioGeneration';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { STEPS } from '@/lib/steps';
import { buildMusicPrompt } from '@/lib/audioPromptBuilder';
import type { AudioGenerationRequest } from '@/types/audio.types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Video rendering-specific loading phrases that rotate
const LOADING_PHRASES = [
  "Rendering your video masterpiece... 🎬",
  "Combining all your scenes... 🧵",
  "Adding smooth transitions... ✨",
  "Polishing every frame... 💎",
  "Creating seamless flow... 🌊",
  "Almost ready with your video... 🚀",
  "Stitching scenes together... 🎞️",
  "Optimizing video quality... ⚡",
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

export function AudioPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const { addToast } = useToast();
  const { setCurrentStep, setAudioUrl } = useAppStore();

  const {
    renderedVideoUrl,
    renderedVideoDuration,
    isRenderingVideo,
    creativeBrief,
    moods,
    selectedMoodId,
  } = useAppStore();

  const { generateAudio, isLoading: isGeneratingAudio, error: audioError } = useAudioGeneration();

  // State for showing audio generation
  const [showAudioGeneration, setShowAudioGeneration] = useState(false);

  // Get selected mood data
  const selectedMood = useMemo(() => {
    if (!selectedMoodId || !moods.length) return null;
    return moods.find((m) => (m as any).mood_id === selectedMoodId || m.id === selectedMoodId) || null;
  }, [moods, selectedMoodId]);

  // Audio generation form state
  const [moodName, setMoodName] = useState('');
  const [moodDescription, setMoodDescription] = useState('');
  const [emotionalTone, setEmotionalTone] = useState<string[]>([]);
  const [emotionalToneInput, setEmotionalToneInput] = useState('');
  const [aestheticDirection, setAestheticDirection] = useState('');
  const [styleKeywords, setStyleKeywords] = useState<string[]>([]);
  const [styleKeywordsInput, setStyleKeywordsInput] = useState('');
  const [duration, setDuration] = useState<number>(30);
  const [prompt, setPrompt] = useState('');
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);

  // Initialize fields from store when audio generation is shown
  useEffect(() => {
    if (showAudioGeneration && selectedMood && creativeBrief && renderedVideoDuration) {
      const moodNameValue = (selectedMood as any).style_name || selectedMood.name;
      const moodDescValue = selectedMood.aesthetic_direction || selectedMood.description || '';
      const emotionalToneValue = creativeBrief.emotional_tone || [];
      const aestheticDirValue = selectedMood.aesthetic_direction || '';
      const styleKeywordsValue = selectedMood.style_keywords || [];
      const durationValue = Math.round(renderedVideoDuration);

      setMoodName(moodNameValue);
      setMoodDescription(moodDescValue);
      setEmotionalTone(emotionalToneValue);
      setEmotionalToneInput(emotionalToneValue.join(', '));
      setAestheticDirection(aestheticDirValue);
      setStyleKeywords(styleKeywordsValue);
      setStyleKeywordsInput(styleKeywordsValue.join(', '));
      setDuration(durationValue);
    }
  }, [showAudioGeneration, selectedMood, creativeBrief, renderedVideoDuration]);

  // Rebuild prompt when structured fields change
  useEffect(() => {
    if (showAudioGeneration) {
      const newPrompt = buildMusicPrompt({
        mood_name: moodName,
        mood_description: moodDescription,
        emotional_tone: emotionalTone,
        aesthetic_direction: aestheticDirection,
        style_keywords: styleKeywords,
      });
      setPrompt(newPrompt);
    }
  }, [showAudioGeneration, moodName, moodDescription, emotionalTone, aestheticDirection, styleKeywords]);

  // Update emotional tone array from input
  useEffect(() => {
    if (showAudioGeneration) {
      const tones = emotionalToneInput
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      setEmotionalTone(tones);
    }
  }, [showAudioGeneration, emotionalToneInput]);

  // Update style keywords array from input
  useEffect(() => {
    if (showAudioGeneration) {
      const keywords = styleKeywordsInput
        .split(',')
        .map((k) => k.trim())
        .filter((k) => k.length > 0);
      setStyleKeywords(keywords);
    }
  }, [showAudioGeneration, styleKeywordsInput]);

  // Redirect if no rendered video and not rendering
  useEffect(() => {
    if (!renderedVideoUrl && !isRenderingVideo) {
      router.push(`/project/${projectId}/scenes`);
    }
  }, [renderedVideoUrl, isRenderingVideo, projectId, router]);

  // Show toast for audio errors
  useEffect(() => {
    if (audioError) {
      addToast({
        type: 'error',
        message: audioError,
        duration: 5000,
      });
    }
  }, [audioError, addToast]);

  const handleSkipAudio = () => {
    // Navigate to final page without audio
    setCurrentStep(STEPS.FINAL);
    router.push(`/project/${projectId}/final`);
  };

  const handleWantAudio = () => {
    // Show audio generation form inline instead of navigating
    setShowAudioGeneration(true);
  };

  const handleGenerateAudio = async () => {
    if (!moodName || !moodDescription || !aestheticDirection) {
      addToast({
        type: 'error',
        message: 'Please fill in all required fields',
        duration: 5000,
      });
      return;
    }

    if (!prompt.trim()) {
      addToast({
        type: 'error',
        message: 'Please provide a music generation prompt',
        duration: 5000,
      });
      return;
    }

    const autoGeneratedPrompt = buildMusicPrompt({
      mood_name: moodName,
      mood_description: moodDescription,
      emotional_tone: emotionalTone,
      aesthetic_direction: aestheticDirection,
      style_keywords: styleKeywords,
    });

    const promptHasBeenEdited = prompt.trim() !== autoGeneratedPrompt.trim();

    const audioRequest: AudioGenerationRequest = {
      mood_name: moodName,
      mood_description: moodDescription,
      emotional_tone: emotionalTone,
      aesthetic_direction: aestheticDirection,
      style_keywords: styleKeywords,
      duration: duration,
      ...(promptHasBeenEdited && { custom_prompt: prompt.trim() }),
    };

    const audioUrl = await generateAudio(audioRequest);

    if (audioUrl) {
      setGeneratedAudioUrl(audioUrl);
      addToast({
        type: 'success',
        message: 'Audio generated successfully!',
        duration: 3000,
      });
    }
  };

  const handleRegenerateAudio = () => {
    setGeneratedAudioUrl(null);
    handleGenerateAudio();
  };

  const handleContinueToFinal = () => {
    if (generatedAudioUrl) {
      setCurrentStep(STEPS.FINAL);
      router.push(`/project/${projectId}/final`);
    }
  };

  // Show loading state while rendering
  if (isRenderingVideo || !renderedVideoUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <LoadingPhrases />
      </div>
    );
  }

  // Construct full video URL
  const videoUrl = renderedVideoUrl.startsWith('http') 
    ? renderedVideoUrl 
    : `${API_URL}${renderedVideoUrl}`;

  return (
    <div className="w-full max-w-7xl h-full flex gap-2 sm:gap-3">
      {/* Video Card - Transitions from centered smaller size to half width when audio generation appears */}
      <div 
        className={`
          min-h-0 animate-slideUp
          transition-all duration-500 ease-in-out
          ${showAudioGeneration ? 'w-1/2' : 'w-full flex items-center justify-center'}
        `}
      >
        <div className={`flex flex-col ${showAudioGeneration ? 'h-full bg-card border rounded-lg p-4 w-full justify-center' : 'max-w-4xl w-full'}`}>
          {/* Video Display */}
          <div className="flex flex-col space-y-1 sm:space-y-2 flex-shrink-0">
            <div className="aspect-video bg-black rounded-lg overflow-hidden w-full">
              <video
                src={videoUrl}
                controls
                className="w-full h-full"
                preload="metadata"
              >
                Your browser does not support the video tag.
              </video>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground text-center">
              Duration: {renderedVideoDuration ? `${renderedVideoDuration.toFixed(1)}s` : 'Unknown'}
            </p>
          </div>

          {/* Audio Options - only show when audio generation is not visible, centered */}
          {!showAudioGeneration && (
            <div className="space-y-2 sm:space-y-3 flex-shrink-0 mt-3 sm:mt-4 flex flex-col items-center">
              <div className="flex flex-col items-center gap-3 sm:gap-4 w-full">
                <h3 className="text-base sm:text-lg font-semibold text-center">Would you like to add audio to this video?</h3>
                {/* Action Buttons - centered */}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center">
                  <Button
                    onClick={handleSkipAudio}
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                  >
                    I don't want audio
                  </Button>
                  <Button
                    onClick={handleWantAudio}
                    size="sm"
                    className="w-full sm:w-auto bg-[rgb(255,81,1)] text-[rgb(196,230,43)] hover:bg-[rgb(255,100,20)]"
                  >
                    I want audio
                  </Button>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground text-center">
                Generate background music that matches your video's mood and duration.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Audio Generation Card - Slides in from right when user wants audio */}
      <div 
        className={`
          transition-all duration-500 ease-in-out
          ${showAudioGeneration
            ? 'w-1/2 opacity-100 translate-x-0' 
            : 'w-0 opacity-0 translate-x-full overflow-hidden'
          }
        `}
      >
        <div className="h-full flex flex-col min-h-0 overflow-y-auto bg-card border rounded-lg">
          <div className="flex-1 min-h-0 flex flex-col space-y-4 p-4">
            {/* Header */}
            <div>
              <h3 className="text-lg font-semibold">Music Generation Prompt</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Edit the prompt that will be sent to the music generation model. The prompt is pre-filled based on your selected mood and creative brief.
              </p>
            </div>

            {/* Prompt Textarea */}
            <div className="flex-1 min-h-0 flex flex-col">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Music generation prompt will appear here..."
                className="flex-1 min-h-0 font-mono text-sm resize-none"
              />
            </div>

            {/* Generated Audio */}
            {generatedAudioUrl && (
              <div className="flex-shrink-0 space-y-2">
                <h4 className="text-sm font-semibold">Generated Audio</h4>
                <div className="bg-secondary rounded-md p-3 border">
                  <audio
                    controls
                    src={generatedAudioUrl}
                    className="w-full"
                    preload="metadata"
                  >
                    Your browser does not support the audio element.
                  </audio>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 flex-shrink-0">
              {generatedAudioUrl ? (
                <>
                  <Button
                    onClick={handleRegenerateAudio}
                    variant="outline"
                    size="sm"
                    disabled={isGeneratingAudio}
                    className="flex-1 sm:flex-none"
                  >
                    Regenerate
                  </Button>
                  <Button
                    onClick={handleContinueToFinal}
                    size="sm"
                    className="flex-1 sm:flex-none bg-[rgb(255,81,1)] text-[rgb(196,230,43)] hover:bg-[rgb(255,100,20)]"
                  >
                    Continue to Final
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleGenerateAudio}
                  size="sm"
                  disabled={isGeneratingAudio}
                  className="w-full bg-[rgb(255,81,1)] text-[rgb(196,230,43)] hover:bg-[rgb(255,100,20)]"
                >
                  {isGeneratingAudio ? (
                    <>
                      <div className="w-4 h-4 border-2 border-[rgb(196,230,43)] border-t-transparent rounded-full animate-spin mr-2" />
                      Generating Audio...
                    </>
                  ) : (
                    'Generate Audio'
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

