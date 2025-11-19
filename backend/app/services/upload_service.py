"""
Upload Service

This service handles product photo uploads, validation, and storage for NeRF processing.
"""

import uuid
import asyncio
import logging
from pathlib import Path
from typing import List, Tuple, Dict, Any, Optional
from datetime import datetime

from ..config import settings
from ..models.nerf_models import (
    ImageStatus,
    ImageValidation,
    ImageDimensions,
    ValidationSummary,
    UploadResponse,
    UploadStatus,
    UploadStatusResponse,
)
from ..utils.image_validation import (
    validate_batch,
    is_supported_extension,
    get_supported_extensions,
)
from ..utils.job_state import (
    JobType,
    create_job,
    update_job,
    get_job,
)
from ..services.modal_service import modal_service

logger = logging.getLogger(__name__)


class UploadService:
    """
    Service for handling product photo uploads and validation.
    """
    
    def __init__(self):
        self.upload_dir = settings.get_upload_storage_path()
        self.upload_dir.mkdir(parents=True, exist_ok=True)
    
    def _generate_job_id(self) -> str:
        """Generate unique job ID."""
        return f"upload_{uuid.uuid4().hex[:12]}"
    
    def _generate_file_id(self) -> str:
        """Generate unique file ID."""
        return f"img_{uuid.uuid4().hex[:8]}"
    
    def _get_job_dir(self, job_id: str) -> Path:
        """Get directory for job uploads."""
        job_dir = self.upload_dir / job_id
        job_dir.mkdir(parents=True, exist_ok=True)
        return job_dir
    
    async def upload_photos(
        self,
        files: List[Tuple[str, bytes]],
        auto_start_nerf: bool = False,
        strict_validation: bool = False
    ) -> UploadResponse:
        """
        Upload and validate product photos.
        
        Args:
            files: List of (filename, file_content) tuples
            auto_start_nerf: Whether to automatically start NeRF processing
            strict_validation: If True, warnings become errors
            
        Returns:
            Upload response with validation results
        """
        job_id = self._generate_job_id()
        job_dir = self._get_job_dir(job_id)
        
        logger.info(f"Starting upload job {job_id} with {len(files)} files")
        
        # Create job state
        create_job(
            job_id=job_id,
            job_type=JobType.UPLOAD,
            initial_data={
                "total_count": len(files),
                "uploaded_count": 0,
                "auto_start_nerf": auto_start_nerf,
            }
        )
        
        # Update status to uploading
        update_job(job_id, status=UploadStatus.UPLOADING.value)
        
        try:
            # Filter unsupported files
            supported_files = []
            unsupported_files = []
            
            for filename, content in files:
                if is_supported_extension(filename):
                    supported_files.append((filename, content))
                else:
                    unsupported_files.append(filename)
            
            if unsupported_files:
                logger.warning(
                    f"Skipped {len(unsupported_files)} unsupported files: "
                    f"{', '.join(unsupported_files[:5])}"
                )
            
            # Validate images
            update_job(job_id, status=UploadStatus.VALIDATING.value)
            
            validation_results, dimensions_list, batch_warnings = validate_batch(
                supported_files,
                strict=strict_validation
            )
            
            # Process and upload valid images directly to Modal
            validated_images = []
            valid_count = 0
            warning_count = 0
            error_count = 0
            
            # Upload valid images to Modal
            if modal_service.is_configured():
                for i, ((filename, content), result, dims) in enumerate(
                    zip(supported_files, validation_results, dimensions_list)
                ):
                    file_id = self._generate_file_id()
                    
                    # Count status
                    if result.status == ImageStatus.ERROR:
                        error_count += 1
                    elif result.status == ImageStatus.WARNING:
                        warning_count += 1
                        valid_count += 1  # Warnings are still usable
                    elif result.status == ImageStatus.VALID:
                        valid_count += 1
                    
                    # Upload to Modal if valid or warning
                    if result.is_valid:
                        # Determine extension
                        ext = Path(filename).suffix
                        modal_path = f"/jobs/{job_id}/images/{file_id}{ext}"
                        
                        # Upload directly to Modal
                        await modal_service.upload_file_bytes(content, modal_path)
                        
                        logger.debug(f"Uploaded {filename} to Modal: {modal_path}")
                    
                    # Create validation record (minimal, no URL needed)
                    validated_images.append(
                        ImageValidation(
                            file_id=file_id,
                            filename=filename,
                            url="",  # Not needed, images in Modal
                            size=len(content),
                            dimensions=dims or ImageDimensions(width=0, height=0),
                            status=result.status,
                            warnings=result.warnings,
                            errors=result.errors,
                        )
                    )
            else:
                # Fallback: if Modal not configured, count but don't upload
                logger.warning("Modal service not configured, cannot upload images")
                for i, ((filename, content), result, dims) in enumerate(
                    zip(supported_files, validation_results, dimensions_list)
                ):
                    file_id = self._generate_file_id()
                    
                    if result.status == ImageStatus.ERROR:
                        error_count += 1
                    elif result.status == ImageStatus.WARNING:
                        warning_count += 1
                        valid_count += 1
                    elif result.status == ImageStatus.VALID:
                        valid_count += 1
                    
                    validated_images.append(
                        ImageValidation(
                            file_id=file_id,
                            filename=filename,
                            url="",
                            size=len(content),
                            dimensions=dims or ImageDimensions(width=0, height=0),
                            status=result.status,
                            warnings=result.warnings,
                            errors=result.errors,
                        )
                    )
            
            # Create validation summary
            summary = ValidationSummary(
                total=len(supported_files),
                valid=valid_count,
                warnings=warning_count,
                errors=error_count,
            )
            
            # Update job state
            update_job(
                job_id,
                status=UploadStatus.COMPLETE.value,
                data={
                    "uploaded_count": len(supported_files),
                    "valid_count": valid_count,
                    "warning_count": warning_count,
                    "error_count": error_count,
                    "job_dir": str(job_dir),
                    "completed_at": datetime.utcnow().isoformat(),
                }
            )
            
            logger.info(
                f"Upload job {job_id} complete: "
                f"{valid_count} valid, {warning_count} warnings, {error_count} errors"
            )
            
            # Build response
            response = UploadResponse(
                job_id=job_id,
                status=UploadStatus.COMPLETE,
                uploaded_count=len(supported_files),
                total_count=len(files),
                validated_images=validated_images,
                validation_summary=summary,
                errors=batch_warnings,
                auto_start_nerf=auto_start_nerf and valid_count >= 20,
            )
            
            return response
            
        except Exception as e:
            logger.error(f"Upload job {job_id} failed: {e}", exc_info=True)
            
            # Update job state to failed
            update_job(
                job_id,
                status=UploadStatus.FAILED.value,
                data={"error": str(e)}
            )
            
            # Return error response
            return UploadResponse(
                job_id=job_id,
                status=UploadStatus.FAILED,
                uploaded_count=0,
                total_count=len(files),
                validated_images=[],
                validation_summary=ValidationSummary(
                    total=0,
                    valid=0,
                    warnings=0,
                    errors=len(files),
                ),
                errors=[f"Upload failed: {str(e)}"],
                auto_start_nerf=False,
            )
    
    async def get_upload_status(self, job_id: str) -> Optional[UploadStatusResponse]:
        """
        Get upload job status.
        
        Args:
            job_id: Job identifier
            
        Returns:
            Upload status or None if not found
        """
        job = get_job(job_id)
        if not job or job.job_type != JobType.UPLOAD:
            return None
        
        # Calculate progress
        total = job.data.get("total_count", 0)
        uploaded = job.data.get("uploaded_count", 0)
        progress = (uploaded / total * 100) if total > 0 else 0
        
        # Build status response
        status = UploadStatusResponse(
            job_id=job_id,
            status=UploadStatus(job.status),
            progress=progress,
            uploaded_count=uploaded,
            total_count=total,
        )
        
        return status
    
    def get_uploaded_images(self, job_id: str) -> List[Path]:
        """
        Get list of uploaded image paths for a job.
        
        Args:
            job_id: Job identifier
            
        Returns:
            List of image file paths
        """
        job_dir = self.upload_dir / job_id
        if not job_dir.exists():
            return []
        
        # Get all image files
        images = []
        for ext in get_supported_extensions():
            images.extend(job_dir.glob(f"*{ext}"))
        
        return sorted(images)
    
    async def upload_to_modal(self, job_id: str) -> Tuple[bool, Optional[str]]:
        """
        Upload images to Modal volume for processing.
        
        Args:
            job_id: Job identifier
            
        Returns:
            Tuple of (success, error_message)
        """
        if not modal_service.is_configured():
            return False, "Modal service not configured"
        
        try:
            # Get uploaded images
            images = self.get_uploaded_images(job_id)
            if not images:
                return False, "No images found for job"
            
            logger.info(f"Uploading {len(images)} images to Modal for job {job_id}")
            
            # Create zip archive
            job_dir = self._get_job_dir(job_id)
            zip_path = job_dir / "images.zip"
            
            import zipfile
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for img_path in images:
                    zipf.write(img_path, img_path.name)
            
            logger.debug(f"Created zip archive: {zip_path} ({zip_path.stat().st_size / 1024:.1f} KB)")
            
            # Upload to Modal volume
            remote_path = f"/jobs/{job_id}/images.zip"
            await modal_service.upload_file(zip_path, remote_path)
            
            logger.info(f"Successfully uploaded images to Modal: {remote_path}")
            
            # Clean up local zip
            zip_path.unlink()
            
            return True, None
            
        except Exception as e:
            error_msg = f"Failed to upload to Modal: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return False, error_msg
    
    def cleanup_job(self, job_id: str) -> None:
        """
        Clean up uploaded files for a job.
        
        Args:
            job_id: Job identifier
        """
        job_dir = self._get_job_dir(job_id)
        
        if job_dir.exists():
            try:
                import shutil
                shutil.rmtree(job_dir)
                logger.info(f"Cleaned up job directory: {job_id}")
            except Exception as e:
                logger.error(f"Failed to cleanup job {job_id}: {e}")


# Global upload service instance
_upload_service: Optional[UploadService] = None


def get_upload_service() -> UploadService:
    """
    Get global upload service instance.
    
    Returns:
        Upload service singleton
    """
    global _upload_service
    if _upload_service is None:
        _upload_service = UploadService()
    return _upload_service

