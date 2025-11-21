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
    <div className={cn('flex items-end gap-3 border-t border-border bg-background p-3', className)}>
      <div className="flex-1 relative flex items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          rows={1}
          className={cn(
            'w-full resize-none rounded-2xl border border-border',
            'bg-secondary px-4 py-2.5',
            'text-sm font-medium text-foreground',
            'placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 focus:border-foreground',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-all duration-300',
            'hover:border-foreground/30'
          )}
          style={{
            minHeight: '40px',
            maxHeight: '120px',
          }}
        />
      </div>
      <button
        onClick={handleSubmit}
        disabled={isDisabled}
        className={cn(
          'flex items-center justify-center',
          'h-10 w-10 rounded-full shrink-0',
          'bg-black dark:bg-white text-white dark:text-black',
          'hover:scale-105 active:scale-95',
          'disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100',
          'transition-all duration-300 ease-out',
          'shadow-md hover:shadow-lg',
          'focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20'
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

