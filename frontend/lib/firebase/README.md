# Firebase Firestore Integration

This directory contains Firebase Firestore integration for persisting project data.

## Setup

### 1. Get Firebase Web Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/project/jant-vid-pipe-fire/settings/general)
2. Scroll to "Your apps" section
3. If you don't have a web app, click "Add app" and select Web (</>) icon
4. Copy the `firebaseConfig` object values

### 2. Configure Environment Variables

Create a `.env.local` file in the `frontend/` directory (copy from `.env.local.example`):

```bash
# Firebase Web Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=jant-vid-pipe-fire.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=jant-vid-pipe-fire
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=jant-vid-pipe-fire.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

### 3. Install Dependencies

```bash
cd frontend
npm install
# or
pnpm install
```

### 4. Set Up Firestore Database

1. Go to [Firestore Database](https://console.firebase.google.com/project/jant-vid-pipe-fire/firestore)
2. Click "Create database"
3. Choose "Start in **production mode**" (we'll set up rules next)
4. Select a location (us-central1 recommended)

### 5. Configure Firestore Security Rules

In the Firestore console, go to "Rules" and add:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Public storyboards (for now - will refine later)
    match /storyboards/{storyboardId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Usage

### Check if Firestore is Available

```typescript
import { isFirestoreAvailable } from '@/lib/firebase';

if (isFirestoreAvailable()) {
  // Firestore is configured and ready
} else {
  // Fall back to localStorage
}
```

### Save a Project

```typescript
import { saveProjectToFirestore } from '@/lib/firebase';
import { useAuth } from '@clerk/nextjs';

const { userId } = useAuth();

try {
  await saveProjectToFirestore(userId!, project);
  console.log('Project saved to Firestore');
} catch (error) {
  console.error('Failed to save to Firestore:', error);
  // Fall back to localStorage
}
```

### Load Projects

```typescript
import { loadProjectsFromFirestore } from '@/lib/firebase';

const projects = await loadProjectsFromFirestore(userId!);
```

## Architecture

### Data Model

```
users/
  {userId}/                    # Clerk user ID
    projects/
      {projectId}/             # UUID
        - id: string
        - name: string
        - createdAt: string
        - updatedAt: string
        - brandAssetIds: string[]
        - characterAssetIds: string[]
        - backgroundAssetIds: string[]
        - storyboardId?: string
        - thumbnail?: string
        - appState: AppStateSnapshot
```

### Graceful Degradation

The Firebase integration is designed to gracefully handle missing configuration:

1. If Firebase env vars are not set, functions throw errors that can be caught
2. The app continues to work with localStorage as fallback
3. Console warnings inform developers that Firestore is not available

## Testing Without Firebase

You can develop without Firebase by:

1. Not creating `.env.local` (or leaving Firebase vars empty)
2. The app will use localStorage as before
3. Console will show: `[Firestore] Firebase not configured, using localStorage only`

## Migration Path

See `tom_planning/ACTUAL_PRS_NEW_PLAN.md` for the full migration strategy.

Current status: **PR 1 Complete** - Functions available but not yet integrated into stores.

## Troubleshooting

### "Firestore not available" errors

- Check that `.env.local` exists and has correct values
- Restart dev server after adding env vars
- Check browser console for initialization errors

### Permission denied errors

- Verify Firestore security rules are set up
- Check that Clerk `userId` is being passed correctly
- Ensure user is authenticated before calling Firestore functions

### CORS errors

- Firebase web SDK should not have CORS issues
- If you see CORS errors, check that you're using the web config (not service account)

