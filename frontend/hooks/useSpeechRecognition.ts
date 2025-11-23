'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseSpeechRecognitionReturn {
  startListening: () => void;
  stopListening: () => void;
  isListening: boolean;
  transcript: string;
  isSupported: boolean;
  error: string | null;
}

export function useSpeechRecognition(
  onResult?: (transcript: string) => void,
  onFinalResult?: (transcript: string) => void
): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Refs for different recognition methods
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const useWebSpeechRef = useRef<boolean>(false);
  // Track accumulated final transcript to append instead of replace
  const accumulatedFinalRef = useRef<string>('');
  // Track if recognition has actually started (onstart fired)
  const hasStartedRef = useRef<boolean>(false);
  // Store callbacks in refs to avoid recreating recognition object
  const onResultRef = useRef(onResult);
  const onFinalResultRef = useRef(onFinalResult);

  // Update refs when callbacks change
  useEffect(() => {
    onResultRef.current = onResult;
    onFinalResultRef.current = onFinalResult;
  }, [onResult, onFinalResult]);

  // Check if Web Speech API is supported (Chrome/Edge)
  const isWebSpeechSupported =
    typeof window !== 'undefined' &&
    ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);

  // Check if MediaRecorder is supported (all modern browsers)
  const isMediaRecorderSupported =
    typeof window !== 'undefined' && 'MediaRecorder' in window;

  const isSupported = isWebSpeechSupported || isMediaRecorderSupported;

  // Initialize Web Speech API if available
  useEffect(() => {
    if (!isWebSpeechSupported) {
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let newFinalTranscript = '';

      // Process all results since last resultIndex
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          // Accumulate final transcripts
          newFinalTranscript += transcript + ' ';
        } else {
          // Interim results (still being processed)
          interimTranscript += transcript;
        }
      }

      // Append new final transcript to accumulated
      if (newFinalTranscript.trim()) {
        accumulatedFinalRef.current += newFinalTranscript;
      }

      // Combine accumulated final + current interim for display
      const fullTranscript = accumulatedFinalRef.current.trim() + (interimTranscript ? ' ' + interimTranscript : '');
      setTranscript(fullTranscript);

      // Call onResult with full transcript (accumulated + interim) using ref
      if (onResultRef.current && fullTranscript.trim()) {
        onResultRef.current(fullTranscript.trim());
      }

      // Call onFinalResult only when we have new final results using ref
      if (onFinalResultRef.current && newFinalTranscript.trim()) {
        onFinalResultRef.current(accumulatedFinalRef.current.trim());
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // Ignore "aborted" errors - they're expected when stopping recognition
      if (event.error === 'aborted') {
        setIsListening(false);
        return;
      }

      // Only show user-facing errors for actual problems
      const userFacingErrors = ['no-speech', 'audio-capture', 'not-allowed', 'network'];
      if (userFacingErrors.includes(event.error)) {
        let errorMessage = '';
        switch (event.error) {
          case 'no-speech':
            errorMessage = 'No speech detected. Please try again.';
            break;
          case 'audio-capture':
            errorMessage = 'No microphone found. Please check your microphone.';
            break;
          case 'not-allowed':
            errorMessage = 'Microphone permission denied. Please enable microphone access.';
            break;
          case 'network':
            errorMessage = 'Network error. Please check your connection.';
            break;
          default:
            errorMessage = `Speech recognition error: ${event.error}`;
        }
        setError(errorMessage);
      } else {
        // Log other errors but don't show to user
        console.warn('Speech recognition error (non-critical):', event.error);
      }
      
      setIsListening(false);
    };

    recognition.onstart = () => {
      hasStartedRef.current = true;
      setIsListening(true);
    };

    recognition.onend = () => {
      hasStartedRef.current = false;
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  }, [isWebSpeechSupported]); // Removed onResult and onFinalResult from deps - using refs instead

  // Start listening with Web Speech API (preferred for real-time)
  const startWebSpeechListening = useCallback(() => {
    if (!recognitionRef.current) return;

    try {
      setError(null);
      setTranscript('');
      accumulatedFinalRef.current = '';
      hasStartedRef.current = false;
      recognitionRef.current.start();
      useWebSpeechRef.current = true;
      // Optimistically set listening state to prevent double-clicks
      setIsListening(true);
    } catch (err: any) {
      // If recognition is already started, ignore the error
      if (err.name === 'InvalidStateError' || (err.message && err.message.includes('already'))) {
        return;
      }
      console.error('Error starting Web Speech:', err);
      hasStartedRef.current = false;
      setIsListening(false);
      startWhisperListening();
    }
  }, []);

  // Start listening with Whisper API (fallback for all browsers)
  const startWhisperListening = useCallback(async () => {
    if (!isMediaRecorderSupported) {
      setError('Speech recognition is not supported in this browser.');
      return;
    }

    try {
      setError(null);
      setTranscript('');
      audioChunksRef.current = [];

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        // Send audio to backend for transcription
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          
          try {
            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.webm');
            formData.append('language', 'en');

            const response = await fetch('/api/whisper/transcribe', {
              method: 'POST',
              body: formData,
            });

            if (!response.ok) {
              throw new Error('Transcription failed');
            }

            const data = await response.json();
            
            if (data.success && data.transcript) {
              setTranscript(data.transcript);
              if (onFinalResultRef.current) {
                onFinalResultRef.current(data.transcript);
              }
            }
          } catch (err) {
            console.error('Whisper transcription error:', err);
            setError('Failed to transcribe audio. Please try again.');
          }
        }

        setIsListening(false);
      };

      // Start recording
      mediaRecorder.start();
      setIsListening(true);
      useWebSpeechRef.current = false;

    } catch (err) {
      console.error('Error starting Whisper recording:', err);
      setError('Failed to access microphone. Please check permissions.');
      setIsListening(false);
    }
  }, [isMediaRecorderSupported, onFinalResult]);

  const startListening = useCallback(() => {
    // Prefer Web Speech API if available (real-time feedback)
    if (isWebSpeechSupported) {
      startWebSpeechListening();
    } else {
      // Fall back to Whisper
      startWhisperListening();
    }
  }, [isWebSpeechSupported, startWebSpeechListening, startWhisperListening]);

  const stopListening = useCallback(() => {
    if (useWebSpeechRef.current && recognitionRef.current) {
      if (hasStartedRef.current) {
        // Recognition has started, call stop and let onend handler update state
        recognitionRef.current.stop();
      } else {
        // Recognition hasn't started yet, manually reset state
        hasStartedRef.current = false;
        setIsListening(false);
      }
    } else if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
    }

    // Clean up audio stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, [isListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    startListening,
    stopListening,
    isListening,
    transcript,
    isSupported,
    error,
  };
}

