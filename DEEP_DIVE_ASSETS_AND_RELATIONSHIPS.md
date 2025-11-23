# Deep Dive: Assets & Storyboard-Project Relationship

## 🖼️ PART 1: Asset Management Deep Dive

### Current Architecture

#### Storage Layer
```
backend/uploads/
├── brands/
│   └── {asset_id}/
│       ├── original.{png|jpg}  # Full resolution image
│       ├── thumb.{png|jpg}      # 512x512 thumbnail
│       └── metadata.json        # Asset metadata
├── characters/
│   └── {asset_id}/
│       ├── original.{png|jpg}
│       ├── thumb.{png|jpg}
│       └── metadata.json
└── products/
    └── {asset_id}/
        ├── original.{png|jpg}
        ├── thumb.{png|jpg}
        └── metadata.json
```

**Metadata Structure:**
```json
{
  "asset_id": "uuid",
  "filename": "my-brand-logo.png",
  "format": "png",
  "dimensions": {"width": 2048, "height": 2048},
  "file_size": 524288,
  "has_alpha": true,
  "uploaded_at": "2025-11-23T...",
  "user_id": "firebase-user-id",  // ✅ ALREADY HAS USER ISOLATION
  "public_url": "https://storage.googleapis.com/...",  // Firebase Storage URL
  "public_thumbnail_url": "https://storage.googleapis.com/..."
}
```

#### Access Control
- ✅ **User ID validation**: Assets are saved with `user_id` in metadata
- ✅ **List filtering**: `list_assets(user_id)` only returns user's assets
- ✅ **Read validation**: `get_asset(asset_id, user_id)` validates ownership
- ✅ **Delete validation**: `delete_asset(asset_id, user_id)` validates ownership
- ✅ **Firebase Storage**: Assets are OPTIONALLY uploaded to Firebase Storage

#### How It Works

**Upload Flow:**
```
Frontend → Backend API → Filesystem → [Optional: Firebase Storage] → Metadata JSON
    ↓          ↓              ↓                    ↓                        ↓
  userId   Validates    Saves files         Gets public URL        Stores user_id
```

**Access Flow:**
```
Frontend requests asset → Backend checks user_id → Returns if owned → Frontend displays
```

---

### The Problem: Assets Not in Firestore

#### What Works:
✅ Assets stored on disk with metadata
✅ User isolation via metadata.json
✅ Firebase Storage integration (optional, already implemented!)
✅ Proper validation and security

#### What Doesn't Work:
❌ **No database** - Assets only exist as files + JSON
❌ **No queries** - Can't search by name, date, size, etc.
❌ **No relationships** - Project → Asset link only stored in Project (one-way)
❌ **Backend restarts** - Files persist but no database to query
❌ **Cross-device** - Firebase Storage has files, but no metadata sync
❌ **Multi-server** - Each server has its own `uploads/` directory

#### Real-World Implications:

**Scenario 1: Multi-Device Use**
```
Device A: Uploads brand logo → Saved to uploads/ + Firebase Storage
Device B: Opens app → Backend can't list assets (different server/no shared DB)
Result: User can't see their own assets on Device B
```

**Scenario 2: Server Migration**
```
Old Server: Has uploads/brands/{id}/
New Server: Empty uploads/ directory
Result: All assets lost (unless filesystem migrated)
```

**Scenario 3: Deployment**
```
Deploy to Vercel/Netlify: ❌ No persistent filesystem
Deploy to AWS/GCP: ✅ Need EBS/persistent disk OR use object storage
Deploy to Kubernetes: ❌ Pods are ephemeral (need PersistentVolumes)
```

---

### Solutions Comparison

#### Option A: Firestore Metadata + Firebase Storage (Recommended)

**Architecture:**
```
Firestore (metadata):
  users/
    {userId}/
      assets/
        brands/
          {assetId}/
            - filename: "logo.png"
            - format: "png"
            - dimensions: {width, height}
            - file_size: 524288
            - has_alpha: true
            - uploaded_at: timestamp
            - firebase_storage_path: "assets/brands/{uuid}.png"
            - public_url: "https://..."
            - thumbnail_url: "https://..."

Firebase Storage (files):
  assets/
    brands/
      {uuid}.png       # Original
      thumbnails/
        {uuid}.png     # Thumbnail
```

