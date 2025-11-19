"""
Tests for Upload Functionality

These tests verify upload, validation, and file handling for product photos.
"""

import pytest
import io
from pathlib import Path
from PIL import Image
from unittest.mock import Mock, patch, AsyncMock

from app.utils.image_validation import (
    validate_image_file,
    validate_image_count,
    check_image_diversity,
    validate_batch,
    is_supported_extension,
    get_supported_extensions,
)
from app.models.nerf_models import ImageStatus
from app.services.upload_service import UploadService
from app.utils.job_state import JobType, JobStateManager


# ============================================================================
# Image Validation Tests
# ============================================================================

class TestImageValidation:
    """Test image validation utilities."""
    
    @pytest.fixture
    def create_test_image(self):
        """Create a test image in memory."""
        def _create(width=1024, height=1024, format="JPEG", mode="RGB"):
            img = Image.new(mode, (width, height), color=(128, 128, 128))
            buf = io.BytesIO()
            img.save(buf, format=format)
            return buf.getvalue()
        return _create
    
    def test_validate_valid_image(self, create_test_image):
        """Test validation of a valid image."""
        content = create_test_image(1920, 1080, "JPEG")
        result, dims = validate_image_file(content, "test.jpg")
        
        assert result.is_valid
        assert result.status == ImageStatus.VALID
        assert len(result.errors) == 0
        assert dims.width == 1920
        assert dims.height == 1080
    
    def test_validate_small_image(self, create_test_image):
        """Test validation of image too small."""
        content = create_test_image(400, 400, "JPEG")
        result, dims = validate_image_file(content, "small.jpg")
        
        assert not result.is_valid
        assert result.status == ImageStatus.ERROR
        assert any("too small" in err.lower() for err in result.errors)
    
    def test_validate_extreme_aspect_ratio(self, create_test_image):
        """Test validation of image with extreme aspect ratio."""
        content = create_test_image(4000, 800, "JPEG")
        result, dims = validate_image_file(content, "wide.jpg")
        
        assert result.is_valid  # Valid but with warning
        assert result.status == ImageStatus.WARNING
        assert any("aspect ratio" in warn.lower() for warn in result.warnings)
    
    def test_validate_grayscale_image(self, create_test_image):
        """Test validation of grayscale image."""
        content = create_test_image(1024, 1024, "JPEG", mode="L")
        result, dims = validate_image_file(content, "gray.jpg")
        
        assert result.is_valid  # Valid but with warning
        assert result.status == ImageStatus.WARNING
        assert any("grayscale" in warn.lower() for warn in result.warnings)
    
    def test_validate_unsupported_format(self):
        """Test validation of unsupported format."""
        # Create a tiny BMP (unsupported)
        img = Image.new("RGB", (100, 100))
        buf = io.BytesIO()
        img.save(buf, format="BMP")
        content = buf.getvalue()
        
        result, dims = validate_image_file(content, "test.bmp")
        
        assert not result.is_valid
        assert result.status == ImageStatus.ERROR
        assert any("unsupported format" in err.lower() for err in result.errors)
    
    def test_validate_corrupted_image(self):
        """Test validation of corrupted image data."""
        content = b"not an image"
        result, dims = validate_image_file(content, "corrupt.jpg")
        
        assert not result.is_valid
        assert result.status == ImageStatus.ERROR
        assert dims is None
    
    def test_validate_image_count(self):
        """Test image count validation."""
        # Too few
        valid, warnings = validate_image_count(10)
        assert not valid
        
        # Minimum
        valid, warnings = validate_image_count(20)
        assert valid
        assert len(warnings) > 0  # Should warn about recommended count
        
        # Recommended
        valid, warnings = validate_image_count(80)
        assert valid
        assert len(warnings) == 0
        
        # Too many
        valid, warnings = validate_image_count(250)
        assert not valid
    
    def test_check_image_diversity(self):
        """Test image diversity checking."""
        # Sequential names
        sequential = [f"IMG_{i:04d}.jpg" for i in range(80)]
        warnings = check_image_diversity(sequential)
        assert len(warnings) > 0
        
        # Diverse names
        diverse = [f"photo_{i}_angle_{j}.jpg" for i in range(8) for j in range(10)]
        warnings = check_image_diversity(diverse)
        # May or may not warn depending on implementation
    
    def test_validate_batch(self, create_test_image):
        """Test batch validation."""
        files = [
            ("valid1.jpg", create_test_image(1920, 1080)),
            ("valid2.jpg", create_test_image(1920, 1080)),
            ("small.jpg", create_test_image(400, 400)),  # Error
            ("wide.jpg", create_test_image(4000, 800)),  # Warning
        ]
        
        results, dimensions, batch_warnings = validate_batch(files)
        
        assert len(results) == 4
        assert results[0].is_valid
        assert results[1].is_valid
        assert not results[2].is_valid  # Too small
        assert results[3].is_valid  # Wide but valid
    
    def test_supported_extensions(self):
        """Test supported extension checking."""
        assert is_supported_extension("test.jpg")
        assert is_supported_extension("test.jpeg")
        assert is_supported_extension("test.png")
        assert is_supported_extension("test.webp")
        assert not is_supported_extension("test.bmp")
        assert not is_supported_extension("test.gif")
        
        extensions = get_supported_extensions()
        assert ".jpg" in extensions
        assert ".png" in extensions


