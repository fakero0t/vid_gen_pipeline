"""
Tests for NeRF Pydantic Models

These tests verify the Pydantic model validations and serialization
for all NeRF pipeline endpoints.
"""

import pytest
from pydantic import ValidationError

from app.models.nerf_models import (
    # Enums
    JobStatus,
    UploadStatus,
    COLMAPStage,
    TrainingStage,
    ImageStatus,
    # Upload models
    ImageDimensions,
    ImageValidation,
    ValidationSummary,
    UploadResponse,
    UploadStatusResponse,
    # COLMAP models
    COLMAPRequest,
    COLMAPResponse,
    COLMAPStatus,
    # Training models
    TrainingConfig,
    CostBreakdown,
    EstimatedCost,
    ModalCallIDs,
    TrainingRequest,
    TrainingResponse,
    StageDetail,
    StageDetails,
    TrainingStatus,
    # Rendering models
    TrajectoryConfig,
    RenderRequest,
    RenderResponse,
    RenderStatus,
)


class TestImageModels:
    """Test image and upload models."""
    
    def test_image_dimensions(self):
        """Test ImageDimensions model."""
        dims = ImageDimensions(width=1920, height=1080)
        assert dims.width == 1920
        assert dims.height == 1080
    
    def test_image_validation(self):
        """Test ImageValidation model."""
        validation = ImageValidation(
            file_id="img_001",
            filename="product.jpg",
            url="/uploads/product.jpg",
            size=2048576,
            dimensions=ImageDimensions(width=2048, height=2048),
            status=ImageStatus.VALID,
            warnings=[],
            errors=[]
        )
        
        assert validation.file_id == "img_001"
        assert validation.status == ImageStatus.VALID
        assert len(validation.warnings) == 0
    
    def test_validation_summary(self):
        """Test ValidationSummary model."""
        summary = ValidationSummary(
            total=80,
            valid=75,
            warnings=3,
            errors=2
        )
        
        assert summary.total == 80
        assert summary.valid == 75
    
    def test_upload_response(self):
        """Test UploadResponse model."""
        response = UploadResponse(
            job_id="upload_123",
            status=UploadStatus.COMPLETE,
            uploaded_count=80,
            total_count=80,
            validated_images=[],
            validation_summary=ValidationSummary(
                total=80,
                valid=80,
                warnings=0,
                errors=0
            ),
            errors=[],
            auto_start_nerf=True
        )
        
        assert response.job_id == "upload_123"
        assert response.status == UploadStatus.COMPLETE
        assert response.auto_start_nerf is True
    
    def test_upload_status_response(self):
        """Test UploadStatusResponse model."""
        status = UploadStatusResponse(
            job_id="upload_123",
            status=UploadStatus.UPLOADING,
            progress=50.0,
            uploaded_count=40,
            total_count=80,
            upload_speed_mbps=5.5,
            estimated_time_remaining=120
        )
        
        assert status.progress == 50.0
        assert status.upload_speed_mbps == 5.5
    
    def test_upload_status_progress_bounds(self):
        """Test progress value validation (0-100)."""
        # Valid progress
        status = UploadStatusResponse(
            job_id="test",
            status=UploadStatus.UPLOADING,
            progress=50.0,
            uploaded_count=40,
            total_count=80
        )
        assert status.progress == 50.0
        
        # Test boundary values
        status_min = UploadStatusResponse(
            job_id="test",
            status=UploadStatus.IDLE,
            progress=0.0,
            uploaded_count=0,
            total_count=80
        )
        assert status_min.progress == 0.0
        
        status_max = UploadStatusResponse(
            job_id="test",
            status=UploadStatus.COMPLETE,
            progress=100.0,
            uploaded_count=80,
            total_count=80
        )
        assert status_max.progress == 100.0


class TestCOLMAPModels:
    """Test COLMAP models."""
    
    def test_colmap_request(self):
        """Test COLMAPRequest model."""
        request = COLMAPRequest(
            job_id="upload_123",
            image_paths=["/uploads/img_001.jpg", "/uploads/img_002.jpg"]
        )
        
        assert request.job_id == "upload_123"
        assert len(request.image_paths) == 2
    
    def test_colmap_response(self):
        """Test COLMAPResponse model."""
        response = COLMAPResponse(
            job_id="colmap_456",
            status=JobStatus.PROCESSING,
            stage=COLMAPStage.FEATURE_EXTRACTION,
            progress=25.0,
            estimated_time_remaining=600
        )
        
        assert response.job_id == "colmap_456"
        assert response.stage == COLMAPStage.FEATURE_EXTRACTION
    
    def test_colmap_status(self):
        """Test COLMAPStatus model."""
        status = COLMAPStatus(
            job_id="colmap_456",
            status=JobStatus.PROCESSING,
            stage=COLMAPStage.FEATURE_MATCHING,
            progress=50.0,
            current_operation="Matching features between images...",
            images_processed=40,
            total_images=80,
            estimated_time_remaining=300,
            output_path="/colmap/output",
            error=None
        )
        
        assert status.images_processed == 40
        assert status.total_images == 80
        assert status.error is None


