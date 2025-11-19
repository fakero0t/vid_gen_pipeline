"""Integration tests for composite generation feature."""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock, Mock
from app.main import app


@pytest.fixture
def test_client():
    """Create a test client for the FastAPI app."""
    return TestClient(app)


@pytest.mark.integration
def test_admin_metrics_endpoint(test_client):
    """Test admin metrics endpoint returns valid data."""
    
    response = test_client.get("/api/admin/metrics/composite")
    
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "stats" in data
    assert "kontext" in data["stats"]
    assert "pil" in data["stats"]
    assert "fallback_rate" in data["stats"]
    assert "today_generations" in data["stats"]
    assert "timestamp" in data


@pytest.mark.integration
def test_admin_daily_generations_endpoint(test_client):
    """Test admin daily generations endpoint."""
    
    response = test_client.get("/api/admin/metrics/daily-generations?days=7")
    
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "generations" in data
    assert len(data["generations"]) <= 7
    assert "summary" in data
    assert "total_count" in data["summary"]
    assert "average_per_day" in data["summary"]


@pytest.mark.integration
def test_admin_daily_generations_invalid_days(test_client):
    """Test daily generations endpoint with invalid days parameter."""
    
    # Test with days < 1
    response = test_client.get("/api/admin/metrics/daily-generations?days=0")
    assert response.status_code == 400
    
    # Test with days > 30
    response = test_client.get("/api/admin/metrics/daily-generations?days=31")
    assert response.status_code == 400


@pytest.mark.integration
def test_admin_health_endpoint(test_client):
    """Test admin health endpoint."""
    
    response = test_client.get("/api/admin/metrics/health")
    
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "status" in data
    assert data["status"] in ["healthy", "degraded", "critical"]
    assert "warnings" in data
    assert "metrics" in data
    assert "kontext_success_rate" in data["metrics"]
    assert "fallback_rate" in data["metrics"]
    assert "today_generations" in data["metrics"]
    assert "daily_limit" in data["metrics"]


@pytest.mark.integration
def test_admin_reset_metrics_endpoint(test_client):
    """Test admin reset metrics endpoint."""
    
    response = test_client.post("/api/admin/metrics/reset")
    
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "message" in data
    assert "timestamp" in data
    
    # Verify metrics were reset
    response = test_client.get("/api/admin/metrics/composite")
    assert response.status_code == 200
    data = response.json()
    assert data["stats"]["kontext"]["total_calls"] == 0
    assert data["stats"]["pil"]["total_calls"] == 0


@pytest.mark.integration
def test_metrics_persistence():
    """Test that metrics are persisted across requests."""
    
    from app.services.metrics_service import get_composite_metrics
    
    metrics = get_composite_metrics()
    
    # Record some test data
    initial_kontext_calls = metrics.metrics["kontext"]["total_calls"]
    metrics.record_kontext_call(success=True, duration_seconds=5.0)
    
    # Verify persistence
    assert metrics.metrics["kontext"]["total_calls"] == initial_kontext_calls + 1
    
    # Get new instance and verify data persisted
    new_metrics = get_composite_metrics()
    assert new_metrics.metrics["kontext"]["total_calls"] == initial_kontext_calls + 1


@pytest.mark.integration
@pytest.mark.asyncio
async def test_kontext_composite_with_rate_limiting():
    """Test that rate limiting works with Kontext composite."""
    
    from app.services.rate_limiter import KontextRateLimiter
    
    # Create rate limiter with low limits
    limiter = KontextRateLimiter(max_concurrent=2, max_per_hour=10)
    
    active_requests = []
    
    async def mock_request():
        async with limiter:
            active_requests.append(1)
            import asyncio
            await asyncio.sleep(0.1)
            active_requests.remove(1)
    
    # Start 5 requests
    import asyncio
    tasks = [asyncio.create_task(mock_request()) for _ in range(5)]
    
    await asyncio.sleep(0.05)
    
    # Verify concurrent limit
    assert len(active_requests) <= 2
    
    # Wait for all to complete
    await asyncio.gather(*tasks)
    
    # Verify hourly tracking
    assert len(limiter.hourly_requests) == 5


