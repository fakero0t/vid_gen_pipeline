# Video Generation Fix Plan

## Issues Identified

### Issue 1: Job ID Not Saved to Store
**Problem:** When video generation starts, the `job_id` returned from the API is never saved to the app store (`setVideoJobId` is never called). This causes:
- `videoJobId` remains `null` in localStorage
- `videoStatus` state in the hook is disconnected from the store
- When clips complete, they can't be saved because there's no job tracking
- Result: `generatedClips` array stays empty

**Evidence:**
```javascript
// localStorage shows:
videoJobId: null
generatedClips: []

// Console shows:
hasVideoStatus: false
clips: undefined
```

### Issue 2: Polling Continues After Completion
**Problem:** Even when the API returns `status: "completed"`, the polling interval doesn't stop properly.

**Evidence:**
- API returns `"status": "completed"` with all clips completed
- Polling continues making unnecessary API calls

---

## Solution Plan

### Fix 1: Save Job ID to Store

**File:** `frontend/components/composition/VideoGeneration.tsx`

**Changes Required:**

1. **Import `setVideoJobId` from store** (around line 23-26):
```typescript
const {
  scenePlan,
  moods,
  selectedMoodId,
  creativeBrief,
  generatedClips,
  audioUrl,
  setGeneratedClips,
  setVideoJobId,  // ADD THIS LINE
} = useAppStore();
```

2. **Save job ID after starting generation** (around line 129-131):
```typescript
setHasStarted(true);
const jobId = await startGeneration(request);

// ADD THESE LINES:
if (jobId) {
  setVideoJobId(jobId);
  console.log('✅ Job ID saved to store:', jobId);
}
```

**Why this fixes it:**
- The job ID will be persisted in localStorage
- The polling hook will have the correct job context
- Clips can be saved to the store when they complete
- State will survive page refreshes

---

### Fix 2: Ensure Polling Stops When Complete

**File:** `frontend/hooks/useVideoGeneration.ts`

**Changes Required:**

1. **Add debug logging in pollJobStatus** (around line 69-82):
```typescript
// Update job status if component is still mounted
if (!isUnmountedRef.current) {
  console.log('📥 Received job status:', data.job_status.status); // ADD THIS
  setJobStatus(data.job_status);
  pollRetryCountRef.current = 0; // Reset retry count on success

  // Check if job is complete or failed
  const isFinished =
    data.job_status.status === 'completed' || data.job_status.status === 'failed';

  if (isFinished) {
    console.log('🛑 Job finished, stopping polling'); // ADD THIS
    setIsGenerating(false);
    return true; // Stop polling
  }
}

return false; // Continue polling
```

2. **Verify polling cleanup in startPolling** (around line 110-115):
```typescript
// Start polling
pollingIntervalRef.current = setInterval(async () => {
  const shouldStop = await pollJobStatus(jobId);
  if (shouldStop) {
    console.log('🛑 Clearing polling interval'); // ADD THIS
    stopPolling();
  }
}, POLLING_INTERVAL);
```

**Why this fixes it:**
- Explicit logging shows when polling should stop
- Ensures `stopPolling()` is actually called
- `setIsGenerating(false)` updates UI state correctly

---

### Fix 3: Sync Clips to Store Properly

**File:** `frontend/components/composition/VideoGeneration.tsx`

**Current code** (lines 66-78) already saves clips, but add verification:

```typescript
// Sync video clips from job status to store
useEffect(() => {
  console.log('📊 Job Status Update:', {
    hasVideoStatus: !!videoStatus,
    status: videoStatus?.status,
    clipsLength: videoStatus?.clips?.length,
    clips: videoStatus?.clips
  });

  if (videoStatus?.clips && videoStatus.clips.length > 0) {
    console.log('💾 Saving clips to store:', videoStatus.clips);
    setGeneratedClips(videoStatus.clips);
    
    // ADD THIS - Verify save:
    console.log('✅ Clips should now be in store');
  }
}, [videoStatus, setGeneratedClips]);
```

---

## Testing Plan

### Test 1: Verify Job ID Saved
1. Start video generation
2. Check console for: `✅ Job ID saved to store: [uuid]`
3. Check localStorage: `videoJobId` should have a UUID value

### Test 2: Verify Polling Stops
1. Wait for all 6 videos to complete
2. Check console for: `🛑 Job finished, stopping polling`
3. Check Network tab - no more polling requests after completion

### Test 3: Verify Clips Saved
1. When videos complete, check console for: `💾 Saving clips to store: [6 clips]`
2. Check localStorage: `generatedClips` should have 6 items with `status: "completed"` and valid `video_url`
3. Verify each clip has:
   - `scene_number` (1-6)
   - `video_url` (Replicate URL)
   - `duration` (seconds)
   - `status: "completed"`

### Test 4: Verify Composition Works
1. Click "Continue to Final Composition →"
2. Should navigate to Step 5
3. Composition should start automatically
4. Should NOT see "No video clips available" alert
5. Should see composition progress bar

---

## Implementation Order

1. **First:** Fix Job ID saving (Fix 1)
   - This is the root cause - nothing works without it
   
2. **Second:** Add polling stop verification (Fix 2)
   - Ensures cleanup happens properly
   
3. **Third:** Add clips sync verification (Fix 3)
   - Confirms data flow is working

4. **Test:** Run through complete flow
   - Generate videos
   - Verify all console logs
   - Verify localStorage state
   - Verify composition works

---

## Expected Behavior After Fixes

1. ✅ Job ID is saved when generation starts
2. ✅ Polling updates show in console with status changes
3. ✅ When all clips complete, polling stops automatically
4. ✅ All 6 clips with URLs are saved to store
5. ✅ localStorage persists the clips
6. ✅ "Continue to Final Composition" button appears
7. ✅ Clicking it navigates to Step 5 with clips available
8. ✅ Composition starts automatically with all 6 video URLs

---

## Rollback Plan

If issues occur:
1. All changes are additive (logging + one function call)
2. Can comment out `setVideoJobId(jobId)` line if it causes issues
3. Original functionality should remain intact

