import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import type { ChatMessage, CreativeBrief } from '@/types/chat.types';

// Allow extraction to take up to 30 seconds
export const maxDuration = 30;

/**
 * Zod schema for creative brief validation
 */
const CreativeBriefSchema = z.object({
  product_name: z.string().min(1, 'Product name is required'),
  target_audience: z.string().min(1, 'Target audience is required'),
  emotional_tone: z.array(z.string()).min(1, 'At least one emotional tone is required'),
  visual_style_keywords: z.array(z.string()).min(1, 'At least one visual style keyword is required'),
  key_messages: z.array(z.string()).min(1, 'At least one key message is required'),
});

/**
 * API endpoint for extracting creative brief from conversation history.
 * Uses OpenAI GPT-4o with structured output to extract required fields.
 */
export async function POST(req: Request) {
  try {
    // Validate OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      );
    }

    // Parse request body
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
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Convert messages to a readable conversation format for the AI
    const conversationText = messages
      .map((msg: ChatMessage) => {
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        return `${role}: ${msg.content}`;
      })
      .join('\n\n');

    // System prompt for extraction
    const extractionPrompt = `You are a creative strategist analyzing a conversation to extract a structured creative brief.

Analyze the conversation below and extract the following information:

1. **Product Name**: The name of the product, service, or brand mentioned
2. **Target Audience**: A clear description of who the video is for (demographics, psychographics, lifestyle)
3. **Emotional Tone**: 3-5 adjectives describing the feeling the video should evoke
4. **Visual Style Keywords**: 4-6 descriptors for visual style (aesthetic, colors, composition)
5. **Key Messages**: 2-4 main selling points or value propositions

**Conversation:**
${conversationText}

**Instructions:**
- Extract information that was explicitly mentioned or clearly implied
- If information is missing, use reasonable defaults based on context
- For arrays (emotional_tone, visual_style_keywords, key_messages), provide multiple items when possible
- Be specific and detailed, not generic
- If product name is not mentioned, use "Unnamed Product" as default
- If target audience is vague, infer from context (e.g., if luxury product, assume "affluent consumers")
- For emotional tone, think about adjectives like: energetic, calm, luxurious, playful, trustworthy, inspiring, bold, sophisticated, modern, etc.
- For visual style, think about: minimalist, bold, natural, futuristic, vintage, clean, vibrant, geometric, organic, etc.

Extract the information and return it in the structured format.`;

    // Use generateObject to get structured output
    const { object: extractedBrief } = await generateObject({
      model: openai('gpt-4o'),
      schema: CreativeBriefSchema,
      prompt: extractionPrompt,
      temperature: 0.3, // Lower temperature for more consistent extraction
    });

    // Validate the extracted brief
    const validationResult = CreativeBriefSchema.safeParse(extractedBrief);
    
    if (!validationResult.success) {
      console.error('Extraction validation failed:', validationResult.error);
      return NextResponse.json(
        { 
          error: 'Failed to extract valid creative brief',
          details: validationResult.error.issues 
        },
        { status: 500 }
      );
    }

    // Create the final creative brief with conversation history
    const creativeBrief: CreativeBrief = {
      ...validationResult.data,
      conversation_history: messages,
    };

    return NextResponse.json({ creativeBrief });
  } catch (error) {
    console.error('Creative brief extraction error:', error);

    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'Invalid OpenAI API key' },
          { status: 401 }
        );
      }

      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again later.' },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { error: 'An error occurred while extracting the creative brief' },
      { status: 500 }
    );
  }
}

