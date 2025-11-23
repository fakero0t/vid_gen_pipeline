# Video Trimming Feature Plan

## Overview
Allow users to visually select and trim video clips in the scene storyboard page. Only the selected portion of each clip will be used in the final composed video.

## Goals
- Enable visual trimming interface for generated scene videos
- Store trim start/end times per scene
- Apply trimming during final video composition
- Maintain backward compatibility with existing scenes

---

## 1. Data Model Changes

### Backend Models (`backend/app/models/storyboard_models.py`)

**Add to `StoryboardScene` model:**
```python
# Video trimming fields
trim_start_time: Optional[float] = Field(default=None, description="Trim start time in seconds (0-based)")
trim_end_time: Optional[float] = Field(default=None, description="Trim end time in seconds (0-based)")
```

**Validation rules:**
- `trim_start_time >= 0`
- `trim_end_time > trim_start_time`
- `trim_end_time <= video_duration` (or actual video file duration)
- If both are `None`, use full video (backward compatible)

### Frontend Types (`frontend/types/storyboard.types.ts`)

**Add to `StoryboardScene` interface:**
```typescript
trim_start_time?: number | null; // Trim start time in seconds
trim_end_time?: number | null; // Trim end time in seconds
```

### API Request/Response Models

**New request model (`backend/app/models/storyboard_models.py`):**
```python
class SceneTrimUpdateRequest(BaseModel):
    """Request to update scene video trim times."""
    trim_start_time: Optional[float] = Field(None, description="Trim start time in seconds", ge=0)
    trim_end_time: Optional[float] = Field(None, description="Trim end time in seconds", ge=0)
```

**Update `SceneUpdateResponse`** - already exists, can be reused

---

## 2. Backend API Changes

### New Endpoint (`backend/app/routers/storyboards.py`)

**Add endpoint to update trim times:**
```python
@router.post("/{storyboard_id}/scenes/{scene_id}/video/trim", response_model=SceneUpdateResponse)
async def update_scene_trim(
    storyboard_id: str,
    scene_id: str,
    request: SceneTrimUpdateRequest
):
    """
    Update trim start/end times for a scene video.
    
    Validates:
    - Scene exists and has a video
    - Trim times are within video duration
    - trim_end_time > trim_start_time
    """
```

**Implementation steps:**
1. Get scene from database
2. Validate scene has `video_url` and `generation_status.video == 'complete'`
3. If video exists, probe actual video duration for validation
4. Validate trim times:
   - `trim_start_time >= 0`
   - `trim_end_time > trim_start_time`
   - `trim_end_time <= actual_video_duration`
5. Update scene with trim times
6. Save to database
7. Return updated scene

### Video Duration Detection

**Add helper function to get actual video duration:**
- Use `ffmpeg.probe()` to get real video duration from URL
- Cache duration in scene model or fetch on-demand
- Consider adding `actual_video_duration` field to scene model for caching

### Composition Service Updates (`backend/app/services/ffmpeg_service.py`)

**Modify `compose_video()` method:**
- Accept trim parameters in `video_clips` dict structure
- Apply trimming when downloading/processing clips

**Update `download_clips_and_audio()` or create new method:**
- After downloading video, apply trim if `trim_start_time` and `trim_end_time` are provided
- Use FFmpeg to extract trimmed segment:
  ```python
  ffmpeg.input(video_path, ss=trim_start_time, t=(trim_end_time - trim_start_time))
  ```

**New method: `trim_video_clip()`**
```python
async def trim_video_clip(
    self,
    video_path: Path,
    start_time: float,
    end_time: float,
    output_path: Optional[Path] = None
) -> Path:
    """
    Trim a video clip to specified time range.
    
    Args:
        video_path: Path to source video
        start_time: Start time in seconds
        end_time: End time in seconds
        output_path: Optional output path (auto-generated if None)
    
    Returns:
        Path to trimmed video file
    """
```

**Update `_compose_with_crossfade()` and `_compose_simple_concat()`:**
- Ensure trimmed clips are used instead of full clips
- Update duration calculations to use trimmed durations

**Update composition router (`backend/app/routers/composition.py`):**
- Pass trim times from scene data to composition service
- Update `VideoClipInput` model to include trim fields:
  ```python
  trim_start_time: Optional[float] = None
  trim_end_time: Optional[float] = None
  ```

---

## 3. Frontend UI Changes

### New Component: Video Trimmer Overlay (`frontend/components/storyboard/VideoTrimmerOverlay.tsx`)

