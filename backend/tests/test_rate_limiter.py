"""Unit tests for rate limiter service."""
import pytest
import asyncio
from app.services.rate_limiter import KontextRateLimiter


@pytest.mark.asyncio
async def test_rate_limiter_concurrent():
    """Test concurrent request limiting."""
    limiter = KontextRateLimiter(max_concurrent=2, max_per_hour=100)
    
    active = []
    
    async def task():
        async with limiter:
            active.append(1)
            await asyncio.sleep(0.1)
            active.remove(1)
    
    # Start 5 tasks but only 2 should run concurrently
    tasks = [asyncio.create_task(task()) for _ in range(5)]
    
    await asyncio.sleep(0.05)
    assert len(active) <= 2
    
    await asyncio.gather(*tasks)


@pytest.mark.asyncio
async def test_rate_limiter_acquire_release():
    """Test acquire and release cycle."""
    limiter = KontextRateLimiter(max_concurrent=1, max_per_hour=100)
    
    await limiter.acquire()
    assert limiter.active_requests == 1
    
    limiter.release()
    assert limiter.active_requests == 0


@pytest.mark.asyncio
async def test_rate_limiter_context_manager():
    """Test rate limiter as context manager."""
    limiter = KontextRateLimiter(max_concurrent=5, max_per_hour=100)
    
    initial_active = limiter.active_requests
    
    async with limiter:
        assert limiter.active_requests == initial_active + 1
    
    assert limiter.active_requests == initial_active


@pytest.mark.asyncio
async def test_rate_limiter_multiple_requests():
    """Test multiple sequential requests."""
    limiter = KontextRateLimiter(max_concurrent=3, max_per_hour=100)
    
    for _ in range(5):
        async with limiter:
            assert limiter.active_requests <= 3
            await asyncio.sleep(0.01)
    
    assert limiter.active_requests == 0


@pytest.mark.asyncio
async def test_rate_limiter_hourly_tracking():
    """Test that hourly requests are tracked."""
    limiter = KontextRateLimiter(max_concurrent=10, max_per_hour=5)
    
    # Make 5 requests
    for _ in range(5):
        await limiter.acquire()
        limiter.release()
    
    assert len(limiter.hourly_requests) == 5