**How Upload Changes:**
```python
# Current (filesystem only)
def save_asset(file_data, filename, user_id):
    asset_id = uuid.uuid4()
    # Save to uploads/ directory
    save_to_disk(file_data, asset_id)
    # Optional: Upload to Firebase Storage
    public_url = upload_to_firebase_storage(file_data)
    # Save metadata.json
    save_metadata_json(asset_id, metadata)
    return response

# New (Firestore + Firebase Storage)
def save_asset(file_data, filename, user_id):
    asset_id = uuid.uuid4()
    
    # 1. Upload to Firebase Storage (primary storage)
    storage_path = f"assets/brands/{asset_id}.png"
    public_url = firebase_storage.upload(file_data, storage_path)
    thumbnail_url = firebase_storage.upload(thumbnail, f"thumbnails/{asset_id}.png")
    
    # 2. Save metadata to Firestore (database)
    firestore_db.collection('users').document(user_id).collection('assets').document(asset_id).set({
        'asset_id': asset_id,
        'filename': filename,
        'format': 'png',
        'dimensions': {...},
        'firebase_storage_path': storage_path,
        'public_url': public_url,
        'thumbnail_url': thumbnail_url,
        'uploaded_at': firestore.SERVER_TIMESTAMP
    })
    
    # 3. Optional: Keep local cache for performance
    save_to_disk_cache(file_data, asset_id)
    
    return response
```

**Pros:**
- ✅ True database with queries, indexes, real-time updates
- ✅ Cloud storage = works on any infrastructure
- ✅ Cross-device sync automatic
- ✅ Backend becomes stateless
- ✅ Security rules enforce user isolation
- ✅ Can scale horizontally
- ✅ Searchable, filterable assets
- ✅ Project-asset relationships become queryable

**Cons:**
- ⚠️ Firebase Storage costs (but cheap: $0.026/GB/month)
- ⚠️ Migration needed for existing assets
- ⚠️ Slightly more complex code

**When to Use:**
- Production deployment
- Multi-device support needed
- Team wants cloud-first architecture
- Planning to scale beyond single server

---

#### Option B: Keep Filesystem + Add Firestore Metadata

**Architecture:**
```
Firestore (metadata only):
  users/{userId}/assets/{assetId}/ → metadata

Filesystem (files):
  uploads/brands/{assetId}/ → actual files
```

**How It Works:**
- Files stay on disk (no Firebase Storage)
- Metadata duplicated to Firestore
- Backend serves files from disk
- Firestore used only for querying/listing

**Pros:**
- ✅ Smaller change (files stay on disk)
- ✅ No Firebase Storage costs
- ✅ Faster serving (local disk)
- ✅ Metadata queryable via Firestore

**Cons:**
- ⚠️ Still requires persistent disk/volume
- ⚠️ Not truly multi-server (need shared filesystem)
- ⚠️ Data in two places (disk + Firestore)
- ⚠️ Migration complexity if moving servers

**When to Use:**
- Single-server deployment with persistent disk
- Want to delay full cloud migration
- Storage costs are a concern
- Development/testing environment

---

#### Option C: Status Quo (Filesystem Only)

**Keep Current System:**
- Files in uploads/ directory
- Metadata in JSON files
- User ID validation in memory

**When This Works:**
- ✅ Development/prototype phase
- ✅ Single developer, single machine
- ✅ Don't need cross-device sync
- ✅ Quick iteration without cloud setup

**When This Breaks:**
- ❌ Deploy to serverless (Vercel, Netlify)
- ❌ Multi-device use
- ❌ Server migration/scaling
- ❌ Container orchestration (Kubernetes)

---

### My Recommendation for Assets

#### Phase 1: Add Firestore Metadata (Now)
Keep files on disk but add Firestore metadata collection:
```
users/{userId}/assets/brands/{assetId}
users/{userId}/assets/characters/{assetId}
users/{userId}/assets/products/{assetId}
```

**Benefits:**
- Queryable assets
- Cross-device sync of metadata
- Security rules enforce ownership
- Minimal code changes

**Implementation:**
1. Modify `BaseAssetService.save_asset()` to write to Firestore
2. Modify `list_assets()` to read from Firestore
3. Keep filesystem as source of truth for files
4. Firebase Storage uploads stay optional

#### Phase 2: Migrate to Firebase Storage (Later)
When ready for production:
1. Move files from disk to Firebase Storage
2. Update URLs to point to Firebase Storage
3. Remove filesystem dependency
4. Backend becomes fully stateless

