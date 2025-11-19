"""
Product Image Service

Handles product image upload, validation, storage, and thumbnail generation.
"""

import uuid
import json
from pathlib import Path
from typing import Optional, Tuple
from datetime import datetime
from PIL import Image
import io

from ..models.product_models import (
    ProductImageUploadResponse,
    ProductImageStatus,
    ImageDimensions
)


class ProductImageService:
    """Service for managing product images."""
    
    def __init__(self, upload_dir: Path = Path("uploads/products")):
        self.upload_dir = upload_dir
        self.upload_dir.mkdir(parents=True, exist_ok=True)
    
    def validate_product_image(self, file_data: bytes, filename: str) -> Tuple[bool, Optional[str]]:
        """
        Validate image meets requirements.
        
        Validation Rules:
        - File size: 0 < size <= 50MB (52,428,800 bytes exactly)
        - Format: PNG or JPEG (check magic bytes, not extension)
        - Dimensions: 512 <= width, height <= 4096
        - Image mode: RGB, RGBA, or L (grayscale)
        - Must be openable by PIL
        
        Returns: (is_valid, error_message)
        """
        # Check file size (50MB max = 52,428,800 bytes)
        MAX_SIZE = 50 * 1024 * 1024
        if len(file_data) == 0:
            return False, "Empty file"
        if len(file_data) > MAX_SIZE:
            return False, f"File size must be under 50MB (got {len(file_data) / (1024*1024):.1f}MB)"
        
        # Check magic bytes for valid image format
        if len(file_data) < 4:
            return False, "File too small to be a valid image"
        
        # PNG magic bytes: \x89PNG
        is_png = file_data[:8] == b'\x89PNG\r\n\x1a\n'
        # JPEG magic bytes: \xFF\xD8\xFF
        is_jpeg = file_data[:3] == b'\xff\xd8\xff'
        
        if not (is_png or is_jpeg):
            return False, "Only PNG and JPG images are supported (invalid file format)"
        
        # Try to open with PIL
        try:
            img = Image.open(io.BytesIO(file_data))
            img.verify()  # Verify it's a valid image
            # Re-open after verify (verify closes the file)
            img = Image.open(io.BytesIO(file_data))
        except Exception as e:
            return False, f"Invalid image file: {str(e)}"
        
        # Check format matches magic bytes
        if img.format not in ['PNG', 'JPEG']:
            return False, f"Unsupported image format: {img.format}"
        
        # Check dimensions (min 512x512, max 4096x4096)
        width, height = img.size
        if width < 512 or height < 512:
            return False, f"Image must be at least 512×512 pixels (got {width}×{height})"
        if width > 4096 or height > 4096:
            return False, f"Image dimensions must not exceed 4096×4096 pixels (got {width}×{height})"
        
        # Check image mode (accept common modes, will convert if needed)
        # P = Palette mode (common in PNGs), will be converted to RGB/RGBA
        # Valid modes: RGB, RGBA, L (grayscale), P (palette), PA (palette with alpha)
        if img.mode not in ['RGB', 'RGBA', 'L', 'P', 'PA']:
            return False, f"Unsupported image mode: {img.mode}. Cannot process this image type"
        
        return True, None
    
    def generate_thumbnail(self, image: Image.Image, size: int = 512) -> Image.Image:
        """
        Generate square thumbnail with aspect ratio preservation.
        
        Specifications:
        - Exact size: 512×512 pixels
        - Resampling: LANCZOS (highest quality)
        - Maintains aspect ratio
        - Centers image in square canvas
        - Background: Transparent for RGBA, white for RGB
        
        Args:
            image: PIL Image
            size: Target size (default 512x512)
        
        Returns:
            Thumbnail image (512x512)
        """
        # Create thumbnail maintaining aspect ratio
        # thumbnail() modifies in place but preserves aspect ratio
        img = image.copy()
        img.thumbnail((size, size), Image.Resampling.LANCZOS)
        
        # Create square canvas with appropriate background
        if img.mode == 'RGBA':
            # Transparent background for RGBA
            thumb = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        else:
            # White background for RGB
            thumb = Image.new('RGB', (size, size), (255, 255, 255))
        
        # Calculate center position
        offset_x = (size - img.width) // 2
        offset_y = (size - img.height) // 2
        
        # Paste centered (use alpha channel if available)
        if img.mode == 'RGBA':
            thumb.paste(img, (offset_x, offset_y), img)
        else:
            thumb.paste(img, (offset_x, offset_y))
        
        return thumb
    
    def save_product_image(
        self, 
        file_data: bytes, 
        filename: str
    ) -> ProductImageUploadResponse:
        """
        Save product image with thumbnail generation.
        
        Steps:
        1. Validate image
        2. Generate UUID product_id
        3. Create directory
        4. Save original image
        5. Generate and save thumbnail
        6. Extract and save metadata
        7. Return response
        """
        # Validate
        is_valid, error = self.validate_product_image(file_data, filename)
        if not is_valid:
            raise ValueError(error)
        
        # Load image
        img = Image.open(io.BytesIO(file_data))
        
        # Save original format before any conversions (PIL loses this after convert)
        original_format = img.format
        
        # Convert palette mode images to RGB/RGBA
        if img.mode == 'P':
            # Check if image has transparency
            if 'transparency' in img.info:
                img = img.convert('RGBA')
            else:
                img = img.convert('RGB')
        elif img.mode == 'PA':
            img = img.convert('RGBA')
        elif img.mode == 'L':
            # Keep grayscale as-is, but convert to RGB for consistency
            img = img.convert('RGB')
        
        # Generate product_id
        product_id = str(uuid.uuid4())
        
        # Create product directory
        product_dir = self.upload_dir / product_id
        product_dir.mkdir(parents=True, exist_ok=True)
        
        # Determine format and extension (use saved format)
        img_format = original_format.lower()
        if img_format == 'jpeg':
            img_format = 'jpg'
        ext = 'png' if img_format == 'png' else 'jpg'
        
        # Save original
        original_path = product_dir / f"original.{ext}"
        if img_format == 'png':
            # Save PNG with full quality, preserve alpha
            img.save(original_path, 'PNG', optimize=False)
        else:
            # Convert RGBA to RGB for JPEG (JPEG doesn't support transparency)
            if img.mode == 'RGBA':
                # Create white background
                rgb_img = Image.new('RGB', img.size, (255, 255, 255))
                rgb_img.paste(img, mask=img.split()[3])  # Use alpha as mask
                img = rgb_img
            elif img.mode == 'L':
                img = img.convert('RGB')
            img.save(original_path, 'JPEG', quality=95, optimize=True)
        
        # Generate and save thumbnail (always 512x512)
        thumb = self.generate_thumbnail(img, size=512)
        thumb_path = product_dir / f"thumb.{ext}"
        if img_format == 'png':
            # PNG thumbnails preserve transparency
            thumb.save(thumb_path, 'PNG', optimize=True)
        else:
            # JPEG thumbnails need RGB conversion
            if thumb.mode == 'RGBA':
                rgb_thumb = Image.new('RGB', thumb.size, (255, 255, 255))
                rgb_thumb.paste(thumb, mask=thumb.split()[3])
                thumb = rgb_thumb
            thumb.save(thumb_path, 'JPEG', quality=90, optimize=True)
        
        # Extract metadata
        width, height = img.size
        file_size = len(file_data)
        has_alpha = img.mode == 'RGBA'
        uploaded_at = datetime.utcnow().isoformat()
        
        # Save metadata (exact structure required)
        metadata = {
            "product_id": product_id,
            "filename": filename,
            "format": img_format,  # "png" or "jpg"
            "dimensions": {"width": width, "height": height},
            "file_size": file_size,  # bytes
            "has_alpha": has_alpha,  # boolean
            "uploaded_at": uploaded_at  # ISO 8601 format
        }
        
        metadata_path = product_dir / "metadata.json"
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        # Return response
        return ProductImageUploadResponse(
            product_id=product_id,
            filename=filename,
            url=f"/api/product/{product_id}/image",
            thumbnail_url=f"/api/product/{product_id}/thumbnail",
            size=file_size,
            dimensions=ImageDimensions(width=width, height=height),
            format=img_format,
            has_alpha=has_alpha,
            uploaded_at=uploaded_at
        )
    
    def get_product_image(self, product_id: str) -> Optional[ProductImageStatus]:
        """Get product metadata and URLs."""
        product_dir = self.upload_dir / product_id
        metadata_path = product_dir / "metadata.json"
        
        if not metadata_path.exists():
            return None
        
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)
        
        return ProductImageStatus(
            product_id=product_id,
            status="active",
            url=f"/api/product/{product_id}/image",
            thumbnail_url=f"/api/product/{product_id}/thumbnail",
            dimensions=ImageDimensions(**metadata["dimensions"]),
            format=metadata["format"],
            has_alpha=metadata["has_alpha"],
            metadata=metadata
        )
    
    def delete_product_image(self, product_id: str) -> bool:
        """Remove product directory and all files."""
        product_dir = self.upload_dir / product_id
        
        if not product_dir.exists():
            return False
        
        # Remove all files in directory
        import shutil
        shutil.rmtree(product_dir)
        
        return True
    
    def get_product_image_path(self, product_id: str, thumbnail: bool = False) -> Optional[Path]:
        """Get path to product image file."""
        product_dir = self.upload_dir / product_id
        
        if not product_dir.exists():
            return None
        
        # Find the image file (could be .png or .jpg)
        filename = "thumb" if thumbnail else "original"
        
        png_path = product_dir / f"{filename}.png"
        jpg_path = product_dir / f"{filename}.jpg"
        
        if png_path.exists():
            return png_path
        elif jpg_path.exists():
            return jpg_path
        
        return None


# Singleton instance
_product_service: Optional[ProductImageService] = None

def get_product_service() -> ProductImageService:
    """Get or create product service singleton."""
    global _product_service
    if _product_service is None:
        _product_service = ProductImageService()
    return _product_service

