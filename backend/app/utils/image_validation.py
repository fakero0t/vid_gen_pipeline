"""
Image Validation Utilities

This module provides utilities for validating product photos before NeRF processing,
including format checks, dimension validation, and quality assessment.
"""

import io
from pathlib import Path
from typing import Tuple, List, Optional
from PIL import Image
import logging

from ..models.nerf_models import ImageStatus, ImageDimensions

logger = logging.getLogger(__name__)


# Validation constants
MIN_IMAGE_SIZE = 512  # Minimum dimension (width or height)
MAX_IMAGE_SIZE = 8192  # Maximum dimension
MIN_TOTAL_PIXELS = 512 * 512  # Minimum total pixels
MAX_FILE_SIZE_MB = 50  # Maximum file size
SUPPORTED_FORMATS = {"JPEG", "PNG", "WEBP"}
RECOMMENDED_IMAGE_COUNT = 80
MIN_IMAGE_COUNT = 20
MAX_IMAGE_COUNT = 200


class ValidationResult:
    """Result of image validation."""
    
    def __init__(
        self,
        status: ImageStatus,
        warnings: List[str] = None,
        errors: List[str] = None
    ):
        self.status = status
        self.warnings = warnings or []
        self.errors = errors or []
    
    @property
    def is_valid(self) -> bool:
        """Check if image is valid (no errors)."""
        return self.status in (ImageStatus.VALID, ImageStatus.WARNING) and len(self.errors) == 0
    
    @property
    def has_warnings(self) -> bool:
        """Check if image has warnings."""
        return len(self.warnings) > 0


def validate_image_file(
    file_content: bytes,
    filename: str,
    strict: bool = False
) -> Tuple[ValidationResult, Optional[ImageDimensions]]:
    """
    Validate an image file for NeRF processing.
    
    Args:
        file_content: Image file content as bytes
        filename: Original filename
        strict: If True, warnings become errors
        
    Returns:
        Tuple of (ValidationResult, ImageDimensions or None)
    """
    warnings = []
    errors = []
    dimensions = None
    
    try:
        # Check file size
        file_size_mb = len(file_content) / (1024 * 1024)
        if file_size_mb > MAX_FILE_SIZE_MB:
            errors.append(f"File size {file_size_mb:.1f}MB exceeds maximum {MAX_FILE_SIZE_MB}MB")
            return ValidationResult(ImageStatus.ERROR, warnings, errors), None
        
        # Open image
        try:
            image = Image.open(io.BytesIO(file_content))
        except Exception as e:
            errors.append(f"Failed to open image: {str(e)}")
            return ValidationResult(ImageStatus.ERROR, warnings, errors), None
        
        # Check format
        if image.format not in SUPPORTED_FORMATS:
            errors.append(
                f"Unsupported format '{image.format}'. "
                f"Supported formats: {', '.join(SUPPORTED_FORMATS)}"
            )
            return ValidationResult(ImageStatus.ERROR, warnings, errors), None
        
        # Get dimensions
        width, height = image.size
        dimensions = ImageDimensions(width=width, height=height)
        
        # Validate dimensions
        if width < MIN_IMAGE_SIZE or height < MIN_IMAGE_SIZE:
            errors.append(
                f"Image dimensions {width}x{height} too small. "
                f"Minimum: {MIN_IMAGE_SIZE}x{MIN_IMAGE_SIZE}"
            )
        
        if width > MAX_IMAGE_SIZE or height > MAX_IMAGE_SIZE:
            errors.append(
                f"Image dimensions {width}x{height} too large. "
                f"Maximum: {MAX_IMAGE_SIZE}x{MAX_IMAGE_SIZE}"
            )
        
        total_pixels = width * height
        if total_pixels < MIN_TOTAL_PIXELS:
            errors.append(
                f"Image resolution too low ({total_pixels:,} pixels). "
                f"Minimum: {MIN_TOTAL_PIXELS:,} pixels"
            )
        
        # Check aspect ratio (warn if extreme)
        aspect_ratio = max(width, height) / min(width, height)
        if aspect_ratio > 3.0:
            warning = f"Extreme aspect ratio {aspect_ratio:.1f}:1 may affect quality"
            if strict:
                errors.append(warning)
            else:
                warnings.append(warning)
        
        # Check image mode
        if image.mode not in ("RGB", "RGBA", "L"):
            warning = f"Image mode '{image.mode}' will be converted to RGB"
            warnings.append(warning)
        
        # Check if image is grayscale (warn)
        if image.mode == "L":
            warning = "Grayscale image detected - color images recommended"
            if strict:
                errors.append(warning)
            else:
                warnings.append(warning)
        
        # Determine status
        if errors:
            status = ImageStatus.ERROR
        elif warnings:
            status = ImageStatus.WARNING
        else:
            status = ImageStatus.VALID
        
        return ValidationResult(status, warnings, errors), dimensions
        
    except Exception as e:
        logger.error(f"Unexpected error validating {filename}: {e}")
        errors.append(f"Validation error: {str(e)}")
        return ValidationResult(ImageStatus.ERROR, warnings, errors), None