**Features:**
- Overlay component that sits on top of existing video player
- Visual timeline/scrubber bar at bottom of video
- Start/end trim handles (draggable) on timeline
- Time indicators showing trim range
- Duration display (original vs trimmed)
- Trim mode toggle button
- Visual indicators for trimmed vs unselected portions

**Props:**
```typescript
interface VideoTrimmerOverlayProps {
  videoElement: HTMLVideoElement | null; // Reference to existing video element
  originalDuration: number; // Full video duration
  trimStartTime?: number | null;
  trimEndTime?: number | null;
  onTrimChange: (startTime: number, endTime: number) => void;
  onSave: () => void;
  onCancel: () => void;
  disabled?: boolean;
  isVisible: boolean; // Control overlay visibility
}
```

**UI Layout (Overlay):**
- Absolute positioned overlay covering video container
- Bottom section: Timeline scrubber with trim handles
- Top-right corner: Close/Cancel button
- Bottom-right: Save/Apply button
- Visual indicators:
  - Dimmed/unselected portions of video (outside trim range)
  - Highlighted selected portion (trim range)
  - Current playhead position

**Implementation details:**
- Use existing video element (passed as ref) - no need to duplicate video player
- Overlay positioned absolutely over video container (z-index above video)
- Timeline scrubber at bottom with dual-handle range slider
- Visual dimming effect for unselected portions (optional CSS overlay)
- Sync video playback with trim handles:
  - When dragging trim handles, scrub video to show selected range
  - When video plays, update playhead position on timeline
- Control video playback: Pause when entering trim mode, allow play/pause from overlay
- Debounce API calls when dragging trim handles (only save on explicit "Save" click)
- Click outside overlay to cancel (optional UX enhancement)
- Prevent video controls from interfering: Hide native controls when overlay is visible

### Update SceneCardNew Component (`frontend/components/storyboard/SceneCardNew.tsx`)

**Changes in VIDEO STATE section:**
- Keep existing video player element
- Wrap video container in relative positioned div
- Add `VideoTrimmerOverlay` as absolute positioned overlay
- Add "Edit Trim" button in controls section (right panel)
- Show trim status badge/indicator when trim is active
- Display trimmed duration vs original duration in controls

**Video container structure:**
```tsx
<div className="w-2/3 flex-shrink-0 relative rounded-lg overflow-hidden flex items-center justify-center bg-black border border-border">
  {/* Existing video element */}
  <video
    ref={videoRef}
    src={scene.video_url}
    controls={!isTrimming} // Hide native controls when trimming
    className="w-full h-full object-contain"
    poster={scene.image_url || undefined}
  />
  
  {/* Trimmer overlay - only visible when isTrimming is true */}
  {isTrimming && (
    <VideoTrimmerOverlay
      videoElement={videoRef.current}
      originalDuration={actualVideoDuration}
      trimStartTime={scene.trim_start_time}
      trimEndTime={scene.trim_end_time}
      onTrimChange={handleTrimChange}
      onSave={handleSaveTrim}
      onCancel={() => setIsTrimming(false)}
      isVisible={isTrimming}
    />
  )}
</div>
```

**New state:**
```typescript
const [isTrimming, setIsTrimming] = useState(false);
const [localTrimStart, setLocalTrimStart] = useState<number | null>(null);
const [localTrimEnd, setLocalTrimEnd] = useState<number | null>(null);
const [actualVideoDuration, setActualVideoDuration] = useState<number>(scene.video_duration);
const videoRef = useRef<HTMLVideoElement>(null);
```

**UI Flow:**
1. Default: Show video player with native controls + "Edit Trim" button in right panel
2. Click "Edit Trim": 
   - Hide native video controls
   - Show `VideoTrimmerOverlay` over video
   - Initialize trim handles from scene.trim_start_time/trim_end_time
3. User adjusts trim handles on timeline overlay
4. Real-time preview: Video scrubs to show selected range
5. Click "Save" in overlay: Save trim times via API, hide overlay
6. Click "Cancel" or outside: Discard changes, hide overlay
7. Show trimmed duration indicator badge when trim is active

**Controls section (right panel) updates:**
- Add "Edit Trim" button below video duration slider
- Show trim status indicator: "Trimmed: Xs / Original: Ys" when trim exists
- Disable "Edit Trim" when video is generating

### API Integration (`frontend/lib/api/storyboard.ts`)

**Add new function:**
```typescript
export async function updateSceneTrim(
  storyboardId: string,
  sceneId: string,
  trimStartTime: number | null,
  trimEndTime: number | null
): Promise<StoryboardScene> {
  // POST to /api/storyboards/{storyboardId}/scenes/{sceneId}/video/trim
}
```

### Store Updates (`frontend/store/sceneStore.ts`)

