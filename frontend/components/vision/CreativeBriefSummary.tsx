'use client';

import { CheckCircle2, Edit2, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CreativeBriefSummaryProps } from '@/types/chat.types';

/**
 * CreativeBriefSummary component displays the extracted creative brief
 * in a structured, readable format with options to edit or continue.
 * Appears in the right panel when brief is generated.
 */
export function CreativeBriefSummary({
  brief,
  onEdit,
  onContinue,
  isExtracting = false,
  isUpdating = false,
  className,
}: CreativeBriefSummaryProps) {
  // Always render to maintain space, but hide when no brief
  const hasBrief = !!brief;
  // Show loading if extracting or updating (new message being processed)
  const isLoading = isExtracting || isUpdating;

  return (
    <div
      className={cn(
        'rounded-3xl border-2',
        'border-foreground',
        'bg-background',
        'overflow-hidden shadow-xl',
        'flex flex-col h-full',
        !hasBrief && 'opacity-0 pointer-events-none',
        className
      )}
    >
      {/* Header - Always visible */}
      <div
        className={cn(
          'flex items-center justify-between p-3 sm:p-4 border-b border-border',
          'shrink-0',
          !hasBrief && !isLoading && 'invisible'
        )}
      >
        <div className="flex items-center gap-2">
          {isLoading ? (
            <Loader2 className="h-5 w-5 text-[rgb(255,81,1)] animate-spin" />
          ) : (
            <CheckCircle2 
              className="h-5 w-5 text-foreground animate-scaleIn" 
            />
          )}
          <h3 className="font-display text-lg font-bold text-foreground">
            Creative Brief
            {isLoading && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                Updating...
              </span>
            )}
          </h3>
        </div>
        {hasBrief && !isLoading && onEdit && (
          <button
            onClick={onEdit}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full',
              'text-xs font-bold text-foreground',
              'hover:bg-secondary',
              'transition-all duration-300'
            )}
          >
            <Edit2 className="h-3 w-3" />
            Edit
          </button>
        )}
      </div>

      {/* Content - Always visible when brief exists or loading */}
      {(hasBrief || isLoading) && (
        <>
        <div className="overflow-y-auto flex-1">
            {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full p-6 space-y-4">
              <Loader2 className="h-8 w-8 text-[rgb(255,81,1)] animate-spin" />
              <p className="text-sm text-muted-foreground text-center">
                Updating creative brief with new information...
              </p>
            </div>
          ) : brief ? (
          <div className="p-3 sm:p-4 space-y-4">
            <div className="space-y-4">
              <div className="space-y-2 animate-slideUp">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Product Name
                </h4>
                <p className="text-lg font-display font-bold text-foreground">
                  {brief.product_name}
                </p>
              </div>

              <div className="space-y-2 animate-slideUp animation-delay-100">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Target Audience
                </h4>
                <p className="text-sm leading-normal text-foreground">
                  {brief.target_audience}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2 animate-slideUp animation-delay-200">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Emotional Tone
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {brief.emotional_tone.map((tone, index) => (
                      <span
                        key={index}
                        className={cn(
                          'px-2 py-1 rounded-full text-xs font-semibold',
                          'bg-secondary border border-border',
                          'text-foreground',
                          'transition-all duration-300'
                        )}
                      >
                        {tone}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 animate-slideUp animation-delay-300">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Visual Style
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {brief.visual_style_keywords.map((keyword, index) => (
                      <span
                        key={index}
                        className={cn(
                          'px-2 py-1 rounded-full text-xs font-semibold',
                          'bg-secondary border border-border',
                          'text-foreground',
                          'transition-all duration-300'
                        )}
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2 animate-slideUp animation-delay-400">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Key Messages
                </h4>
                <ul className="space-y-1.5">
                  {brief.key_messages.map((message, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 text-sm text-foreground"
                    >
                      <span className="text-foreground mt-0.5 font-bold text-sm">•</span>
                      <span className="leading-normal">{message}</span>
                    </li>
                  ))}
                </ul>
              </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Continue button - Fixed at bottom right */}
          {onContinue && !isLoading && (
            <div className="p-3 sm:p-4 flex justify-end shrink-0 border-t border-border">
                <button
                  onClick={onContinue}
                  className={cn(
                  'group flex items-center gap-2 px-4 py-2.5 rounded-full w-auto',
                    'bg-black dark:bg-white text-white dark:text-black',
                    'hover:scale-[1.02] active:scale-95',
                    'font-display font-bold text-sm transition-all duration-300',
                    'shadow-md hover:shadow-lg',
                  'focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20',
                  'animate-slideUp animation-delay-400'
                  )}
                >
                <span>Continue to Mood Selection</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            )}
        </>
      )}
    </div>
  );
}

