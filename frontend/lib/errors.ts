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
 * Error codes for different error scenarios across all pipeline steps
 */
export const ERROR_CODES = {
  // API Errors
  API_KEY_MISSING: 'API_KEY_MISSING',
  API_KEY_INVALID: 'API_KEY_INVALID',
  API_RATE_LIMIT: 'API_RATE_LIMIT',
  API_TIMEOUT: 'API_TIMEOUT',
  API_SERVER_ERROR: 'API_SERVER_ERROR',
  API_CONTENT_POLICY: 'API_CONTENT_POLICY',
  
  // Network Errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  NETWORK_OFFLINE: 'NETWORK_OFFLINE',
  
  // Validation Errors
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_MESSAGE_FORMAT: 'INVALID_MESSAGE_FORMAT',
  INSUFFICIENT_CONVERSATION: 'INSUFFICIENT_CONVERSATION',
  
  // Vision Chat / Extraction Errors
  EXTRACTION_FAILED: 'EXTRACTION_FAILED',
  EXTRACTION_INCOMPLETE: 'EXTRACTION_INCOMPLETE',
  EXTRACTION_VALIDATION_FAILED: 'EXTRACTION_VALIDATION_FAILED',
  
  // Mood Generation Errors
  MOOD_GENERATION_FAILED: 'MOOD_GENERATION_FAILED',
  MOOD_GENERATION_PARTIAL: 'MOOD_GENERATION_PARTIAL',
  MOOD_IMAGE_FAILED: 'MOOD_IMAGE_FAILED',
  MOOD_NO_SELECTION: 'MOOD_NO_SELECTION',
  
  // Scene Planning Errors
  SCENE_PLANNING_FAILED: 'SCENE_PLANNING_FAILED',
  SCENE_SEED_IMAGE_FAILED: 'SCENE_SEED_IMAGE_FAILED',
  SCENE_TIMING_INVALID: 'SCENE_TIMING_INVALID',
  SCENE_NO_PLAN: 'SCENE_NO_PLAN',
  
  // Video Generation Errors
  VIDEO_GENERATION_FAILED: 'VIDEO_GENERATION_FAILED',
  VIDEO_GENERATION_PARTIAL: 'VIDEO_GENERATION_PARTIAL',
  VIDEO_CLIP_FAILED: 'VIDEO_CLIP_FAILED',
  VIDEO_JOB_NOT_FOUND: 'VIDEO_JOB_NOT_FOUND',
  VIDEO_NO_CLIPS: 'VIDEO_NO_CLIPS',
  
  // Audio Generation Errors
  AUDIO_GENERATION_FAILED: 'AUDIO_GENERATION_FAILED',
  AUDIO_NO_OUTPUT: 'AUDIO_NO_OUTPUT',
  
  // Composition Errors
  COMPOSITION_FAILED: 'COMPOSITION_FAILED',
  COMPOSITION_MISSING_CLIPS: 'COMPOSITION_MISSING_CLIPS',
  COMPOSITION_MISSING_AUDIO: 'COMPOSITION_MISSING_AUDIO',
  
  // Unknown
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

/**
 * User-friendly error messages with recovery suggestions
 */
export const ERROR_MESSAGES: Record<string, string> = {
  // API Errors
  [ERROR_CODES.API_KEY_MISSING]: 'API key is not configured. Please check your environment variables.',
  [ERROR_CODES.API_KEY_INVALID]: 'Invalid API key. Please check your API key and try again.',
  [ERROR_CODES.API_RATE_LIMIT]: 'Rate limit exceeded. Please wait a moment and try again.',
  [ERROR_CODES.API_TIMEOUT]: 'Request timed out. Please try again.',
  [ERROR_CODES.API_SERVER_ERROR]: 'Server error occurred. Please try again later.',
  [ERROR_CODES.API_CONTENT_POLICY]: 'Content did not pass moderation. Please try adjusting your input.',
  
  // Network Errors
  [ERROR_CODES.NETWORK_ERROR]: 'Network error. Please check your connection and try again.',
  [ERROR_CODES.NETWORK_TIMEOUT]: 'Connection timed out. Please check your internet connection.',
  [ERROR_CODES.NETWORK_OFFLINE]: 'You appear to be offline. Please check your connection.',
  
  // Validation Errors
  [ERROR_CODES.INVALID_INPUT]: 'Invalid input. Please check your message and try again.',
  [ERROR_CODES.INVALID_MESSAGE_FORMAT]: 'Invalid message format. Please try again.',
  [ERROR_CODES.INSUFFICIENT_CONVERSATION]: 'Not enough conversation to extract a brief. Please continue chatting.',
  
  // Vision Chat / Extraction Errors
  [ERROR_CODES.EXTRACTION_FAILED]: 'Failed to extract creative brief. Please continue the conversation and try again.',
  [ERROR_CODES.EXTRACTION_INCOMPLETE]: 'Creative brief extraction incomplete. Please provide more details.',
  [ERROR_CODES.EXTRACTION_VALIDATION_FAILED]: 'Extracted brief validation failed. Please try again.',
  
  // Mood Generation Errors
  [ERROR_CODES.MOOD_GENERATION_FAILED]: 'Failed to generate mood boards. Please try again or adjust your creative brief.',
  [ERROR_CODES.MOOD_GENERATION_PARTIAL]: 'Some mood images failed to generate. You can retry failed images or continue with what was generated.',
  [ERROR_CODES.MOOD_IMAGE_FAILED]: 'Failed to generate one or more mood images. Click retry to try again.',
  [ERROR_CODES.MOOD_NO_SELECTION]: 'Please select a mood board to continue.',
  
  // Scene Planning Errors
  [ERROR_CODES.SCENE_PLANNING_FAILED]: 'Failed to generate scene plan. Please try again or go back to adjust your selections.',
  [ERROR_CODES.SCENE_SEED_IMAGE_FAILED]: 'Failed to generate one or more scene images. Click retry to regenerate failed scenes.',
  [ERROR_CODES.SCENE_TIMING_INVALID]: 'Scene timing does not add up to 30 seconds. Please regenerate the scene plan.',
  [ERROR_CODES.SCENE_NO_PLAN]: 'No scene plan available. Please complete the previous steps first.',
  
  // Video Generation Errors
  [ERROR_CODES.VIDEO_GENERATION_FAILED]: 'Failed to generate videos. Please try again or check your scene plan.',
  [ERROR_CODES.VIDEO_GENERATION_PARTIAL]: 'Some video clips failed to generate. You can retry failed clips or continue with successful ones.',
  [ERROR_CODES.VIDEO_CLIP_FAILED]: 'Failed to generate video clip. Click retry to try again.',
  [ERROR_CODES.VIDEO_JOB_NOT_FOUND]: 'Video generation job not found. Please start generation again.',
  [ERROR_CODES.VIDEO_NO_CLIPS]: 'No video clips available. Please generate clips first.',
  
  // Audio Generation Errors
  [ERROR_CODES.AUDIO_GENERATION_FAILED]: 'Failed to generate background music. Please try again.',
  [ERROR_CODES.AUDIO_NO_OUTPUT]: 'Audio generation completed but produced no output. Please try again.',
  
  // Composition Errors
  [ERROR_CODES.COMPOSITION_FAILED]: 'Failed to compose final video. Please check that all clips are ready and try again.',
  [ERROR_CODES.COMPOSITION_MISSING_CLIPS]: 'Missing video clips for composition. Please generate all clips first.',
  [ERROR_CODES.COMPOSITION_MISSING_AUDIO]: 'Missing background audio for composition. Please generate audio first.',
  
  // Unknown
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
  // Check custom error classes
  if (
    error instanceof ChatError ||
    error instanceof ExtractionError ||
    error instanceof MoodGenerationError ||
    error instanceof ScenePlanningError ||
    error instanceof VideoGenerationError ||
    error instanceof AudioGenerationError ||
    error instanceof CompositionError
  ) {
    return error.retryable;
  }
  
  if (error instanceof NetworkError) {
    return error.retryable;
  }
  
  // Default: network errors, timeouts, rate limits, and server errors are retryable
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('timed out') ||
      message.includes('rate limit') ||
      message.includes('429') ||
      message.includes('fetch') ||
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504') ||
      message.includes('server error') ||
      message.includes('connection')
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

/**
 * Pipeline-specific error classes for better error handling
 */
export class MoodGenerationError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean = true,
    public failedImages?: number[]
  ) {
    super(message);
    this.name = 'MoodGenerationError';
  }
}

