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
  const { creativeBrief, setCreativeBrief, setError, chatMessages: storedMessages, setChatMessages } = useAppStore();
  const previousMessageCountRef = useRef(0);
  const [isExtracting, setIsExtracting] = useState(false);
  const extractionAttemptedRef = useRef(false);
  const lastExtractionMessageCountRef = useRef(0);

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

  // Restore stored messages on mount if chat is empty
  const hasRestoredRef = useRef(false);
  useEffect(() => {
    if (!hasRestoredRef.current && storedMessages.length > 0 && aiMessages.length === 0) {
      // Convert stored messages to AI SDK v5 format with parts
      const restoredMessages = storedMessages.map(msg => ({
        id: msg.id,
        role: msg.role,
        parts: [{ type: 'text' as const, text: msg.content }],
      }));
      setAiMessages(restoredMessages);
      hasRestoredRef.current = true;
      
      // If a brief already exists when restoring messages, mark extraction as attempted
      // and set the message count to prevent re-extraction when navigating back
      // This ensures the brief that was used to generate mood boards is preserved
      if (creativeBrief) {
        extractionAttemptedRef.current = true;
        lastExtractionMessageCountRef.current = storedMessages.length;
        previousMessageCountRef.current = storedMessages.length;
      }
    }
  }, [storedMessages, aiMessages.length, setAiMessages, creativeBrief]);

  // Derive isLoading from status (v5 API change)
  const isLoading = status === 'submitted' || status === 'streaming';

  // Convert AI SDK messages to our ChatMessage format with proper timestamps
  // Use a ref to access storedMessages without including it in dependencies
  const storedMessagesRef = useRef(storedMessages);
  storedMessagesRef.current = storedMessages;
  
  const messages: ChatMessage[] = useMemo(() => {
    return aiMessages.map((msg, index) => {
      // Extract text content from message parts
      const textParts = msg.parts?.filter((part: any) => part.type === 'text') || [];
      const content = textParts.map((part: any) => part.text).join('') || '';
      
      // Determine if this message is currently streaming
      const isLastMessage = index === aiMessages.length - 1;
      const isStreaming = status === 'streaming' && msg.role === 'assistant' && isLastMessage;
      
      // Try to find existing message to preserve timestamp (using ref to avoid dependency)
      const existingMessage = storedMessagesRef.current.find(m => m.id === msg.id);
      
      return {
        id: msg.id,
        role: msg.role as 'user' | 'assistant' | 'system',
        content,
        timestamp: existingMessage?.timestamp || new Date(),
        isStreaming,
      };
    });
  }, [aiMessages, status]);

  // Persist messages to store whenever they change (with deep comparison to prevent infinite loops)
  const previousMessagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => {
    // Only update if messages actually changed (deep comparison)
    const messagesChanged = 
      messages.length !== previousMessagesRef.current.length ||
      messages.some((msg, index) => {
        const prev = previousMessagesRef.current[index];
        return !prev || 
          msg.id !== prev.id || 
          msg.content !== prev.content || 
          msg.role !== prev.role;
      });
    
    if (messagesChanged && messages.length > 0) {
      previousMessagesRef.current = messages;
      setChatMessages(messages);
    } else if (messages.length === 0 && previousMessagesRef.current.length > 0) {
      // Clear messages if they were reset
      previousMessagesRef.current = [];
      setChatMessages([]);
    }
  }, [messages, setChatMessages]);

  // Handle case where brief exists but messages haven't been restored yet
  // This can happen when navigating back - brief is restored first, then messages
  // Mark extraction as attempted to prevent re-extraction of existing brief
  useEffect(() => {
    if (creativeBrief && messages.length > 0 && lastExtractionMessageCountRef.current === 0) {
      // Brief exists and we have messages, but extraction count is 0
      // This means we're restoring - mark as attempted to prevent re-extraction
      extractionAttemptedRef.current = true;
      lastExtractionMessageCountRef.current = messages.length;
    }
  }, [creativeBrief, messages.length]);

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
    return creativeBrief ? isCreativeBriefComplete(creativeBrief) : false;
  }, [creativeBrief]);

  // Manual extraction function with enhanced error handling
  const extractBrief = useCallback(async () => {
    if (isExtracting || isLoading) {
      return;
    }

    setIsExtracting(true);
    setError(null);

    try {
      // Call actual API endpoint
      const extractedBrief = await extractCreativeBrief(messages);
      
      if (!extractedBrief) {
        throw new Error('Failed to extract creative brief from conversation');
      }

      setCreativeBrief(extractedBrief);
      // Track when we last extracted based on message count
      lastExtractionMessageCountRef.current = messages.length;
    } catch (error) {
      console.error('Extraction error:', error);
      const errorMessage = getErrorMessage(error);
      setError(errorMessage);
    } finally {
      setIsExtracting(false);
    }
  }, [messages, isExtracting, isLoading, setError, setCreativeBrief]);

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
    setChatMessages([]);
    setCreativeBrief(null as CreativeBrief | null);
    setError(null);
    previousMessageCountRef.current = 0;
    extractionAttemptedRef.current = false;
    lastExtractionMessageCountRef.current = 0;
    hasRestoredRef.current = false;
    setIsExtracting(false);
  }, [setAiMessages, setChatMessages, setCreativeBrief, setError]);

  // Auto-extract creative brief when conversation reaches threshold
  // Also re-extract when new messages are added after a brief exists
  useEffect(() => {
    // Don't extract if:
    // - Already extracting
    // - Currently loading a response
    // - Don't have enough conversation yet
    if (
      isExtracting ||
      isLoading ||
      !hasEnoughConversation(messages)
    ) {
      return;
    }

    // Check if we have new messages since last extraction
    const hasNewMessages = messages.length > lastExtractionMessageCountRef.current;
    
    // If brief exists and we're restoring messages (same count as last extraction),
    // don't re-extract - this is the brief that was used before
    const isRestoringMessages = creativeBrief && 
                                messages.length > 0 && 
                                messages.length === lastExtractionMessageCountRef.current &&
                                !hasNewMessages;
    
    const shouldExtract = 
      // First time extraction: haven't attempted yet or no brief exists
      (!extractionAttemptedRef.current || !creativeBrief) ||
      // Re-extraction: brief exists and we have new messages (user added more conversation)
      (creativeBrief && hasNewMessages && messages.length >= lastExtractionMessageCountRef.current + 2);

    // Don't extract if we're just restoring the same messages that already have a brief
    if (isRestoringMessages) {
      extractionAttemptedRef.current = true;
      return;
    }

    if (shouldExtract) {
      extractionAttemptedRef.current = true;
      extractBrief();
    }
  }, [messages, isLoading, isExtracting, creativeBrief, extractBrief]);

  // Track message count changes and reset extraction flag when conversation is cleared
  useEffect(() => {
    if (messages.length !== previousMessageCountRef.current) {
      previousMessageCountRef.current = messages.length;
      // Reset extraction attempt flag and message count if conversation is reset
      if (messages.length === 0) {
        extractionAttemptedRef.current = false;
        lastExtractionMessageCountRef.current = 0;
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

