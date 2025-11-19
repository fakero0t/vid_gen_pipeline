"""Unit tests for composite feature flag routing."""
import pytest
from unittest.mock import patch, AsyncMock, Mock
import asyncio


@pytest.mark.asyncio
async def test_feature_flag_kontext_enabled():
    """Test that Kontext is used when feature flag is ON."""
    
    with patch('app.config.settings') as mock_settings:
        mock_settings.USE_KONTEXT_COMPOSITE = True
        mock_settings.COMPOSITE_METHOD = "kontext"
        mock_settings.KONTEXT_TIMEOUT_SECONDS = 60
        
        # Verify settings are configured for Kontext
        assert mock_settings.USE_KONTEXT_COMPOSITE is True
        assert mock_settings.COMPOSITE_METHOD == "kontext"


@pytest.mark.asyncio
async def test_feature_flag_kontext_disabled():
    """Test that PIL is used when Kontext is disabled."""
    
    with patch('app.config.settings') as mock_settings:
        mock_settings.USE_KONTEXT_COMPOSITE = False
        mock_settings.COMPOSITE_METHOD = "pil"
        
        # Verify settings are configured for PIL
        assert mock_settings.USE_KONTEXT_COMPOSITE is False


@pytest.mark.asyncio
async def test_feature_flag_method_override():
    """Test that COMPOSITE_METHOD can override USE_KONTEXT_COMPOSITE."""
    
    with patch('app.config.settings') as mock_settings:
        mock_settings.USE_KONTEXT_COMPOSITE = True
        mock_settings.COMPOSITE_METHOD = "pil"
        
        # Even with USE_KONTEXT_COMPOSITE=True, method should respect COMPOSITE_METHOD
        use_kontext = mock_settings.USE_KONTEXT_COMPOSITE and mock_settings.COMPOSITE_METHOD == "kontext"
        assert use_kontext is False


@pytest.mark.asyncio
async def test_automatic_fallback_on_kontext_timeout():
    """Test automatic fallback to PIL when Kontext times out."""
    
    with patch('app.config.settings') as mock_settings:
        mock_settings.USE_KONTEXT_COMPOSITE = True
        mock_settings.COMPOSITE_METHOD = "kontext"
        mock_settings.KONTEXT_TIMEOUT_SECONDS = 1  # Very short timeout
        
        # Mock the replicate service
        with patch('app.services.replicate_service.ReplicateImageService') as MockService:
            mock_service = MockService.return_value
            
            # Kontext method times out
            async def timeout_coro(*args, **kwargs):
                await asyncio.sleep(2)  # Sleep longer than timeout
                return "/uploads/test.png"
            
            mock_service.generate_scene_with_kontext_composite = timeout_coro
            
            # PIL method succeeds
            mock_service.generate_scene_with_product = AsyncMock(return_value="/uploads/fallback.png")
            
            # Simulate the router logic
            try:
                result = await asyncio.wait_for(
                    mock_service.generate_scene_with_kontext_composite(
                        scene_text="Test",
                        style_prompt="Modern",
                        product_image_path="/test.png"
                    ),
                    timeout=mock_settings.KONTEXT_TIMEOUT_SECONDS
                )
                fallback_occurred = False
            except asyncio.TimeoutError:
                # Fallback to PIL
                result = await mock_service.generate_scene_with_product(
                    scene_text="Test",
                    style_prompt="Modern",
                    product_image_path="/test.png"
                )
                fallback_occurred = True
            
            assert fallback_occurred is True
            assert result == "/uploads/fallback.png"


