"""
Base Asset Service

Generic service for managing asset uploads, validation, storage, and thumbnail generation.
"""

import uuid
import json
import logging
from pathlib import Path
from typing import Optional, Tuple, List, TypeVar, Generic
from datetime import datetime
from PIL import Image
import io

from ..models.asset_models import AssetUploadResponse, AssetStatus, ImageDimensions

logger = logging.getLogger(__name__)

T = TypeVar('T', bound=AssetUploadResponse)
S = TypeVar('S', bound=AssetStatus)


class BaseAssetService(Generic[T, S]):
    """Base service for managing assets."""
    
    def __init__(self, upload_dir: Path, api_prefix: str, response_class: type[T], status_class: type[S]):
        self.upload_dir = upload_dir
        self.api_prefix = api_prefix
        self.response_class = response_class
        self.status_class = status_class
        self.upload_dir.mkdir(parents=True, exist_ok=True)
    
    def validate_image(self, file_data: bytes, filename: str) -> Tuple[bool, Optional[str]]:
        """
        Validate image meets requirements.
        
        Validation Rules:
        - File size: 0 < size <= 50MB (52,428,800 bytes exactly)
        - Format: PNG or JPEG (check magic bytes, not extension)
        - Dimensions: 100 <= width, height <= 4096
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
        # JPEG magic bytes: \xFF\xD8 (third byte can vary: \xFF for JFIF, \xE0 for Exif, etc.)
        is_jpeg = len(file_data) >= 2 and file_data[:2] == b'\xff\xd8'
        
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
        
        # Check dimensions (min 100x100, max 4096x4096)
        width, height = img.size
        if width < 100 or height < 100:
            return False, f"Image must be at least 100×100 pixels (got {width}×{height})"
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
    
    def save_asset(
        self, 
        file_data: bytes, 
        filename: str,
        user_id: Optional[str] = None
    ) -> T:
        """
        Save asset with thumbnail generation.
        
        Steps:
        1. Validate image
        2. Generate UUID asset_id
        3. Create directory
        4. Save original image
        5. Generate and save thumbnail
        6. Extract and save metadata
        7. Return response
        """
        # Validate
        is_valid, error = self.validate_image(file_data, filename)
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
        
        # Generate asset_id
        asset_id = str(uuid.uuid4())
        
        # Create asset directory
        asset_dir = self.upload_dir / asset_id
        asset_dir.mkdir(parents=True, exist_ok=True)
        
        # Determine format and extension (use saved format)
        img_format = original_format.lower()
        if img_format == 'jpeg':
            img_format = 'jpg'
        ext = 'png' if img_format == 'png' else 'jpg'
        
        # Save original
        original_path = asset_dir / f"original.{ext}"
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
        thumb_path = asset_dir / f"thumb.{ext}"
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
        
        # Upload to ImgBB for public URLs (for external API access)
        public_url = None
        public_thumbnail_url = None
        
        try:
            from ..services.imgbb_service import get_imgbb_service
            print(f"[Asset Upload] Checking ImgBB configuration...")
            imgbb_service = get_imgbb_service()
            
            if imgbb_service:
                # Upload original image
                print(f"[Asset Upload] Uploading {filename} to ImgBB...")
                logger.info(f"Uploading {filename} to ImgBB...")
                public_url = imgbb_service.upload_image(original_path)
                
                if public_url:
                    print(f"[Asset Upload] ✓ Successfully uploaded to ImgBB: {public_url}")
                    logger.info(f"Successfully uploaded to ImgBB: {public_url}")
                    
                    # Upload thumbnail if original succeeded
                    print(f"[Asset Upload] Uploading thumbnail for {filename} to ImgBB...")
                    logger.info(f"Uploading thumbnail for {filename} to ImgBB...")
                    public_thumbnail_url = imgbb_service.upload_image(thumb_path)
                    
                    if public_thumbnail_url:
                        print(f"[Asset Upload] ✓ Successfully uploaded thumbnail to ImgBB: {public_thumbnail_url}")
                        logger.info(f"Successfully uploaded thumbnail to ImgBB: {public_thumbnail_url}")
                    else:
                        print(f"[Asset Upload] ⚠️  Thumbnail upload to ImgBB failed")
                else:
                    print(f"[Asset Upload] ⚠️  Failed to upload to ImgBB (no URL returned)")
            else:
                print(f"[Asset Upload] ⚠️  ImgBB service not configured (IMGBB_API_KEY not set). Skipping public URL upload.")
                logger.info("ImgBB service not configured, skipping public URL upload")
        except Exception as e:
            print(f"[Asset Upload] ❌ Error uploading to ImgBB: {e}")
            logger.warning(f"Failed to upload to ImgBB: {e}. Continuing with local URLs.", exc_info=True)
        
        # Extract metadata
        width, height = img.size
        file_size = len(file_data)
        has_alpha = img.mode == 'RGBA'
        uploaded_at = datetime.utcnow().isoformat()
        
        # Save metadata (exact structure required)
        metadata = {
            "asset_id": asset_id,
            "filename": filename,
            "format": img_format,  # "png" or "jpg"
            "dimensions": {"width": width, "height": height},
            "file_size": file_size,  # bytes
            "has_alpha": has_alpha,  # boolean
            "uploaded_at": uploaded_at,  # ISO 8601 format
            "public_url": public_url,  # Public URL from ImgBB
            "public_thumbnail_url": public_thumbnail_url,  # Public thumbnail URL from ImgBB
            "user_id": user_id  # User ID for asset isolation
        }
        
        metadata_path = asset_dir / "metadata.json"
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        # Return response using the specific response class
        return self.response_class(
            asset_id=asset_id,
            filename=filename,
            url=f"/api/{self.api_prefix}/{asset_id}/image",
            thumbnail_url=f"/api/{self.api_prefix}/{asset_id}/thumbnail",
            public_url=public_url,
            public_thumbnail_url=public_thumbnail_url,
            size=file_size,
            dimensions=ImageDimensions(width=width, height=height),
            format=img_format,
            has_alpha=has_alpha,
            uploaded_at=uploaded_at
        )
    
    def get_asset(self, asset_id: str, user_id: Optional[str] = None) -> Optional[S]:
        """Get asset metadata and URLs. Optionally verify ownership."""
        asset_dir = self.upload_dir / asset_id
        metadata_path = asset_dir / "metadata.json"
        
        if not metadata_path.exists():
            return None
        
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)
        
        # Verify ownership if user_id is provided
        if user_id is not None:
            asset_user_id = metadata.get("user_id")
            if asset_user_id and asset_user_id != user_id:
                return None  # Asset belongs to a different user
        
        return self.status_class(
            asset_id=asset_id,
            status="active",
            url=f"/api/{self.api_prefix}/{asset_id}/image",
            thumbnail_url=f"/api/{self.api_prefix}/{asset_id}/thumbnail",
            public_url=metadata.get("public_url"),  # Public URL from ImgBB
            public_thumbnail_url=metadata.get("public_thumbnail_url"),  # Public thumbnail URL from ImgBB
            dimensions=ImageDimensions(**metadata["dimensions"]),
            format=metadata["format"],
            has_alpha=metadata["has_alpha"],
            metadata=metadata
        )
    
    def list_assets(self, user_id: Optional[str] = None) -> List[S]:
        """List assets. If user_id is provided, only return assets for that user."""
        assets = []
        
        if not self.upload_dir.exists():
            return assets
        
        # Iterate through all asset directories
        for asset_dir in self.upload_dir.iterdir():
            if not asset_dir.is_dir():
                continue
            
            asset_id = asset_dir.name
            asset = self.get_asset(asset_id, user_id=user_id)
            if asset:
                assets.append(asset)
        
        # Sort by uploaded_at (most recent first)
        assets.sort(key=lambda x: x.metadata.get("uploaded_at", ""), reverse=True)
        
        return assets
    
    def delete_asset(self, asset_id: str, user_id: Optional[str] = None) -> bool:
        """Remove asset directory and all files. Optionally verify ownership."""
        asset_dir = self.upload_dir / asset_id
        
        if not asset_dir.exists():
            return False
        
        # Verify ownership if user_id is provided
        if user_id is not None:
            metadata_path = asset_dir / "metadata.json"
            if metadata_path.exists():
                with open(metadata_path, 'r') as f:
                    metadata = json.load(f)
                asset_user_id = metadata.get("user_id")
                if asset_user_id and asset_user_id != user_id:
                    return False  # Asset belongs to a different user
        
        # Remove all files in directory
        import shutil
        shutil.rmtree(asset_dir)
        
        return True
    
    def get_asset_path(self, asset_id: str, thumbnail: bool = False) -> Optional[Path]:
        """Get path to asset image file."""
        asset_dir = self.upload_dir / asset_id
        
        if not asset_dir.exists():
            return None
        
        # Find the image file (could be .png or .jpg)
        filename = "thumb" if thumbnail else "original"
        
        png_path = asset_dir / f"{filename}.png"
        jpg_path = asset_dir / f"{filename}.jpg"
        
        if png_path.exists():
            return png_path
        elif jpg_path.exists():
            return jpg_path
        
        return None


