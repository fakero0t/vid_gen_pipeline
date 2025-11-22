"""Firestore database with in-memory write-through cache.

This module provides a persistent database layer using Google Cloud Firestore
with an in-memory cache for performance. Firestore is REQUIRED - the app will
fail fast on startup if not properly configured.
"""
from typing import Dict, List, Optional
from app.models.storyboard_models import Storyboard, StoryboardScene
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, firestore
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class FirestoreDatabase:
    """Firestore database with in-memory cache for performance.
    
    Architecture:
    - Writes: Firestore first (persistence), then cache (speed)
    - Reads: Cache first (speed), then Firestore (persistence)
    - Cache: In-memory dict for fast lookups
    - Persistence: Firestore for durability across restarts
    """
    
    def __init__(self):
        """Initialize Firestore and in-memory cache.
        
        Raises:
            FileNotFoundError: If serviceAccountKey.json not found
            RuntimeError: If Firestore initialization fails
        """
        # In-memory cache for fast reads
        self._cache_storyboards: Dict[str, Storyboard] = {}
        self._cache_scenes: Dict[str, StoryboardScene] = {}
        
        # Initialize Firestore (REQUIRED - will raise if fails)
        self._init_firestore()
    
    def _init_firestore(self):
        """Initialize Firebase Admin SDK.
        
        Raises:
            FileNotFoundError: If serviceAccountKey.json not found
            RuntimeError: If Firestore client cannot be created
        """
        # Check for service account key
        cred_path = Path("serviceAccountKey.json")
        if not cred_path.exists():
            raise FileNotFoundError(
                "serviceAccountKey.json not found. "
                "Firestore is required for data persistence. "
                "Add serviceAccountKey.json to the backend directory."
            )
        
        try:
            # Initialize Firebase Admin (only once)
            if not firebase_admin._apps:
                cred = credentials.Certificate(str(cred_path))
                firebase_admin.initialize_app(cred)
                logger.info("Firebase Admin SDK initialized")
            
            self._db = firestore.client()
            logger.info("✓ Firestore database initialized successfully")
            
        except Exception as e:
            raise RuntimeError(f"Failed to initialize Firestore: {e}")
    
    def _storyboard_to_dict(self, storyboard: Storyboard) -> dict:
        """Convert Storyboard to Firestore-compatible dict.
        
        Firestore requirements:
        - datetime objects must be converted to ISO strings or Firestore Timestamp
        - None values are acceptable (stored as null)
        """
        data = storyboard.model_dump()
        
        # Convert datetime to ISO string
        if isinstance(data.get('created_at'), datetime):
            data['created_at'] = data['created_at'].isoformat()
        if isinstance(data.get('updated_at'), datetime):
            data['updated_at'] = data['updated_at'].isoformat()
        
        return data
    
    def _scene_to_dict(self, scene: StoryboardScene) -> dict:
        """Convert Scene to Firestore-compatible dict.
        
        Firestore requirements:
        - datetime objects must be converted to ISO strings
        - None values are acceptable (stored as null)
        """
        data = scene.model_dump()
        
        # Convert datetime to ISO string
        if isinstance(data.get('created_at'), datetime):
            data['created_at'] = data['created_at'].isoformat()
        if isinstance(data.get('updated_at'), datetime):
            data['updated_at'] = data['updated_at'].isoformat()
        
        return data
    
    # ============================================================================
    # Storyboard Operations
    # ============================================================================
    
    def create_storyboard(self, storyboard: Storyboard) -> Storyboard:
        """Create storyboard in Firestore and cache.
        
        Write-through cache: Firestore first, then cache.
        """
        # Write to Firestore (persistence)
        doc_ref = self._db.collection('storyboards').document(storyboard.storyboard_id)
        doc_ref.set(self._storyboard_to_dict(storyboard))
        logger.debug(f"Saved storyboard to Firestore: {storyboard.storyboard_id}")
        
        # Write to cache (speed)
        self._cache_storyboards[storyboard.storyboard_id] = storyboard
        return storyboard
    
    def get_storyboard(self, storyboard_id: str) -> Optional[Storyboard]:
        """Get storyboard from cache or Firestore.
        
        Cache-first read: Check memory, then Firestore.
        """
        # Check cache first (fast)
        if storyboard_id in self._cache_storyboards:
            return self._cache_storyboards[storyboard_id]
        
        # Load from Firestore (persistent)
        doc = self._db.collection('storyboards').document(storyboard_id).get()
        if doc.exists:
            data = doc.to_dict()
            storyboard = Storyboard(**data)
            # Cache for next time
            self._cache_storyboards[storyboard_id] = storyboard
            logger.debug(f"Loaded storyboard from Firestore: {storyboard_id}")
            return storyboard
        
        return None
    
    def update_storyboard(self, storyboard_id: str, storyboard: Storyboard) -> Optional[Storyboard]:
        """Update storyboard in Firestore and cache.
        
        Returns None if storyboard doesn't exist.
        """
        # Check if storyboard exists (cache or Firestore)
        if storyboard_id not in self._cache_storyboards:
            existing = self.get_storyboard(storyboard_id)
            if not existing:
                return None
        
        storyboard.updated_at = datetime.utcnow()
        
        # Update Firestore
        doc_ref = self._db.collection('storyboards').document(storyboard_id)
        doc_ref.set(self._storyboard_to_dict(storyboard), merge=True)
        
        # Update cache
        self._cache_storyboards[storyboard_id] = storyboard
        return storyboard
    
    def delete_storyboard(self, storyboard_id: str) -> bool:
        """Delete storyboard and its scenes from Firestore and cache.
        
        Cascades to delete all scenes belonging to this storyboard.
        """
        # Check if exists
        if storyboard_id not in self._cache_storyboards and not self.get_storyboard(storyboard_id):
            return False
        
        # Delete all scenes first
        scenes = self.get_scenes_by_storyboard(storyboard_id)
        for scene in scenes:
            self.delete_scene(scene.id)
        
        # Delete storyboard from Firestore
        self._db.collection('storyboards').document(storyboard_id).delete()
        
        # Delete from cache
        if storyboard_id in self._cache_storyboards:
            del self._cache_storyboards[storyboard_id]
        
        return True
    
    # ============================================================================
    # Scene Operations
    # ============================================================================
    
    def create_scene(self, scene: StoryboardScene) -> StoryboardScene:
        """Create scene in Firestore and cache."""
        # Write to Firestore
        doc_ref = self._db.collection('scenes').document(scene.id)
        doc_ref.set(self._scene_to_dict(scene))
        
        # Write to cache
        self._cache_scenes[scene.id] = scene
        return scene
    
    def get_scene(self, scene_id: str) -> Optional[StoryboardScene]:
        """Get scene from cache or Firestore.
        
        Cache-first read for performance.
        """
        # Check cache first
        if scene_id in self._cache_scenes:
            return self._cache_scenes[scene_id]
        
        # Load from Firestore
        doc = self._db.collection('scenes').document(scene_id).get()
        if doc.exists:
            data = doc.to_dict()
            scene = StoryboardScene(**data)
            # Cache for next time
            self._cache_scenes[scene_id] = scene
            return scene
        
        return None
    
    def get_scenes_by_storyboard(self, storyboard_id: str) -> List[StoryboardScene]:
        """Get all scenes for a storyboard.
        
        Loads from Firestore to ensure completeness, caches results.
        """
        # Always load from Firestore to ensure we have all scenes
        # (scenes might have been added in another process/server)
        query = self._db.collection('scenes').where('storyboard_id', '==', storyboard_id)
        docs = query.stream()
        
        scenes = []
        for doc in docs:
            # Check cache first to avoid re-parsing
            if doc.id in self._cache_scenes:
                scenes.append(self._cache_scenes[doc.id])
            else:
                data = doc.to_dict()
                scene = StoryboardScene(**data)
                self._cache_scenes[scene.id] = scene
                scenes.append(scene)
        
        return scenes
    
    def update_scene(self, scene_id: str, scene: StoryboardScene) -> Optional[StoryboardScene]:
        """Update scene in Firestore and cache.
        
        Returns None if scene doesn't exist.
        """
        # Check if scene exists (cache or Firestore)
        if scene_id not in self._cache_scenes:
            existing = self.get_scene(scene_id)
            if not existing:
                return None
        
        scene.updated_at = datetime.utcnow()
        
        # Update Firestore
        doc_ref = self._db.collection('scenes').document(scene_id)
        doc_ref.set(self._scene_to_dict(scene), merge=True)
        
        # Update cache
        self._cache_scenes[scene_id] = scene
        return scene
    
    def delete_scene(self, scene_id: str) -> bool:
        """Delete scene from Firestore and cache."""
        # Check if exists
        if scene_id not in self._cache_scenes and not self.get_scene(scene_id):
            return False
        
        # Delete from Firestore
        self._db.collection('scenes').document(scene_id).delete()
        
        # Delete from cache
        if scene_id in self._cache_scenes:
            del self._cache_scenes[scene_id]
        
        return True


# Global database instance
db = FirestoreDatabase()