**Add action:**
```typescript
updateSceneTrim: async (
  sceneId: string,
  trimStartTime: number | null,
  trimEndTime: number | null
) => Promise<void>
```

**Implementation:**
- Call API endpoint
- Update local scene state
- Handle errors

---

## 4. Composition Flow Updates

### Final Composition (`frontend/components/composition/FinalComposition.tsx`)

**Update `handleStartComposition()`:**
- Include trim times when creating `VideoClipInput[]`:
  ```typescript
  const clips: VideoClipInput[] = videoScenes.map((scene, index) => ({
    scene_number: index + 1,
    video_url: scene.video_url!,
    duration: scene.trim_end_time && scene.trim_start_time
      ? scene.trim_end_time - scene.trim_start_time
      : scene.video_duration,
    trim_start_time: scene.trim_start_time ?? undefined,
    trim_end_time: scene.trim_end_time ?? undefined,
  }));
  ```

### Composition Request Model (`backend/app/models/composition_models.py`)

**Update `VideoClipInput`:**
```python
trim_start_time: Optional[float] = Field(None, description="Trim start time in seconds")
trim_end_time: Optional[float] = Field(None, description="Trim end time in seconds")
```

**Update validation:**
- If `trim_start_time` is provided, `trim_end_time` must also be provided
- If `trim_end_time` is provided, `trim_start_time` must also be provided
- Validate `trim_end_time > trim_start_time`

---

## 5. Implementation Order

### Phase 1: Backend Foundation
1. ✅ Add trim fields to `StoryboardScene` model
2. ✅ Create `SceneTrimUpdateRequest` model
3. ✅ Add API endpoint for updating trim times
4. ✅ Add video duration detection helper
5. ✅ Update database schema (if using SQL) or ensure Firestore supports new fields

### Phase 2: Backend Composition
1. ✅ Update `VideoClipInput` model with trim fields
2. ✅ Implement `trim_video_clip()` method in FFmpeg service
3. ✅ Update `compose_video()` to handle trim parameters
4. ✅ Update composition router to pass trim data
5. ✅ Test trimming with FFmpeg

### Phase 3: Frontend UI
1. ✅ Create `VideoTrimmerOverlay` component (overlay design)
2. ✅ Add video ref and duration detection to `SceneCardNew`
3. ✅ Integrate overlay into `SceneCardNew` video container
4. ✅ Add "Edit Trim" button and trim status indicators
5. ✅ Add API function for trim updates
6. ✅ Add store action for trim updates
7. ✅ Test overlay interactions and video sync

### Phase 4: Integration
1. ✅ Update `FinalComposition` to include trim times
2. ✅ End-to-end testing: Trim → Compose → Verify
3. ✅ Handle edge cases (no trim, invalid trim, etc.)
4. ✅ Update preview player to respect trim times (optional)

### Phase 5: Polish
1. ✅ Add loading states during trim save
2. ✅ Add error handling and user feedback
3. ✅ Add visual indicators for trimmed vs untrimmed scenes
4. ✅ Add keyboard shortcuts (optional)
5. ✅ Performance optimization (debounce, lazy loading)

---

## 6. Edge Cases & Validation

### Validation Rules
- **Trim start time:** Must be >= 0 and < video duration
- **Trim end time:** Must be > trim start time and <= video duration
- **Both or neither:** If one trim time is set, both must be set
- **Minimum duration:** Enforce minimum trimmed duration (e.g., 0.5 seconds)
- **Maximum duration:** Trimmed duration cannot exceed original video duration

### Error Handling
- **Video not available:** Show error if video_url is missing
- **Invalid trim times:** Validate and show error message
- **API failures:** Handle network errors gracefully
- **Composition failures:** If trim fails during composition, fall back to full video with warning

### Backward Compatibility
- **Existing scenes:** Scenes without trim times use full video (default behavior)
- **Migration:** No migration needed - new fields are optional
- **API:** Trim endpoint is optional - composition works without it

---

## 7. UI/UX Considerations

### Visual Design
- **Overlay background:** Semi-transparent dark overlay (rgba(0,0,0,0.7)) to make controls stand out
- **Timeline scrubber:** Positioned at bottom of video, full width, with primary color for selected range, muted for unselected
- **Trim handles:** Draggable handles with visual feedback (hover, active states), positioned on timeline
- **Time labels:** Show current time, trim start, trim end, and duration on timeline
- **Video dimming:** Optional - dim unselected portions of video to highlight selected range
- **Overlay controls:** Positioned at corners (close top-right, save bottom-right) with clear visual hierarchy

