'use client';

import { useState } from 'react';
import { CheckCircle2, Edit2, ArrowRight, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CreativeBriefSummaryProps } from '@/types/chat.types';

/**
 * CreativeBriefSummary component displays the extracted creative brief
 * in a structured, readable format with options to edit or continue.
 * Starts collapsed and expands upwards when toggled.
 */
export function CreativeBriefSummary({
  brief,
  onEdit,
  onContinue,
  className,
}: CreativeBriefSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasBeenOpened, setHasBeenOpened] = useState(false);

  // Always render to maintain space, but hide when no brief
  const hasBrief = !!brief;

  // Track if component has been opened (for pulsing animation)
  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    if (newExpanded && !hasBeenOpened) {
      setHasBeenOpened(true);
    }
  };

  // Show pulse animation when visible but not yet opened
  const shouldPulse = hasBrief && !hasBeenOpened && !isExpanded;

  return (
    <div
      className={cn(
        'rounded-lg border',
        shouldPulse 
          ? 'border-green-500 dark:border-green-400' 
          : 'border-zinc-200 dark:border-zinc-800',
        'bg-zinc-50 dark:bg-zinc-900',
        'overflow-hidden transition-all duration-300 ease-in-out',
        'flex flex-col',
        isExpanded && hasBrief ? 'max-h-[80vh]' : 'max-h-16',
        !hasBrief && 'opacity-0 pointer-events-none',
        shouldPulse && 'animate-attentionPulse',
        className
      )}
    >
      {/* Header - Always visible */}
      <div
        className={cn(
          'flex items-center justify-between p-4',
          hasBrief && 'cursor-pointer',
          hasBrief && 'hover:bg-zinc-100 dark:hover:bg-zinc-800',
          'transition-colors shrink-0',
          !hasBrief && 'invisible'
        )}
        onClick={hasBrief ? handleToggle : undefined}
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 
            className={cn(
              'h-5 w-5 text-green-600 dark:text-green-400 transition-all',
              shouldPulse && 'animate-pulse'
            )} 
          />
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Creative Brief Summary
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {hasBrief && onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-md',
                'text-sm font-medium text-zinc-700 dark:text-zinc-300',
                'hover:bg-zinc-200 dark:hover:bg-zinc-700',
                'transition-colors'
              )}
            >
              <Edit2 className="h-4 w-4" />
              Edit
            </button>
          )}
          {hasBrief && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggle();
              }}
              className={cn(
                'p-1 rounded-md',
                'text-zinc-700 dark:text-zinc-300',
                'hover:bg-zinc-200 dark:hover:bg-zinc-700',
                'transition-colors'
              )}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronDown className="h-5 w-5" />
              ) : (
                <ChevronUp className="h-5 w-5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Content - Collapsible */}
      {hasBrief && (
        <div
          className={cn(
            'overflow-y-auto transition-all duration-300 ease-in-out',
            'flex-1',
            isExpanded ? 'opacity-100' : 'opacity-0 max-h-0'
          )}
        >
          <div className="p-6 pt-0 space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  Product Name
                </h4>
                <p className="text-base text-zinc-900 dark:text-zinc-100">
                  {brief.product_name}
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  Target Audience
                </h4>
                <p className="text-base text-zinc-900 dark:text-zinc-100">
                  {brief.target_audience}
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  Emotional Tone
                </h4>
                <div className="flex flex-wrap gap-2">
                  {brief.emotional_tone.map((tone, index) => (
                    <span
                      key={index}
                      className={cn(
                        'px-3 py-1 rounded-full text-sm',
                        'bg-zinc-200 dark:bg-zinc-800',
                        'text-zinc-900 dark:text-zinc-100'
                      )}
                    >
                      {tone}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  Visual Style
                </h4>
                <div className="flex flex-wrap gap-2">
                  {brief.visual_style_keywords.map((keyword, index) => (
                    <span
                      key={index}
                      className={cn(
                        'px-3 py-1 rounded-full text-sm',
                        'bg-zinc-200 dark:bg-zinc-800',
                        'text-zinc-900 dark:text-zinc-100'
                      )}
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <h4 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  Key Messages
                </h4>
                <ul className="space-y-1">
                  {brief.key_messages.map((message, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 text-base text-zinc-900 dark:text-zinc-100"
                    >
                      <span className="text-zinc-400 dark:text-zinc-600 mt-1">•</span>
                      <span>{message}</span>
                    </li>
                  ))}
                </ul>
              </div>
          </div>

            {onContinue && (
              <div className="flex justify-end pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  onClick={onContinue}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg',
                    'bg-zinc-950 dark:bg-zinc-50 text-white dark:text-zinc-950',
                    'hover:bg-zinc-800 dark:hover:bg-zinc-200',
                    'font-medium transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-zinc-50 focus:ring-offset-2'
                  )}
                >
                  Continue to Mood Selection
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

