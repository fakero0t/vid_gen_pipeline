# Scene Management Feature Implementation

## Overview

Add functionality to add, remove, and reorder scenes in the storyboard view with drag-and-drop support. Enforce minimum 3 and maximum 20 scenes. New scenes are auto-generated with AI text and added to the end. Scene removal requires confirmation. Drag-and-drop works by dragging scene number buttons directly.

## Current State

- Storyboards initialize with 6 scenes (hardcoded in `backend/app/services/storyboard_service.py:179`)
- Backend validation: `min_length=5, max_length=7` (needs update to `min_length=3, max_length=20`)
- No API endpoints exist for scene management operations
- Frontend displays scenes via `storyboard.scene_order` array
- No drag-and-drop library currently installed
- `StoryboardCarousel` uses local `currentSceneIndex` state that can become invalid when scenes change
- `total_duration` field exists but isn't recalculated when scenes change

## Key Requirements

- **Scene Limits**: Minimum 3, maximum 20 scenes
- **Add Scene**: Auto-generate AI text using creative brief and mood, add to end
- **Remove Scene**: Always show confirmation dialog with scene details (number, generated content, content loss warning)
- **Drag-and-Drop**: Drag scene number buttons directly to reorder (disabled while any scene is generating)
- **Current Scene Tracking**: Carousel stays on the same scene when scenes are removed/reordered (track by scene ID, adjust index if needed)
- **Total Duration**: Recalculate as sum of all scene durations when scenes are added/removed
- **Loading States**: Show loading indicator on new scene in timeline, show placeholder scene card with "Generating...", disable add/remove operations while generating
- **Error Handling**: Show error toast and revert UI on failure
- **Preview Mode**: Changes reflected immediately when scenes are added/removed/reordered
- **Optimistic Updates**: Drag-and-drop works immediately with optimistic updates (disabled during generation)

### Backend Changes

#### 1. Update Storyboard Model Validation

- **File**: `backend/app/models/storyboard_models.py`
- Update `scene_order` field validation from `min_length=5, max_length=7` to `min_length=3, max_length=20` (line 87)

#### 2. Create Scene Management API Endpoints

