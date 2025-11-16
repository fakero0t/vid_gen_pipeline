'use client';

import { CheckCircle2, Edit2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CreativeBriefSummaryProps } from '@/types/chat.types';

/**
 * CreativeBriefSummary component displays the extracted creative brief
 * in a structured, readable format with options to edit or continue.
 */
export function CreativeBriefSummary({
  brief,
  onEdit,
  onContinue,
  className,
}: CreativeBriefSummaryProps) {
  if (!brief) {
    return null;
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-zinc-200 dark:border-zinc-800',
        'bg-zinc-50 dark:bg-zinc-900 p-6',
        'space-y-6',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Creative Brief Summary
          </h3>
        </div>
        {onEdit && (
          <button
            onClick={onEdit}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-md',
              'text-sm font-medium text-zinc-700 dark:text-zinc-300',
              'hover:bg-zinc-200 dark:hover:bg-zinc-800',
              'transition-colors'
            )}
          >
            <Edit2 className="h-4 w-4" />
            Edit
          </button>
        )}
      </div>

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
  );
}