### User Experience
- **Immediate feedback:** Show trimmed duration as user drags handles, video scrubs to show selected range
- **Reset option:** Easy way to clear trim and use full video (via overlay controls)
- **Save state:** Explicit "Save" button in overlay, changes only applied on save
- **Cancel option:** Easy way to discard changes and exit trim mode
- **Loading states:** Show spinner when saving trim times
- **Success feedback:** Toast notification when trim is saved, overlay closes automatically
- **Non-intrusive:** Overlay only appears when actively trimming, doesn't replace video player

### Accessibility
- **Keyboard navigation:** Allow arrow keys to adjust trim handles
- **Screen reader:** Announce trim times and duration changes
- **Focus management:** Proper focus handling when entering/exiting trim mode

---

## 8. Testing Checklist

### Backend Tests
- [ ] Test trim update endpoint with valid data
- [ ] Test trim update endpoint with invalid data (validation)
- [ ] Test trim update endpoint with missing video
- [ ] Test FFmpeg trimming with various time ranges
- [ ] Test composition with trimmed clips
- [ ] Test composition with mix of trimmed and untrimmed clips
- [ ] Test edge cases (trim at start, trim at end, very short trim)

### Frontend Tests
- [ ] Test VideoTrimmer component rendering
- [ ] Test trim handle dragging
- [ ] Test trim time updates
- [ ] Test API integration (save trim times)
- [ ] Test error handling (invalid times, API failures)
- [ ] Test backward compatibility (scenes without trim)

### Integration Tests
- [ ] End-to-end: Trim scene → Compose video → Verify trimmed portion used
- [ ] Multiple scenes: Trim some, leave others untrimmed
- [ ] Regenerate video: Ensure trim times are preserved or cleared appropriately

---

## 9. Performance Considerations

### Optimization
- **Lazy loading:** Load video metadata (duration) on-demand
- **Debouncing:** Debounce API calls when dragging trim handles
- **Caching:** Cache video duration to avoid repeated probes
- **Progressive enhancement:** Show basic player first, enhance with trimmer

### Resource Management
- **Video loading:** Reuse existing video element (no duplicate loading)
- **Memory:** Overlay is lightweight, only renders when active
- **Network:** Minimize API calls (only save on explicit "Save", not during drag)
- **Performance:** Overlay doesn't re-render video, just adds UI controls on top

---

## 10. Future Enhancements (Out of Scope)

- **Frame-accurate trimming:** Allow frame-by-frame selection
- **Multiple trim points:** Support multiple segments from one video
- **Audio sync:** Ensure audio stays in sync after trimming
- **Preview with audio:** Show trimmed section with audio in preview
- **Bulk trim:** Apply same trim to multiple scenes
- **Trim presets:** Save common trim patterns (e.g., "First 3 seconds")

---

## 11. Technical Notes

### FFmpeg Trimming Command
```bash
ffmpeg -i input.mp4 -ss START_TIME -t DURATION -c copy output.mp4
# Or with re-encoding:
ffmpeg -i input.mp4 -ss START_TIME -t DURATION -c:v libx264 -c:a aac output.mp4
```

### Video Duration Detection
```python
import ffmpeg

probe = ffmpeg.probe(video_path)
duration = float(probe['format']['duration'])
```

### Timeline Component Library Options
- **react-range:** For dual-handle slider (recommended)
- **rc-slider:** Alternative for range slider with handles
- **Custom implementation:** Using HTML5 video + canvas for timeline visualization
- **Note:** Video element already exists, overlay just needs to sync with it via ref

---

## 12. Files to Modify

### Backend
- `backend/app/models/storyboard_models.py` - Add trim fields
- `backend/app/routers/storyboards.py` - Add trim endpoint
- `backend/app/services/ffmpeg_service.py` - Add trimming logic
- `backend/app/routers/composition.py` - Pass trim data
- `backend/app/models/composition_models.py` - Update clip input model

### Frontend
- `frontend/types/storyboard.types.ts` - Add trim fields
- `frontend/components/storyboard/VideoTrimmerOverlay.tsx` - New overlay component
- `frontend/components/storyboard/SceneCardNew.tsx` - Integrate overlay, add video ref, trim controls
- `frontend/lib/api/storyboard.ts` - Add trim API function
- `frontend/store/sceneStore.ts` - Add trim action
- `frontend/components/composition/FinalComposition.tsx` - Include trim times

---

## Summary

This plan enables users to visually trim video clips in the storyboard page. The implementation includes:
- Data model updates to store trim times
- Backend API to update and apply trims
- Frontend UI for visual trimming
- Integration with existing composition flow

The feature maintains backward compatibility and follows the existing codebase patterns.

