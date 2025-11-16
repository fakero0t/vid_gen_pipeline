'use client';

import { useState, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VisionPromptProps } from '@/types/chat.types';

/**
 * VisionPrompt component for user input in the chat interface.
 * Handles message input, submission, and keyboard interactions.
 */
export function VisionPrompt({
  onSend,
  disabled = false,
  placeholder = 'Describe your product vision...',
  isLoading = false,
  className,
}: VisionPromptProps) {
  const [input, setInput] = useState('');

  const handleSubmit = () => {
    const trimmedInput = input.trim();
    if (trimmedInput && !disabled && !isLoading) {
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
    <div className={cn('flex items-end gap-2 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4', className)}>
      <div className="flex-1 relative">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          rows={1}
          className={cn(
            'w-full resize-none rounded-lg border border-zinc-300 dark:border-zinc-700',
            'bg-white dark:bg-zinc-900 px-4 py-3 pr-12',
            'text-sm text-zinc-900 dark:text-zinc-100',
            'placeholder:text-zinc-500 dark:placeholder:text-zinc-400',
            'focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-zinc-50 focus:border-transparent',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-colors'
          )}
          style={{
            minHeight: '48px',
            maxHeight: '120px',
          }}
        />
      </div>
      <button
        onClick={handleSubmit}
        disabled={isDisabled}
        className={cn(
          'flex items-center justify-center',
          'h-12 w-12 rounded-lg',
          'bg-zinc-950 dark:bg-zinc-50 text-white dark:text-zinc-950',
          'hover:bg-zinc-800 dark:hover:bg-zinc-200',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-zinc-50 focus:ring-offset-2'
        )}
        aria-label="Send message"
      >
        {isLoading ? (
          <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <Send className="h-5 w-5" />
        )}
      </button>
    </div>
  );
}

