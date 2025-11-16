/**
 * Comprehensive logging system for debugging and error tracking
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  data?: any;
  error?: Error;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // Keep last 1000 logs
  private isDevelopment = process.env.NODE_ENV === 'development';

  /**
   * Log a debug message (only in development)
   */
  debug(context: string, message: string, data?: any) {
    if (this.isDevelopment) {
      this.log('debug', context, message, data);
      console.log(`🔍 [${context}] ${message}`, data || '');
    }
  }

  /**
   * Log an info message
   */
  info(context: string, message: string, data?: any) {
    this.log('info', context, message, data);
    console.log(`ℹ️  [${context}] ${message}`, data || '');
  }

  /**
   * Log a warning
   */
  warn(context: string, message: string, data?: any) {
    this.log('warn', context, message, data);
    console.warn(`⚠️  [${context}] ${message}`, data || '');
  }

  /**
   * Log an error
   */
  error(context: string, message: string, error?: Error | unknown, data?: any) {
    const errorObj = error instanceof Error ? error : undefined;
    this.log('error', context, message, data, errorObj);
    console.error(`❌ [${context}] ${message}`, error, data || '');
    
    // In production, send to error tracking service
    if (!this.isDevelopment) {
      this.reportToErrorTracking(context, message, errorObj, data);
    }
  }

  /**
   * Log operation start
   */
  startOperation(context: string, operation: string, data?: any) {
    this.info(context, `Starting: ${operation}`, data);
  }

  /**
   * Log operation success
   */
  successOperation(context: string, operation: string, duration?: number, data?: any) {
    const durationText = duration ? ` (${duration}ms)` : '';
    this.info(context, `✅ Success: ${operation}${durationText}`, data);
  }

  /**
   * Log operation failure
   */
  failOperation(context: string, operation: string, error: Error | unknown, data?: any) {
    this.error(context, `❌ Failed: ${operation}`, error, data);
  }

  /**
   * Log with retry information
   */
  retryOperation(context: string, operation: string, attempt: number, maxAttempts: number, error?: Error | unknown) {
    this.warn(context, `Retry ${attempt}/${maxAttempts}: ${operation}`, error);
  }

  /**
   * Log API request
   */
  apiRequest(endpoint: string, method: string, data?: any) {
    this.debug('API', `${method} ${endpoint}`, data);
  }

  /**
   * Log API response
   */
  apiResponse(endpoint: string, status: number, duration?: number, data?: any) {
    const level = status >= 400 ? 'error' : 'debug';
    const durationText = duration ? ` (${duration}ms)` : '';
    this[level]('API', `${status} ${endpoint}${durationText}`, data);
  }

  /**
   * Log state change
   */
  stateChange(context: string, stateName: string, oldValue: any, newValue: any) {
    this.debug(context, `State change: ${stateName}`, { old: oldValue, new: newValue });
  }

  /**
   * Log user action
   */
  userAction(context: string, action: string, data?: any) {
    this.info(context, `User action: ${action}`, data);
  }

  /**
   * Get all logs
   */
  getLogs(filter?: { level?: LogLevel; context?: string; limit?: number }): LogEntry[] {
    let filtered = [...this.logs];

    if (filter?.level) {
      filtered = filtered.filter((log) => log.level === filter.level);
    }

    if (filter?.context) {
      filtered = filtered.filter((log) => log.context === filter.context);
    }

    if (filter?.limit) {
      filtered = filtered.slice(-filter.limit);
    }

    return filtered;
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.logs = [];
  }

  /**
   * Internal log method
   */
  private log(
    level: LogLevel,
    context: string,
    message: string,
    data?: any,
    error?: Error
  ) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      ...(data && { data }),
      ...(error && { error }),
    };

    this.logs.push(entry);

    // Trim logs if exceeding max
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  /**
   * Report error to tracking service (placeholder for production)
   */
  private reportToErrorTracking(
    context: string,
    message: string,
    error?: Error,
    data?: any
  ) {
    // TODO: Implement integration with error tracking service
    // e.g., Sentry, LogRocket, DataDog, etc.
    
    // Example:
    // Sentry.captureException(error, {
    //   tags: { context },
    //   extra: { message, data },
    // });
  }
}

// Export singleton instance
export const logger = new Logger();

/**
 * Pipeline-specific logging helpers
 */