---

## 🔗 PART 2: Storyboard-Project Relationship Deep Dive

### Current Architecture

#### Data Model
```typescript
// Frontend: Project
interface Project {
  id: string;
  name: string;
  storyboardId?: string;  // ← Reference to storyboard (optional)
  brandAssetIds?: string[];
  characterAssetIds?: string[];
  appState: AppStateSnapshot;
}

// Backend: Storyboard
class Storyboard:
  storyboard_id: str
  project_id: Optional[str]  # ← Reference back to project
  creative_brief: str
  selected_mood: dict
  scene_order: List[str]
```

#### Storage Structure
```
Frontend Firestore:
  users/{userId}/projects/{projectId}
    - storyboardId: "abc-123"
    - ...other fields

Backend Firestore:
  storyboards/{storyboardId}
    - project_id: "xyz-789"
    - ...other fields
  
  scenes/{sceneId}
    - storyboard_id: "abc-123"
    - ...other fields
```

---

### The Problem: Loose Coupling

#### Issues:

**1. No User Ownership on Storyboards** 🚨
```python
# Current: Storyboard has NO user_id
class Storyboard:
    storyboard_id: str
    project_id: Optional[str]  # Has project reference
    # ❌ NO user_id field

# Security rule can't validate ownership
match /storyboards/{storyboardId} {
  allow read, write: if request.auth != null;  // ← Too permissive!
  // Can't do: if request.auth.uid == resource.data.user_id (field doesn't exist)
}
```

**2. Weak Referential Integrity**
- Project stores `storyboardId` (string)
- Storyboard stores `project_id` (string)
- No validation that these match
- No CASCADE delete (deleting project leaves orphan storyboard)

**3. Separate Collections**
- Projects: `users/{userId}/projects/{projectId}`
- Storyboards: `storyboards/{storyboardId}` (top-level)
- Makes queries harder
- Security rules more complex

**4. Can't Query "All Storyboards for Project"**
```typescript
// Current: Must use project.storyboardId to get ONE storyboard
const storyboard = await getStoryboard(project.storyboardId);

// Can't do: Get all storyboards for this project
// (because storyboards aren't nested under project)
```

---

### Solutions Comparison

#### Option A: Nest Storyboards Under Projects (Recommended)

**New Structure:**
```
users/
  {userId}/
    projects/
      {projectId}/
        - name, createdAt, appState, etc.
        
        storyboards/  ← NEW: Nested collection
          {storyboardId}/
            - creative_brief
            - selected_mood
            - scene_order
            - createdAt, updatedAt
            
            scenes/  ← NEW: Nested under storyboard
              {sceneId}/
                - text, style_prompt
                - image_url, video_url
                - generation_status
                - createdAt, updatedAt
```

**Full Path Example:**
```
users/abc123/projects/proj-001/storyboards/story-001/scenes/scene-001
```

**Security Rules (Simple!):**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Projects
    match /users/{userId}/projects/{projectId} {
      allow read, write: if request.auth.uid == userId;
      
      // Storyboards (automatically inherits user ownership!)
      match /storyboards/{storyboardId} {
        allow read, write: if request.auth.uid == userId;
        
        // Scenes (automatically inherits user ownership!)
        match /scenes/{sceneId} {
          allow read, write: if request.auth.uid == userId;
        }
      }
    }
  }
}
```

**Querying:**
```typescript
// Get all storyboards for a project
const storyboards = await getDocs(
  collection(db, `users/${userId}/projects/${projectId}/storyboards`)
);

// Get all scenes for a storyboard
const scenes = await getDocs(
  collection(db, `users/${userId}/projects/${projectId}/storyboards/${storyboardId}/scenes`)
);
```

**Pros:**
- ✅ Security rules automatically enforce ownership
- ✅ Clear hierarchy (user → project → storyboard → scene)
- ✅ Easy to query "all storyboards for project"
- ✅ Cascading deletes possible
- ✅ More intuitive data model
- ✅ No separate user_id field needed (inherited from path)

**Cons:**
- ⚠️ Migration needed (move existing storyboards)
- ⚠️ Deeper nesting (longer paths)
- ⚠️ Max subcollection depth is 100 (not a concern here)

**Migration Strategy:**
```typescript
// 1. Query all storyboards
const storyboards = await getDocs(collection(db, 'storyboards'));

