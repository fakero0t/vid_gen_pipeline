'use client';

import { useState, useEffect, useMemo } from 'react';
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

export function AudioGenerationPage() {
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

  // Get selected mood data
  const selectedMood = useMemo(() => {
    if (!selectedMoodId || !moods.length) return null;
    return moods.find((m) => (m as any).mood_id === selectedMoodId || m.id === selectedMoodId) || null;
  }, [moods, selectedMoodId]);

  // Structured fields state
  const [moodName, setMoodName] = useState('');
  const [moodDescription, setMoodDescription] = useState('');
  const [emotionalTone, setEmotionalTone] = useState<string[]>([]);
  const [emotionalToneInput, setEmotionalToneInput] = useState('');
  const [aestheticDirection, setAestheticDirection] = useState('');
  const [styleKeywords, setStyleKeywords] = useState<string[]>([]);
  const [styleKeywordsInput, setStyleKeywordsInput] = useState('');
  const [duration, setDuration] = useState<number>(30);

  // Prompt state
  const [prompt, setPrompt] = useState('');

  // Audio state
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);

  // Initialize fields from store
  useEffect(() => {
    if (selectedMood && creativeBrief && renderedVideoDuration) {
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
  }, [selectedMood, creativeBrief, renderedVideoDuration]);

  // Rebuild prompt when structured fields change
  useEffect(() => {
    const newPrompt = buildMusicPrompt({
      mood_name: moodName,
      mood_description: moodDescription,
      emotional_tone: emotionalTone,
      aesthetic_direction: aestheticDirection,
      style_keywords: styleKeywords,
    });
    setPrompt(newPrompt);
  }, [moodName, moodDescription, emotionalTone, aestheticDirection, styleKeywords]);

  // Update emotional tone array from input
  useEffect(() => {
    const tones = emotionalToneInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    setEmotionalTone(tones);
  }, [emotionalToneInput]);

  // Update style keywords array from input
  useEffect(() => {
    const keywords = styleKeywordsInput
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
    setStyleKeywords(keywords);
  }, [styleKeywordsInput]);

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

  // Redirect if no rendered video and not rendering
  useEffect(() => {
    if (!renderedVideoUrl && !isRenderingVideo) {
      router.push(`/project/${projectId}/scenes`);
    }
  }, [renderedVideoUrl, isRenderingVideo, projectId, router]);

  const handleBack = () => {
    router.push(`/project/${projectId}/audio`);
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

    // Check if prompt has been edited (compare with auto-generated prompt)
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
      // Send custom prompt if user has edited it
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
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold">Rendering Your Video</h3>
          <p className="text-sm text-muted-foreground">
            Please wait while we combine all your scenes into a single video...
          </p>
        </div>
      </div>
    );
  }

  // Construct full video URL
  const videoUrl = renderedVideoUrl.startsWith('http') 
    ? renderedVideoUrl 
    : `${API_URL}${renderedVideoUrl}`;

  return (
    <div className="w-full max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Generate Audio</h2>
          <p className="text-muted-foreground mt-1">
            Customize the prompt for your background music
          </p>
        </div>
        <Button variant="ghost" onClick={handleBack}>
          ← Back
        </Button>
      </div>

      {/* Rendered Video Display */}
      <div className="bg-card border rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold">Your Rendered Video</h3>
        <div className="aspect-video bg-black rounded-lg overflow-hidden">
          <video
            src={videoUrl}
            controls
            className="w-full h-full"
            preload="metadata"
          >
            Your browser does not support the video tag.
          </video>
        </div>
        <p className="text-sm text-muted-foreground text-center">
          Duration: {renderedVideoDuration ? `${renderedVideoDuration.toFixed(1)}s` : 'Unknown'}
        </p>
      </div>

      {/* Prompt Display and Editing */}
      <div className="bg-card border rounded-lg p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Music Generation Prompt</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Edit the prompt that will be sent to the music generation model. The prompt is pre-filled based on your selected mood and creative brief.
          </p>
        </div>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Music generation prompt will appear here..."
          rows={8}
          className="font-mono text-sm"
        />
      </div>

      {/* Generated Audio */}
      {generatedAudioUrl && (
        <div className="bg-card border rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold">Generated Audio</h3>
          <div className="bg-white dark:bg-zinc-900 rounded-md p-4 border">
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
      <div className="flex gap-4 justify-end">
        {generatedAudioUrl ? (
          <>
            <Button
              onClick={handleRegenerateAudio}
              variant="outline"
              size="lg"
              disabled={isGeneratingAudio}
            >
              Regenerate Audio
            </Button>
            <Button
              onClick={handleContinueToFinal}
              size="lg"
              className="bg-[rgb(255,81,1)] text-[rgb(196,230,43)] hover:bg-[rgb(255,100,20)]"
            >
              Continue to Final
            </Button>
          </>
        ) : (
          <Button
            onClick={handleGenerateAudio}
            size="lg"
            disabled={isGeneratingAudio}
            className="bg-[rgb(255,81,1)] text-[rgb(196,230,43)] hover:bg-[rgb(255,100,20)]"
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
  );
}

