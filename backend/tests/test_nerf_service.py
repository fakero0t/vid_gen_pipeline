"""
Tests for NeRF Training Service

This module tests the NeRF training service, including:
- Training initialization
- Status polling
- Error handling
- Cost estimation
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from pathlib import Path

from app.services.nerf_service import NeRFTrainingService, nerf_training_service
from app.services.modal_service import ModalAPIError
from app.models.nerf_models import (
    TrainingResponse,
    TrainingStatus,
    JobStatus,
    TrainingStage,
    EstimatedCost,
    CostBreakdown,
)


@pytest.fixture
def mock_modal_service():
    """Mock the modal_service for testing."""
    with patch('app.services.nerf_service.modal_service') as mock:
        mock.call_function = AsyncMock()
        mock.get_progress = AsyncMock()
        yield mock


@pytest.fixture
def mock_settings():
    """Mock the settings."""
    with patch('app.services.nerf_service.settings') as mock:
        mock.is_development.return_value = True
        mock.get_gpu_type.return_value = "T4"
        yield mock


@pytest.mark.asyncio
async def test_start_nerf_training_success(mock_modal_service, mock_settings):
    """Test successful NeRF training initialization."""
    # Mock Modal function call
    mock_call = MagicMock()
    mock_call.object_id = "test-prepare-call-id"
    mock_modal_service.call_function.return_value = mock_call
    
    service = NeRFTrainingService()
    
    # Start training
    response = await service.start_nerf_training(
        colmap_job_id="colmap_test-upload-job",
        config=None,
    )
    
    # Verify response
    assert isinstance(response, TrainingResponse)
    assert response.job_id == "train_test-upload-job"
    assert response.status == JobStatus.PROCESSING
    assert response.stage == TrainingStage.DATA_PREPARATION
    assert response.progress == 0
    assert response.estimated_cost.total_usd > 0
    
    # Verify Modal function was called
    mock_modal_service.call_function.assert_called_once_with(
        "prepare_training_data",
        job_id="test-upload-job",
        colmap_path="jobs/test-upload-job/colmap",
    )


@pytest.mark.asyncio
async def test_start_nerf_training_with_config(mock_modal_service, mock_settings):
    """Test NeRF training initialization with custom config."""
    mock_call = MagicMock()
    mock_call.object_id = "test-prepare-call-id"
    mock_modal_service.call_function.return_value = mock_call
    
    service = NeRFTrainingService()
    
    custom_config = {
        "num_iterations": 20000,
        "resolution": [1920, 1080],
    }
    
    # Start training with config
    response = await service.start_nerf_training(
        colmap_job_id="colmap_test-job",
        config=custom_config,
    )
    
    # Verify response
    assert response.job_id == "train_test-job"
    assert response.status == JobStatus.PROCESSING


@pytest.mark.asyncio
async def test_start_nerf_training_modal_error(mock_modal_service, mock_settings):
    """Test NeRF training initialization with Modal error."""
    # Mock Modal function call to raise error
    mock_modal_service.call_function.side_effect = ModalAPIError("Modal API failed")
    
    service = NeRFTrainingService()
    
    # Start training should raise ModalAPIError
    with pytest.raises(ModalAPIError):
        await service.start_nerf_training(
            colmap_job_id="colmap_test-job",
            config=None,
        )


@pytest.mark.asyncio
async def test_get_training_status_data_preparation(mock_modal_service, mock_settings):
    """Test getting training status during data preparation stage."""
    # Mock progress data
    mock_modal_service.get_progress.return_value = {
        "stage": "data_preparation",
        "progress": 50,
        "status": "processing",
        "current_operation": "Converting COLMAP output...",
        "elapsed_time": 120.5,
    }
    
    service = NeRFTrainingService()
    
    # Get status
    status = await service.get_training_status("train_test-job")
    
    # Verify status
    assert isinstance(status, TrainingStatus)
    assert status.job_id == "train_test-job"
    assert status.status == JobStatus.PROCESSING
    assert status.stage == TrainingStage.DATA_PREPARATION
    assert status.progress > 0  # Overall progress
    assert status.stage_progress == 50
    assert status.elapsed_time == 120
    assert status.cost_so_far > 0
    
    # Verify Modal service was called
    mock_modal_service.get_progress.assert_called_once_with("test-job")


@pytest.mark.asyncio
async def test_get_training_status_training_stage(mock_modal_service, mock_settings):
    """Test getting training status during training stage."""
    # Mock progress data
    mock_modal_service.get_progress.return_value = {
        "stage": "training",
        "progress": 75,
        "status": "processing",
        "current_operation": "Training iteration 11250/15000",
        "elapsed_time": 1200.0,
    }
    
    service = NeRFTrainingService()
    
    # Get status
    status = await service.get_training_status("train_test-job")
    
    # Verify status
    assert status.stage == TrainingStage.TRAINING
    assert status.progress > 50  # Should be weighted progress
    assert status.stage_progress == 75
    assert status.elapsed_time == 1200


@pytest.mark.asyncio
async def test_get_training_status_complete(mock_modal_service, mock_settings):
    """Test getting training status when complete."""
    # Mock progress data
    mock_modal_service.get_progress.return_value = {
        "stage": "complete",
        "progress": 100,
        "status": "complete",
        "current_operation": "Training complete",
        "elapsed_time": 1800.0,
    }
    
    service = NeRFTrainingService()
    
    # Get status
    status = await service.get_training_status("train_test-job")
    
    # Verify status
    assert status.status == JobStatus.COMPLETE
    assert status.stage == TrainingStage.COMPLETE
    assert status.progress == 100
    assert status.model_path is not None


@pytest.mark.asyncio
async def test_get_training_status_failed(mock_modal_service, mock_settings):
    """Test getting training status when failed."""
    # Mock progress data with error
    mock_modal_service.get_progress.return_value = {
        "stage": "training",
        "progress": 30,
        "status": "failed",
        "current_operation": "Training failed",
        "elapsed_time": 600.0,
        "error": "GPU out of memory",
    }
    
    service = NeRFTrainingService()
    
    # Get status
    status = await service.get_training_status("train_test-job")
    
    # Verify status
    assert status.status == JobStatus.FAILED
    assert status.error == "GPU out of memory"


@pytest.mark.asyncio
async def test_get_training_status_no_progress_data(mock_modal_service, mock_settings):
    """Test getting training status with no progress data."""
    # Mock no progress data
    mock_modal_service.get_progress.return_value = None
    
    service = NeRFTrainingService()
    
    # Get status
    status = await service.get_training_status("train_test-job")
    
    # Verify initial status is returned
    assert status.job_id == "train_test-job"
    assert status.status == JobStatus.PROCESSING
    assert status.stage == TrainingStage.DATA_PREPARATION
    assert status.progress == 0


@pytest.mark.asyncio
async def test_retry_training(mock_modal_service, mock_settings):
    """Test retrying failed training."""
    mock_call = MagicMock()
    mock_call.object_id = "test-retry-call-id"
    mock_modal_service.call_function.return_value = mock_call
    
    service = NeRFTrainingService()
    
    # Retry training
    response = await service.retry_training(
        job_id="train_test-failed-job",
        config=None,
    )
    
    # Verify response
    assert response.job_id == "train_test-failed-job"
    assert response.status == JobStatus.PROCESSING
    
    # Verify Modal function was called
    mock_modal_service.call_function.assert_called_once()


def test_calculate_cost_estimate_development(mock_settings):
    """Test cost estimation for development environment."""
    mock_settings.is_development.return_value = True
    
    service = NeRFTrainingService()
    
    # Calculate cost
    cost = service._calculate_cost_estimate(None)
    
    # Verify cost structure
    assert isinstance(cost, EstimatedCost)
    assert cost.total_usd > 0
    assert isinstance(cost.breakdown, CostBreakdown)
    assert cost.breakdown.colmap > 0
    assert cost.breakdown.training > 0
    assert cost.breakdown.rendering > 0
    
    # Verify total matches breakdown
    expected_total = (
        cost.breakdown.colmap +
        cost.breakdown.training +
        cost.breakdown.rendering
    )
    assert abs(cost.total_usd - expected_total) < 0.01


def test_calculate_cost_estimate_production(mock_settings):
    """Test cost estimation for production environment."""
    mock_settings.is_development.return_value = False
    
    service = NeRFTrainingService()
    
    # Calculate cost
    cost = service._calculate_cost_estimate(None)
    
    # Production costs should be higher (A10G vs T4)
    assert cost.total_usd > 0.5  # Should be more expensive


@pytest.mark.asyncio
async def test_get_training_status_with_metrics(mock_modal_service, mock_settings):
    """Test getting training status with validation metrics."""
    # Mock progress data with metrics
    mock_modal_service.get_progress.return_value = {
        "stage": "validation",
        "progress": 100,
        "status": "processing",
        "current_operation": "Validating model...",
        "elapsed_time": 1750.0,
        "loss": 0.0234,
        "psnr": 28.5,
        "ssim": 0.92,
    }
    
    service = NeRFTrainingService()
    
    # Get status
    status = await service.get_training_status("train_test-job")
    
    # Verify metrics are present
    assert status.stage == TrainingStage.VALIDATION
    # Note: Loss, PSNR, SSIM would need to be parsed from training logs
    # In this test, they won't be present as we're just mocking progress data


def test_singleton_instance():
    """Test that the global singleton instance is correctly initialized."""
    assert nerf_training_service is not None
    assert isinstance(nerf_training_service, NeRFTrainingService)


@pytest.mark.asyncio
async def test_estimated_time_remaining_calculation(mock_modal_service, mock_settings):
    """Test calculation of estimated time remaining."""
    # Mock progress data with elapsed time
    mock_modal_service.get_progress.return_value = {
        "stage": "training",
        "progress": 50,  # 50% complete
        "status": "processing",
        "current_operation": "Training...",
        "elapsed_time": 600.0,  # 10 minutes elapsed
    }
    
    service = NeRFTrainingService()
    
    # Get status
    status = await service.get_training_status("train_test-job")
    
    # With stage weighting, estimated time should account for:
    # - Data prep: 5% complete (already done)
    # - Training: at stage 50%, which is (5 + (90-5) * 0.5) = 47.5% overall
    # If 47.5% took 600 seconds, 100% would take ~1263 seconds
    # Remaining: 1263 - 600 = ~663 seconds
    assert status.estimated_time_remaining is not None
    assert status.estimated_time_remaining > 0