class TestTrainingModels:
    """Test training models."""
    
    def test_training_config_default(self):
        """Test TrainingConfig with default values."""
        config = TrainingConfig()
        
        assert config.num_iterations == 15000
        assert config.resolution == [1920, 1080]
        assert config.downscale_factor == 1
    
    def test_training_config_custom(self):
        """Test TrainingConfig with custom values."""
        config = TrainingConfig(
            num_iterations=30000,
            resolution=[3840, 2160],
            downscale_factor=2
        )
        
        assert config.num_iterations == 30000
        assert config.resolution == [3840, 2160]
    
    def test_training_config_validation_invalid_resolution(self):
        """Test resolution validation."""
        # Wrong number of dimensions
        with pytest.raises(ValidationError, match="Resolution must be"):
            TrainingConfig(resolution=[1920])
        
        # Dimensions too small
        with pytest.raises(ValidationError, match="between 256 and 4096"):
            TrainingConfig(resolution=[100, 100])
        
        # Dimensions too large
        with pytest.raises(ValidationError, match="between 256 and 4096"):
            TrainingConfig(resolution=[5000, 5000])
    
    def test_training_config_validation_iterations(self):
        """Test iteration count validation."""
        # Too few iterations
        with pytest.raises(ValidationError):
            TrainingConfig(num_iterations=500)
        
        # Too many iterations
        with pytest.raises(ValidationError):
            TrainingConfig(num_iterations=200000)
    
    def test_cost_breakdown(self):
        """Test CostBreakdown model."""
        cost = CostBreakdown(
            colmap=0.15,
            training=0.50,
            rendering=0.20
        )
        
        assert cost.colmap == 0.15
        assert cost.training == 0.50
    
    def test_estimated_cost(self):
        """Test EstimatedCost model."""
        cost = EstimatedCost(
            total_usd=0.85,
            breakdown=CostBreakdown(
                colmap=0.15,
                training=0.50,
                rendering=0.20
            )
        )
        
        assert cost.total_usd == 0.85
    
    def test_modal_call_ids(self):
        """Test ModalCallIDs model."""
        call_ids = ModalCallIDs(
            prepare="prep_123",
            train=None,
            validation=None
        )
        
        assert call_ids.prepare == "prep_123"
        assert call_ids.train is None
    
    def test_training_request(self):
        """Test TrainingRequest model."""
        request = TrainingRequest(
            colmap_job_id="colmap_456",
            config=TrainingConfig()
        )
        
        assert request.colmap_job_id == "colmap_456"
        assert isinstance(request.config, TrainingConfig)
    
    def test_training_response(self):
        """Test TrainingResponse model."""
        response = TrainingResponse(
            job_id="train_789",
            modal_call_ids=ModalCallIDs(prepare="prep_123"),
            status=JobStatus.PROCESSING,
            stage=TrainingStage.DATA_PREPARATION,
            progress=10.0,
            estimated_time_remaining=1500,
            estimated_cost=EstimatedCost(
                total_usd=0.85,
                breakdown=CostBreakdown(
                    colmap=0.15,
                    training=0.50,
                    rendering=0.20
                )
            )
        )
        
        assert response.job_id == "train_789"
        assert response.stage == TrainingStage.DATA_PREPARATION
    
    def test_stage_detail(self):
        """Test StageDetail model."""
        detail = StageDetail(
            status="complete",
            duration=120
        )
        
        assert detail.status == "complete"
        assert detail.duration == 120
    
    def test_stage_details(self):
        """Test StageDetails model."""
        details = StageDetails(
            prepare=StageDetail(status="complete", duration=120),
            train=StageDetail(status="in_progress", duration=None),
            validation=StageDetail(status="pending", duration=None)
        )
        
        assert details.prepare.status == "complete"
        assert details.train.status == "in_progress"
    
    def test_training_status(self):
        """Test TrainingStatus model."""
        status = TrainingStatus(
            job_id="train_789",
            modal_call_ids=ModalCallIDs(
                prepare="prep_123",
                train="train_456",
                validation=None
            ),
            status=JobStatus.PROCESSING,
            stage=TrainingStage.TRAINING,
            progress=50.0,
            stage_progress=67.0,
            current_iteration=6750,
            total_iterations=15000,
            loss=0.0123,
            psnr=28.5,
            ssim=0.92,
            gpu_type="T4",
            estimated_time_remaining=500,
            elapsed_time=1200,
            cost_so_far=0.35,
            model_path=None,
            checkpoint_paths=["/checkpoints/iter_2000.pth"],
            error=None,
            stage_details=StageDetails(
                prepare=StageDetail(status="complete", duration=90),
                train=StageDetail(status="in_progress", duration=None),
                validation=StageDetail(status="pending", duration=None)
            )
        )
        
        assert status.current_iteration == 6750
        assert status.loss == 0.0123
        assert status.gpu_type == "T4"