export const pipelineLogger = {
  visionChat: {
    start: (data?: any) => logger.startOperation('VisionChat', 'Chat message', data),
    success: (duration?: number) => logger.successOperation('VisionChat', 'Chat message', duration),
    error: (error: unknown) => logger.failOperation('VisionChat', 'Chat message', error),
    extract: () => logger.info('VisionChat', 'Extracting creative brief'),
    extractSuccess: () => logger.successOperation('VisionChat', 'Extract creative brief'),
    extractError: (error: unknown) => logger.failOperation('VisionChat', 'Extract creative brief', error),
  },

  moods: {
    start: (count: number) => logger.startOperation('Moods', `Generate ${count} mood boards`),
    success: (count: number, duration?: number) =>
      logger.successOperation('Moods', `Generated ${count} mood boards`, duration),
    partial: (success: number, failed: number) =>
      logger.warn('Moods', `Partial success: ${success} succeeded, ${failed} failed`),
    error: (error: unknown) => logger.failOperation('Moods', 'Generate mood boards', error),
    imageStart: (index: number) => logger.debug('Moods', `Generating mood image ${index}`),
    imageSuccess: (index: number) => logger.debug('Moods', `✅ Mood image ${index} generated`),
    imageError: (index: number, error: unknown) =>
      logger.error('Moods', `❌ Mood image ${index} failed`, error),
    select: (moodId: string) => logger.userAction('Moods', 'Select mood', { moodId }),
  },

  scenes: {
    planStart: () => logger.startOperation('Scenes', 'Plan scenes'),
    planSuccess: (count: number, duration?: number) =>
      logger.successOperation('Scenes', `Planned ${count} scenes`, duration),
    planError: (error: unknown) => logger.failOperation('Scenes', 'Plan scenes', error),
    seedStart: (count: number) => logger.startOperation('Scenes', `Generate ${count} seed images`),
    seedSuccess: (count: number, duration?: number) =>
      logger.successOperation('Scenes', `Generated ${count} seed images`, duration),
    seedPartial: (success: number, failed: number) =>
      logger.warn('Scenes', `Partial success: ${success} succeeded, ${failed} failed`),
    seedError: (error: unknown) => logger.failOperation('Scenes', 'Generate seed images', error),
    imageStart: (sceneNum: number) => logger.debug('Scenes', `Generating seed image for scene ${sceneNum}`),
    imageSuccess: (sceneNum: number) => logger.debug('Scenes', `✅ Seed image ${sceneNum} generated`),
    imageError: (sceneNum: number, error: unknown) =>
      logger.error('Scenes', `❌ Seed image ${sceneNum} failed`, error),
  },

  video: {
    start: (count: number) => logger.startOperation('Video', `Generate ${count} video clips`),
    progress: (progress: number, completed: number, total: number) =>
      logger.debug('Video', `Progress: ${progress}% (${completed}/${total} clips)`),
    clipProgress: (sceneNum: number, progress: number) =>
      logger.debug('Video', `Clip ${sceneNum}: ${progress}%`),
    clipSuccess: (sceneNum: number) => logger.debug('Video', `✅ Clip ${sceneNum} completed`),
    clipError: (sceneNum: number, error: unknown) =>
      logger.error('Video', `❌ Clip ${sceneNum} failed`, error),
    success: (count: number, duration?: number) =>
      logger.successOperation('Video', `Generated ${count} clips`, duration),
    partial: (success: number, failed: number) =>
      logger.warn('Video', `Partial success: ${success} succeeded, ${failed} failed`),
    error: (error: unknown) => logger.failOperation('Video', 'Generate videos', error),
    retry: (clipNumbers: number[]) =>
      logger.info('Video', `Retrying failed clips: ${clipNumbers.join(', ')}`),
  },

  audio: {
    start: () => logger.startOperation('Audio', 'Generate background music'),
    success: (duration?: number) => logger.successOperation('Audio', 'Generate background music', duration),
    error: (error: unknown) => logger.failOperation('Audio', 'Generate background music', error),
    retry: (attempt: number) => logger.retryOperation('Audio', 'Generate background music', attempt, 3),
  },

  composition: {
    start: () => logger.startOperation('Composition', 'Compose final video'),
    success: (duration?: number) => logger.successOperation('Composition', 'Compose final video', duration),
    error: (error: unknown) => logger.failOperation('Composition', 'Compose final video', error),
    validate: () => logger.debug('Composition', 'Validating clips and audio'),
    validateError: (message: string) => logger.error('Composition', 'Validation failed', new Error(message)),
  },
};

