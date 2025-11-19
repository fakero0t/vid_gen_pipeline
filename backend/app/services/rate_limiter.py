"""Rate limiter for Kontext API calls."""
import asyncio
from datetime import datetime, timedelta
from typing import Dict
from collections import deque


class KontextRateLimiter:
    """
    Rate limiter for Kontext API calls.
    
    Implements:
    - Concurrent request limiting
    - Hourly request limiting
    - Request queuing
    """
    
    def __init__(self, max_concurrent: int = 10, max_per_hour: int = 100):
        self.max_concurrent = max_concurrent
        self.max_per_hour = max_per_hour
        
        # Tracking
        self.active_requests = 0
        self.hourly_requests: deque = deque()  # Timestamps of requests
        self.lock = asyncio.Lock()
        self.semaphore = asyncio.Semaphore(max_concurrent)
    
    async def acquire(self):
        """
        Acquire permission to make a Kontext API call.
        
        Blocks if:
        - Too many concurrent requests
        - Hourly limit exceeded
        """
        # Wait for available concurrent slot
        await self.semaphore.acquire()
        
        async with self.lock:
            # Clean old hourly requests (> 1 hour old)
            now = datetime.now()
            hour_ago = now - timedelta(hours=1)
            
            while self.hourly_requests and self.hourly_requests[0] < hour_ago:
                self.hourly_requests.popleft()
            
            # Check hourly limit
            if len(self.hourly_requests) >= self.max_per_hour:
                # Calculate wait time
                oldest = self.hourly_requests[0]
                wait_until = oldest + timedelta(hours=1)
                wait_seconds = (wait_until - now).total_seconds()
                
                if wait_seconds > 0:
                    print(f"[Rate Limiter] Hourly limit reached, waiting {wait_seconds:.1f}s")
                    self.semaphore.release()  # Release semaphore while waiting
                    await asyncio.sleep(wait_seconds)
                    await self.semaphore.acquire()  # Re-acquire after wait
            
            # Record this request
            self.hourly_requests.append(now)
            self.active_requests += 1
    
    def release(self):
        """Release the rate limit slot."""
        self.active_requests -= 1
        self.semaphore.release()
    
    async def __aenter__(self):
        await self.acquire()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        self.release()


# Global rate limiter instance
_kontext_limiter = None


def get_kontext_rate_limiter() -> KontextRateLimiter:
    """Get or create global Kontext rate limiter."""
    global _kontext_limiter
    
    if _kontext_limiter is None:
        from app.config import settings
        _kontext_limiter = KontextRateLimiter(
            max_concurrent=settings.MAX_CONCURRENT_KONTEXT,
            max_per_hour=settings.MAX_KONTEXT_PER_HOUR
        )
    
    return _kontext_limiter

