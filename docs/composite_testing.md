# Composite Feature Manual Testing Guide

## Prerequisites
- Replicate API key configured
- At least one product uploaded to system
- Feature flag `USE_KONTEXT_COMPOSITE=true`
- Backend server running

## Test Cases

### Test 1: Transparent Background Product
**Objective:** Verify Kontext handles transparent backgrounds properly

- [ ] Upload product with transparent background (PNG with alpha channel)
- [ ] Create scene with product composite enabled
- [ ] Set `use_product_composite: true` and provide `product_id`
- [ ] Generate image
- [ ] **Verify:** Product transparency is preserved
- [ ] **Verify:** Natural integration with proper lighting/shadows
- [ ] **Verify:** Product appears as part of the scene, not overlaid

**Expected Result:** Product seamlessly integrated with scene lighting and perspective

---

### Test 2: Opaque Background Product
**Objective:** Verify Kontext handles products with solid backgrounds

- [ ] Upload product with solid background
- [ ] Create scene with product composite enabled
- [ ] Generate image
- [ ] **Verify:** Product is integrated (background removed/blended)
- [ ] **Verify:** Natural placement in scene

**Expected Result:** Product appears naturally placed despite opaque background

---

### Test 3: Small Product (< 500px)
**Objective:** Verify appropriate scaling for small products

- [ ] Upload small product image (e.g., 300x300)
- [ ] Generate scene
- [ ] **Verify:** Product is appropriately scaled
- [ ] **Verify:** No pixelation or quality loss
- [ ] **Verify:** Proper placement within scene

**Expected Result:** Small product scaled and positioned appropriately

---

### Test 4: Large Product (> 2000px)
**Objective:** Verify handling of large images

- [ ] Upload large product image (e.g., 3000x3000)
- [ ] Generate scene
- [ ] **Verify:** Image is compressed/handled properly
- [ ] **Verify:** No timeout errors
- [ ] **Verify:** Base64 encoding succeeds or URL fallback works

**Expected Result:** Large image handled with compression or URL fallback

---

### Test 5: Feature Flag OFF
**Objective:** Verify PIL method is used when Kontext disabled

- [ ] Set `USE_KONTEXT_COMPOSITE=false` in environment
- [ ] Restart backend server
- [ ] Generate scene with product
- [ ] **Check logs:** Verify "Using PIL composite method" appears
- [ ] **Verify:** Scene generates successfully
- [ ] **Verify:** Product overlaid at center (PIL behavior)

**Expected Result:** PIL method used, product centered on scene

---

### Test 6: Automatic Fallback
**Objective:** Verify automatic fallback to PIL on Kontext failure

- [ ] Temporarily break Kontext (e.g., invalid API key or model ID)
- [ ] Set `KONTEXT_MODEL_ID=invalid-model-id`
- [ ] Generate scene with product
- [ ] **Check logs:** Verify "Kontext failed" and "falling back to PIL"
- [ ] **Verify:** Scene still generates using PIL
- [ ] **Check metrics:** Verify fallback event recorded

**API Check:**
```bash
curl http://localhost:8000/api/admin/metrics/composite
```

**Expected Result:** Automatic fallback, scene generated, metrics show fallback event

---

### Test 7: Timeout Handling
**Objective:** Verify timeout triggers fallback

- [ ] Set very low timeout: `KONTEXT_TIMEOUT_SECONDS=5`
- [ ] Restart backend server
- [ ] Generate scene
- [ ] **Check logs:** Verify "Kontext timeout, falling back to PIL"
- [ ] **Verify:** Scene generates using PIL fallback
- [ ] **Check metrics:** Verify fallback recorded

**Expected Result:** Timeout handled gracefully, fallback successful

---

### Test 8: Metrics Tracking
**Objective:** Verify metrics are tracked accurately

- [ ] Reset metrics (optional):
```bash
curl -X POST http://localhost:8000/api/admin/metrics/reset
```

- [ ] Generate 3 scenes with Kontext (enabled)
- [ ] Generate 2 scenes with PIL (Kontext disabled)
- [ ] Trigger 1 fallback (break Kontext temporarily)
- [ ] Check metrics:

```bash
curl http://localhost:8000/api/admin/metrics/composite
```

**Verify metrics show:**
- [ ] Kontext: 4 calls (3 success + 1 failure)
- [ ] PIL: 3 calls (2 direct + 1 fallback)
- [ ] Fallback events: 1
- [ ] Success rates calculated correctly

**Expected Result:** All operations accurately tracked in metrics

---

### Test 9: Rate Limiting
**Objective:** Verify rate limiting prevents abuse

