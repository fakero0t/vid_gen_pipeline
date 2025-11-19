"""
Tests for Rendering Service

This module tests the frame rendering service, including:
- Rendering initialization
- Status polling
- Batch download
- Frame serving
- Error handling
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from pathlib import Path

from app.services.rendering_service import RenderingService, rendering_service
from app.services.modal_service import ModalAPIError
from app.models.nerf_models import (
    RenderResponse,
    RenderStatus,
    JobStatus,
)


@pytest.fixture
def mock_modal_service():
    """Mock the modal_service for testing."""
    with patch('app.services.rendering_service.modal_service') as mock:
        mock.call_function = AsyncMock()
        mock.get_progress = AsyncMock()
        yield mock


@pytest.fixture
def mock_settings():
    """Mock the settings."""
    with patch('app.services.rendering_service.settings') as mock:
        mock.get_gpu_type.return_value = "T4"
        mock.FRAME_STORAGE_PATH = Path("/tmp/frames")
        yield mock


@pytest.mark.asyncio
async def test_start_rendering_success(mock_modal_service, mock_settings):
    """Test successful rendering initialization."""
    # Mock Modal function call
    mock_call = MagicMock()
    mock_call.object_id = "test-render-call-id"
    mock_modal_service.call_function.return_value = mock_call
    
    service = RenderingService()
    
    # Start rendering
    response = await service.start_rendering(
        train_job_id="train_test-job",
        trajectory_config=None,
    )
    
    # Verify response
    assert isinstance(response, RenderResponse)
    assert response.job_id == "render_test-job"
    assert response.status == JobStatus.PROCESSING
    assert response.progress == 0
    assert response.total_frames == 1440
    assert response.total_batches == 15
    
    # Verify Modal function was called
    mock_modal_service.call_function.assert_called_once_with(
        "render_frames",
        job_id="test-job",
        model_path="jobs/test-job/model",
        trajectory_config={
            "trajectory_type": "circular_orbit",
            "num_frames": 1440,
            "radius": 2.5,
            "elevation": 35,
            "center": [0, 0, 0],
        },
    )


@pytest.mark.asyncio
async def test_start_rendering_with_custom_trajectory(mock_modal_service, mock_settings):
    """Test rendering initialization with custom trajectory config."""
    mock_call = MagicMock()
    mock_call.object_id = "test-render-call-id"
    mock_modal_service.call_function.return_value = mock_call
    
    service = RenderingService()
    
    custom_trajectory = {
        "num_frames": 720,
        "radius": 3.0,
        "elevation": 45,
    }
    
    # Start rendering with custom config
    response = await service.start_rendering(
        train_job_id="train_test-job",
        trajectory_config=custom_trajectory,
    )
    
    # Verify response
    assert response.job_id == "render_test-job"
    assert response.total_frames == 720
    assert response.total_batches == 8  # 720 / 100 = 8


@pytest.mark.asyncio
async def test_start_rendering_modal_error(mock_modal_service, mock_settings):
    """Test rendering initialization with Modal error."""
    # Mock Modal function call to raise error
    mock_modal_service.call_function.side_effect = ModalAPIError("Modal API failed")
    
    service = RenderingService()
    
    # Start rendering should raise ModalAPIError
    with pytest.raises(ModalAPIError):
        await service.start_rendering(
            train_job_id="train_test-job",
            trajectory_config=None,
        )


@pytest.mark.asyncio
async def test_get_rendering_status_processing(mock_modal_service, mock_settings):
    """Test getting rendering status while processing."""
    # Mock progress data
    mock_modal_service.get_progress.return_value = {
        "progress": 50,
        "status": "processing",
        "current_operation": "Rendering batch 8/15...",
        "images_processed": 750,
        "total_images": 1440,
        "elapsed_time": 600.0,
    }
    
    service = RenderingService()
    
    # Get status
    status = await service.get_rendering_status("render_test-job")
    
    # Verify status
    assert isinstance(status, RenderStatus)
    assert status.job_id == "render_test-job"
    assert status.status == JobStatus.PROCESSING
    assert status.progress == 50
    assert status.frames_rendered == 750
    assert status.total_frames == 1440
    assert status.current_batch == 7  # 750 // 100 = 7
    assert status.total_batches == 15
    
    # Verify Modal service was called
    mock_modal_service.get_progress.assert_called_once_with("test-job")


@pytest.mark.asyncio
async def test_get_rendering_status_with_speed(mock_modal_service, mock_settings):
    """Test rendering status with calculated speed."""
    # Mock progress data with enough time elapsed
    mock_modal_service.get_progress.return_value = {
        "progress": 50,
        "status": "processing",
        "current_operation": "Rendering...",
        "images_processed": 720,
        "total_images": 1440,
        "elapsed_time": 600.0,  # 10 minutes
    }
    
    service = RenderingService()
    
    # Get status
    status = await service.get_rendering_status("render_test-job")
    
    # Verify rendering speed calculation (720 frames / 600 seconds = 1.2 fps)
    assert status.rendering_speed is not None
    assert abs(status.rendering_speed - 1.2) < 0.01


@pytest.mark.asyncio
async def test_get_rendering_status_complete(mock_modal_service, mock_settings):
    """Test getting rendering status when complete."""
    # Mock progress data
    mock_modal_service.get_progress.return_value = {
        "progress": 100,
        "status": "complete",
        "current_operation": "Rendering complete",
        "images_processed": 1440,
        "total_images": 1440,
        "elapsed_time": 1200.0,
    }
    
    service = RenderingService()
    
    # Get status
    status = await service.get_rendering_status("render_test-job")
    
    # Verify status
    assert status.status == JobStatus.COMPLETE
    assert status.progress == 100
    assert status.frames_rendered == 1440
    assert status.volume_path is not None
    assert status.local_path is not None


@pytest.mark.asyncio
async def test_get_rendering_status_failed(mock_modal_service, mock_settings):
    """Test getting rendering status when failed."""
    # Mock progress data with error
    mock_modal_service.get_progress.return_value = {
        "progress": 30,
        "status": "failed",
        "current_operation": "Rendering failed",
        "images_processed": 450,
        "total_images": 1440,
        "elapsed_time": 300.0,
        "error": "GPU out of memory",
    }
    
    service = RenderingService()
    
    # Get status
    status = await service.get_rendering_status("render_test-job")
    
    # Verify status
    assert status.status == JobStatus.FAILED
    assert status.error == "GPU out of memory"


@pytest.mark.asyncio
async def test_get_rendering_status_no_progress_data(mock_modal_service, mock_settings):
    """Test getting rendering status with no progress data."""
    # Mock no progress data
    mock_modal_service.get_progress.return_value = None
    
    service = RenderingService()
    
    # Get status
    status = await service.get_rendering_status("render_test-job")
    
    # Verify initial status is returned
    assert status.job_id == "render_test-job"
    assert status.status == JobStatus.PROCESSING
    assert status.progress == 0
    assert status.frames_rendered == 0


@pytest.mark.asyncio
async def test_retry_rendering(mock_modal_service, mock_settings):
    """Test retrying failed rendering."""
    mock_call = MagicMock()
    mock_call.object_id = "test-retry-call-id"
    mock_modal_service.call_function.return_value = mock_call
    
    service = RenderingService()
    
    # Retry rendering
    response = await service.retry_rendering(
        job_id="render_test-failed-job",
        trajectory_config=None,
    )
    
    # Verify response
    assert response.job_id == "render_test-failed-job"
    assert response.status == JobStatus.PROCESSING
    
    # Verify Modal function was called
    mock_modal_service.call_function.assert_called_once()


@pytest.mark.asyncio
async def test_download_batch(mock_modal_service, mock_settings):
    """Test downloading a specific batch."""
    service = RenderingService()
    
    # Create temp directory for testing
    import tempfile
    with tempfile.TemporaryDirectory() as tmpdir:
        mock_settings.FRAME_STORAGE_PATH = Path(tmpdir)
        
        # For now, this would require mocking the actual file download
        # In a real implementation, we'd mock modal_service.download_file
        # and test the zip extraction logic
        
        # This test is a placeholder for the actual implementation
        pass


def test_get_frame_path_exists(mock_settings):
    """Test getting frame path when frame exists."""
    service = RenderingService()
    
    import tempfile
    with tempfile.TemporaryDirectory() as tmpdir:
        mock_settings.FRAME_STORAGE_PATH = Path(tmpdir)
        
        # Create test frame
        job_dir = Path(tmpdir) / "test-job"
        batch_dir = job_dir / "batch_00"
        batch_dir.mkdir(parents=True)
        
        frame_path = batch_dir / "product_frame_0010.png"
        frame_path.touch()
        
        # Get frame path
        result = service.get_frame_path("render_test-job", 10)
        
        assert result is not None
        assert result.exists()
        assert result.name == "product_frame_0010.png"


def test_get_frame_path_not_found(mock_settings):
    """Test getting frame path when frame doesn't exist."""
    service = RenderingService()
    
    import tempfile
    with tempfile.TemporaryDirectory() as tmpdir:
        mock_settings.FRAME_STORAGE_PATH = Path(tmpdir)
        
        # Get frame path for non-existent frame
        result = service.get_frame_path("render_test-job", 999)
        
        assert result is None


