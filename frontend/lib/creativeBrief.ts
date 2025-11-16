/**
 * Creative brief synthesis utilities.
 * Functions for extracting and validating creative brief data from conversations.
 */

import type { ChatMessage, CreativeBrief } from '@/types/chat.types';
import { retryWithBackoff, timeout, isOnline, ExtractionError, ERROR_CODES } from './errors';

/**
 * Check if a creative brief is complete (all required fields are present and non-empty)
 */
export function isCreativeBriefComplete(brief: CreativeBrief | null): boolean {
  if (!brief) return false;

  return (
    brief.product_name.trim().length > 0 &&
    brief.target_audience.trim().length > 0 &&
    brief.emotional_tone.length > 0 &&
    brief.visual_style_keywords.length > 0 &&
    brief.key_messages.length > 0
  );
}

/**
 * Check if conversation has enough messages to attempt extraction
 * (heuristic: at least 2 user messages and 2 assistant messages)
 */
export function hasEnoughConversation(messages: ChatMessage[]): boolean {
  const userMessages = messages.filter(m => m.role === 'user');
  const assistantMessages = messages.filter(m => m.role === 'assistant');
  
  return userMessages.length >= 2 && assistantMessages.length >= 2;
}

/**
 * Extract creative brief from conversation using the API endpoint
 * Includes retry logic and error handling
 */
export async function extractCreativeBrief(
  messages: ChatMessage[]
): Promise<CreativeBrief | null> {
  // Check if we have enough conversation
  if (!hasEnoughConversation(messages)) {
    throw new ExtractionError(
      'Not enough conversation to extract a brief',
      ERROR_CODES.INSUFFICIENT_CONVERSATION,
      false
    );
  }

  // Check if online
  if (!isOnline()) {
    throw new ExtractionError(
      'You appear to be offline. Please check your connection.',
      ERROR_CODES.NETWORK_OFFLINE,
      true
    );
  }

  // Retry with exponential backoff
  return retryWithBackoff(
    async () => {
      const fetchPromise = fetch('/api/chat/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages }),
      });

      // Add timeout (30 seconds)
      const response = await timeout(fetchPromise, 30000);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }

        // Map HTTP status codes to error types
        const isRetryable = response.status >= 500 || response.status === 429;
        
        throw new ExtractionError(
          errorData.error || 'Failed to extract creative brief',
          response.status === 429 ? ERROR_CODES.API_RATE_LIMIT : ERROR_CODES.EXTRACTION_FAILED,
          isRetryable
        );
      }

      const data = await response.json();
      
      if (!data.creativeBrief) {
        throw new ExtractionError(
          'No creative brief returned from extraction',
          ERROR_CODES.EXTRACTION_FAILED,
          false
        );
      }

      return data.creativeBrief;
    },
    {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 5000,
    }
  );
}

/**
 * Validate creative brief structure
 */
export function validateCreativeBrief(brief: Partial<CreativeBrief>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!brief.product_name || brief.product_name.trim().length === 0) {
    errors.push('Product name is required');
  }

  if (!brief.target_audience || brief.target_audience.trim().length === 0) {
    errors.push('Target audience is required');
  }

  if (!brief.emotional_tone || !Array.isArray(brief.emotional_tone) || brief.emotional_tone.length === 0) {
    errors.push('At least one emotional tone is required');
  }

  if (!brief.visual_style_keywords || !Array.isArray(brief.visual_style_keywords) || brief.visual_style_keywords.length === 0) {
    errors.push('At least one visual style keyword is required');
  }

  if (!brief.key_messages || !Array.isArray(brief.key_messages) || brief.key_messages.length === 0) {
    errors.push('At least one key message is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

