"""
Base Asset Service

Generic service for managing asset uploads, validation, storage, and thumbnail generation.
Uses Firebase Storage for cloud storage.
"""

import uuid
import logging
import tempfile
from pathlib import Path
from typing import Optional, Tuple, List, TypeVar, Generic
from datetime import datetime
from PIL import Image
import io

from ..models.asset_models import AssetUploadResponse, AssetStatus, ImageDimensions
from ..services.firebase_storage_service import get_firebase_storage_service

logger = logging.getLogger(__name__)

T = TypeVar('T', bound=AssetUploadResponse)
S = TypeVar('S', bound=AssetStatus)


class BaseAssetService(Generic[T, S]):
    """Base service for managing assets."""

    def __init__(self, upload_dir: Path, api_prefix: str, response_class: type[T], status_class: type[S]):
        self.upload_dir = upload_dir  # Kept for backwards compatibility but not used
        self.api_prefix = api_prefix
        self.response_class = response_class
        self.status_class = status_class
        self.firebase_service = get_firebase_storage_service()
        if not self.firebase_service:
            logger.warning(f"Firebase Storage not available for {api_prefix} - asset uploads will fail")
    
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
        3. Process and save original image to Firebase
        4. Generate and save thumbnail to Firebase
        5. Return response with Firebase URLs
        """
        if not self.firebase_service:
            raise ValueError("Firebase Storage not configured")

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

        # Determine format and extension (use saved format)
        img_format = original_format.lower()
        if img_format == 'jpeg':
            img_format = 'jpg'
        ext = 'png' if img_format == 'png' else 'jpg'

        # Use temporary files for upload
        with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as original_temp:
            original_temp_path = Path(original_temp.name)

            # Save original
            if img_format == 'png':
                # Save PNG with full quality, preserve alpha
                img.save(original_temp_path, 'PNG', optimize=False)
            else:
                # Convert RGBA to RGB for JPEG (JPEG doesn't support transparency)
                if img.mode == 'RGBA':
                    # Create white background
                    rgb_img = Image.new('RGB', img.size, (255, 255, 255))
                    rgb_img.paste(img, mask=img.split()[3])  # Use alpha as mask
                    img = rgb_img
                elif img.mode == 'L':
                    img = img.convert('RGB')
                img.save(original_temp_path, 'JPEG', quality=95, optimize=True)

            # Upload original to Firebase
            print(f"[Asset Upload] Uploading {filename} to Firebase Storage...")
            logger.info(f"Uploading {filename} to Firebase Storage...")
            public_url = self.firebase_service.upload_image(
                original_temp_path,
                folder=f"assets/{self.api_prefix}"
            )

            # Clean up temp file
            original_temp_path.unlink()

            if not public_url:
                raise ValueError("Failed to upload original image to Firebase")

            print(f"[Asset Upload] ✓ Successfully uploaded to Firebase Storage: {public_url}")
            logger.info(f"Successfully uploaded to Firebase Storage: {public_url}")

        # Generate and save thumbnail
        thumb = self.generate_thumbnail(img, size=512)

        with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as thumb_temp:
            thumb_temp_path = Path(thumb_temp.name)

            if img_format == 'png':
                # PNG thumbnails preserve transparency
                thumb.save(thumb_temp_path, 'PNG', optimize=True)
            else:
                # JPEG thumbnails need RGB conversion
                if thumb.mode == 'RGBA':
                    rgb_thumb = Image.new('RGB', thumb.size, (255, 255, 255))
                    rgb_thumb.paste(thumb, mask=thumb.split()[3])
                    thumb = rgb_thumb
                thumb.save(thumb_temp_path, 'JPEG', quality=90, optimize=True)

            # Upload thumbnail to Firebase
            print(f"[Asset Upload] Uploading thumbnail for {filename} to Firebase Storage...")
            logger.info(f"Uploading thumbnail for {filename} to Firebase Storage...")
            public_thumbnail_url = self.firebase_service.upload_image(
                thumb_temp_path,
                folder=f"assets/{self.api_prefix}/thumbnails"
            )

            # Clean up temp file
            thumb_temp_path.unlink()

            if not public_thumbnail_url:
                raise ValueError("Failed to upload thumbnail to Firebase")

            print(f"[Asset Upload] ✓ Successfully uploaded thumbnail to Firebase Storage: {public_thumbnail_url}")
            logger.info(f"Successfully uploaded thumbnail to Firebase Storage: {public_thumbnail_url}")

        # Extract metadata
        width, height = img.size
        file_size = len(file_data)
        has_alpha = img.mode == 'RGBA'
        uploaded_at = datetime.utcnow().isoformat()

        # Save asset metadata to in-memory database
        from app.database import db
        asset_metadata = {
            'asset_id': asset_id,
            'asset_type': self.api_prefix,
            'filename': filename,
            'url': public_url,
            'thumbnail_url': public_thumbnail_url,
            'public_url': public_url,
            'public_thumbnail_url': public_thumbnail_url,
            'size': file_size,
            'width': width,
            'height': height,
            'format': img_format,
            'has_alpha': has_alpha,
            'uploaded_at': uploaded_at,
            'status': 'active',
            'user_id': user_id
        }
        db.create_asset(asset_id, asset_metadata)
        logger.info(f"Saved asset metadata to database: {self.api_prefix}/{asset_id}")

        # Return response using the specific response class
        return self.response_class(
            asset_id=asset_id,
            filename=filename,
            url=public_url,
            thumbnail_url=public_thumbnail_url,
            public_url=public_url,
            public_thumbnail_url=public_thumbnail_url,
            size=file_size,
            dimensions=ImageDimensions(width=width, height=height),
            format=img_format,
            has_alpha=has_alpha,
            uploaded_at=uploaded_at
        )
    
    def get_asset(self, asset_id: str, user_id: Optional[str] = None) -> Optional[S]:
        """
        Get asset metadata and URLs from in-memory database.
        Optionally verify ownership by user_id.
        """
        from app.database import db
        asset_data = db.get_asset(asset_id)

        if not asset_data:
            logger.warning(f"Asset not found: {asset_id}")
            return None

        # Verify ownership if user_id is provided
        if user_id and asset_data.get('user_id') != user_id:
            logger.warning(f"Asset {asset_id} does not belong to user {user_id}")
            return None

        # Convert to status class
        return self.status_class(
            asset_id=asset_data['asset_id'],
            status=asset_data.get('status', 'active'),
            url=asset_data['url'],
            thumbnail_url=asset_data['thumbnail_url'],
            public_url=asset_data.get('public_url'),
            public_thumbnail_url=asset_data.get('public_thumbnail_url'),
            dimensions=ImageDimensions(width=asset_data['width'], height=asset_data['height']),
            format=asset_data['format'],
            has_alpha=asset_data['has_alpha'],
            metadata={
                'filename': asset_data['filename'],
                'size': asset_data['size'],
                'uploaded_at': asset_data['uploaded_at']
            }
        )

    def list_assets(self, user_id: Optional[str] = None) -> List[S]:
        """
        List all assets of this type from Firestore database.
        Optionally filter by user_id (recommended for performance).
        """
        from app.database import db
        
        # Pass user_id to database for efficient querying
        # This will query users/{user_id}/assets/ directly if user_id is provided
        assets_data = db.list_assets_by_type(self.api_prefix, user_id=user_id)

        logger.info(f"Found {len(assets_data)} assets of type {self.api_prefix} for user {user_id}")

        # Convert to status class instances
        assets = []
        for asset_data in assets_data:
            try:
                asset = self.status_class(
                    asset_id=asset_data['asset_id'],
                    status=asset_data.get('status', 'active'),
                    url=asset_data['url'],
                    thumbnail_url=asset_data['thumbnail_url'],
                    public_url=asset_data.get('public_url'),
                    public_thumbnail_url=asset_data.get('public_thumbnail_url'),
                    dimensions=ImageDimensions(width=asset_data['width'], height=asset_data['height']),
                    format=asset_data['format'],
                    has_alpha=asset_data['has_alpha'],
                    metadata={
                        'filename': asset_data['filename'],
                        'size': asset_data['size'],
                        'uploaded_at': asset_data['uploaded_at']
                    }
                )
                assets.append(asset)
            except Exception as e:
                logger.error(f"Error converting asset data: {e}", exc_info=True)
                continue

        return assets

    def delete_asset(self, asset_id: str, user_id: Optional[str] = None) -> bool:
        """
        Remove asset from in-memory database.
        Note: This does not delete the file from Firebase Storage.
        """
        from app.database import db
        deleted = db.delete_asset(asset_id)

        if deleted:
            logger.info(f"Deleted asset from database: {asset_id}")
            print(f"[Asset] ✓ Deleted asset: {asset_id}")
        else:
            logger.warning(f"Asset not found for deletion: {asset_id}")

        return deleted

    def get_asset_path(self, asset_id: str, thumbnail: bool = False) -> Optional[Path]:
        """
        Get path to asset image file.
        Note: Not applicable with Firebase Storage.
        """
        logger.warning(f"get_asset_path called for {asset_id} - not applicable with Firebase Storage")
        return None


