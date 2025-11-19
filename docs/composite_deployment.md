# Composite Feature Deployment Guide

## Pre-Deployment Checklist

- [ ] All PRs merged and tested locally
- [ ] Environment variables configured in staging
- [ ] Replicate API key verified and tested
- [ ] Rate limits configured appropriately for environment
- [ ] Monitoring/alerting configured
- [ ] Logs directory created and writable
- [ ] All unit tests passing
- [ ] Integration tests passing

## Deployment Steps

### Step 1: Deploy to Staging

1. **Merge all PRs to staging branch**
   ```bash
   git checkout staging
   git merge feature/composite-infrastructure
   git merge feature/composite-kontext-integration
   git merge feature/composite-admin-testing
   ```

2. **Deploy to staging environment**
   - Push to staging branch
   - Wait for CI/CD pipeline to complete
   - Verify deployment successful

3. **Set feature flag OFF initially**
   
   In `backend/.env` (staging):
   ```bash
   USE_KONTEXT_COMPOSITE=false
   COMPOSITE_METHOD=pil
   ```

4. **Run full test suite**
   ```bash
   cd backend
   python -m pytest tests/ -v
   ```

5. **Verify application stability**
   - Check health endpoint: `curl http://staging-url/health`
   - Verify existing features still work
   - Generate test scenes without product compositing
   - Monitor logs for errors

### Step 2: Enable for Internal Testing

1. **Enable feature flag**
   
   Update `backend/.env` (staging):
   ```bash
   USE_KONTEXT_COMPOSITE=true
   COMPOSITE_METHOD=kontext
   KONTEXT_MODEL_ID=flux-kontext-apps/multi-image-kontext-pro
   KONTEXT_TIMEOUT_SECONDS=60
   MAX_CONCURRENT_KONTEXT=5  # Conservative limit for staging
   MAX_KONTEXT_PER_HOUR=50
   KONTEXT_DAILY_GENERATION_LIMIT=500
   ```

2. **Restart application**
   ```bash
   # Using systemd
   sudo systemctl restart jant-vid-pipe-backend
   
   # Using Docker
   docker-compose restart backend
   
   # Using PM2
   pm2 restart backend
   ```

3. **Run manual test cases** (see `docs/composite_testing.md`)
   - Test 1: Transparent background product
   - Test 2: Opaque background product
   - Test 5: Feature flag ON/OFF
   - Test 6: Automatic fallback
   - Test 8: Metrics tracking

4. **Monitor logs for errors**
   ```bash
   # Tail logs
   tail -f /var/log/jant-vid-pipe/backend.log
   
   # Or using Docker
   docker logs -f jant-vid-pipe-backend
   ```

5. **Check metrics endpoint**
   ```bash
   curl http://staging-url/api/admin/metrics/composite | jq
   ```

6. **Test fallback scenarios**
   - Temporarily set invalid model ID
   - Verify automatic fallback to PIL
   - Verify metrics record fallback event
   - Restore correct model ID

### Step 3: Deploy to Production

1. **Merge to production branch**
   ```bash
   git checkout production
   git merge staging
   git push origin production
   ```

2. **Deploy to production**
   - Push to production branch
   - Wait for CI/CD pipeline
   - Verify deployment successful

3. **Keep feature flag OFF initially**
   
   In `backend/.env` (production):
   ```bash
   USE_KONTEXT_COMPOSITE=false
   COMPOSITE_METHOD=pil
   
   # But configure other settings for when enabled
   KONTEXT_MODEL_ID=flux-kontext-apps/multi-image-kontext-pro
   KONTEXT_TIMEOUT_SECONDS=60
   MAX_CONCURRENT_KONTEXT=10
   MAX_KONTEXT_PER_HOUR=100
   KONTEXT_DAILY_GENERATION_LIMIT=1000
   ```

4. **Monitor application stability**
   - Check all health endpoints
   - Verify existing functionality
   - Monitor error rates
   - Check response times

### Step 4: Gradual Rollout

#### Phase 1: Internal Testing (Days 1-3)

**Enable for internal users/team only:**

```bash
USE_KONTEXT_COMPOSITE=true
COMPOSITE_METHOD=kontext
MAX_CONCURRENT_KONTEXT=5  # Conservative
MAX_KONTEXT_PER_HOUR=50   # Conservative
```

**Monitor:**
- Success rate (target: >95%)
- Fallback rate (target: <5%)
- Average generation time
- Error logs

**Collect feedback:**
- Quality of composites
- Integration naturalness
- Performance issues
- Any unexpected behaviors

#### Phase 2: Limited Release (Days 4-7)

**Scale up gradually:**

