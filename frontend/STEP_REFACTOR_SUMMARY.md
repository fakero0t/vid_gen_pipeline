# Step System Refactor Summary

## Overview
Refactored from numeric step system (1-6) to string-based step system with 4 actual steps in the flow.

## New Step System

### Steps Definition (`frontend/lib/steps.ts`)
```typescript
export const STEPS = {
  CHAT: 'chat',
  MOOD: 'mood',
  SCENES: 'scenes',
  FINAL: 'final',
} as const;
```

### Step Flow
1. **Chat** - Vision & Creative Brief (`/project/[id]/chat`)
2. **Mood** - Mood Selection (`/project/[id]/mood`)
3. **Scenes** - Storyboard with inline video generation (`/project/[id]/scenes`)
4. **Final** - Final Composition (`/project/[id]/final`)

## Changes Made

### 1. Created `frontend/lib/steps.ts`
- Defined STEPS constants (chat, mood, scenes, final)
- STEP_ORDER array for navigation/progress tracking
- STEP_LABELS for UI display
- Helper functions: `getStepIndex`, `isStepBefore`, `getNextStep`, `getPreviousStep`
- Migration function `migrateNumericStep` for backward compatibility

### 2. Updated Types (`frontend/types/project.types.ts`)
- Changed `currentStep` from `1 | 2 | 3 | 4 | 5 | 6` to `StepName`
- Removed unused fields from `AppStateSnapshot`:
  - `uploadedProduct`, `colmap`, `nerfTraining`, `rendering`
  - `scenePlan`, `videoJobId`, `generatedClips`
- Kept only: `currentStep`, `creativeBrief`, `moods`, `selectedMoodId`, `storyboardCompleted`, `audioUrl`, `compositionJobId`, `finalVideo`

### 3. Simplified App Store (`frontend/store/appStore.ts`)
- Removed NeRF/Product Upload related state
- Removed separate Video Generation state
- Streamlined to 4-step workflow
- Changed `currentStep` to `StepName` type
- Initial step is now `STEPS.CHAT` instead of `1`

### 4. Updated Project Store (`frontend/store/projectStore.ts`)
- Added migration logic in `restoreAppState` to convert old numeric steps
- Imports `migrateNumericStep` helper
- Backward compatible with existing projects

### 5. Refactored StepIndicator (`frontend/components/ui/StepIndicator.tsx`)
- Uses `STEP_ORDER` and `STEP_LABELS` from steps.ts
- Dynamic step rendering based on array length
- Uses helper functions for step comparison
- Still shows numbers in UI (1-4) but tracks by name internally

### 6. Updated Projects Page (`frontend/app/projects/page.tsx`)
- Imports `STEP_LABELS` instead of local constant
- Displays correct step label for each project

### 7. Updated Navigation in All Project Pages
- **chat/page.tsx**: `setCurrentStep(STEPS.MOOD)`
- **mood/page.tsx**: `setCurrentStep(STEPS.SCENES)` / `setCurrentStep(STEPS.CHAT)`
- **scenes/page.tsx**: `setCurrentStep(STEPS.FINAL)`
- **final/page.tsx**: `setCurrentStep(STEPS.SCENES)`

### 8. Cleanup
- Deleted `/app/storyboard/page.tsx` (duplicate of scenes page)
- Removed empty `/app/project/[projectId]/` directory

## Benefits

1. **Extensible**: Easy to add new steps without renumbering
2. **Clear**: Step names are self-documenting
3. **Maintainable**: Single source of truth in `steps.ts`
4. **Backward Compatible**: Migration function handles old numeric steps
5. **Type Safe**: TypeScript ensures correct step names
6. **Simplified**: Removed unused Product Upload and separate Video Generation steps

## Migration

Existing projects with numeric steps (1-6) are automatically migrated:
- 1, 2, 3 → 'chat', 'mood', 'scenes' (as appropriate)
- 4 → 'scenes'
- 5, 6 → 'final'

The migration happens automatically when loading a project via `restoreAppState` in projectStore.

## Adding New Steps

To add a new step in the future:

1. Add to `STEPS` constant in `steps.ts`
2. Add to `STEP_ORDER` array at the desired position
3. Add label to `STEP_LABELS`
4. Update navigation calls in adjacent pages
5. No need to update type definitions (uses string type)

