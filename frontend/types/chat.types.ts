/**
 * TypeScript types for the vision chat interface and creative brief system.
 */

/**
 * Represents a single message in the chat conversation.
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isStreaming?: boolean; // Indicates if this message is currently being streamed
}

/**
 * Creative brief structure extracted from conversation.
 */
export interface CreativeBrief {
  product_name: string;
  target_audience: string;
  emotional_tone: string[];
  visual_style_keywords: string[];
  key_messages: string[];
  conversation_history?: ChatMessage[];
}

/**
 * Props for ChatInterface component.
 */
export interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  isStreaming?: boolean;
  error?: string | null;
  className?: string;
}

/**
 * Props for VisionPrompt component (input field).
 */
export interface VisionPromptProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  isLoading?: boolean;
  className?: string;
}

/**
 * Props for CreativeBriefSummary component.
 */
export interface CreativeBriefSummaryProps {
  brief: CreativeBrief | null;
  onEdit?: () => void;
  onContinue?: () => void;
  className?: string;
}

/**
 * Chat state for managing conversation flow.
 */
export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  creativeBrief: CreativeBrief | null;
}