// 2. For each storyboard
for (const storyboardDoc of storyboards.docs) {
  const storyboard = storyboardDoc.data();
  const projectId = storyboard.project_id;
  
  // Find which user owns this project
  const project = await getDoc(doc(db, `users/${userId}/projects/${projectId}`));
  
  if (project.exists()) {
    const userId = project.data().userId; // Or infer from path
    
    // 3. Copy to new location
    await setDoc(
      doc(db, `users/${userId}/projects/${projectId}/storyboards/${storyboard.storyboard_id}`),
      storyboard
    );
    
    // 4. Copy scenes
    const scenes = await getDocs(collection(db, 'scenes').where('storyboard_id', '==', storyboard.storyboard_id));
    for (const sceneDoc of scenes.docs) {
      await setDoc(
        doc(db, `users/${userId}/projects/${projectId}/storyboards/${storyboard.storyboard_id}/scenes/${sceneDoc.id}`),
        sceneDoc.data()
      );
    }
  }
  
  // 5. Delete old documents
  await deleteDoc(doc(db, 'storyboards', storyboardDoc.id));
}
```

---

#### Option B: Add user_id to Storyboards (Keep Flat)

**Structure:**
```
users/{userId}/projects/{projectId}
  - storyboardId: "story-001"

storyboards/{storyboardId}  ← Top-level collection
  - user_id: "abc123"  ← NEW FIELD
  - project_id: "proj-001"
  - creative_brief, etc.

scenes/{sceneId}
  - storyboard_id: "story-001"
  - user_id: "abc123"  ← NEW FIELD (optional, can infer from storyboard)
```

**Security Rules:**
```javascript
// Storyboards
match /storyboards/{storyboardId} {
  // Read: User must own it
  allow read: if request.auth.uid == resource.data.user_id;
  
  // Create: Must set user_id to self
  allow create: if request.auth.uid == request.resource.data.user_id;
  
  // Update/Delete: Must own it
  allow update, delete: if request.auth.uid == resource.data.user_id;
}

// Scenes
match /scenes/{sceneId} {
  // Must check parent storyboard ownership (complex!)
  allow read, write: if request.auth.uid == 
    get(/databases/$(database)/documents/storyboards/$(resource.data.storyboard_id)).data.user_id;
}
```

**Pros:**
- ✅ Fixes security issue
- ✅ Simpler migration (just add field)
- ✅ Flatter structure

**Cons:**
- ⚠️ More complex security rules
- ⚠️ Harder to query all storyboards for project
- ⚠️ Redundant data (user_id in multiple places)
- ⚠️ Scene validation requires extra Firestore read

---

### My Recommendation for Relationships

**Go with Option A: Nested Structure**

**Why:**
1. **Security is automatic** - Path-based ownership is clearest
2. **Intuitive hierarchy** - Matches mental model (project has storyboards)
3. **Easier queries** - Can list all storyboards for a project
4. **Simpler rules** - No need for complex validation

**Migration Path:**
1. Create migration script to move storyboards under projects
2. Update backend `FirestoreDatabase` to use new paths
3. Update frontend `sceneStore` to query new paths
4. Test thoroughly
5. Deploy with data migration
6. Delete old collections after verification

**Timeline:**
- Option A: ~2-3 hours implementation + testing
- Option B: ~1 hour implementation (but ongoing complexity)

---

## 📋 Summary & Recommendations

### Assets
**Immediate (Phase 1):**
- Add Firestore metadata collection for assets
- Keep files on disk for now
- Enable queryable asset lists

**Later (Phase 2):**
- Migrate files to Firebase Storage
- Remove filesystem dependency

### Storyboard-Project Relationship
**Fix Now:**
- Nest storyboards under projects
- Automatically fixes security
- Cleaner architecture

### Priority Order
1. **Storyboard nesting** (fixes security + improves structure)
2. **Asset Firestore metadata** (enables queries + cross-device)
3. **Asset Firebase Storage migration** (full cloud, deploy anywhere)

---

## 🤔 Questions for Discussion

1. **Assets**: Do we need cross-device asset sync soon, or can we keep filesystem for now?

2. **Storyboards**: Should we nest under projects (my recommendation) or just add user_id field?

3. **Migration**: Are there existing storyboards in Firestore we need to migrate, or starting fresh?

4. **Timeline**: When do you need this production-ready? Affects urgency of Firebase Storage migration.

Let me know which parts you want to tackle first!



