"""Unit tests for metrics service."""
import pytest
import tempfile
from pathlib import Path
from datetime import datetime
from app.services.metrics_service import CompositeMetrics


@pytest.fixture
def temp_metrics():
    """Create a metrics instance with temporary storage."""
    with tempfile.TemporaryDirectory() as tmpdir:
        metrics = CompositeMetrics()
        metrics.metrics_file = Path(tmpdir) / "test_metrics.json"
        yield metrics


def test_record_kontext_call_success(temp_metrics):
    """Test recording successful Kontext call."""
    initial_calls = temp_metrics.metrics["kontext"]["total_calls"]
    
    temp_metrics.record_kontext_call(success=True, duration_seconds=5.0)
    
    assert temp_metrics.metrics["kontext"]["total_calls"] == initial_calls + 1
    assert temp_metrics.metrics["kontext"]["successful_calls"] == 1
    assert temp_metrics.metrics["kontext"]["failed_calls"] == 0
    assert temp_metrics.metrics["kontext"]["total_time_seconds"] == 5.0


def test_record_kontext_call_failure(temp_metrics):
    """Test recording failed Kontext call."""
    initial_calls = temp_metrics.metrics["kontext"]["total_calls"]
    
    temp_metrics.record_kontext_call(success=False, duration_seconds=2.0)
    
    assert temp_metrics.metrics["kontext"]["total_calls"] == initial_calls + 1
    assert temp_metrics.metrics["kontext"]["successful_calls"] == 0
    assert temp_metrics.metrics["kontext"]["failed_calls"] == 1


def test_record_pil_call_success(temp_metrics):
    """Test recording successful PIL call."""
    initial_calls = temp_metrics.metrics["pil"]["total_calls"]
    
    temp_metrics.record_pil_call(success=True, duration_seconds=2.0)
    
    assert temp_metrics.metrics["pil"]["total_calls"] == initial_calls + 1
    assert temp_metrics.metrics["pil"]["successful_calls"] == 1
    assert temp_metrics.metrics["pil"]["total_time_seconds"] == 2.0


def test_record_pil_call_failure(temp_metrics):
    """Test recording failed PIL call."""
    initial_calls = temp_metrics.metrics["pil"]["total_calls"]
    
    temp_metrics.record_pil_call(success=False, duration_seconds=1.0)
    
    assert temp_metrics.metrics["pil"]["total_calls"] == initial_calls + 1
    assert temp_metrics.metrics["pil"]["failed_calls"] == 1


def test_record_fallback(temp_metrics):
    """Test recording fallback event."""
    initial_fallbacks = temp_metrics.metrics["fallback_events"]
    
    temp_metrics.record_fallback()
    
    assert temp_metrics.metrics["fallback_events"] == initial_fallbacks + 1


def test_get_daily_count(temp_metrics):
    """Test getting daily generation count."""
    today = datetime.now().date().isoformat()
    
    temp_metrics.record_kontext_call(success=True, duration_seconds=5.0)
    temp_metrics.record_kontext_call(success=True, duration_seconds=3.0)
    
    assert temp_metrics.get_daily_count(today) == 2


def test_get_daily_count_default_today(temp_metrics):
    """Test getting today's count without specifying date."""
    temp_metrics.record_kontext_call(success=True, duration_seconds=5.0)
    
    assert temp_metrics.get_daily_count() == 1


def test_get_stats_kontext(temp_metrics):
    """Test getting summary statistics for Kontext."""
    temp_metrics.record_kontext_call(success=True, duration_seconds=10.0)
    temp_metrics.record_kontext_call(success=True, duration_seconds=6.0)
    temp_metrics.record_kontext_call(success=False, duration_seconds=2.0)
    
    stats = temp_metrics.get_stats()
    
    assert stats["kontext"]["total_calls"] == 3
    assert stats["kontext"]["success_rate"] == pytest.approx(2/3)
    assert stats["kontext"]["avg_time_seconds"] == pytest.approx(6.0)


def test_get_stats_pil(temp_metrics):
    """Test getting summary statistics for PIL."""
    temp_metrics.record_pil_call(success=True, duration_seconds=4.0)
    temp_metrics.record_pil_call(success=True, duration_seconds=2.0)
    
    stats = temp_metrics.get_stats()
    
    assert stats["pil"]["total_calls"] == 2
    assert stats["pil"]["success_rate"] == 1.0
    assert stats["pil"]["avg_time_seconds"] == pytest.approx(3.0)


def test_get_stats_fallback_rate(temp_metrics):
    """Test calculating fallback rate."""
    temp_metrics.record_kontext_call(success=True, duration_seconds=5.0)
    temp_metrics.record_kontext_call(success=True, duration_seconds=5.0)
    temp_metrics.record_fallback()
    
    stats = temp_metrics.get_stats()
    
    assert stats["fallback_rate"] == pytest.approx(0.5)


def test_get_stats_empty(temp_metrics):
    """Test getting stats with no data."""
    stats = temp_metrics.get_stats()
    
    assert stats["kontext"]["total_calls"] == 0
    assert stats["kontext"]["success_rate"] == 0
    assert stats["kontext"]["avg_time_seconds"] == 0
    assert stats["fallback_rate"] == 0


def test_check_daily_generation_alert_below_threshold(temp_metrics):
    """Test daily generation alert below threshold."""
    temp_metrics.record_kontext_call(success=True, duration_seconds=5.0)
    
    assert temp_metrics.check_daily_generation_alert(threshold=10) is False


def test_check_daily_generation_alert_above_threshold(temp_metrics):
    """Test daily generation alert above threshold."""
    for _ in range(5):
        temp_metrics.record_kontext_call(success=True, duration_seconds=1.0)
    
    assert temp_metrics.check_daily_generation_alert(threshold=3) is True


def test_save_and_load_metrics(temp_metrics):
    """Test saving and loading metrics."""
    temp_metrics.record_kontext_call(success=True, duration_seconds=5.0)
    temp_metrics.record_pil_call(success=True, duration_seconds=2.0)
    temp_metrics.record_fallback()
    
    # Save metrics
    temp_metrics.save_metrics()
    
    # Create new instance and load
    new_metrics = CompositeMetrics()
    new_metrics.metrics_file = temp_metrics.metrics_file
    new_metrics.load_metrics()
    
    assert new_metrics.metrics["kontext"]["total_calls"] == 1
    assert new_metrics.metrics["pil"]["total_calls"] == 1
    assert new_metrics.metrics["fallback_events"] == 1


def test_multiple_daily_generations_tracking(temp_metrics):
    """Test tracking multiple generations over time."""
    today = datetime.now().date().isoformat()
    
    for _ in range(3):
        temp_metrics.record_kontext_call(success=True, duration_seconds=5.0)
    
    for _ in range(2):
        temp_metrics.record_pil_call(success=True, duration_seconds=2.0)
    
    assert temp_metrics.get_daily_count(today) == 5

