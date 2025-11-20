/**
 * Step definitions for the video generation pipeline.
 * Using string-based steps allows easy insertion of new steps without breaking numbering.
 */

export const STEPS = {
  CHAT: 'chat',
  MOOD: 'mood',
  SCENES: 'scenes',
  FINAL: 'final',
} as const;

export type StepName = typeof STEPS[keyof typeof STEPS];

/**
 * Step order for navigation and progress tracking
 */
export const STEP_ORDER: StepName[] = [
  STEPS.CHAT,
  STEPS.MOOD,
  STEPS.SCENES,
  STEPS.FINAL,
];

/**
 * Step display labels for UI
 */
export const STEP_LABELS: Record<StepName, string> = {
  [STEPS.CHAT]: 'Vision & Brief',
  [STEPS.MOOD]: 'Mood Selection',
  [STEPS.SCENES]: 'Storyboard',
  [STEPS.FINAL]: 'Final Composition',
};

/**
 * Get step index (0-based) for ordering
 */
export function getStepIndex(step: StepName): number {
  return STEP_ORDER.indexOf(step);
}

/**
 * Check if step1 comes before step2
 */
export function isStepBefore(step1: StepName, step2: StepName): boolean {
  return getStepIndex(step1) < getStepIndex(step2);
}

/**
 * Get next step in order
 */
export function getNextStep(step: StepName): StepName | null {
  const index = getStepIndex(step);
  return index < STEP_ORDER.length - 1 ? STEP_ORDER[index + 1] : null;
}

/**
 * Get previous step in order
 */
export function getPreviousStep(step: StepName): StepName | null {
  const index = getStepIndex(step);
  return index > 0 ? STEP_ORDER[index - 1] : null;
}

/**
 * Migration helper for existing projects with numeric steps
 */
export function migrateNumericStep(step: number | string): StepName {
  if (typeof step === 'string') return step as StepName;
  
  const stepMap: Record<number, StepName> = {
    1: STEPS.CHAT,
    2: STEPS.MOOD,      // Old "product upload" -> mood
    3: STEPS.MOOD,
    4: STEPS.SCENES,
    5: STEPS.FINAL,     // Old "video generation" -> final
    6: STEPS.FINAL,
  };
  
  return stepMap[step] || STEPS.CHAT;
}

