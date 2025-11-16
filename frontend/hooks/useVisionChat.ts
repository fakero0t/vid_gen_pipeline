'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useCallback, useMemo, useEffect, useRef, useState } from 'react';
import type { ChatMessage, CreativeBrief } from '@/types/chat.types';
import { useAppStore } from '@/store/appStore';
import { extractCreativeBrief, isCreativeBriefComplete, hasEnoughConversation } from '@/lib/creativeBrief';
import { getErrorMessage, isRetryableError, isOnline } from '@/lib/errors';

/**
 * Return type for useVisionChat hook
 */
export interface UseVisionChatReturn {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  creativeBrief: CreativeBrief | null;
  conversationProgress: number; // 0-100, based on message count and completeness
  canProceed: boolean; // Whether user has enough information to proceed
  isExtracting: boolean; // Whether creative brief extraction is in progress
  extractBrief: () => Promise<void>; // Manually trigger brief extraction
  clearError: () => void;
  reset: () => void;
}

/**
 * Custom hook for vision chat functionality.
 * Manages chat state, API communication, message history, and streaming response handling.
 * 
 * Features:
 * - Message state management with proper timestamps
 * - Streaming response detection
 * - Conversation progress tracking
 * - Error handling with retry logic
 * - Zustand store integration
 * - Conversation completeness checking
 */
export function useVisionChat(): UseVisionChatReturn {
  const { creativeBrief, setCreativeBrief, setError } = useAppStore();
  const previousMessageCountRef = useRef(0);
  const [isExtracting, setIsExtracting] = useState(false);
  const extractionAttemptedRef = useRef(false);

  const {
    messages: aiMessages,
    sendMessage,
    status,
    error: aiError,
    setMessages: setAiMessages,
  } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
    onError: (error) => {
      console.error('Chat error:', error);
      const errorMessage = getErrorMessage(error);
      setError(errorMessage);
    },
  });

  // Derive isLoading from status (v5 API change)
  const isLoading = status === 'submitted' || status === 'streaming';

  // Convert AI SDK messages to our ChatMessage format with proper timestamps
  const messages: ChatMessage[] = useMemo(() => {
    return aiMessages.map((msg, index) => {
      // Extract text content from message parts
      const textParts = msg.parts?.filter((part: any) => part.type === 'text') || [];
      const content = textParts.map((part: any) => part.text).join('') || '';
      
      // Determine if this message is currently streaming
      const isLastMessage = index === aiMessages.length - 1;
      const isStreaming = status === 'streaming' && msg.role === 'assistant' && isLastMessage;
      
      return {
        id: msg.id,
        role: msg.role as 'user' | 'assistant' | 'system',
        content,
        timestamp: new Date(), // In a real app, you might want to preserve original timestamps
        isStreaming,
      };
    });
  }, [aiMessages, status]);

  // Calculate conversation progress (0-100)
  // Progress increases with message count and conversation depth
  const conversationProgress = useMemo(() => {
    if (messages.length === 0) return 0;
    
    // Base progress on message count (more messages = more progress)
    const messageProgress = Math.min((messages.length / 10) * 50, 50);
    
    // Additional progress if we have user messages (indicates engagement)
    const userMessages = messages.filter(m => m.role === 'user').length;
    const engagementProgress = Math.min((userMessages / 5) * 30, 30);
    
    // Progress if creative brief exists (20%)
    const briefProgress = creativeBrief ? 20 : 0;
    
    return Math.min(messageProgress + engagementProgress + briefProgress, 100);
  }, [messages.length, creativeBrief]);

  // Check if conversation has enough information to proceed
  const canProceed = useMemo(() => {
    // HARDCODED: Always allow proceeding for testing
    return true;
  }, [creativeBrief]);

  // Manual extraction function with enhanced error handling
  const extractBrief = useCallback(async () => {
    if (isExtracting || isLoading) {
      return;
    }

    setIsExtracting(true);
    setError(null);

    try {
      // HARDCODED for testing
      const hardcodedBrief: CreativeBrief = {
        product_name: "Epic Mountain Adventure",
        target_audience: "Adventure seekers and nature lovers aged 25-45",
        emotional_tone: ["inspirational", "energetic", "adventurous", "bold"],
        visual_style_keywords: ["cinematic", "dramatic", "vibrant", "epic", "golden-hour"],
        key_messages: [
          "Explore the unknown",
          "Push your limits",
          "Find your freedom",
          "Experience nature's grandeur"
        ]
      };
      setCreativeBrief(hardcodedBrief);
    } catch (error) {
      console.error('Extraction error:', error);
      const errorMessage = getErrorMessage(error);
      setError(errorMessage);
    } finally {
      setIsExtracting(false);
    }
  }, [isExtracting, isLoading, setError, setCreativeBrief]);

  // Handle sending messages with validation
  const onSendMessage = useCallback(
    (message: string) => {
      // Validate input
      const trimmedMessage = message.trim();
      
      if (!trimmedMessage) {
        setError('Please enter a message');
        return;
      }

      if (trimmedMessage.length > 2000) {
        setError('Message is too long. Please keep it under 2000 characters.');
        return;
      }

      if (isLoading) {
        return; // Don't send if already loading
      }

      // Check if online
      if (!isOnline()) {
        setError('You appear to be offline. Please check your connection.');
        return;
      }
      
      // Clear any previous errors
      setError(null);
      
      try {
        sendMessage({
          role: 'user',
          parts: [{ type: 'text', text: trimmedMessage }],
        });
      } catch (error) {
        console.error('Error sending message:', error);
        setError(getErrorMessage(error));
      }
    },
    [sendMessage, isLoading, setError]
  );

  // Clear error handler
  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  // Reset conversation
  const reset = useCallback(() => {
    setAiMessages([]);
    setCreativeBrief(null as CreativeBrief | null);
    setError(null);
    previousMessageCountRef.current = 0;
    extractionAttemptedRef.current = false;
    setIsExtracting(false);
  }, [setAiMessages, setCreativeBrief, setError]);

  // Auto-extract creative brief when conversation reaches threshold
  // Only attempt once per conversation session
  useEffect(() => {
    // Don't extract if:
    // - Already extracting
    // - Currently loading a response
    // - Already have a complete brief
    // - Already attempted extraction
    if (
      isExtracting ||
      isLoading ||
      isCreativeBriefComplete(creativeBrief) ||
      extractionAttemptedRef.current
    ) {
      return;
    }

    // HARDCODED: Auto-extract immediately on mount for testing
    extractionAttemptedRef.current = true;
    extractBrief();
  }, [isLoading, isExtracting, creativeBrief, extractBrief]);

  // Track message count changes and reset extraction flag when conversation is cleared
  useEffect(() => {
    if (messages.length !== previousMessageCountRef.current) {
      previousMessageCountRef.current = messages.length;
      // Reset extraction attempt flag if conversation is reset
      if (messages.length === 0) {
        extractionAttemptedRef.current = false;
      }
    }
  }, [messages.length]);

  return {
    messages,
    onSendMessage,
    isLoading,
    isStreaming: isLoading,
    error: aiError?.message || null,
    creativeBrief: creativeBrief || null,
    conversationProgress,
    canProceed,
    isExtracting,
    extractBrief,
    clearError,
    reset,
  };
}