export class ScenePlanningError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean = true
  ) {
    super(message);
    this.name = 'ScenePlanningError';
  }
}

export class VideoGenerationError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean = true,
    public failedClips?: number[]
  ) {
    super(message);
    this.name = 'VideoGenerationError';
  }
}

export class AudioGenerationError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean = true
  ) {
    super(message);
    this.name = 'AudioGenerationError';
  }
}

export class CompositionError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean = true
  ) {
    super(message);
    this.name = 'CompositionError';
  }
}

/**
 * Enhanced error message extraction that handles all pipeline error types
 */
export function getPipelineErrorMessage(error: unknown): string {
  if (
    error instanceof MoodGenerationError ||
    error instanceof ScenePlanningError ||
    error instanceof VideoGenerationError ||
    error instanceof AudioGenerationError ||
    error instanceof CompositionError
  ) {
    return ERROR_MESSAGES[error.code] || error.message;
  }
  return getErrorMessage(error);
}

/**
 * Get recovery suggestions based on error type
 */
export function getRecoverySuggestion(error: unknown): string | null {
  if (error instanceof ChatError || error instanceof ExtractionError) {
    if (error.code === ERROR_CODES.INSUFFICIENT_CONVERSATION) {
      return 'Try providing more details about your product and target audience.';
    }
  }
  
  if (error instanceof MoodGenerationError) {
    if (error.failedImages && error.failedImages.length > 0) {
      return `${error.failedImages.length} image(s) failed. You can retry just the failed images or continue with what was generated.`;
    }
    return 'Try adjusting your creative brief or mood keywords.';
  }
  
  if (error instanceof VideoGenerationError) {
    if (error.failedClips && error.failedClips.length > 0) {
      return `${error.failedClips.length} clip(s) failed. You can retry just the failed clips or proceed to composition with successful clips.`;
    }
    return 'Check your seed images and try regenerating the videos.';
  }
  
  if (error instanceof ScenePlanningError) {
    return 'Try going back to adjust your mood selection or creative brief.';
  }
  
  if (error instanceof AudioGenerationError) {
    return 'Retry audio generation or continue without background music.';
  }
  
  if (error instanceof CompositionError) {
    return 'Ensure all video clips and audio are generated successfully before composing.';
  }
  
  // Check for retryable errors
  if (isRetryableError(error)) {
    return 'This is a temporary error. Please try again in a moment.';
  }
  
  return null;
}

