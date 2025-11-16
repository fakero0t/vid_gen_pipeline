'use client';

import { useEffect, useRef } from 'react';
import { Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatInterfaceProps } from '@/types/chat.types';
import { VisionPrompt } from './VisionPrompt';
import { CreativeBriefSummary } from './CreativeBriefSummary';

/**
 * ChatInterface component provides the main chat UI with message rendering,
 * streaming support, and integration with creative brief display.
 */
export function ChatInterface({
  messages,
  onSendMessage,
  isLoading = false,
  isStreaming = false,
  error = null,
  className,
}: ChatInterfaceProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive or streaming updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-white dark:bg-zinc-950',
        'border border-zinc-200 dark:border-zinc-800 rounded-lg',
        'overflow-hidden',
        className
      )}
    >
      {/* Messages Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <div className="rounded-full bg-zinc-100 dark:bg-zinc-800 p-4">
              <Bot className="h-8 w-8 text-zinc-600 dark:text-zinc-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Let's create your product vision
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400 max-w-md">
                Start by describing your product, target audience, and what makes it special.
                I'll help you refine your vision into a creative brief.
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex gap-3',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.role === 'assistant' && (
                  <div className="flex-shrink-0">
                    <div className="rounded-full bg-zinc-100 dark:bg-zinc-800 p-2">
                      <Bot className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
                    </div>
                  </div>
                )}

                <div
                  className={cn(
                    'max-w-[80%] rounded-lg px-4 py-2.5',
                    message.role === 'user'
                      ? 'bg-zinc-950 dark:bg-zinc-50 text-white dark:text-zinc-950'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                  )}
                >
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <p className="whitespace-pre-wrap break-words m-0">
                      {message.content}
                      {message.isStreaming && (
                        <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
                      )}
                    </p>
                  </div>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {message.timestamp.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>

                {message.role === 'user' && (
                  <div className="flex-shrink-0">
                    <div className="rounded-full bg-zinc-950 dark:bg-zinc-50 p-2">
                      <User className="h-5 w-5 text-white dark:text-zinc-950" />
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Loading indicator for streaming */}
            {isStreaming && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0">
                  <div className="rounded-full bg-zinc-100 dark:bg-zinc-800 p-2">
                    <Bot className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
                  </div>
                </div>
                <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg px-4 py-2.5">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce" />
                    <span
                      className="w-2 h-2 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce"
                      style={{ animationDelay: '0.1s' }}
                    />
                    <span
                      className="w-2 h-2 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce"
                      style={{ animationDelay: '0.2s' }}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Error Display */}
        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <VisionPrompt
        onSend={onSendMessage}
        disabled={isLoading}
        isLoading={isLoading}
        placeholder={
          messages.length === 0
            ? 'Describe your product vision...'
            : 'Continue the conversation...'
        }
      />
    </div>
  );
}