class TestRenderingModels:
    """Test rendering models."""
    
    def test_trajectory_config_default(self):
        """Test TrajectoryConfig with default values."""
        config = TrajectoryConfig()
        
        assert config.trajectory_type == "circular_orbit"
        assert config.center == [0, 0, 0]
        assert config.radius == 2.0
        assert config.elevation == 35
        assert config.num_frames == 1440
    
    def test_trajectory_config_custom(self):
        """Test TrajectoryConfig with custom values."""
        config = TrajectoryConfig(
            center=[1.0, 0.5, 0.0],
            radius=3.0,
            elevation=45,
            num_frames=2880
        )
        
        assert config.center == [1.0, 0.5, 0.0]
        assert config.radius == 3.0
        assert config.num_frames == 2880
    
    def test_trajectory_config_validation(self):
        """Test trajectory config validation."""
        # Radius too small
        with pytest.raises(ValidationError):
            TrajectoryConfig(radius=0.05)
        
        # Elevation out of range
        with pytest.raises(ValidationError):
            TrajectoryConfig(elevation=95)
    
    def test_render_request(self):
        """Test RenderRequest model."""
        request = RenderRequest(
            train_job_id="train_789",
            trajectory_config=TrajectoryConfig()
        )
        
        assert request.train_job_id == "train_789"
        assert isinstance(request.trajectory_config, TrajectoryConfig)
    
    def test_render_response(self):
        """Test RenderResponse model."""
        response = RenderResponse(
            job_id="render_012",
            modal_call_id="call_345",
            status=JobStatus.PROCESSING,
            progress=50.0,
            frames_rendered=720,
            total_frames=1440,
            current_batch=7,
            total_batches=15,
            gpu_type="T4",
            estimated_time_remaining=600
        )
        
        assert response.frames_rendered == 720
        assert response.total_frames == 1440
        assert response.current_batch == 7
    
    def test_render_status(self):
        """Test RenderStatus model."""
        status = RenderStatus(
            job_id="render_012",
            modal_call_id="call_345",
            status=JobStatus.PROCESSING,
            progress=65.0,
            frames_rendered=936,
            total_frames=1440,
            current_batch=10,
            total_batches=15,
            current_frame=936,
            rendering_speed=1.2,
            gpu_type="T4",
            estimated_time_remaining=420,
            volume_path="/volumes/renders/render_012/frames/",
            local_path="/nerf/renders/render_012/frames/",
            frames_available=936,
            error=None
        )
        
        assert status.frames_rendered == 936
        assert status.rendering_speed == 1.2
        assert status.frames_available == 936


class TestModelSerialization:
    """Test model serialization and deserialization."""
    
    def test_upload_response_serialization(self):
        """Test UploadResponse JSON serialization."""
        response = UploadResponse(
            job_id="upload_123",
            status=UploadStatus.COMPLETE,
            uploaded_count=80,
            total_count=80,
            validated_images=[],
            validation_summary=ValidationSummary(
                total=80,
                valid=80,
                warnings=0,
                errors=0
            ),
            errors=[],
            auto_start_nerf=True
        )
        
        # Serialize to dict
        data = response.model_dump()
        assert data["job_id"] == "upload_123"
        assert data["status"] == "complete"
        
        # Deserialize from dict
        restored = UploadResponse(**data)
        assert restored.job_id == response.job_id
        assert restored.status == response.status
    
    def test_training_status_serialization(self):
        """Test TrainingStatus JSON serialization."""
        status = TrainingStatus(
            job_id="train_789",
            modal_call_ids=ModalCallIDs(prepare="prep_123"),
            status=JobStatus.PROCESSING,
            stage=TrainingStage.TRAINING,
            progress=50.0,
            stage_progress=67.0,
            gpu_type="T4",
            elapsed_time=1200,
            cost_so_far=0.35,
            stage_details=StageDetails(
                prepare=StageDetail(status="complete", duration=90),
                train=StageDetail(status="in_progress", duration=None),
                validation=StageDetail(status="pending", duration=None)
            )
        )
        
        # Serialize to JSON
        json_data = status.model_dump_json()
        assert isinstance(json_data, str)
        assert "train_789" in json_data
        
        # Deserialize from JSON
        restored = TrainingStatus.model_validate_json(json_data)
        assert restored.job_id == status.job_id
        assert restored.gpu_type == status.gpu_type

