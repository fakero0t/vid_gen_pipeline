"""Unit tests for Replicate service Kontext composite methods."""
import pytest
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from pathlib import Path
import tempfile
from app.services.replicate_service import ReplicateImageService


@pytest.fixture
def replicate_service():
    """Create a ReplicateImageService instance for testing."""
    with patch('app.services.replicate_service.settings') as mock_settings:
        mock_settings.get_replicate_token.return_value = "test_token"
        service = ReplicateImageService()
        return service


@pytest.mark.asyncio
async def test_image_to_base64_normal_size(replicate_service):
    """Test base64 encoding for normal-sized images."""
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_file:
        temp_path = temp_file.name
        # Write some test data
        temp_file.write(b"fake_image_data" * 100)
    
    try:
        # Mock Path.stat to return small size
        with patch('pathlib.Path.stat') as mock_stat:
            mock_stat.return_value = Mock(st_size=2 * 1024 * 1024)  # 2MB
            
            with patch('builtins.open', create=True) as mock_open:
                mock_open.return_value.__enter__.return_value.read.return_value = b"imagedata"
                
                with patch('base64.b64encode') as mock_encode:
                    mock_encode.return_value = b"encodeddata"
                    
                    result = await replicate_service._image_to_base64(temp_path)
                    
                    assert result == "encodeddata"
    finally:
        Path(temp_path).unlink(missing_ok=True)


@pytest.mark.asyncio
async def test_image_to_base64_too_large(replicate_service):
    """Test base64 encoding rejects images > 10MB."""
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_file:
        temp_path = temp_file.name
    
    try:
        with patch('pathlib.Path.stat') as mock_stat:
            mock_stat.return_value = Mock(st_size=15 * 1024 * 1024)  # 15MB
            
            with pytest.raises(Exception, match="Image too large"):
                await replicate_service._image_to_base64(temp_path)
    finally:
        Path(temp_path).unlink(missing_ok=True)


@pytest.mark.asyncio
async def test_image_to_base64_compression(replicate_service):
    """Test that large images (5-10MB) are compressed."""
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_file:
        temp_path = temp_file.name
        temp_file.write(b"fake_image_data" * 1000)
    
    try:
        with patch('pathlib.Path.stat') as mock_stat:
            mock_stat.return_value = Mock(st_size=7 * 1024 * 1024)  # 7MB
            
            with patch('PIL.Image.open') as mock_open:
                mock_image = Mock()
                mock_open.return_value = mock_image
                
                with patch('builtins.open', create=True) as mock_file_open:
                    mock_file_open.return_value.__enter__.return_value.read.return_value = b"compressed_data"
                    
                    with patch('base64.b64encode') as mock_encode:
                        mock_encode.return_value = b"encoded_compressed"
                        
                        result = await replicate_service._image_to_base64(temp_path)
                        
                        # Verify compression was attempted
                        mock_image.save.assert_called_once()
                        assert result == "encoded_compressed"
    finally:
        Path(temp_path).unlink(missing_ok=True)


@pytest.mark.asyncio
async def test_upload_temp_image(replicate_service):
    """Test temporary image upload."""
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_file:
        temp_path = temp_file.name
        temp_file.write(b"test_image_data")
    
    try:
        with patch('shutil.copy2') as mock_copy:
            with patch('asyncio.create_task') as mock_task:
                result = await replicate_service._upload_temp_image(temp_path)
                
                assert result.startswith("/uploads/temp/temp_")
                assert result.endswith(".png")
                mock_copy.assert_called_once()
                mock_task.assert_called_once()
    finally:
        Path(temp_path).unlink(missing_ok=True)


@pytest.mark.asyncio
async def test_cleanup_temp_file_exists(replicate_service):
    """Test that cleanup deletes existing temp file."""
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_file:
        temp_path = Path(temp_file.name)
        temp_file.write(b"test_data")
    
    # File should exist
    assert temp_path.exists()
    
    # Cleanup with very short delay
    await replicate_service._cleanup_temp_file(temp_path, delay=0.1)
    
    # File should be deleted
    assert not temp_path.exists()


@pytest.mark.asyncio
async def test_cleanup_temp_file_not_exists(replicate_service):
    """Test that cleanup handles non-existent files gracefully."""
    temp_path = Path("/tmp/nonexistent_file.png")
    
    # Should not raise exception
    await replicate_service._cleanup_temp_file(temp_path, delay=0.1)


