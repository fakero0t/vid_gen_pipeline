"""
Base Asset Router Factory

Generic router factory for creating asset upload routers.
"""

import logging
from typing import TypeVar, Generic, List, Optional
from fastapi import APIRouter, File, UploadFile, HTTPException, status, Header, Request
from fastapi.responses import FileResponse

from ..models.asset_models import AssetUploadResponse, AssetStatus

T = TypeVar('T', bound=AssetUploadResponse)
S = TypeVar('S', bound=AssetStatus)

logger = logging.getLogger(__name__)


def get_user_id_from_request(request: Request) -> Optional[str]:
    """Extract user_id from request headers or query parameters."""
    # Try X-User-Id header first (sent by frontend for API calls)
    user_id = request.headers.get("X-User-Id")
    if user_id:
        return user_id
    
    # Fallback: try query parameter (for image URLs used in img src tags)
    user_id = request.query_params.get("user_id")
    if user_id:
        return user_id
    
    return None


def create_asset_router(
    prefix: str,
    tag: str,
    service,
    response_class: type[T],
    asset_type_name: str
) -> APIRouter:
    """
    Create a generic asset router.
    
    Args:
        prefix: API prefix (e.g., "brand", "character")
        tag: OpenAPI tag name
        service: Service instance with methods: save_asset, get_asset, list_assets, delete_asset, get_asset_path
        response_class: Response model class
        asset_type_name: Human-readable asset type name for error messages
    
    Returns:
        Configured FastAPI router
    """
    router = APIRouter(prefix=f"/api/{prefix}", tags=[tag])
    
    @router.post("/upload", response_model=response_class)
    async def upload_asset(
        request: Request,
        file: UploadFile = File(..., description=f"{asset_type_name} asset image to upload")
    ):
        """
        Upload a single asset image.
        
        **Requirements:**
        - Single PNG or JPG image
        - Max file size: 50MB
        - Min resolution: 100×100
        - Max resolution: 4096×4096
        
        **Returns:**
        - asset_id: UUID for the uploaded asset
        - url: URL to access the full image
        - thumbnail_url: URL to access 512×512 thumbnail
        - metadata: Image information
        """
        # Validate file
        if not file:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No file provided"
            )
        
        # Check content type (accept both image/jpeg and image/jpg, but be lenient since content-type can be unreliable)
        # We'll rely on magic bytes validation in the service layer for actual format detection
        if file.content_type and file.content_type not in ['image/png', 'image/jpeg', 'image/jpg']:
            # Log warning but don't reject - let magic bytes validation handle it
            logger.warning(f"Unexpected content type {file.content_type} for file {file.filename}, will validate via magic bytes")
        
        logger.info(f"Received {asset_type_name} asset upload: {file.filename}")
        
        # Get user_id from request headers
        user_id = get_user_id_from_request(request)
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID is required. Please ensure you are authenticated."
            )
        
        try:
            # Read file data
            file_data = await file.read()
            
            # Save asset with user_id
            response = service.save_asset(file_data, file.filename or f"{prefix}-asset.png", user_id=user_id)
            
            logger.info(f"{asset_type_name.capitalize()} asset uploaded successfully: {response.asset_id} for user {user_id}")
            return response
            
        except ValueError as e:
            # Validation error
            logger.error(f"Validation failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
        except Exception as e:
            logger.error(f"Upload failed: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Upload failed: {str(e)}"
            )
    
    @router.get("", response_model=List[AssetStatus])
    async def list_assets(request: Request):
        """
        List assets for the current user.
        
        Returns a list of assets belonging to the authenticated user, sorted by most recent first.
        """
        # Get user_id from request headers
        user_id = get_user_id_from_request(request)
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID is required. Please ensure you are authenticated."
            )
        
        assets = service.list_assets(user_id=user_id)
        return assets
    
    @router.get("/{asset_id}", response_model=AssetStatus)
    async def get_asset_metadata(asset_id: str, request: Request):
        """
        Get asset metadata.
        
        Returns asset information including URLs and dimensions.
        Only returns assets belonging to the authenticated user.
        """
        # Get user_id from request headers
        user_id = get_user_id_from_request(request)
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID is required. Please ensure you are authenticated."
            )
        
        asset = service.get_asset(asset_id, user_id=user_id)
        
        if not asset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{asset_type_name.capitalize()} asset {asset_id} not found"
            )
        
        return asset
    
    @router.get("/{asset_id}/image")
    async def get_asset_image_file(asset_id: str, request: Request):
        """
        Get the full asset image file.
        Only accessible if the asset belongs to the authenticated user.
        """
        # Get user_id from request headers
        user_id = get_user_id_from_request(request)
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID is required. Please ensure you are authenticated."
            )
        
        # Verify ownership
        asset = service.get_asset(asset_id, user_id=user_id)
        if not asset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{asset_type_name.capitalize()} asset image {asset_id} not found"
            )
        
        image_path = service.get_asset_path(asset_id, thumbnail=False)
        
        if not image_path or not image_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{asset_type_name.capitalize()} asset image {asset_id} not found"
            )
        
        return FileResponse(image_path)
    
    @router.get("/{asset_id}/thumbnail")
    async def get_asset_thumbnail_file(asset_id: str, request: Request):
        """
        Get the asset thumbnail (512×512).
        Only accessible if the asset belongs to the authenticated user.
        """
        # Get user_id from request headers
        user_id = get_user_id_from_request(request)
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID is required. Please ensure you are authenticated."
            )
        
        # Verify ownership
        asset = service.get_asset(asset_id, user_id=user_id)
        if not asset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{asset_type_name.capitalize()} asset thumbnail {asset_id} not found"
            )
        
        image_path = service.get_asset_path(asset_id, thumbnail=True)
        
        if not image_path or not image_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{asset_type_name.capitalize()} asset thumbnail {asset_id} not found"
            )
        
        return FileResponse(image_path)
    
    @router.delete("/{asset_id}")
    async def delete_asset(asset_id: str, request: Request):
        """
        Delete an asset and all associated files.
        Only allows deletion of assets belonging to the authenticated user.
        """
        # Get user_id from request headers
        user_id = get_user_id_from_request(request)
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID is required. Please ensure you are authenticated."
            )
        
        success = service.delete_asset(asset_id, user_id=user_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{asset_type_name.capitalize()} asset {asset_id} not found"
            )
        
        return {"success": True, "message": f"{asset_type_name.capitalize()} asset {asset_id} deleted"}
    
    return router