- **File**: `backend/app/routers/storyboards.py`
- Add three new endpoints:
- `POST /api/storyboards/{storyboard_id}/scenes` - Add a new scene
  - Request body: `{ "position": int }` (optional, defaults to end)
  - Auto-generate new scene text using AI (similar to regenerate_scene_text, using storyboard's creative_brief and selected_mood)
  - Insert scene into scene_order at specified position (default: end)
  - Recalculate total_duration as sum of all scene durations
  - Return updated storyboard and scenes
- `DELETE /api/storyboards/{storyboard_id}/scenes/{scene_id}` - Remove a scene
  - Validate minimum 3 scenes before deletion (return error if at minimum)
  - Remove scene from database and scene_order
  - Recalculate total_duration as sum of remaining scene durations
  - Return updated storyboard and scenes
- `PUT /api/storyboards/{storyboard_id}/scenes/reorder` - Reorder scenes
  - Request body: `{ "scene_order": string[] }`
  - Validate all scene IDs exist and belong to storyboard
  - Update storyboard.scene_order
  - Return updated storyboard and scenes

#### 3. Add Storyboard Service Methods

- **File**: `backend/app/services/storyboard_service.py`
- Add methods:
- `add_scene()` - Generate new scene with AI text and insert into storyboard
  - Use storyboard's creative_brief and selected_mood for generation
  - Insert at specified position (default: end)
  - Recalculate total_duration
- `remove_scene()` - Delete scene and update scene_order
  - Validate minimum 3 scenes before deletion
  - Recalculate total_duration
- `reorder_scenes()` - Update scene_order array
  - Validate all scene IDs exist and belong to storyboard
- Update `initialize_storyboard()` to use configurable num_scenes (default 6, but allow override)
- Add helper method `_recalculate_total_duration()` to sum all scene durations

#### 4. Update Database Methods (if needed)

- **File**: `backend/app/database.py`
- Ensure `update_storyboard()` properly handles scene_order updates (already exists)

### Frontend Changes

#### 5. Install Drag-and-Drop Library

- **File**: `frontend/package.json`
- Install `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (lightweight, accessible)

#### 6. Create API Client Functions

- **File**: `frontend/lib/api/storyboard.ts`
- Add functions:
- `addScene(storyboardId, position?)` - Call POST endpoint
- `removeScene(storyboardId, sceneId)` - Call DELETE endpoint
- `reorderScenes(storyboardId, sceneOrder)` - Call PUT endpoint

#### 7. Update Scene Store

- **File**: `frontend/store/sceneStore.ts`
- Add actions:
- `addScene(position?)` - Add scene at position (default: end)
  - Optimistically update UI
  - Call API, show loading state
  - On success: update state with new scene
  - On error: show toast, revert optimistic update
- `removeScene(sceneId)` - Remove scene (validate min 3)
  - Optimistically update UI
  - Call API
  - On success: update state, adjust currentSceneIndex if needed
  - On error: show toast, revert optimistic update
- `reorderScenes(newOrder)` - Update scene_order
  - Optimistically update UI (only if no scenes are generating)
  - Call API
  - On success: update state, adjust currentSceneIndex if needed
  - On error: show toast, revert optimistic update
- Add helper: `isAnySceneGenerating()` - Check if any scene has generation_status.image === 'generating' or generation_status.video === 'generating'
- Update `currentSceneIndex` handling: Track by scene ID, adjust index when scenes change

#### 8. Enhance SceneTimelineNew Component

- **File**: `frontend/components/storyboard/SceneTimelineNew.tsx`
- Add drag-and-drop functionality using @dnd-kit
  - Make scene number buttons draggable directly (no separate handle)
  - Disable drag-and-drop while any scene is generating (check via prop)
  - Add visual indicators for drag state (opacity, border highlight, drop zones)
  - Show loading indicator on new scenes during generation
- Add "+" button at end of timeline to add scenes
  - Disabled at max 20 scenes (show tooltip explaining limit)
  - Disabled while any scene is generating
- Add delete button/icon on each scene button
  - Show on hover or always visible (small X icon)
  - Disabled at min 3 scenes (show tooltip explaining limit)
  - Disabled while any scene is generating
- Show confirmation dialog before removing scenes
  - Display scene number/position
  - Show whether scene has generated images/videos
  - Warning about losing content
- Handle drag end to call reorder API (only if not generating)
- Update props to accept:
  - `onAddScene` - Callback to add scene
  - `onRemoveScene` - Callback to remove scene (opens confirmation dialog)
  - `onReorderScenes` - Callback to reorder scenes
  - `isGenerating` - Boolean indicating if any scene is generating
  - `scenes` - Full scenes array for checking generation status

#### 9. Update StoryboardCarousel Component

- **File**: `frontend/components/storyboard/StoryboardCarousel.tsx`
- Update current scene tracking:
  - Track current scene by ID instead of just index
  - When scenes change, find current scene ID in new scene_order and update index
  - If current scene is deleted, stay on same position (scene 5 becomes scene 4)
- Pass new handlers to SceneTimelineNew:
  - `onAddScene` - Calls store action, handles loading state
  - `onRemoveScene` - Calls store action (confirmation handled in timeline)
  - `onReorderScenes` - Calls store action
  - `isGenerating` - Check if any scene is generating
- Handle scene count changes in carousel navigation
- Show placeholder scene card with "Generating..." for new scenes being added

#### 10. Update Storyboard Service Default

- **File**: `backend/app/services/storyboard_service.py`
- Consider making default scene count configurable (keep 6 for backward compatibility)

## Key Considerations

- **Validation**: Enforce min 3 / max 20 scenes at both backend and frontend
- **Error Handling**: Show error toast and revert UI on failure (rollback optimistic updates)
- **Loading States**: 
  - Show loading indicator on new scene in timeline
  - Show placeholder scene card with "Generating..." text
  - Disable add/remove operations while any scene is generating
- **Optimistic Updates**: 
  - Drag-and-drop works immediately with optimistic updates
  - Disabled while any scene is generating
  - Rollback on error with toast notification
- **Scene Generation**: New scenes are auto-generated with AI text immediately using storyboard's creative brief and mood (same as regenerate_scene_text logic)
- **Confirmation Dialogs**: Always show confirmation dialog when removing scenes with:
  - Scene number/position
  - Whether scene has generated images/videos
  - Warning about losing content
- **Current Scene Tracking**: 
  - Carousel stays on same scene when scenes are removed/reordered
  - Track by scene ID, adjust index when scenes change
  - If viewing scene 5 and scene 2 is deleted, stay on scene 5 (now scene 4)
- **Total Duration**: Recalculate as sum of all scene durations when scenes are added/removed
- **Preview Mode**: Changes reflected immediately when scenes are added/removed/reordered
- **State Management**: Ensure scene_order stays in sync between frontend and backend
- **Accessibility**: Ensure drag-and-drop is keyboard accessible
- **Backward Compatibility**: Existing storyboards with 6 scenes should continue to work

## Testing Checklist

- [ ] Can add scene when < 20 scenes
- [ ] Cannot add scene when at max (20)
- [ ] Cannot add scene while any scene is generating
- [ ] Can remove scene when > 3 scenes
- [ ] Cannot remove scene when at min (3)
- [ ] Cannot remove scene while any scene is generating
- [ ] Confirmation dialog shows scene number, generated content status, and warning
- [ ] Drag-and-drop reorders scenes correctly
- [ ] Drag-and-drop is disabled while any scene is generating
- [ ] Drag-and-drop uses optimistic updates
- [ ] Scene order persists after page refresh
- [ ] New scenes are auto-generated with appropriate AI text
- [ ] Loading indicator shows on new scene in timeline
- [ ] Placeholder "Generating..." card shows for new scenes
- [ ] Removed scenes are properly deleted from database
- [ ] Total duration recalculates correctly when scenes added/removed
- [ ] Current scene tracking works correctly when scenes removed/reordered
- [ ] Carousel stays on same scene when scenes are removed (scene 5 → scene 4)
- [ ] Error handling shows toast and reverts UI on failure
- [ ] Preview mode reflects changes immediately
- [ ] UI updates correctly during operations
- [ ] Add/remove buttons are disabled during generation