@pytest.mark.asyncio
async def test_generate_scene_with_kontext_composite_success(replicate_service):
    """Test successful Kontext composite generation."""
    # Mock rate limiter
    with patch('app.services.replicate_service.get_kontext_rate_limiter') as mock_limiter:
        mock_limiter.return_value.__aenter__ = AsyncMock()
        mock_limiter.return_value.__aexit__ = AsyncMock()
        
        # Mock metrics
        with patch('app.services.replicate_service.get_composite_metrics') as mock_metrics:
            mock_metrics_instance = Mock()
            mock_metrics.return_value = mock_metrics_instance
            
            # Mock asyncio.to_thread for Replicate calls
            with patch('asyncio.to_thread', new_callable=AsyncMock) as mock_thread:
                # First call: base scene generation
                # Second call: Kontext composite
                mock_thread.side_effect = [
                    ["https://example.com/base_scene.png"],
                    ["https://example.com/composite.png"]
                ]
                
                # Mock image encoding
                with patch.object(replicate_service, '_image_to_base64', new_callable=AsyncMock) as mock_encode:
                    mock_encode.return_value = "base64encodeddata"
                    
                    # Mock image download
                    with patch('requests.get') as mock_get:
                        mock_response = Mock()
                        mock_response.status_code = 200
                        mock_response.content = b"fake_image_data"
                        mock_get.return_value = mock_response
                        
                        # Mock PIL Image
                        with patch('PIL.Image.open') as mock_image_open:
                            mock_image = Mock()
                            mock_image_open.return_value = mock_image
                            
                            # Mock Path.mkdir
                            with patch('pathlib.Path.mkdir'):
                                result = await replicate_service.generate_scene_with_kontext_composite(
                                    scene_text="A beautiful sunset",
                                    style_prompt="Cinematic",
                                    product_image_path="/path/to/product.png",
                                    width=1080,
                                    height=1920
                                )
                                
                                assert result.startswith("/uploads/composites/kontext_")
                                assert result.endswith(".png")
                                
                                # Verify metrics were recorded
                                mock_metrics_instance.record_kontext_call.assert_called_once()
                                call_args = mock_metrics_instance.record_kontext_call.call_args
                                assert call_args[1]['success'] is True


@pytest.mark.asyncio
async def test_generate_scene_with_kontext_composite_base64_fallback(replicate_service):
    """Test Kontext composite with base64 encoding fallback to URL upload."""
    with patch('app.services.replicate_service.get_kontext_rate_limiter') as mock_limiter:
        mock_limiter.return_value.__aenter__ = AsyncMock()
        mock_limiter.return_value.__aexit__ = AsyncMock()
        
        with patch('app.services.replicate_service.get_composite_metrics') as mock_metrics:
            mock_metrics_instance = Mock()
            mock_metrics.return_value = mock_metrics_instance
            
            with patch('asyncio.to_thread', new_callable=AsyncMock) as mock_thread:
                mock_thread.side_effect = [
                    ["https://example.com/base_scene.png"],
                    ["https://example.com/composite.png"]
                ]
                
                # Mock base64 encoding to fail
                with patch.object(replicate_service, '_image_to_base64', new_callable=AsyncMock) as mock_encode:
                    mock_encode.side_effect = Exception("Encoding failed")
                    
                    # Mock temp upload as fallback
                    with patch.object(replicate_service, '_upload_temp_image', new_callable=AsyncMock) as mock_upload:
                        mock_upload.return_value = "/uploads/temp/temp_product.png"
                        
                        with patch('requests.get') as mock_get:
                            mock_response = Mock()
                            mock_response.status_code = 200
                            mock_response.content = b"fake_image_data"
                            mock_get.return_value = mock_response
                            
                            with patch('PIL.Image.open') as mock_image_open:
                                mock_image = Mock()
                                mock_image_open.return_value = mock_image
                                
                                with patch('pathlib.Path.mkdir'):
                                    result = await replicate_service.generate_scene_with_kontext_composite(
                                        scene_text="A scene",
                                        style_prompt="Modern",
                                        product_image_path="/path/to/product.png",
                                        width=1080,
                                        height=1920
                                    )
                                    
                                    # Should still succeed with URL fallback
                                    assert result.startswith("/uploads/composites/kontext_")
                                    mock_upload.assert_called_once()


@pytest.mark.asyncio
async def test_generate_scene_with_kontext_composite_failure(replicate_service):
    """Test Kontext composite handles failures and records metrics."""
    with patch('app.services.replicate_service.get_kontext_rate_limiter') as mock_limiter:
        mock_limiter.return_value.__aenter__ = AsyncMock()
        mock_limiter.return_value.__aexit__ = AsyncMock()
        
        with patch('app.services.replicate_service.get_composite_metrics') as mock_metrics:
            mock_metrics_instance = Mock()
            mock_metrics.return_value = mock_metrics_instance
            
            # Mock asyncio.to_thread to fail
            with patch('asyncio.to_thread', new_callable=AsyncMock) as mock_thread:
                mock_thread.side_effect = Exception("API Error")
                
                with pytest.raises(Exception, match="API Error"):
                    await replicate_service.generate_scene_with_kontext_composite(
                        scene_text="A scene",
                        style_prompt="Modern",
                        product_image_path="/path/to/product.png",
                        width=1080,
                        height=1920
                    )
                
                # Verify failure was recorded
                mock_metrics_instance.record_kontext_call.assert_called_once()
                call_args = mock_metrics_instance.record_kontext_call.call_args
                assert call_args[1]['success'] is False

