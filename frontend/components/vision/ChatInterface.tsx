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
        'flex flex-col h-full bg-background',
        'border-2 border-[rgb(255,81,1)]/20 rounded-3xl',
        'overflow-hidden shadow-xl',
        className
      )}
    >
      {/* Messages Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden p-4 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6 px-4 animate-fadeIn">
            <div className="space-y-3">
              <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight leading-tight text-balance">
                Turn ordinary products into
                <br />
                <span className="text-gradient">extraordinary visuals</span>
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
                Start by describing your product, target audience, and what makes it special
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
                    <div className="rounded-full bg-[rgb(255,81,1)] p-1.5">
                      <Bot className="h-4 w-4 text-[rgb(196,230,43)]" />
                    </div>
                  </div>
                )}

                <div
                  className={cn(
                    'max-w-[75%] rounded-2xl px-3 py-2 animate-slideUp',
                    message.role === 'user'
                      ? 'bg-[rgb(255,81,1)] text-[rgb(196,230,43)] font-medium'
                      : 'bg-secondary text-foreground border border-border/50'
                  )}
                >
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <p className="whitespace-pre-wrap break-words m-0 text-sm leading-normal">
                      {message.content}
                      {message.isStreaming && (
                        <span className="inline-block w-1 h-3 ml-1 bg-current animate-pulse rounded-sm" />
                      )}
                    </p>
                  </div>
                  <div className="mt-1 text-[10px] opacity-60">
                    {message.timestamp.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>

                {message.role === 'user' && (
                  <div className="flex-shrink-0">
                    <div className="rounded-full bg-[rgb(255,81,1)] p-1.5">
                      <User className="h-4 w-4 text-[rgb(196,230,43)]" />
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Loading indicator for streaming */}
            {isStreaming && (
              <div className="flex gap-2 justify-start animate-slideUp">
                <div className="flex-shrink-0">
                  <div className="rounded-full bg-[rgb(255,81,1)] p-1.5">
                    <Bot className="h-4 w-4 text-[rgb(196,230,43)]" />
                  </div>
                </div>
                <div className="bg-secondary rounded-2xl px-3 py-2 border border-border/50">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-[rgb(255,81,1)] rounded-full animate-bounce" />
                    <span
                      className="w-1.5 h-1.5 bg-[rgb(255,81,1)] rounded-full animate-bounce"
                      style={{ animationDelay: '0.1s' }}
                    />
                    <span
                      className="w-1.5 h-1.5 bg-[rgb(255,81,1)] rounded-full animate-bounce"
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
          <div className="rounded-xl bg-destructive/10 border border-destructive/50 p-2 animate-slideUp">
            <p className="text-xs font-medium text-destructive">{error}</p>
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

