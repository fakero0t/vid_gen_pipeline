"""
Modal Service - Core API Client for Modal Functions

This service provides a singleton client for interacting with Modal functions,
including retry logic, error handling, and GPU fallback.
"""

import modal
import asyncio
import json
import logging
from typing import Dict, Any, Optional
from pathlib import Path

from ..config import settings


# Configure logging
logger = logging.getLogger(__name__)


class ModalAPIError(Exception):
    """Base exception for Modal API errors."""
    pass


class ModalGPUUnavailable(ModalAPIError):
    """Exception raised when requested GPU is unavailable."""
    pass


class ModalRateLimitError(ModalAPIError):
    """Exception raised when Modal rate limit is hit."""
    pass


class ModalService:
    """
    Singleton service for interacting with Modal functions.
    
    Provides:
    - Modal client initialization
    - Function calling with retry logic
    - Progress tracking via volume
    - Error handling with GPU fallback
    """
    
    _instance: Optional['ModalService'] = None
    _initialized: bool = False
    
    def __new__(cls):
        """Singleton pattern - ensure only one instance exists."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Initialize Modal client (only once)."""
        if not self._initialized:
            self._initialize()
            ModalService._initialized = True
    
    def _get_app_name(self) -> str:
        """Get the Modal app name based on environment."""
        return "nerf-dev" if settings.is_development() else "nerf-prod"
    
    def _initialize(self):
        """Initialize Modal client and lookup resources."""
        # Check for Modal credentials
        if not settings.has_modal_credentials():
            logger.warning(
                "Modal credentials not configured. "
                "Set MODAL_TOKEN_ID and MODAL_TOKEN_SECRET environment variables."
            )
            self.app = None
            self.volume = None
            return
        
        try:
            # Determine app name based on environment
            app_name = self._get_app_name()
            
            # Lookup deployed Modal app (for reference, but functions are accessed via Function.from_name)
            # Modal handles authentication automatically via ~/.modal.toml
            self.app = modal.App.lookup(app_name)
            
            # Get shared Modal volume (from_name will create if missing)
            self.volume = modal.Volume.from_name("nerf-data", create_if_missing=True)
            
            logger.info(f"Modal service initialized: app={app_name}, env={settings.ENVIRONMENT}")
            
        except Exception as e:
            logger.error(f"Failed to initialize Modal service: {e}")
            self.app = None
            self.volume = None
            raise ModalAPIError(f"Modal initialization failed: {e}")
    
    def is_configured(self) -> bool:
        """Check if Modal service is properly configured."""
        return self.app is not None and self.volume is not None
    
    async def call_function(
        self,
        function_name: str,
        max_retries: int = 3,
        **kwargs
    ) -> Any:
        """
        Call a Modal function with retry logic and error handling.
        
        Args:
            function_name: Name of Modal function to call
            max_retries: Maximum number of retry attempts
            **kwargs: Arguments to pass to the function
            
        Returns:
            Function call handle (use .get() to wait for result)
            
        Raises:
            ModalAPIError: If function call fails after retries
            ModalGPUUnavailable: If GPU allocation fails
            ModalRateLimitError: If rate limit is hit
        """
        if not self.is_configured():
            raise ModalAPIError("Modal service not configured")
        
        # Note: GPU is configured in the function decorator, not passed as parameter
        # Remove gpu_type from kwargs if present (it's not a function parameter)
        kwargs.pop("gpu_type", None)
        
        for attempt in range(max_retries):
            try:
                # Get app name for function lookup
                app_name = self._get_app_name()
                
                # Lookup function by name from deployed app
                # Format: Function.from_name("app-name", "function-name")
                func = modal.Function.from_name(app_name, function_name)
                
                # Spawn function (non-blocking)
                function_call = func.spawn(**kwargs)
                
                logger.info(
                    f"Modal function called: {function_name} "
                    f"(attempt {attempt + 1}/{max_retries})"
                )
                
                return function_call
                
            except Exception as e:
                error_msg = str(e).lower()
                
                # Handle rate limiting
                if "rate limit" in error_msg or "429" in error_msg:
                    if attempt < max_retries - 1:
                        delay = 2 ** attempt  # Exponential backoff: 1s, 2s, 4s
                        logger.warning(
                            f"Modal rate limit hit, retrying in {delay}s "
                            f"(attempt {attempt + 1}/{max_retries})"
                        )
                        await asyncio.sleep(delay)
                        continue
                    else:
                        raise ModalRateLimitError("Modal rate limit exceeded after retries")
                
                # Handle GPU unavailability
                # Note: GPU is set in function decorator, so fallback requires redeployment
                # For now, just raise the error - GPU fallback would need app redeployment
                if "gpu" in error_msg and ("unavailable" in error_msg or "not available" in error_msg):
                        raise ModalGPUUnavailable(
                        f"GPU unavailable: {e}. The function GPU is configured in the decorator and cannot be changed at runtime."
                        )
                
                # Generic error retry
                if attempt < max_retries - 1:
                    delay = 2 ** attempt  # Exponential backoff
                    logger.warning(
                        f"Modal function call failed: {e}, "
                        f"retrying in {delay}s (attempt {attempt + 1}/{max_retries})"
                    )
                    await asyncio.sleep(delay)
                    continue
                else:
                    raise ModalAPIError(f"Modal function call failed after {max_retries} attempts: {e}")
        
        raise ModalAPIError("Unexpected error in call_function")
    
    async def get_progress(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Read progress.json from Modal volume for a job.
        
        Args:
            job_id: Job identifier
            
        Returns:
            Progress data dict or None if not found
        """
        if not self.is_configured():
            return {"progress": 0, "stage": "error", "message": "Modal service not configured"}
        
        try:
            progress_path = f"/jobs/{job_id}/progress.json"
            
            # Read file from Modal volume
            data = self.volume.read_file(progress_path)
            
            # Parse JSON
            progress = json.loads(data)
            
            return progress
            
        except FileNotFoundError:
            # Progress file doesn't exist yet
            return {"progress": 0, "stage": "initializing", "message": "Initializing..."}
            
        except Exception as e:
            logger.error(f"Failed to read progress for job {job_id}: {e}")
            return None
    
    async def upload_file(
        self,
        local_path: Path,
        remote_path: str
    ) -> None:
        """
        Upload a file to Modal volume.
        
        Args:
            local_path: Local file path
            remote_path: Remote path in Modal volume
        """
        if not self.is_configured():
            raise ModalAPIError("Modal service not configured")
        
        try:
            # Use batch_upload context manager to upload file
            # put_file can accept either a file path string or a file-like object
            with self.volume.batch_upload() as batch:
                batch.put_file(str(local_path), remote_path)
            
            logger.info(f"Uploaded {local_path} to Modal volume: {remote_path}")
            
        except Exception as e:
            raise ModalAPIError(f"Failed to upload file to Modal volume: {e}")
    
    async def upload_file_bytes(
        self,
        file_bytes: bytes,
        remote_path: str
    ) -> None:
        """
        Upload file bytes directly to Modal volume.
        
        Args:
            file_bytes: File content as bytes
            remote_path: Remote path in Modal volume
        """
        if not self.is_configured():
            raise ModalAPIError("Modal service not configured")
        
        try:
            import io
            # Create file-like object from bytes
            file_obj = io.BytesIO(file_bytes)
            
            # Run blocking operation in executor to avoid blocking event loop
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,  # Use default executor
                self._upload_bytes_sync,
                file_obj,
                remote_path
            )
            
            logger.info(f"Uploaded {len(file_bytes)} bytes to Modal volume: {remote_path}")
            
        except Exception as e:
            raise ModalAPIError(f"Failed to upload file bytes to Modal volume: {e}")
    
    def _upload_bytes_sync(self, file_obj, remote_path):
        """Synchronous helper for batch upload."""
        with self.volume.batch_upload() as batch:
            batch.put_file(file_obj, remote_path)
    
    async def download_file(
        self,
        remote_path: str,
        local_path: Path
    ) -> Path:
        """
        Download a file from Modal volume.
        
        Args:
            remote_path: Remote path in Modal volume
            local_path: Local file path to save to
            
        Returns:
            Path to downloaded file
        """
        if not self.is_configured():
            raise ModalAPIError("Modal service not configured")
        
        try:
            # Ensure parent directory exists
            local_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Read file from Modal volume
            data = self.volume.read_file(remote_path)
            
            # Write to local file
            with open(local_path, 'wb') as f:
                f.write(data)
            
            logger.info(f"Downloaded {remote_path} from Modal volume to {local_path}")
            
            return local_path
            
        except Exception as e:
            raise ModalAPIError(f"Failed to download file from Modal volume: {e}")
    
    async def list_files(self, remote_dir: str) -> list[str]:
        """
        List files in a Modal volume directory.
        
        Args:
            remote_dir: Remote directory path in Modal volume
            
        Returns:
            List of file paths
        """
        if not self.is_configured():
            raise ModalAPIError("Modal service not configured")
        
        try:
            files = self.volume.listdir(remote_dir)
            return files
            
        except Exception as e:
            logger.error(f"Failed to list files in {remote_dir}: {e}")
            return []
    
    async def delete_job_data(self, job_id: str) -> None:
        """
        Delete job data from Modal volume.
        
        Args:
            job_id: Job identifier
        """
        if not self.is_configured():
            logger.warning("Modal service not configured, cannot delete job data")
            return
        
        try:
            job_path = f"/jobs/{job_id}"
            
            # List all files in job directory
            files = await self.list_files(job_path)
            
            # Delete each file
            for file_path in files:
                try:
                    self.volume.remove_file(file_path)
                except Exception as e:
                    logger.warning(f"Failed to delete {file_path}: {e}")
            
            logger.info(f"Deleted job data for {job_id} from Modal volume")
            
        except Exception as e:
            logger.error(f"Failed to delete job data for {job_id}: {e}")


# Global singleton instance
modal_service = ModalService()


# Convenience functions for common operations
async def call_modal_function(function_name: str, **kwargs) -> Any:
    """
    Convenience function to call Modal function.
    
    Args:
        function_name: Name of function to call
        **kwargs: Function arguments
        
    Returns:
        Function call handle
    """
    return await modal_service.call_function(function_name, **kwargs)


async def get_job_progress(job_id: str) -> Optional[Dict[str, Any]]:
    """
    Convenience function to get job progress.
    
    Args:
        job_id: Job identifier
        
    Returns:
        Progress data
    """
    return await modal_service.get_progress(job_id)

