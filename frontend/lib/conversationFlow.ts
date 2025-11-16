/**
 * Conversation flow utilities for tracking and guiding creative brief extraction.
 */

import type { ChatMessage, CreativeBrief } from '@/types/chat.types';
import { getFollowUpPrompt } from '@/app/api/chat/prompts';

/**
 * Analyze conversation to determine which creative brief fields are likely missing
 * This is a heuristic analysis - actual extraction happens via AI
 */
export function analyzeMissingFields(messages: ChatMessage[]): string[] {
  const conversationText = messages
    .map(m => m.content.toLowerCase())
    .join(' ');

  const missing: string[] = [];

  // Check for product name indicators
  const productNameIndicators = [
    /(?:product|brand|service|company) (?:name|called|named|is|are)/i,
    /(?:called|named|branded) ["']([^"']+)["']/i,
  ];
  if (!productNameIndicators.some(pattern => pattern.test(conversationText))) {
    missing.push('product_name');
  }

  // Check for target audience indicators
  const audienceIndicators = [
    /(?:target|audience|customer|consumer|user|buyer|for|aimed at)/i,
    /(?:millennials|gen z|gen x|boomers|professionals|students)/i,
  ];
  if (!audienceIndicators.some(pattern => pattern.test(conversationText))) {
    missing.push('target_audience');
  }

  // Check for emotional tone indicators
  const toneIndicators = [
    /(?:feel|feeling|emotion|tone|mood|vibe|atmosphere)/i,
    /(?:energetic|calm|luxurious|playful|trustworthy|inspiring|bold|sophisticated)/i,
  ];
  if (!toneIndicators.some(pattern => pattern.test(conversationText))) {
    missing.push('emotional_tone');
  }

  // Check for visual style indicators
  const styleIndicators = [
    /(?:visual|style|aesthetic|look|design|color|palette)/i,
    /(?:minimalist|bold|natural|futuristic|vintage|modern|clean)/i,
  ];
  if (!styleIndicators.some(pattern => pattern.test(conversationText))) {
    missing.push('visual_style_keywords');
  }

  // Check for key messages indicators
  const messageIndicators = [
    /(?:message|selling point|value proposition|key|main|important)/i,
    /(?:quality|premium|fast|sustainable|proven|recommended)/i,
  ];
  if (!messageIndicators.some(pattern => pattern.test(conversationText))) {
    missing.push('key_messages');
  }

  return missing;
}

/**
 * Get suggested follow-up question based on missing fields
 */
export function getSuggestedFollowUp(messages: ChatMessage[]): string | null {
  const missing = analyzeMissingFields(messages);
  if (missing.length === 0) {
    return null;
  }
  return getFollowUpPrompt(missing);
}

/**
 * Estimate conversation completeness (0-100)
 * Based on message count and field coverage
 */
export function estimateCompleteness(
  messages: ChatMessage[],
  brief: CreativeBrief | null
): number {
  if (brief) {
    // If brief exists, check its completeness
    const fields = [
      brief.product_name,
      brief.target_audience,
      brief.emotional_tone.length,
      brief.visual_style_keywords.length,
      brief.key_messages.length,
    ];
    const completeFields = fields.filter(f => 
      typeof f === 'string' ? f.length > 0 : f > 0
    ).length;
    return (completeFields / 5) * 100;
  }

  // Otherwise, estimate based on conversation analysis
  const missing = analyzeMissingFields(messages);
  const coveredFields = 5 - missing.length;
  const baseScore = (coveredFields / 5) * 70; // Max 70% without extraction

  // Add bonus for message count (indicates engagement)
  const messageBonus = Math.min((messages.length / 10) * 30, 30);

  return Math.min(baseScore + messageBonus, 100);
}