- [ ] Set low rate limits:
  - `MAX_CONCURRENT_KONTEXT=2`
  - `MAX_KONTEXT_PER_HOUR=5`
- [ ] Restart backend server
- [ ] Trigger 10 simultaneous generations (use parallel requests)
- [ ] **Check logs:** Verify rate limiting messages
- [ ] **Verify:** Only 2 run concurrently
- [ ] **Verify:** Hourly limit blocks after 5 calls

**Expected Result:** Rate limiting enforced, requests queued appropriately

---

### Test 10: Various Scene Types
**Objective:** Verify natural integration across different scene types

#### Indoor Scene
- [ ] Scene: "A modern living room with wooden furniture"
- [ ] Style: "Warm, cozy, natural lighting"
- [ ] **Verify:** Product placed naturally with room lighting

#### Outdoor Scene
- [ ] Scene: "A garden patio with sunset in background"
- [ ] Style: "Golden hour, soft shadows"
- [ ] **Verify:** Product matches outdoor lighting and environment

#### Abstract/Artistic Scene
- [ ] Scene: "Abstract geometric background with gradients"
- [ ] Style: "Modern, minimalist, clean"
- [ ] **Verify:** Product integrated artistically

**Expected Result:** Natural integration in all scene types

---

### Test 11: Health Check Endpoint
**Objective:** Verify health monitoring works

- [ ] Generate several successful scenes
- [ ] Check health:
```bash
curl http://localhost:8000/api/admin/metrics/health
```

**Verify response shows:**
- [ ] `status: "healthy"`
- [ ] `kontext_success_rate` > 0.95
- [ ] `fallback_rate` < 0.1
- [ ] `today_generations` count accurate

**Then trigger failures:**
- [ ] Break Kontext (invalid model ID)
- [ ] Generate 10 scenes (all will fall back)
- [ ] Check health again

**Verify response shows:**
- [ ] `status: "degraded"` or `"critical"`
- [ ] Warnings about high fallback rate
- [ ] Lower success rate

**Expected Result:** Health status reflects actual system state

---

### Test 12: Daily Generation Counts
**Objective:** Verify daily tracking works

- [ ] Generate scenes throughout the day
- [ ] Check daily counts:
```bash
curl http://localhost:8000/api/admin/metrics/daily-generations?days=7
```

**Verify:**
- [ ] Today's count is accurate
- [ ] Previous days show historical data
- [ ] Summary shows total and average

**Expected Result:** Accurate daily tracking over time

---

## API Endpoints Reference

### Get Composite Metrics
```bash
GET /api/admin/metrics/composite
```

Response:
```json
{
  "success": true,
  "stats": {
    "kontext": {
      "total_calls": 10,
      "success_rate": 0.9,
      "avg_time_seconds": 45.2
    },
    "pil": {
      "total_calls": 5,
      "success_rate": 1.0,
      "avg_time_seconds": 35.1
    },
    "fallback_rate": 0.1,
    "today_generations": 15
  }
}
```

### Get Daily Generations
```bash
GET /api/admin/metrics/daily-generations?days=7
```

### Get Health Status
```bash
GET /api/admin/metrics/health
```

### Reset Metrics
```bash
POST /api/admin/metrics/reset
```

---

## Troubleshooting

### Kontext Always Fails
**Symptoms:** Every generation falls back to PIL

**Check:**
1. Replicate API key: `echo $REPLICATE_API_TOKEN`
2. Model ID: `echo $KONTEXT_MODEL_ID`
3. Network connectivity
4. Replicate API status

**Fix:** Update API key or model ID in `.env`

---

### High Fallback Rate
**Symptoms:** Health check shows degraded status, high fallback rate

**Check:**
1. Timeout settings too low: `echo $KONTEXT_TIMEOUT_SECONDS`
2. Replicate API stability
3. Product image sizes (very large images may timeout)

**Fix:** Increase timeout or compress large images

---

### Performance Issues
**Symptoms:** Slow generation, timeouts

**Check:**
1. Rate limiting settings
2. Concurrent request limits
3. System resources (CPU/memory)

**Fix:** Adjust rate limits or scale infrastructure

---

## Success Criteria

All tests passing indicates the feature is ready for production:

- [x] Transparent and opaque products handled
- [x] Various product sizes processed
- [x] Feature flag controls routing
- [x] Automatic fallback works reliably
- [x] Timeout handling works
- [x] Metrics accurately tracked
- [x] Rate limiting prevents abuse
- [x] Natural integration across scene types
- [x] Health monitoring functional
- [x] Daily tracking accurate

---

## Notes

- Save screenshots of generated composites for comparison
- Document any unexpected behaviors
- Track generation times for performance baseline
- Note any Replicate API errors or rate limits encountered

