'use client';

import React from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  getPipelineErrorMessage,
  getRecoverySuggestion,
  isRetryableError,
} from '@/lib/errors';

interface ErrorAlertProps {
  error: unknown;
  onRetry?: () => void;
  onDismiss?: () => void;
  showRetry?: boolean;
  showDismiss?: boolean;
  className?: string;
}

export function ErrorAlert({
  error,
  onRetry,
  onDismiss,
  showRetry = true,
  showDismiss = true,
  className = '',
}: ErrorAlertProps) {
  if (!error) return null;

  const errorMessage = getPipelineErrorMessage(error);
  const recoverySuggestion = getRecoverySuggestion(error);
  const canRetry = isRetryableError(error);

  return (
    <Alert variant="destructive" className={`${className}`}>
      <div className="flex flex-col gap-3">
        {/* Error Icon and Message */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg
              className="w-5 h-5 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-red-900 dark:text-red-100">
              Error Occurred
            </h4>
            <p className="text-sm text-red-800 dark:text-red-200 mt-1">
              {errorMessage}
            </p>
            {recoverySuggestion && (
              <p className="text-sm text-red-700 dark:text-red-300 mt-2 italic">
                💡 {recoverySuggestion}
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {(canRetry && showRetry && onRetry) || (showDismiss && onDismiss) ? (
          <div className="flex items-center gap-2 ml-8">
            {canRetry && showRetry && onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="bg-white dark:bg-zinc-900 hover:bg-red-50 dark:hover:bg-red-950"
              >
                <svg
                  className="w-4 h-4 mr-1.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Retry
              </Button>
            )}
            {showDismiss && onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismiss}
                className="text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950"
              >
                Dismiss
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </Alert>
  );
}

/**
 * Compact error display for inline use
 */
export function ErrorText({
  error,
  className = '',
}: {
  error: unknown;
  className?: string;
}) {
  if (!error) return null;

  const errorMessage = getPipelineErrorMessage(error);

  return (
    <div className={`flex items-center gap-2 text-sm text-red-600 dark:text-red-400 ${className}`}>
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>{errorMessage}</span>
    </div>
  );
}