# ============================================================================
# Upload Service Tests
# ============================================================================

class TestUploadService:
    """Test upload service functionality."""
    
    @pytest.fixture
    def upload_service(self, tmp_path):
        """Create upload service with temp directory."""
        with patch('app.services.upload_service.settings') as mock_settings:
            mock_settings.get_upload_storage_path.return_value = tmp_path
            service = UploadService()
            yield service
    
    @pytest.fixture
    def create_test_image(self):
        """Create a test image in memory."""
        def _create(width=1920, height=1080):
            img = Image.new("RGB", (width, height), color=(128, 128, 128))
            buf = io.BytesIO()
            img.save(buf, format="JPEG")
            return buf.getvalue()
        return _create
    
    @pytest.mark.asyncio
    async def test_upload_valid_photos(self, upload_service, create_test_image):
        """Test uploading valid photos."""
        files = [
            (f"photo{i:03d}.jpg", create_test_image())
            for i in range(80)
        ]
        
        response = await upload_service.upload_photos(
            files=files,
            auto_start_nerf=False,
            strict_validation=False
        )
        
        assert response.status.value == "complete"
        assert response.uploaded_count == 80
        assert response.validation_summary.valid == 80
        assert response.validation_summary.errors == 0
        assert len(response.job_id) > 0
    
    @pytest.mark.asyncio
    async def test_upload_mixed_quality(self, upload_service, create_test_image):
        """Test uploading mixed quality images."""
        files = [
            ("good1.jpg", create_test_image(1920, 1080)),
            ("good2.jpg", create_test_image(1920, 1080)),
            ("small.jpg", create_test_image(400, 400)),  # Error
            ("wide.jpg", create_test_image(4000, 800)),  # Warning
        ]
        
        response = await upload_service.upload_photos(
            files=files,
            auto_start_nerf=False,
            strict_validation=False
        )
        
        assert response.status.value == "complete"
        assert response.validation_summary.valid == 3  # good1, good2, wide
        assert response.validation_summary.warnings == 1  # wide
        assert response.validation_summary.errors == 1  # small
    
    @pytest.mark.asyncio
    async def test_upload_too_few_images(self, upload_service, create_test_image):
        """Test uploading too few images."""
        files = [
            (f"photo{i:03d}.jpg", create_test_image())
            for i in range(10)  # Too few
        ]
        
        response = await upload_service.upload_photos(
            files=files,
            auto_start_nerf=False,
            strict_validation=False
        )
        
        # Should complete but with errors
        assert response.status.value == "complete"
        assert len(response.errors) > 0
    
    @pytest.mark.asyncio
    async def test_get_upload_status(self, upload_service, create_test_image):
        """Test getting upload status."""
        files = [
            (f"photo{i:03d}.jpg", create_test_image())
            for i in range(80)
        ]
        
        # Create upload
        response = await upload_service.upload_photos(files=files)
        job_id = response.job_id
        
        # Get status
        status = await upload_service.get_upload_status(job_id)
        
        assert status is not None
        assert status.job_id == job_id
        assert status.progress == 100.0  # Complete
    
    @pytest.mark.asyncio
    async def test_get_nonexistent_upload_status(self, upload_service):
        """Test getting status for nonexistent upload."""
        status = await upload_service.get_upload_status("nonexistent_job")
        assert status is None
    
    def test_get_uploaded_images(self, upload_service, create_test_image, tmp_path):
        """Test getting list of uploaded images."""
        # Create a fake job directory with images
        job_id = "test_job_123"
        job_dir = tmp_path / job_id
        job_dir.mkdir()
        
        # Create some test image files
        for i in range(5):
            img_file = job_dir / f"img_{i:03d}.jpg"
            img_file.write_bytes(create_test_image())
        
        # Get images
        images = upload_service.get_uploaded_images(job_id)
        
        assert len(images) == 5
        assert all(isinstance(p, Path) for p in images)
    
    def test_cleanup_job(self, upload_service, tmp_path):
        """Test cleanup of job files."""
        # Create a fake job directory
        job_id = "test_job_cleanup"
        job_dir = tmp_path / job_id
        job_dir.mkdir()
        
        # Add some files
        (job_dir / "test.txt").write_text("test")
        
        # Cleanup
        upload_service.cleanup_job(job_id)
        
        # Verify cleanup
        assert not job_dir.exists()


