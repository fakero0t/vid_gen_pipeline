'use client';

import { useState, KeyboardEvent, useEffect, useRef } from 'react';
import { Send, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VisionPromptProps } from '@/types/chat.types';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

/**
 * VisionPrompt component for user input in the chat interface.
 * Handles message input, submission, keyboard interactions, and speech recognition.
 */
export function VisionPrompt({
  onSend,
  disabled = false,
  placeholder = 'Describe your product vision...',
  isLoading = false,
  className,
}: VisionPromptProps) {
  const [input, setInput] = useState('');
  const [isDictating, setIsDictating] = useState(false);

  // Track the input text before dictation starts to preserve manual input
  const inputBeforeDictationRef = useRef<string>('');
  // Ref for the textarea to focus it when dictation starts
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Speech recognition hook
  const {
    startListening,
    stopListening,
    isListening,
    transcript,
    isSupported: isSpeechSupported,
    error: speechError,
  } = useSpeechRecognition(
    // Interim results - update input in real-time (includes accumulated + interim)
    (fullTranscript) => {
      if (isDictating) {
        // Combine preserved manual input with dictation transcript
        const preserved = inputBeforeDictationRef.current.trim();
        const dictationText = fullTranscript.trim();
        setInput(preserved ? `${preserved} ${dictationText}` : dictationText);
      }
    },
    // Final results - transcript already includes accumulated text
    () => {
      // No action needed - transcript state is already updated
    }
  );

  // Handle dictation toggle
  const handleToggleDictation = () => {
    if (isListening) {
      stopListening();
      setIsDictating(false);
      inputBeforeDictationRef.current = ''; // Clear preserved text
    } else {
      // Preserve existing text before starting dictation
      inputBeforeDictationRef.current = input.trim();
      setIsDictating(true);
      startListening();
      // Focus the textarea when starting dictation
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    }
  };

  // Stop dictation when component unmounts or when sending
  useEffect(() => {
    return () => {
      if (isListening) {
        stopListening();
      }
    };
  }, [isListening, stopListening]);

  const handleSubmit = () => {
    const trimmedInput = input.trim();
    if (trimmedInput && !disabled && !isLoading) {
      // Stop dictation if active
      if (isListening) {
        stopListening();
        setIsDictating(false);
      }
      onSend(trimmedInput);
      setInput('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isDisabled = disabled || isLoading || !input.trim();

  return (
    <div className={cn('flex items-end gap-3 border-t border-[rgb(255,81,1)]/20 bg-background p-3', className)}>
      <div className="flex-1 relative flex items-end">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? '🎤 Listening... Speak now' : placeholder}
          disabled={disabled || isLoading}
          rows={1}
          className={cn(
            'w-full resize-none rounded-2xl border border-border',
            'bg-secondary px-4 py-2.5',
            'text-sm font-medium text-foreground',
            'placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-[rgb(255,81,1)]/30 focus:border-[rgb(255,81,1)]/50',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-all duration-300',
            'hover:border-[rgb(255,81,1)]/30',
            // Visual indicator when dictating - more prominent
            isListening && 'border-[rgb(255,81,1)] ring-2 ring-[rgb(255,81,1)]/50 bg-[rgb(255,81,1)]/5'
          )}
          style={{
            minHeight: '40px',
            maxHeight: '120px',
          }}
        />
        {/* Speech error indicator */}
        {speechError && (
          <div className="absolute -top-6 left-0 text-xs text-destructive">
            {speechError}
          </div>
        )}
      </div>
      
      {/* Microphone button for dictation */}
      {isSpeechSupported && (
        <div className="relative group">
          <button
            onClick={handleToggleDictation}
            disabled={disabled || isLoading}
            className={cn(
              'flex items-center justify-center relative',
              'h-10 w-10 rounded-full shrink-0',
              'border-2 transition-all duration-300',
              isListening
                ? // Selected/Recording state - inverted colors
                  'bg-[rgb(255,81,1)] border-white text-white'
                : // Normal state
                  'bg-transparent border-[rgb(255,81,1)]/50 text-[rgb(255,81,1)] hover:border-[rgb(255,81,1)] hover:bg-[rgb(255,81,1)]/10',
              'disabled:opacity-30 disabled:cursor-not-allowed',
              'focus:outline-none focus:ring-2 focus:ring-[rgb(255,81,1)]/50',
              // Active/pressed effect
              isListening && 'active:scale-95'
            )}
            aria-label={isListening ? 'Stop recording' : 'Start recording'}
            title={isListening ? 'Click to stop recording' : 'Click to start recording'}
          >
            <Mic className={cn('h-4 w-4', isListening && 'relative z-10')} />
          </button>
          {/* Tooltip */}
          <div className={cn(
            'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1',
            'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900',
            'text-xs rounded whitespace-nowrap',
            'opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none',
            'z-50'
          )}>
            {isListening ? 'Click to stop' : 'Click to start recording'}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-zinc-900 dark:border-t-zinc-100" />
          </div>
        </div>
      )}

      {/* Send button */}
      <button
        onClick={handleSubmit}
        disabled={isDisabled}
        className={cn(
          'flex items-center justify-center',
          'h-10 w-10 rounded-full shrink-0',
          'bg-[rgb(255,81,1)] text-[rgb(196,230,43)]',
          'hover:scale-105 active:scale-95 hover:bg-[rgb(255,100,20)]',
          'disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100',
          'transition-all duration-300 ease-out',
          'shadow-md hover:shadow-lg',
          'focus:outline-none focus:ring-2 focus:ring-[rgb(255,81,1)]/50'
        )}
        aria-label="Send message"
      >
        {isLoading ? (
          <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}