```bash
MAX_CONCURRENT_KONTEXT=10
MAX_KONTEXT_PER_HOUR=100
```

**Monitor closely:**
- Kontext success rate
- Fallback events
- Daily generation counts
- API costs

**Watch for:**
- High fallback rate (>10%)
- Timeout issues
- Rate limit hits
- Quality concerns

#### Phase 3: Full Rollout (Day 8+)

**Enable for all users:**

```bash
USE_KONTEXT_COMPOSITE=true
COMPOSITE_METHOD=kontext
MAX_CONCURRENT_KONTEXT=15  # Scale as needed
MAX_KONTEXT_PER_HOUR=200   # Scale as needed
KONTEXT_DAILY_GENERATION_LIMIT=2000
```

**Set as default method**

**Continue monitoring:**
- All metrics via admin endpoints
- Daily generation counts
- Cost tracking
- User feedback

## Monitoring

### Key Metrics to Watch

Track these metrics via `/api/admin/metrics/composite`:

1. **Kontext Success Rate**
   - **Target:** >95%
   - **Alert:** <90%
   - **Action:** Investigate API issues or increase timeout

2. **Fallback Rate**
   - **Target:** <5%
   - **Alert:** >10%
   - **Action:** Check Kontext stability, review error logs

3. **Average Generation Time**
   - **Target:** <45 seconds
   - **Alert:** >60 seconds
   - **Action:** Review timeout settings, check API performance

4. **Daily Generation Counts**
   - **Track:** Via `/api/admin/metrics/daily-generations`
   - **Alert:** Approaching daily limit
   - **Action:** Adjust limits or optimize usage

5. **Error Rates**
   - **Target:** <1%
   - **Alert:** >5%
   - **Action:** Review logs, check API health

### Monitoring Commands

**Get current metrics:**
```bash
curl http://your-domain/api/admin/metrics/composite | jq
```

**Get health status:**
```bash
curl http://your-domain/api/admin/metrics/health | jq
```

**Get 7-day generation history:**
```bash
curl http://your-domain/api/admin/metrics/daily-generations?days=7 | jq
```

### Alerts to Configure

Set up alerts for:

1. **High Fallback Rate**
   - Condition: `fallback_rate > 0.10`
   - Severity: Warning
   - Action: Investigate Kontext API issues

2. **Daily Generation Limit**
   - Condition: `today_generations > KONTEXT_DAILY_GENERATION_LIMIT * 0.9`
   - Severity: Warning
   - Action: Review usage patterns

3. **Low Success Rate**
   - Condition: `kontext_success_rate < 0.90`
   - Severity: Critical
   - Action: Check API health, consider disabling feature

4. **High Average Time**
   - Condition: `avg_time_seconds > 60`
   - Severity: Warning
   - Action: Review timeout settings

### Log Monitoring

**Key log patterns to watch:**

```bash
# Successful generations
grep "\[Kontext Composite\] Composite saved" /var/log/backend.log

# Fallback events
grep "falling back to PIL" /var/log/backend.log

# Timeout events
grep "Kontext timeout" /var/log/backend.log

# Error events
grep "\[Kontext Composite\].*failed" /var/log/backend.log
```

## Rollback Plan

If issues occur, follow this rollback procedure:

### Quick Rollback (No Code Changes)

1. **Disable feature flag**
   ```bash
   USE_KONTEXT_COMPOSITE=false
   ```

2. **Restart application**
   ```bash
   sudo systemctl restart jant-vid-pipe-backend
   ```

3. **System automatically reverts to PIL method**
   - No code changes needed
   - All scenes continue generating
   - Zero downtime

4. **Verify rollback successful**
   ```bash
   # Check logs for PIL usage
   grep "Using PIL composite method" /var/log/backend.log
   ```

5. **Investigate issues**
   - Review error logs
   - Check metrics
   - Analyze failure patterns
   - Fix root cause

6. **Redeploy when ready**

### Full Rollback (Code Revert)

If feature needs to be completely removed:

1. **Revert commits**
   ```bash
   git revert <commit-hash-pr3>
   git revert <commit-hash-pr2>
   git revert <commit-hash-pr1>
   git push origin production
   ```

2. **Deploy reverted code**

3. **Remove configuration**
   - Remove Kontext settings from `.env`
   - Clear metrics file
   - Remove logs

## Troubleshooting

### Kontext Always Fails

**Symptoms:**
- All generations fall back to PIL
- Error logs show Kontext failures
- Success rate near 0%

