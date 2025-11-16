/**
 * Error handling utilities and types for the vision chat system.
 */

/**
 * Custom error types for better error handling
 */
export class ChatError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'ChatError';
  }
}

export class ExtractionError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'ExtractionError';
  }
}

export class NetworkError extends Error {
  constructor(message: string, public retryable: boolean = true) {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * Error codes for different error scenarios
 */
export const ERROR_CODES = {
  // API Errors
  API_KEY_MISSING: 'API_KEY_MISSING',
  API_KEY_INVALID: 'API_KEY_INVALID',
  API_RATE_LIMIT: 'API_RATE_LIMIT',
  API_TIMEOUT: 'API_TIMEOUT',
  API_SERVER_ERROR: 'API_SERVER_ERROR',
  
  // Network Errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  NETWORK_OFFLINE: 'NETWORK_OFFLINE',
  
  // Validation Errors
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_MESSAGE_FORMAT: 'INVALID_MESSAGE_FORMAT',
  INSUFFICIENT_CONVERSATION: 'INSUFFICIENT_CONVERSATION',
  
  // Extraction Errors
  EXTRACTION_FAILED: 'EXTRACTION_FAILED',
  EXTRACTION_INCOMPLETE: 'EXTRACTION_INCOMPLETE',
  EXTRACTION_VALIDATION_FAILED: 'EXTRACTION_VALIDATION_FAILED',
  
  // Unknown
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

/**
 * User-friendly error messages
 */
export const ERROR_MESSAGES: Record<string, string> = {
  [ERROR_CODES.API_KEY_MISSING]: 'OpenAI API key is not configured. Please check your environment variables.',
  [ERROR_CODES.API_KEY_INVALID]: 'Invalid OpenAI API key. Please check your API key and try again.',
  [ERROR_CODES.API_RATE_LIMIT]: 'Rate limit exceeded. Please wait a moment and try again.',
  [ERROR_CODES.API_TIMEOUT]: 'Request timed out. Please try again.',
  [ERROR_CODES.API_SERVER_ERROR]: 'Server error occurred. Please try again later.',
  
  [ERROR_CODES.NETWORK_ERROR]: 'Network error. Please check your connection and try again.',
  [ERROR_CODES.NETWORK_TIMEOUT]: 'Connection timed out. Please check your internet connection.',
  [ERROR_CODES.NETWORK_OFFLINE]: 'You appear to be offline. Please check your connection.',
  
  [ERROR_CODES.INVALID_INPUT]: 'Invalid input. Please check your message and try again.',
  [ERROR_CODES.INVALID_MESSAGE_FORMAT]: 'Invalid message format. Please try again.',
  [ERROR_CODES.INSUFFICIENT_CONVERSATION]: 'Not enough conversation to extract a brief. Please continue chatting.',
  
  [ERROR_CODES.EXTRACTION_FAILED]: 'Failed to extract creative brief. Please continue the conversation and try again.',
  [ERROR_CODES.EXTRACTION_INCOMPLETE]: 'Creative brief extraction incomplete. Please provide more details.',
  [ERROR_CODES.EXTRACTION_VALIDATION_FAILED]: 'Extracted brief validation failed. Please try again.',
  
  [ERROR_CODES.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.',
};

/**
 * Get user-friendly error message from error code or error object
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ChatError || error instanceof ExtractionError) {
    return ERROR_MESSAGES[error.code] || error.message;
  }
  
  if (error instanceof NetworkError) {
    return error.message;
  }
  
  if (error instanceof Error) {
    // Check for common error patterns
    if (error.message.includes('rate limit')) {
      return ERROR_MESSAGES[ERROR_CODES.API_RATE_LIMIT];
    }
    if (error.message.includes('timeout')) {
      return ERROR_MESSAGES[ERROR_CODES.NETWORK_TIMEOUT];
    }
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return ERROR_MESSAGES[ERROR_CODES.NETWORK_ERROR];
    }
    if (error.message.includes('API key')) {
      return ERROR_MESSAGES[ERROR_CODES.API_KEY_INVALID];
    }
    return error.message;
  }
  
  return ERROR_MESSAGES[ERROR_CODES.UNKNOWN_ERROR];
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof ChatError || error instanceof ExtractionError) {
    return error.retryable;
  }
  if (error instanceof NetworkError) {
    return error.retryable;
  }
  // Default: network errors and rate limits are retryable
  if (error instanceof Error) {
    return (
      error.message.includes('network') ||
      error.message.includes('timeout') ||
      error.message.includes('rate limit') ||
      error.message.includes('fetch')
    );
  }
  return false;
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
    retryable?: (error: unknown) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    retryable = isRetryableError,
  } = options;

  let lastError: unknown;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if error is not retryable
      if (!retryable(error)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Increase delay for next retry (exponential backoff)
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw lastError;
}

/**
 * Check if browser is online
 */
export function isOnline(): boolean {
  if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
    return navigator.onLine;
  }
  return true; // Assume online if we can't check
}

/**
 * Create a timeout promise that rejects after specified milliseconds
 */
export function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new NetworkError('Request timeout', true)), ms)
    ),
  ]);
}

