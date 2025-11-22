"""Database layer for storyboards and scenes.

Uses Firestore with in-memory write-through cache for best performance.
Firestore is REQUIRED - app will fail fast on startup if not configured.

The database is a drop-in replacement for the old InMemoryDatabase with
the same interface, but data now persists across backend restarts.
"""

from app.firestore_database import db

__all__ = ['db']