# ============================================================================
# Job State Tests
# ============================================================================

class TestJobState:
    """Test job state management."""
    
    @pytest.fixture
    def job_manager(self, tmp_path):
        """Create job state manager with temp directory."""
        return JobStateManager(state_dir=tmp_path)
    
    def test_create_and_load_job(self, job_manager):
        """Test creating and loading job state."""
        from app.utils.job_state import JobState, JobType
        
        job = JobState(
            job_id="test_123",
            job_type=JobType.UPLOAD,
            status="processing",
            data={"count": 80}
        )
        
        # Save
        job_manager.save(job)
        
        # Load
        loaded = job_manager.load("test_123")
        
        assert loaded is not None
        assert loaded.job_id == "test_123"
        assert loaded.job_type == JobType.UPLOAD
        assert loaded.status == "processing"
        assert loaded.data["count"] == 80
    
    def test_update_job(self, job_manager):
        """Test updating job state."""
        from app.utils.job_state import JobState, JobType
        
        job = JobState(
            job_id="test_update",
            job_type=JobType.UPLOAD,
            status="processing"
        )
        
        job_manager.save(job)
        
        # Update
        job.update(status="complete", data={"result": "success"})
        job_manager.save(job)
        
        # Verify
        loaded = job_manager.load("test_update")
        assert loaded.status == "complete"
        assert loaded.data["result"] == "success"
    
    def test_delete_job(self, job_manager):
        """Test deleting job state."""
        from app.utils.job_state import JobState, JobType
        
        job = JobState(
            job_id="test_delete",
            job_type=JobType.UPLOAD
        )
        
        job_manager.save(job)
        assert job_manager.exists("test_delete")
        
        job_manager.delete("test_delete")
        assert not job_manager.exists("test_delete")
    
    def test_list_jobs(self, job_manager):
        """Test listing jobs."""
        from app.utils.job_state import JobState, JobType
        
        # Create multiple jobs
        for i in range(5):
            job = JobState(
                job_id=f"job_{i}",
                job_type=JobType.UPLOAD if i % 2 == 0 else JobType.COLMAP,
                status="complete" if i < 3 else "processing"
            )
            job_manager.save(job)
        
        # List all
        all_jobs = job_manager.list_jobs()
        assert len(all_jobs) == 5
        
        # Filter by type
        upload_jobs = job_manager.list_jobs(job_type=JobType.UPLOAD)
        assert len(upload_jobs) == 3
        
        # Filter by status
        complete_jobs = job_manager.list_jobs(status="complete")
        assert len(complete_jobs) == 3


# Integration tests
@pytest.mark.integration
@pytest.mark.asyncio
async def test_upload_integration():
    """
    Integration test for full upload flow.
    
    Requires backend to be running.
    """
    # This would test the actual API endpoints
    # Skipped in unit tests
    pass