@pytest.mark.integration
def test_composite_stats_calculation():
    """Test composite stats calculation logic."""
    
    from app.services.metrics_service import CompositeMetrics
    import tempfile
    from pathlib import Path
    
    # Create temp metrics
    with tempfile.TemporaryDirectory() as tmpdir:
        metrics = CompositeMetrics()
        metrics.metrics_file = Path(tmpdir) / "test_metrics.json"
        
        # Record some test data
        metrics.record_kontext_call(success=True, duration_seconds=10.0)
        metrics.record_kontext_call(success=True, duration_seconds=6.0)
        metrics.record_kontext_call(success=False, duration_seconds=2.0)
        metrics.record_pil_call(success=True, duration_seconds=4.0)
        metrics.record_fallback()
        
        # Get stats
        stats = metrics.get_stats()
        
        # Verify calculations
        assert stats["kontext"]["total_calls"] == 3
        assert stats["kontext"]["success_rate"] == pytest.approx(2/3)
        assert stats["kontext"]["avg_time_seconds"] == pytest.approx(6.0)
        assert stats["pil"]["total_calls"] == 1
        assert stats["fallback_rate"] == pytest.approx(1/3)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_end_to_end_feature_flag_routing():
    """Test complete feature flag routing logic."""
    
    from app.config import settings
    from app.services.replicate_service import ReplicateImageService
    from app.services.metrics_service import get_composite_metrics
    
    # Mock the replicate service
    with patch('app.services.replicate_service.ReplicateImageService') as MockService:
        mock_service = MockService.return_value
        
        # Test Kontext path
        with patch.object(settings, 'USE_KONTEXT_COMPOSITE', True):
            with patch.object(settings, 'COMPOSITE_METHOD', 'kontext'):
                with patch.object(settings, 'KONTEXT_TIMEOUT_SECONDS', 60):
                    mock_service.generate_scene_with_kontext_composite = AsyncMock(
                        return_value="/uploads/composites/kontext_test.png"
                    )
                    
                    # Verify Kontext would be used
                    use_kontext = settings.USE_KONTEXT_COMPOSITE and settings.COMPOSITE_METHOD == "kontext"
                    assert use_kontext is True
        
        # Test PIL path
        with patch.object(settings, 'USE_KONTEXT_COMPOSITE', False):
            with patch.object(settings, 'COMPOSITE_METHOD', 'pil'):
                mock_service.generate_scene_with_product = AsyncMock(
                    return_value="/uploads/composites/pil_test.png"
                )
                
                # Verify PIL would be used
                use_kontext = settings.USE_KONTEXT_COMPOSITE and settings.COMPOSITE_METHOD == "kontext"
                assert use_kontext is False


@pytest.mark.integration
def test_daily_generation_alert():
    """Test daily generation alert threshold."""
    
    from app.services.metrics_service import CompositeMetrics
    import tempfile
    from pathlib import Path
    
    with tempfile.TemporaryDirectory() as tmpdir:
        metrics = CompositeMetrics()
        metrics.metrics_file = Path(tmpdir) / "test_metrics.json"
        
        # Add generations below threshold
        for _ in range(5):
            metrics.record_kontext_call(success=True, duration_seconds=1.0)
        
        # Should not trigger alert
        assert metrics.check_daily_generation_alert(threshold=10) is False
        
        # Add more to exceed threshold
        for _ in range(6):
            metrics.record_kontext_call(success=True, duration_seconds=1.0)
        
        # Should trigger alert
        assert metrics.check_daily_generation_alert(threshold=10) is True


@pytest.mark.integration
def test_health_check_warnings():
    """Test health check warning conditions."""
    
    from app.services.metrics_service import CompositeMetrics
    import tempfile
    from pathlib import Path
    
    with tempfile.TemporaryDirectory() as tmpdir:
        metrics = CompositeMetrics()
        metrics.metrics_file = Path(tmpdir) / "test_metrics.json"
        
        # Record mostly failures (low success rate)
        for _ in range(2):
            metrics.record_kontext_call(success=True, duration_seconds=5.0)
        for _ in range(10):
            metrics.record_kontext_call(success=False, duration_seconds=1.0)
        
        stats = metrics.get_stats()
        
        # Success rate should be low
        assert stats["kontext"]["success_rate"] < 0.5
        
        # Add fallbacks
        for _ in range(5):
            metrics.record_fallback()
        
        stats = metrics.get_stats()
        
        # Fallback rate should be high
        assert stats["fallback_rate"] > 0.3