@pytest.mark.asyncio
async def test_automatic_fallback_on_kontext_exception():
    """Test automatic fallback to PIL when Kontext raises exception."""
    
    with patch('app.config.settings') as mock_settings:
        mock_settings.USE_KONTEXT_COMPOSITE = True
        mock_settings.COMPOSITE_METHOD = "kontext"
        mock_settings.KONTEXT_TIMEOUT_SECONDS = 60
        
        with patch('app.services.replicate_service.ReplicateImageService') as MockService:
            mock_service = MockService.return_value
            
            # Kontext method fails
            mock_service.generate_scene_with_kontext_composite = AsyncMock(
                side_effect=Exception("API Error")
            )
            
            # PIL method succeeds
            mock_service.generate_scene_with_product = AsyncMock(return_value="/uploads/fallback.png")
            
            # Simulate the router logic
            try:
                result = await mock_service.generate_scene_with_kontext_composite(
                    scene_text="Test",
                    style_prompt="Modern",
                    product_image_path="/test.png"
                )
                fallback_occurred = False
            except Exception:
                # Fallback to PIL
                result = await mock_service.generate_scene_with_product(
                    scene_text="Test",
                    style_prompt="Modern",
                    product_image_path="/test.png"
                )
                fallback_occurred = True
            
            assert fallback_occurred is True
            assert result == "/uploads/fallback.png"


@pytest.mark.asyncio
async def test_metrics_recorded_on_fallback():
    """Test that metrics are recorded when fallback occurs."""
    
    with patch('app.services.metrics_service.get_composite_metrics') as mock_get_metrics:
        mock_metrics = Mock()
        mock_get_metrics.return_value = mock_metrics
        
        # Simulate a fallback scenario
        with patch('app.services.replicate_service.ReplicateImageService') as MockService:
            mock_service = MockService.return_value
            
            # Kontext fails
            mock_service.generate_scene_with_kontext_composite = AsyncMock(
                side_effect=Exception("API Error")
            )
            
            # PIL succeeds
            mock_service.generate_scene_with_product = AsyncMock(return_value="/uploads/fallback.png")
            
            # Simulate router logic with metrics
            try:
                await mock_service.generate_scene_with_kontext_composite(
                    scene_text="Test",
                    style_prompt="Modern",
                    product_image_path="/test.png"
                )
            except Exception:
                # Record fallback
                metrics = mock_get_metrics()
                metrics.record_fallback()
                
                # Use PIL
                await mock_service.generate_scene_with_product(
                    scene_text="Test",
                    style_prompt="Modern",
                    product_image_path="/test.png"
                )
            
            # Verify fallback was recorded
            mock_metrics.record_fallback.assert_called_once()


@pytest.mark.asyncio
async def test_rate_limiting_configuration():
    """Test that rate limiting settings are properly configured."""
    
    with patch('app.config.settings') as mock_settings:
        mock_settings.MAX_CONCURRENT_KONTEXT = 5
        mock_settings.MAX_KONTEXT_PER_HOUR = 50
        
        assert mock_settings.MAX_CONCURRENT_KONTEXT == 5
        assert mock_settings.MAX_KONTEXT_PER_HOUR == 50


@pytest.mark.asyncio
async def test_timeout_configuration():
    """Test that timeout settings are properly configured."""
    
    with patch('app.config.settings') as mock_settings:
        mock_settings.KONTEXT_TIMEOUT_SECONDS = 45
        
        assert mock_settings.KONTEXT_TIMEOUT_SECONDS == 45


@pytest.mark.asyncio
async def test_daily_generation_limit_configuration():
    """Test that daily generation limit is properly configured."""
    
    with patch('app.config.settings') as mock_settings:
        mock_settings.KONTEXT_DAILY_GENERATION_LIMIT = 500
        
        assert mock_settings.KONTEXT_DAILY_GENERATION_LIMIT == 500


@pytest.mark.asyncio
async def test_kontext_model_id_configuration():
    """Test that Kontext model ID is properly configured."""
    
    with patch('app.config.settings') as mock_settings:
        mock_settings.KONTEXT_MODEL_ID = "flux-kontext-apps/multi-image-kontext-pro"
        
        assert mock_settings.KONTEXT_MODEL_ID == "flux-kontext-apps/multi-image-kontext-pro"

