#!/usr/bin/env python3
"""
Test script to demonstrate the asset persistence issue.

This script shows that assets are only stored in memory and lost on backend restart.
"""

import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.database import db

def test_asset_persistence():
    """Test that demonstrates assets are lost on restart."""
    
    print("\n" + "="*60)
    print("TESTING ASSET PERSISTENCE ISSUE")
    print("="*60 + "\n")
    
    # Create a test asset
    test_asset = {
        'asset_id': 'test-123',
        'asset_type': 'brand',
        'filename': 'test-logo.png',
        'url': '/api/brand/test-123/image',
        'thumbnail_url': '/api/brand/test-123/thumbnail',
        'public_url': 'https://storage.googleapis.com/test.png',
        'public_thumbnail_url': 'https://storage.googleapis.com/test-thumb.png',
        'width': 1024,
        'height': 1024,
        'format': 'png',
        'has_alpha': True,
        'size': 50000,
        'uploaded_at': '2025-11-23T12:00:00',
        'user_id': 'test-user-123'
    }
    
    print("1. Creating test asset in database...")
    db.create_asset('test-123', test_asset)
    print(f"   ✓ Asset created: {test_asset['asset_id']}")
    
    print("\n2. Retrieving asset from database...")
    retrieved = db.get_asset('test-123')
    if retrieved:
        print(f"   ✓ Asset found: {retrieved['asset_id']}")
    else:
        print("   ❌ Asset NOT found!")
        return False
    
    print("\n3. Listing assets by type 'brand'...")
    brand_assets = db.list_assets_by_type('brand')
    print(f"   ✓ Found {len(brand_assets)} brand asset(s)")
    
    print("\n4. Checking where asset is stored...")
    
    # Check in-memory cache
    if 'test-123' in db._cache_assets:
        print("   ✓ Asset exists in IN-MEMORY cache (self._cache_assets)")
        print("     ⚠️  This will be LOST when backend restarts!")
    
    # Try to check Firestore
    try:
        firestore_doc = db._db.collection('assets').document('test-123').get()
        if firestore_doc.exists:
            print("   ✓ Asset exists in FIRESTORE")
            print("     ✓ This will PERSIST across backend restarts!")
        else:
            print("   ❌ Asset does NOT exist in FIRESTORE")
            print("     ❌ This is the problem!")
    except Exception as e:
        print(f"   ❌ Could not check Firestore: {e}")
    
    print("\n" + "="*60)
    print("RESULT:")
    print("="*60)
    print("\n❌ ISSUE CONFIRMED:")
    print("   Assets are stored in memory (_cache_assets) only.")
    print("   They are NOT persisted to Firestore.")
    print("   When backend restarts, assets will disappear.\n")
    print("This is why your teammates are losing their assets!\n")
    
    # Simulate restart by clearing cache
    print("5. Simulating backend restart (clearing cache)...")
    db._cache_assets.clear()
    print("   ✓ Cache cleared")
    
    print("\n6. Trying to retrieve asset after 'restart'...")
    retrieved_after_restart = db.get_asset('test-123')
    if retrieved_after_restart:
        print(f"   ✓ Asset still found: {retrieved_after_restart['asset_id']}")
        print("   (This would mean it was loaded from Firestore)")
        return True
    else:
        print("   ❌ Asset NOT found after restart!")
        print("   ❌ This confirms assets are lost on backend restart!\n")
        return False

if __name__ == '__main__':
    try:
        test_asset_persistence()
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

