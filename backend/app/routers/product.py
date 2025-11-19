"""
Product Image Router

API endpoints for uploading and managing product images.
"""

import logging
from fastapi import APIRouter, File, UploadFile, HTTPException, status
from fastapi.responses import FileResponse

from ..models.product_models import ProductImageUploadResponse, ProductImageStatus
from ..services.product_service import get_product_service
from ..config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/product", tags=["product"])


@router.post("/upload", response_model=ProductImageUploadResponse)
async def upload_product_image(
    file: UploadFile = File(..., description="Product image to upload")
):
    """
    Upload a single product image.
    
    **Requirements:**
    - Single PNG or JPG image
    - Max file size: 50MB
    - Min resolution: 512×512
    - Max resolution: 4096×4096
    
    **Returns:**
    - product_id: UUID for the uploaded product
    - url: URL to access the full image
    - thumbnail_url: URL to access 512×512 thumbnail
    - metadata: Image information
    """
    # Check if product mode is enabled
    if not settings.is_product_mode():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Product upload is not available. Set UPLOAD_MODE=product"
        )
    
    # Validate file
    if not file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file provided"
        )
    
    # Check content type
    if file.content_type not in ['image/png', 'image/jpeg']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PNG and JPG images are supported"
        )
    
    logger.info(f"Received product image upload: {file.filename}")
    
    try:
        # Read file data
        file_data = await file.read()
        
        # Save product image
        product_service = get_product_service()
        response = product_service.save_product_image(file_data, file.filename or "product.png")
        
        logger.info(f"Product image uploaded successfully: {response.product_id}")
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


@router.get("/{product_id}", response_model=ProductImageStatus)
async def get_product_image_metadata(product_id: str):
    """
    Get product image metadata.
    
    Returns product information including URLs and dimensions.
    """
    product_service = get_product_service()
    product = product_service.get_product_image(product_id)
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product {product_id} not found"
        )
    
    return product


@router.get("/{product_id}/image")
async def get_product_image_file(product_id: str):
    """
    Get the full product image file.
    """
    product_service = get_product_service()
    image_path = product_service.get_product_image_path(product_id, thumbnail=False)
    
    if not image_path or not image_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product image {product_id} not found"
        )
    
    return FileResponse(image_path)


@router.get("/{product_id}/thumbnail")
async def get_product_thumbnail_file(product_id: str):
    """
    Get the product thumbnail (512×512).
    """
    product_service = get_product_service()
    image_path = product_service.get_product_image_path(product_id, thumbnail=True)
    
    if not image_path or not image_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product thumbnail {product_id} not found"
        )
    
    return FileResponse(image_path)


@router.delete("/{product_id}")
async def delete_product_image(product_id: str):
    """
    Delete a product image and all associated files.
    """
    # Check if product mode is enabled
    if not settings.is_product_mode():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Product operations not available in NeRF mode"
        )
    
    product_service = get_product_service()
    success = product_service.delete_product_image(product_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product {product_id} not found"
        )
    
    return {"success": True, "message": f"Product {product_id} deleted"}

