import { openai } from '@ai-sdk/openai';
import { streamText, type UIMessage, convertToModelMessages } from 'ai';
import { NextResponse } from 'next/server';
import { CREATIVE_BRIEF_SYSTEM_PROMPT } from './prompts';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

/**
 * Chat API route for vision refinement and creative brief generation.
 * Handles streaming chat requests using Vercel AI SDK with OpenAI GPT-4o.
 */
export async function POST(req: Request) {
  try {
    // Validate OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is not configured');
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      );
    }

    // Parse and validate request body
    let body;
    try {
      body = await req.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { messages } = body;

    // Validate messages array
    if (!Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages must be an array' },
        { status: 400 }
      );
    }

    if (messages.length === 0) {
      return NextResponse.json(
        { error: 'At least one message is required' },
        { status: 400 }
      );
    }

    // Validate message structure (v5 format with parts)
    for (const message of messages) {
      if (!message.role) {
        return NextResponse.json(
          { error: 'Each message must have a role' },
          { status: 400 }
        );
      }
      if (!['user', 'assistant', 'system'].includes(message.role)) {
        return NextResponse.json(
          { error: 'Message role must be user, assistant, or system' },
          { status: 400 }
        );
      }
      // v5 uses parts array, but we'll handle both formats for compatibility
      if (!message.parts && !message.content) {
        return NextResponse.json(
          { error: 'Each message must have parts or content' },
          { status: 400 }
        );
      }
    }

    // Stream text response using OpenAI GPT-4o with enhanced prompt engineering
    const result = streamText({
      model: openai('gpt-4o'),
      system: CREATIVE_BRIEF_SYSTEM_PROMPT,
      messages: convertToModelMessages(messages as UIMessage[]),
      temperature: 0.8, // Slightly higher for more natural, conversational responses
    });

    // Return streaming response
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);

    // Handle specific error types
    if (error instanceof Error) {
      // Check for OpenAI API errors
      if (error.message.includes('API key') || error.message.includes('authentication')) {
        return NextResponse.json(
          { error: 'Invalid OpenAI API key. Please check your configuration.' },
          { status: 401 }
        );
      }

      if (error.message.includes('rate limit') || error.message.includes('quota')) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please wait a moment and try again.' },
          { status: 429 }
        );
      }

      if (error.message.includes('timeout') || error.message.includes('timed out')) {
        return NextResponse.json(
          { error: 'Request timeout. The server took too long to respond. Please try again.' },
          { status: 504 }
        );
      }

      if (error.message.includes('network') || error.message.includes('fetch')) {
        return NextResponse.json(
          { error: 'Network error. Please check your connection and try again.' },
          { status: 503 }
        );
      }
    }

    // Generic error response
    return NextResponse.json(
      { error: 'An unexpected error occurred while processing your request. Please try again.' },
      { status: 500 }
    );
  }
}