def validate_image_count(count: int) -> Tuple[bool, List[str]]:
    """
    Validate the total number of images.
    
    Args:
        count: Number of images
        
    Returns:
        Tuple of (is_valid, warnings)
    """
    warnings = []
    
    if count < MIN_IMAGE_COUNT:
        return False, [
            f"Too few images ({count}). Minimum: {MIN_IMAGE_COUNT}. "
            f"NeRF training requires sufficient coverage."
        ]
    
    if count > MAX_IMAGE_COUNT:
        return False, [
            f"Too many images ({count}). Maximum: {MAX_IMAGE_COUNT}. "
            f"Upload in batches or select best images."
        ]
    
    if count < RECOMMENDED_IMAGE_COUNT:
        warnings.append(
            f"Only {count} images provided. Recommended: {RECOMMENDED_IMAGE_COUNT}+ "
            f"for best quality."
        )
    
    return True, warnings


def check_image_diversity(filenames: List[str]) -> List[str]:
    """
    Check for potential issues with image diversity.
    
    Args:
        filenames: List of image filenames
        
    Returns:
        List of warnings
    """
    warnings = []
    
    # Check for sequential naming patterns (might indicate burst photos)
    sequential_count = 0
    sorted_names = sorted(filenames)
    
    for i in range(1, len(sorted_names)):
        # Simple heuristic: check if names differ by only a few characters
        prev = sorted_names[i-1]
        curr = sorted_names[i]
        
        # Count matching prefix length
        prefix_len = 0
        for j in range(min(len(prev), len(curr))):
            if prev[j] == curr[j]:
                prefix_len += 1
            else:
                break
        
        # If most of the name matches, might be sequential
        if prefix_len > len(prev) * 0.7:
            sequential_count += 1
    
    if sequential_count > len(filenames) * 0.5:
        warnings.append(
            "Many sequentially named images detected. Ensure photos are taken "
            "from diverse angles around the product for best 3D reconstruction."
        )
    
    return warnings


def validate_batch(
    files: List[Tuple[str, bytes]],
    strict: bool = False
) -> Tuple[List[ValidationResult], List[Optional[ImageDimensions]], List[str]]:
    """
    Validate a batch of images.
    
    Args:
        files: List of (filename, file_content) tuples
        strict: If True, warnings become errors
        
    Returns:
        Tuple of (validation_results, dimensions, batch_warnings)
    """
    results = []
    dimensions_list = []
    
    # Validate each image
    for filename, content in files:
        result, dims = validate_image_file(content, filename, strict)
        results.append(result)
        dimensions_list.append(dims)
    
    # Get batch-level warnings
    batch_warnings = []
    
    # Check image count
    count_valid, count_warnings = validate_image_count(len(files))
    if not count_valid:
        # This is critical, add to errors
        for result in results:
            result.errors.extend(count_warnings)
        batch_warnings.extend(count_warnings)
    else:
        batch_warnings.extend(count_warnings)
    
    # Check diversity
    filenames = [f[0] for f in files]
    diversity_warnings = check_image_diversity(filenames)
    batch_warnings.extend(diversity_warnings)
    
    return results, dimensions_list, batch_warnings


def get_supported_extensions() -> List[str]:
    """
    Get list of supported file extensions.
    
    Returns:
        List of extensions (with dots)
    """
    return [".jpg", ".jpeg", ".png", ".webp"]


def is_supported_extension(filename: str) -> bool:
    """
    Check if filename has supported extension.
    
    Args:
        filename: Filename to check
        
    Returns:
        True if extension is supported
    """
    ext = Path(filename).suffix.lower()
    return ext in get_supported_extensions()