**Diagnosis:**
```bash
# Check API key
echo $REPLICATE_API_TOKEN

# Verify model ID
echo $KONTEXT_MODEL_ID

# Test API connectivity
curl -H "Authorization: Token $REPLICATE_API_TOKEN" \
     https://api.replicate.com/v1/models/flux-kontext-apps/multi-image-kontext-pro
```

**Fix:**
1. Verify Replicate API key is valid
2. Check model ID is correct
3. Verify network connectivity
4. Check Replicate API status page

### High Fallback Rate

**Symptoms:**
- Fallback rate >10%
- Health check shows degraded status
- Frequent timeout messages

**Diagnosis:**
```bash
# Check timeout setting
echo $KONTEXT_TIMEOUT_SECONDS

# Review recent errors
grep "Kontext failed" /var/log/backend.log | tail -20

# Check average generation time
curl http://your-domain/api/admin/metrics/composite | jq '.stats.kontext.avg_time_seconds'
```

**Fix:**
1. **If timeouts:** Increase `KONTEXT_TIMEOUT_SECONDS` to 90
2. **If API errors:** Check Replicate API stability
3. **If large images:** Implement image compression before upload
4. **If rate limits:** Adjust `MAX_CONCURRENT_KONTEXT`

### Performance Issues

**Symptoms:**
- Slow generation times
- Frequent timeouts
- High resource usage

**Diagnosis:**
```bash
# Check system resources
top
htop

# Check concurrent requests
curl http://your-domain/api/admin/metrics/composite | jq

# Monitor rate limiter
grep "Rate Limiter" /var/log/backend.log
```

**Fix:**
1. Review rate limiting settings
2. Adjust concurrent request limits
3. Monitor system resources
4. Consider horizontal scaling
5. Optimize image sizes before sending

### Database/Metrics Issues

**Symptoms:**
- Metrics not updating
- Admin endpoints failing
- File permission errors

**Diagnosis:**
```bash
# Check metrics file
ls -la logs/composite_metrics.json

# Check logs directory permissions
ls -la logs/

# Test metrics endpoint
curl http://your-domain/api/admin/metrics/composite
```

**Fix:**
```bash
# Ensure logs directory exists and is writable
mkdir -p logs
chmod 755 logs

# Reset metrics if corrupted
curl -X POST http://your-domain/api/admin/metrics/reset
```

## Cost Management

### Monitoring Costs

1. **Track generation counts**
   ```bash
   curl http://your-domain/api/admin/metrics/daily-generations?days=30
   ```

2. **Calculate estimated costs**
   - Kontext API: Check Replicate pricing
   - Base scene generation: Flux Schnell usage
   - Storage: Image storage costs

3. **Set budget alerts**
   - Daily generation limit
   - Monthly spend tracking
   - Alert when approaching limits

### Cost Optimization

1. **Use feature flag strategically**
   - Enable only for specific users
   - Disable during low-priority scenes
   - Use PIL for simple compositions

2. **Optimize image sizes**
   - Compress large products before upload
   - Use appropriate resolutions
   - Clean up temp files promptly

3. **Rate limiting**
   - Set appropriate hourly limits
   - Prevent abuse via concurrent limits
   - Monitor usage patterns

## Success Criteria

✅ **Ready for production when:**

- [ ] All tests passing (unit, integration, manual)
- [ ] Feature flag controls routing correctly
- [ ] Automatic fallback works reliably
- [ ] Rate limiting prevents abuse
- [ ] Metrics accurately tracked
- [ ] Admin endpoints provide useful data
- [ ] Documentation complete and accurate
- [ ] Zero regressions in existing functionality
- [ ] PIL method still works as fallback
- [ ] Monitoring and alerting configured
- [ ] Rollback plan tested and documented
- [ ] Team trained on feature and monitoring

## Post-Deployment

### Week 1

- [ ] Monitor metrics daily
- [ ] Review error logs
- [ ] Collect user feedback
- [ ] Track costs
- [ ] Adjust limits as needed

### Week 2-4

- [ ] Analyze success/fallback rates
- [ ] Optimize timeout settings
- [ ] Review and adjust rate limits
- [ ] Document any issues and solutions
- [ ] Plan optimizations

### Ongoing

- [ ] Monthly metrics review
- [ ] Cost analysis and optimization
- [ ] Feature enhancement planning
- [ ] Documentation updates
- [ ] Team feedback integration

## Support Contacts

- **Replicate API Issues:** support@replicate.com
- **Application Issues:** [Your support contact]
- **Monitoring Alerts:** [Your alert contact]

## Additional Resources

- [Composite Testing Guide](composite_testing.md)
- [Replicate API Documentation](https://replicate.com/docs)
- [FLUX Kontext Model](https://replicate.com/flux-kontext-apps/multi-image-kontext-pro)

