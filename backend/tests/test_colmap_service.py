"""
Tests for COLMAP Service

This module contains tests for the COLMAP processing service,
including job initiation, status polling, and error handling.
"""

import pytest
from pathlib import Path
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.colmap_service import COLMAPService, colmap_service
from app.models.nerf_models import COLMAPResponse, COLMAPStatus, JobStatus, COLMAPStage


@pytest.fixture
def sample_image_paths(tmp_path):
    """Create sample image files for testing."""
    images = []
    for i in range(60):
        image_path = tmp_path / f"image_{i:04d}.jpg"
        image_path.write_text("fake image data")
        images.append(image_path)
    return images


@pytest.fixture
def mock_modal_service():
    """Mock the modal service."""
    with patch('app.services.colmap_service.modal_service') as mock:
        # Mock upload_file
        mock.upload_file = AsyncMock()
        
        # Mock call_function
        mock.call_function = AsyncMock(return_value=MagicMock(id="test_call_id"))
        
        # Mock get_progress
        mock.get_progress = AsyncMock(return_value={
            "stage": "feature_extraction",
            "progress": 25,
            "status": "processing",
            "current_operation": "Extracting features...",
            "images_processed": 20,
            "total_images": 60,
        })
        
        yield mock


class TestCOLMAPService:
    """Test suite for COLMAP service."""
    
    @pytest.mark.asyncio
    async def test_start_colmap_processing(self, sample_image_paths, mock_modal_service, tmp_path):
        """Test starting COLMAP processing."""
        service = COLMAPService()
        job_id = "test_job_123"
        
        # Start COLMAP processing
        response = await service.start_colmap_processing(
            job_id=job_id,
            image_paths=sample_image_paths
        )
        
        # Verify response
        assert isinstance(response, COLMAPResponse)
        assert response.job_id == f"colmap_{job_id}"
        assert response.status == "processing"
        assert response.stage == "feature_extraction"
        assert response.progress == 0
        assert response.estimated_time_remaining == 1200
        
        # Verify modal service was called
        mock_modal_service.upload_file.assert_called_once()
        mock_modal_service.call_function.assert_called_once()
        
        # Verify function was called with correct parameters
        call_args = mock_modal_service.call_function.call_args
        assert call_args[1]["function_name"] == "process_colmap"
        assert call_args[1]["job_id"] == job_id
    
    @pytest.mark.asyncio
    async def test_get_colmap_status_processing(self, mock_modal_service):
        """Test getting COLMAP status during processing."""
        service = COLMAPService()
        job_id = "colmap_test_job_123"
        
        # Get status
        status = await service.get_colmap_status(job_id)
        
        # Verify status
        assert isinstance(status, COLMAPStatus)
        assert status.job_id == job_id
        assert status.status == "processing"
        assert status.stage == "feature_extraction"
        assert status.progress == 25
        assert status.current_operation == "Extracting features..."
        assert status.images_processed == 20
        assert status.total_images == 60
        
        # Verify modal service was called
        mock_modal_service.get_progress.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_colmap_status_complete(self, mock_modal_service):
        """Test getting COLMAP status when complete."""
        service = COLMAPService()
        job_id = "colmap_test_job_123"
        
        # Mock complete status
        mock_modal_service.get_progress.return_value = {
            "stage": "complete",
            "progress": 100,
            "status": "complete",
            "current_operation": "COLMAP processing complete",
            "images_processed": 60,
            "total_images": 60,
            "elapsed_time": 1234,
        }
        
        # Get status
        status = await service.get_colmap_status(job_id)
        
        # Verify status
        assert status.status == "complete"
        assert status.progress == 100
        assert status.output_path == "/jobs/test_job_123/colmap"
    
    @pytest.mark.asyncio
    async def test_get_colmap_status_failed(self, mock_modal_service):
        """Test getting COLMAP status when failed."""
        service = COLMAPService()
        job_id = "colmap_test_job_123"
        
        # Mock failed status
        mock_modal_service.get_progress.return_value = {
            "stage": "feature_extraction",
            "progress": 15,
            "status": "failed",
            "current_operation": "Feature extraction failed",
            "images_processed": 10,
            "total_images": 60,
            "error": "Insufficient features detected in images",
        }
        
        # Get status
        status = await service.get_colmap_status(job_id)
        
        # Verify status
        assert status.status == "failed"
        assert status.error == "Insufficient features detected in images"
    
    @pytest.mark.asyncio
    async def test_get_colmap_status_no_progress_data(self, mock_modal_service):
        """Test getting COLMAP status when no progress data available."""
        service = COLMAPService()
        job_id = "colmap_test_job_123"
        
        # Mock no progress data
        mock_modal_service.get_progress.return_value = None
        
        # Get status
        status = await service.get_colmap_status(job_id)
        
        # Verify status returns initializing state
        assert status.status == "processing"
        assert status.stage == "initializing"
        assert status.progress == 0
        assert status.current_operation == "Initializing..."
    
    @pytest.mark.asyncio
    async def test_zip_images(self, sample_image_paths, tmp_path):
        """Test zipping images."""
        service = COLMAPService()
        job_id = "test_job_123"
        
        # Create zip
        zip_path = await service._zip_images(job_id, sample_image_paths)
        
        # Verify zip was created
        assert zip_path.exists()
        assert zip_path.suffix == ".zip"
        assert zip_path.stat().st_size > 0
    
    @pytest.mark.asyncio
    async def test_retry_colmap_processing(self, sample_image_paths, mock_modal_service):
        """Test retrying COLMAP processing."""
        service = COLMAPService()
        job_id = "test_job_123"
        
        # Retry COLMAP processing
        response = await service.retry_colmap_processing(
            job_id=job_id,
            image_paths=sample_image_paths
        )
        
        # Verify response
        assert isinstance(response, COLMAPResponse)
        assert response.job_id == f"colmap_{job_id}"
        assert response.status == "processing"
        
        # Verify modal service was called
        mock_modal_service.upload_file.assert_called_once()
        mock_modal_service.call_function.assert_called_once()
    
    def test_estimate_processing_time(self):
        """Test estimating COLMAP processing time."""
        service = COLMAPService()
        
        # Test with different image counts
        time_60 = service._estimate_processing_time(60)
        time_80 = service._estimate_processing_time(80)
        time_100 = service._estimate_processing_time(100)
        
        # Verify estimates increase with image count
        assert time_80 > time_60
        assert time_100 > time_80
        
        # Verify estimates are reasonable (in seconds)
        assert 600 < time_60 < 2400  # 10-40 minutes
        assert 600 < time_80 < 2400
        assert 600 < time_100 < 2400


class TestCOLMAPServiceSingleton:
    """Test COLMAP service singleton instance."""
    
    def test_colmap_service_singleton(self):
        """Test that colmap_service is a singleton."""
        service1 = colmap_service
        service2 = colmap_service
        
        # Verify they are the same instance
        assert service1 is service2