@pytest.mark.asyncio
async def test_estimated_time_remaining_calculation(mock_modal_service, mock_settings):
    """Test calculation of estimated time remaining."""
    # Mock progress data
    mock_modal_service.get_progress.return_value = {
        "progress": 50,
        "status": "processing",
        "current_operation": "Rendering...",
        "images_processed": 720,  # 50% complete
        "total_images": 1440,
        "elapsed_time": 600.0,  # 10 minutes elapsed
    }
    
    service = RenderingService()
    
    # Get status
    status = await service.get_rendering_status("render_test-job")
    
    # With 50% done in 600 seconds, remaining 50% should take ~600 seconds
    assert status.estimated_time_remaining is not None
    assert abs(status.estimated_time_remaining - 600) < 10  # Allow small variance


def test_singleton_instance():
    """Test that the global singleton instance is correctly initialized."""
    assert rendering_service is not None
    assert isinstance(rendering_service, RenderingService)


@pytest.mark.asyncio
async def test_batch_calculations(mock_modal_service, mock_settings):
    """Test batch number calculations for different frame counts."""
    test_cases = [
        (100, 1, 0),    # 100 frames = 1 batch, current batch 1 (idx 0)
        (500, 5, 4),    # 500 frames = 5 batches, current batch 5 (idx 4)
        (750, 8, 7),    # 750 frames = 8 batches, current batch 8 (idx 7)
        (1440, 15, 14), # 1440 frames = 15 batches, all complete
    ]
    
    service = RenderingService()
    
    for frames_rendered, expected_total_batches, expected_current_batch in test_cases:
        mock_modal_service.get_progress.return_value = {
            "progress": int((frames_rendered / 1440) * 100),
            "status": "processing",
            "current_operation": "Rendering...",
            "images_processed": frames_rendered,
            "total_images": 1440,
            "elapsed_time": 300.0,
        }
        
        status = await service.get_rendering_status("render_test-job")
        
        assert status.total_batches == expected_total_batches
        assert status.current_batch == expected_current_batch

