/**
 * Utility to build music generation prompts from structured fields.
 * Mirrors the backend's build_music_prompt logic.
 */

export interface PromptBuilderInputs {
  mood_name: string;
  mood_description: string;
  emotional_tone: string[];
  aesthetic_direction: string;
  style_keywords?: string[];
}

/**
 * Build a detailed music generation prompt from mood and creative brief data.
 * 
 * @param inputs - Structured fields for prompt generation
 * @returns Formatted prompt string for music generation
 */
export function buildMusicPrompt(inputs: PromptBuilderInputs): string {
  const {
    mood_name,
    mood_description,
    emotional_tone,
    aesthetic_direction,
    style_keywords = [],
  } = inputs;

  // Build prompt components for instrumental background music
  const components: string[] = [];

  // Start with the mood and emotional tone
  components.push(`${mood_name} instrumental background music`);

  // Add emotional characteristics
  if (emotional_tone && emotional_tone.length > 0) {
    const toneStr = emotional_tone.slice(0, 3).join(', '); // Limit to top 3 tones
    components.push(`emotional tone: ${toneStr}`);
  }

  // Add mood-specific characteristics
  // Extract key adjectives from mood description
  const moodKeywords = mood_description.toLowerCase().split('.').slice(0, 2); // First 2 sentences
  if (moodKeywords.length > 0 && moodKeywords[0].trim()) {
    components.push(`style: ${moodKeywords.join(' ')}`);
  }

  // Add aesthetic direction
  if (aesthetic_direction) {
    components.push(`aesthetic: ${aesthetic_direction}`);
  }

  // Add musical characteristics based on style keywords
  if (style_keywords && style_keywords.length > 0) {
    // Map visual styles to musical characteristics
    const styleMappings: Record<string, string> = {
      modern: 'electronic, contemporary',
      vintage: 'retro, analog',
      minimalist: 'simple, clean melody',
      bold: 'powerful, dynamic',
      elegant: 'sophisticated, smooth',
      energetic: 'upbeat, fast tempo',
      calm: 'peaceful, slow tempo',
      cinematic: 'orchestral, atmospheric',
    };

    const musicalStyles: string[] = [];
    for (const keyword of style_keywords.slice(0, 3)) {
      // Limit to 3 keywords
      const keywordLower = keyword.toLowerCase();
      for (const [style, music] of Object.entries(styleMappings)) {
        if (keywordLower.includes(style)) {
          musicalStyles.push(music);
          break;
        }
      }
    }

    if (musicalStyles.length > 0) {
      components.push(`musical style: ${musicalStyles.join(', ')}`);
    }
  }

  // Specify instrumental and background characteristics
  components.push('no vocals, instrumental only');
  components.push('suitable for video background');
  components.push('consistent volume and energy');

  // Join all components
  let prompt = components.join(', ');

  // Ensure prompt isn't too long
  if (prompt.length > 500) {
    prompt = prompt.slice(0, 497) + '...';
  }

  return prompt;
}

