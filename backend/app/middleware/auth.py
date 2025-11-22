"""
Firebase Authentication Middleware

Provides token verification for protecting backend routes.
Uses Firebase Admin SDK to verify ID tokens from client.
"""
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import firebase_admin
from firebase_admin import auth as firebase_auth
import logging

logger = logging.getLogger(__name__)

# HTTP Bearer token security scheme
security = HTTPBearer()

# Global Firebase Admin app instance (may already be initialized by firebase_storage_service)
_firebase_admin_initialized = False


def _ensure_firebase_admin():
    """
    Ensure Firebase Admin SDK is initialized.
    This may already be done by firebase_storage_service.
    """
    global _firebase_admin_initialized
    
    # Check if Firebase Admin is already initialized
    try:
        firebase_admin.get_app()
        _firebase_admin_initialized = True
        return True
    except ValueError:
        # Not initialized yet, try to initialize
        try:
            from firebase_admin import credentials
            import os
            from pathlib import Path
            
            # Look for service account key
            creds_path = Path(__file__).parent.parent.parent / "serviceAccountKey.json"
            
            if not creds_path.exists():
                logger.warning(f"Firebase credentials file not found at {creds_path}")
                return False
            
            cred = credentials.Certificate(str(creds_path))
            firebase_admin.initialize_app(cred)
            _firebase_admin_initialized = True
            logger.info("Firebase Admin SDK initialized for authentication")
            return True
            
        except Exception as e:
            logger.error(f"Error initializing Firebase Admin SDK: {e}", exc_info=True)
            return False


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> str:
    """
    Verify Firebase ID token and return user ID.
    
    Use this as a dependency in protected routes:
    
    ```python
    @router.get("/protected")
    async def protected_route(user_id: str = Depends(get_current_user)):
        # user_id is the Firebase UID
        return {"user_id": user_id}
    ```
    
    Args:
        credentials: HTTP Authorization credentials from request header
        
    Returns:
        str: Firebase user ID (UID)
        
    Raises:
        HTTPException: If token is invalid or verification fails
    """
    if not _ensure_firebase_admin():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service not available",
        )
    
    token = credentials.credentials
    
    try:
        # Verify the ID token
        decoded_token = firebase_auth.verify_id_token(token)
        user_id = decoded_token['uid']
        
        logger.debug(f"Successfully authenticated user: {user_id}")
        return user_id
        
    except firebase_auth.InvalidIdTokenError:
        logger.warning("Invalid Firebase ID token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except firebase_auth.ExpiredIdTokenError:
        logger.warning("Expired Firebase ID token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except firebase_auth.RevokedIdTokenError:
        logger.warning("Revoked Firebase ID token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        logger.error(f"Error verifying Firebase token: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
) -> Optional[str]:
    """
    Optional authentication dependency.
    Returns user ID if authenticated, None if not.
    Does not raise an exception if no token is provided.
    
    Use this for routes that work differently for authenticated vs anonymous users:
    
    ```python
    @router.get("/optional-auth")
    async def optional_auth_route(user_id: Optional[str] = Depends(get_current_user_optional)):
        if user_id:
            return {"message": "Authenticated", "user_id": user_id}
        else:
            return {"message": "Anonymous"}
    ```
    """
    if not credentials:
        return None
    
    try:
        return await get_current_user(credentials)
    except HTTPException:
        # If token verification fails, return None instead of raising
        return None

