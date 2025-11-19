"""Metrics tracking service for composite generation."""
from datetime import datetime, timedelta
from typing import Dict, List
from collections import defaultdict
import json
from pathlib import Path


class CompositeMetrics:
    """
    Track metrics for composite generation.
    
    Metrics tracked:
    - Total Kontext calls
    - Total PIL calls
    - Success/failure rates
    - Average generation time
    - Fallback rate
    """
    
    def __init__(self):
        self.metrics: Dict = {
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
            "daily_generations": defaultdict(int)  # date -> count
        }
        
        self.metrics_file = Path("logs/composite_metrics.json")
        self.load_metrics()
    
    def record_kontext_call(
        self,
        success: bool,
        duration_seconds: float
    ):
        """Record a Kontext composite call."""
        self.metrics["kontext"]["total_calls"] += 1
        
        if success:
            self.metrics["kontext"]["successful_calls"] += 1
        else:
            self.metrics["kontext"]["failed_calls"] += 1
        
        self.metrics["kontext"]["total_time_seconds"] += duration_seconds
        
        # Track daily generations
        today = datetime.now().date().isoformat()
        self.metrics["daily_generations"][today] += 1
        
        self.save_metrics()
    
    def record_pil_call(
        self,
        success: bool,
        duration_seconds: float
    ):
        """Record a PIL composite call."""
        self.metrics["pil"]["total_calls"] += 1
        
        if success:
            self.metrics["pil"]["successful_calls"] += 1
        else:
            self.metrics["pil"]["failed_calls"] += 1
        
        self.metrics["pil"]["total_time_seconds"] += duration_seconds
        
        # Track daily generations
        today = datetime.now().date().isoformat()
        self.metrics["daily_generations"][today] += 1
        
        self.save_metrics()
    
    def record_fallback(self):
        """Record a fallback from Kontext to PIL."""
        self.metrics["fallback_events"] += 1
        self.save_metrics()
    
    def get_daily_count(self, date: str = None) -> int:
        """Get generation count for specific date (default: today)."""
        if date is None:
            date = datetime.now().date().isoformat()
        
        return self.metrics["daily_generations"].get(date, 0)
    
    def get_stats(self) -> Dict:
        """Get summary statistics."""
        kontext = self.metrics["kontext"]
        pil = self.metrics["pil"]
        
        return {
            "kontext": {
                "total_calls": kontext["total_calls"],
                "success_rate": (
                    kontext["successful_calls"] / kontext["total_calls"]
                    if kontext["total_calls"] > 0 else 0
                ),
                "avg_time_seconds": (
                    kontext["total_time_seconds"] / kontext["total_calls"]
                    if kontext["total_calls"] > 0 else 0
                )
            },
            "pil": {
                "total_calls": pil["total_calls"],
                "success_rate": (
                    pil["successful_calls"] / pil["total_calls"]
                    if pil["total_calls"] > 0 else 0
                ),
                "avg_time_seconds": (
                    pil["total_time_seconds"] / pil["total_calls"]
                    if pil["total_calls"] > 0 else 0
                )
            },
            "fallback_rate": (
                self.metrics["fallback_events"] / kontext["total_calls"]
                if kontext["total_calls"] > 0 else 0
            ),
            "today_generations": self.get_daily_count()
        }
    
    def check_daily_generation_alert(self, threshold: int = 1000) -> bool:
        """Check if daily generation count exceeds threshold."""
        today_count = self.get_daily_count()
        
        if today_count > threshold:
            print(f"[Generation Alert] Daily count {today_count} exceeds threshold {threshold}")
            return True
        
        return False
    
    def save_metrics(self):
        """Save metrics to disk."""
        self.metrics_file.parent.mkdir(parents=True, exist_ok=True)
        
        # Convert defaultdict to dict for JSON serialization
        serializable = dict(self.metrics)
        serializable["daily_generations"] = dict(serializable["daily_generations"])
        
        with open(self.metrics_file, 'w') as f:
            json.dump(serializable, f, indent=2)
    
    def load_metrics(self):
        """Load metrics from disk."""
        if self.metrics_file.exists():
            try:
                with open(self.metrics_file, 'r') as f:
                    loaded = json.load(f)
                    
                    # Merge loaded metrics
                    self.metrics.update(loaded)
                    
                    # Convert daily_generations back to defaultdict
                    self.metrics["daily_generations"] = defaultdict(
                        int,
                        loaded.get("daily_generations", {})
                    )
            except Exception as e:
                print(f"[Metrics] Failed to load metrics: {e}")


# Global metrics instance
_metrics = None


def get_composite_metrics() -> CompositeMetrics:
    """Get or create global metrics tracker."""
    global _metrics
    
    if _metrics is None:
        _metrics = CompositeMetrics()
    
    return _metrics