/**
 * Log error with context for debugging
 */
export function logError(
  error: unknown,
  context: string,
  additionalData?: Record<string, any>
) {
  console.error(`[${context}] Error:`, error);
  if (additionalData) {
    console.error(`[${context}] Additional data:`, additionalData);
  }
  
  // In production, you could send this to an error tracking service
  // like Sentry, LogRocket, etc.
  if (process.env.NODE_ENV === 'production') {
    // TODO: Send to error tracking service
  }
}

/**
 * Enhanced retry function with better logging and error categorization
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
    operationName?: string;
    onRetry?: (attempt: number, error: unknown) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    operationName = 'Operation',
    onRetry,
  } = options;

  let lastError: unknown;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`🔄 ${operationName}: Retry attempt ${attempt}/${maxRetries}`);
      }
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Log the error
      logError(error, operationName, { attempt, maxRetries });

      // Don't retry if error is not retryable
      if (!isRetryableError(error)) {
        console.error(`❌ ${operationName}: Non-retryable error, aborting`);
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        console.error(`❌ ${operationName}: Max retries reached`);
        break;
      }

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, error);
      }

      // Wait before retrying
      console.log(`⏳ ${operationName}: Waiting ${delay}ms before retry...`);
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Increase delay for next retry (exponential backoff)
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw lastError;
}

