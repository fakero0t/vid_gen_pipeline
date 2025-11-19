"""
Tests for Modal Service

These tests verify the Modal service functionality including:
- Client initialization
- Function calling with retry logic
- Error handling
- GPU fallback
"""

import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock, mock_open
from pathlib import Path

from app.services.modal_service import (
    ModalService,
    ModalAPIError,
    ModalGPUUnavailable,
    ModalRateLimitError,
    modal_service,
)


class TestModalService:
    """Test cases for ModalService class."""
    
    @pytest.fixture
    def mock_modal_client(self):
        """Mock Modal client."""
        with patch('app.services.modal_service.modal') as mock_modal:
            mock_client = Mock()
            mock_app = Mock()
            mock_volume = Mock()
            
            mock_modal.App.lookup.return_value = mock_app
            mock_modal.Volume.from_name.return_value = mock_volume
            
            yield mock_modal, mock_client, mock_app, mock_volume
    
    @pytest.fixture
    def service(self, mock_modal_client):
        """Create a fresh ModalService instance."""
        # Reset singleton
        ModalService._instance = None
        ModalService._initialized = False
        
        with patch('app.services.modal_service.settings') as mock_settings:
            mock_settings.has_modal_credentials.return_value = True
            mock_settings.is_development.return_value = True
            mock_settings.ENVIRONMENT = "development"
            mock_settings.get_gpu_type.return_value = "T4"
            
            service = ModalService()
            yield service
    
    def test_singleton_pattern(self, mock_modal_client):
        """Test that ModalService follows singleton pattern."""
        # Reset singleton
        ModalService._instance = None
        ModalService._initialized = False
        
        with patch('app.services.modal_service.settings') as mock_settings:
            mock_settings.has_modal_credentials.return_value = True
            mock_settings.is_development.return_value = True
            mock_settings.ENVIRONMENT = "development"
            
            service1 = ModalService()
            service2 = ModalService()
            
            assert service1 is service2
    
    def test_initialization_without_credentials(self):
        """Test initialization fails gracefully without credentials."""
        # Reset singleton
        ModalService._instance = None
        ModalService._initialized = False
        
        with patch('app.services.modal_service.settings') as mock_settings:
            mock_settings.has_modal_credentials.return_value = False
            
            service = ModalService()
            
            assert service.app is None
            assert service.volume is None
            assert not service.is_configured()
    
    def test_is_configured(self, service):
        """Test is_configured method."""
        assert service.is_configured()
        
        service.app = None
        assert not service.is_configured()
    
    @pytest.mark.asyncio
    async def test_call_function_success(self, service):
        """Test successful function call."""
        mock_func = Mock()
        mock_func_call = Mock()
        mock_func.spawn.return_value = mock_func_call
        
        with patch('app.services.modal_service.modal.Function.from_name', return_value=mock_func):
        result = await service.call_function("test_function", arg1="value1")
        
        assert result == mock_func_call
        mock_func.spawn.assert_called_once_with(arg1="value1")
    
    @pytest.mark.asyncio
    async def test_call_function_not_configured(self, service):
        """Test function call fails when not configured."""
        service.app = None
        
        with pytest.raises(ModalAPIError, match="not configured"):
            await service.call_function("test_function")
    
    @pytest.mark.asyncio
    async def test_call_function_with_retry(self, service):
        """Test function call retry logic."""
        mock_func = Mock()
        mock_func.spawn.side_effect = [
            Exception("Connection error"),
            Exception("Connection error"),
            Mock()  # Success on third try
        ]
        
        with patch('app.services.modal_service.modal.Function.from_name', return_value=mock_func):
        with patch('asyncio.sleep'):  # Mock sleep to speed up test
            result = await service.call_function("test_function", max_retries=3)
        
        assert mock_func.spawn.call_count == 3
        assert result is not None
    
    @pytest.mark.asyncio
    async def test_call_function_rate_limit_retry(self, service):
        """Test rate limit error triggers retry with backoff."""
        mock_func = Mock()
        mock_func.spawn.side_effect = [
            Exception("rate limit exceeded"),
            Mock()  # Success on second try
        ]
        
        with patch('app.services.modal_service.modal.Function.from_name', return_value=mock_func):
        with patch('asyncio.sleep') as mock_sleep:
            await service.call_function("test_function", max_retries=3)
        
        # Should have slept once with exponential backoff
        mock_sleep.assert_called_once()
        assert mock_func.spawn.call_count == 2
    
    @pytest.mark.asyncio
    async def test_call_function_rate_limit_exhausted(self, service):
        """Test rate limit error raises exception after max retries."""
        mock_func = Mock()
        mock_func.spawn.side_effect = Exception("rate limit exceeded")
        
        with patch('app.services.modal_service.modal.Function.from_name', return_value=mock_func):
        with patch('asyncio.sleep'):
            with pytest.raises(ModalRateLimitError):
                await service.call_function("test_function", max_retries=2)
    
    @pytest.mark.asyncio
    async def test_call_function_gpu_fallback(self, service):
        """Test GPU fallback when GPU unavailable."""
        mock_func = Mock()
        mock_func.spawn.side_effect = [
            Exception("GPU T4 is not available"),
            Mock()  # Success with fallback GPU
        ]
        
        with patch('app.services.modal_service.modal.Function.from_name', return_value=mock_func):
        result = await service.call_function("test_function", gpu_type="T4")
        
        assert result is not None
        assert mock_func.spawn.call_count == 2
        # Second call should use fallback GPU (A10G)
        assert mock_func.spawn.call_args_list[1][1]["gpu_type"] == "A10G"
    
    @pytest.mark.asyncio
    async def test_call_function_gpu_all_unavailable(self, service):
        """Test exception when all GPU fallbacks exhausted."""
        mock_func = Mock()
        mock_func.spawn.side_effect = Exception("GPU is not available")
        
        with patch('app.services.modal_service.modal.Function.from_name', return_value=mock_func):
        with pytest.raises(ModalGPUUnavailable):
            await service.call_function("test_function", gpu_type="A100")
    
    @pytest.mark.asyncio
    async def test_get_progress_success(self, service):
        """Test successful progress retrieval."""
        progress_data = {
            "job_id": "test_123",
            "stage": "training",
            "progress": 50,
            "message": "Training in progress"
        }
        
        service.volume.read_file.return_value = '{"job_id": "test_123", "stage": "training", "progress": 50, "message": "Training in progress"}'
        
        result = await service.get_progress("test_123")
        
        assert result["job_id"] == "test_123"
        assert result["stage"] == "training"
        assert result["progress"] == 50
    
    @pytest.mark.asyncio
    async def test_get_progress_file_not_found(self, service):
        """Test progress retrieval when file doesn't exist."""
        service.volume.read_file.side_effect = FileNotFoundError()
        
        result = await service.get_progress("test_123")
        
        assert result["stage"] == "initializing"
        assert result["progress"] == 0
    
    @pytest.mark.asyncio
    async def test_get_progress_not_configured(self, service):
        """Test progress retrieval when service not configured."""
        service.app = None
        
        result = await service.get_progress("test_123")
        
        assert result["stage"] == "error"
    
    @pytest.mark.asyncio
    async def test_upload_file(self, service):
        """Test file upload to Modal volume."""
        local_path = Path("/tmp/test.zip")
        remote_path = "/jobs/test_123/images.zip"
        
        # Mock batch_upload context manager
        mock_batch = Mock()
        service.volume.batch_upload.return_value.__enter__.return_value = mock_batch
        
        await service.upload_file(local_path, remote_path)
        
        # Verify batch_upload was called and put_file was called with file path
        service.volume.batch_upload.assert_called_once()
        mock_batch.put_file.assert_called_once_with(str(local_path), remote_path)
    
    @pytest.mark.asyncio
    async def test_upload_file_not_configured(self, service):
        """Test upload fails when not configured."""
        service.app = None
        
        with pytest.raises(ModalAPIError, match="not configured"):
            await service.upload_file(Path("/tmp/test.zip"), "/remote/path")
    
    @pytest.mark.asyncio
    async def test_download_file(self, service, tmp_path):
        """Test file download from Modal volume."""
        remote_path = "/jobs/test_123/model.pth"
        local_path = tmp_path / "model.pth"
        
        service.volume.read_file.return_value = b"model data"
        
        result = await service.download_file(remote_path, local_path)
        
        assert result == local_path
        assert local_path.exists()
        assert local_path.read_bytes() == b"model data"
    
    @pytest.mark.asyncio
    async def test_list_files(self, service):
        """Test listing files in Modal volume."""
        service.volume.listdir.return_value = [
            "/jobs/test_123/file1.txt",
            "/jobs/test_123/file2.txt"
        ]
        
        files = await service.list_files("/jobs/test_123")
        
        assert len(files) == 2
        assert "/jobs/test_123/file1.txt" in files
    
    @pytest.mark.asyncio
    async def test_delete_job_data(self, service):
        """Test deleting job data from Modal volume."""
        service.volume.listdir.return_value = [
            "/jobs/test_123/file1.txt",
            "/jobs/test_123/file2.txt"
        ]
        
        await service.delete_job_data("test_123")
        
        assert service.volume.remove_file.call_count == 2


# Integration tests (require actual Modal credentials)
@pytest.mark.integration
@pytest.mark.asyncio
async def test_modal_integration():
    """
    Integration test with real Modal API.
    
    Requires:
    - MODAL_TOKEN_ID and MODAL_TOKEN_SECRET environment variables
    - Deployed Modal app (nerf-dev or nerf-prod)
    """
    service = modal_service
    
    if not service.is_configured():
        pytest.skip("Modal credentials not configured")
    
    # Test health check function
    try:
        health_check = await service.call_function("health_check")
        result = health_check.get()
        
        assert result["status"] == "healthy"
        assert "environment" in result
        
    except Exception as e:
        pytest.fail(f"Integration test failed: {e}")

