"""Admin API router for metrics and monitoring."""
from fastapi import APIRouter, HTTPException
from app.services.metrics_service import get_composite_metrics
from datetime import datetime, timedelta
from typing import Dict, List

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/metrics/composite")
async def get_composite_generation_metrics() -> Dict:
    """
    Get composite generation metrics and statistics.
    
    Returns comprehensive statistics including:
    - Kontext generation stats (calls, success rate, avg time)
    - PIL generation stats (calls, success rate, avg time)
    - Fallback rate
    - Today's generation count
    
    Returns:
        Dictionary with stats for Kontext, PIL, and overall metrics
    """
    try:
        metrics = get_composite_metrics()
        stats = metrics.get_stats()
        
        return {
            "success": True,
            "stats": stats,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve metrics: {str(e)}"
        )


@router.get("/metrics/daily-generations")
async def get_daily_generations(days: int = 7) -> Dict:
    """
    Get daily generation counts for the last N days.
    
    Args:
        days: Number of days to retrieve (default: 7, max: 30)
    
    Returns:
        Dictionary with daily generation counts
    """
    try:
        # Validate days parameter
        if days < 1 or days > 30:
            raise HTTPException(
                status_code=400,
                detail="Days parameter must be between 1 and 30"
            )
        
        metrics = get_composite_metrics()
        generations: List[Dict] = []
        
        for i in range(days):
            date = (datetime.now() - timedelta(days=i)).date().isoformat()
            count = metrics.get_daily_count(date)
            generations.append({
                "date": date,
                "count": count
            })
        
        # Calculate total and average
        total_count = sum(g["count"] for g in generations)
        avg_count = total_count / days if days > 0 else 0
        
        return {
            "success": True,
            "generations": generations,
            "summary": {
                "total_count": total_count,
                "average_per_day": round(avg_count, 2),
                "days_requested": days
            },
            "timestamp": datetime.now().isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve daily generations: {str(e)}"
        )


@router.get("/metrics/health")
async def get_composite_health() -> Dict:
    """
    Get health status of composite generation system.
    
    Checks:
    - Recent success rate
    - Fallback rate
    - Daily generation limit status
    
    Returns:
        Dictionary with health status and warnings
    """
    try:
        metrics = get_composite_metrics()
        stats = metrics.get_stats()
        
        # Determine health status
        warnings = []
        status = "healthy"
        
        # Check Kontext success rate
        kontext_success_rate = stats["kontext"]["success_rate"]
        if kontext_success_rate < 0.95 and stats["kontext"]["total_calls"] > 10:
            warnings.append(f"Kontext success rate is low: {kontext_success_rate:.1%}")
            status = "degraded"
        
        # Check fallback rate
        fallback_rate = stats["fallback_rate"]
        if fallback_rate > 0.1 and stats["kontext"]["total_calls"] > 10:
            warnings.append(f"High fallback rate: {fallback_rate:.1%}")
            status = "degraded"
        
        # Check daily generation limit
        from app.config import settings
        today_count = metrics.get_daily_count()
        limit = settings.KONTEXT_DAILY_GENERATION_LIMIT
        if today_count > limit * 0.9:
            warnings.append(f"Approaching daily limit: {today_count}/{limit}")
            if today_count > limit:
                status = "critical"
        
        return {
            "success": True,
            "status": status,
            "warnings": warnings,
            "metrics": {
                "kontext_success_rate": kontext_success_rate,
                "fallback_rate": fallback_rate,
                "today_generations": today_count,
                "daily_limit": limit
            },
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to check health: {str(e)}"
        )


@router.post("/metrics/reset")
async def reset_metrics() -> Dict:
    """
    Reset all metrics (use with caution).
    
    This will clear all tracked metrics including:
    - Call counts
    - Success/failure rates
    - Daily generation counts
    
    Returns:
        Confirmation message
    """
    try:
        metrics = get_composite_metrics()
        
        # Reset all metrics to initial state
        metrics.metrics = {
            "kontext": {
                "total_calls": 0,
                "successful_calls": 0,
                "failed_calls": 0,
                "total_time_seconds": 0.0
            },
            "pil": {
                "total_calls": 0,
                "successful_calls": 0,
                "failed_calls": 0,
                "total_time_seconds": 0.0
            },
            "fallback_events": 0,
            "daily_generations": {}
        }
        
        # Save reset state
        metrics.save_metrics()
        
        return {
            "success": True,
            "message": "All metrics have been reset",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to reset metrics: {str(e)}"
        )

