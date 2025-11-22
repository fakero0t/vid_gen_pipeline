# Firebase Setup Guide

## PR 1: Firebase Firestore Integration - Setup Instructions

This guide walks you through setting up Firebase Firestore for project persistence.

## ✅ What Was Added

- Firebase SDK (`firebase` package v11.1.0)
- Firestore client initialization with graceful degradation
- Project CRUD operations (save, load, delete, batch)
- Configuration management with environment variables
- Comprehensive error handling and fallbacks

## 🚀 Quick Setup (5 minutes)

### Step 1: Get Firebase Web Config

1. Go to: https://console.firebase.google.com/project/jant-vid-pipe-fire/settings/general
2. Scroll to "Your apps" section
3. **If you don't have a Web app yet:**
   - Click the "</>" (Web) icon to add a new web app
   - Enter app nickname: "jant-vid-pipe-web"
   - **Don't** check "Also set up Firebase Hosting"
   - Click "Register app"
4. Copy the `firebaseConfig` values

### Step 2: Create `.env.local`

```bash
cd frontend
cp env.local.example .env.local
```

Edit `.env.local` and fill in your Firebase values:

```bash
# These are the values from Step 1
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyC_your_actual_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=jant-vid-pipe-fire.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=jant-vid-pipe-fire
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=jant-vid-pipe-fire.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abc123def456

# Keep your existing Clerk and API keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_API_URL=http://localhost:8000
OPENAI_API_KEY=sk-...
```

### Step 3: Enable Firestore Database

1. Go to: https://console.firebase.google.com/project/jant-vid-pipe-fire/firestore
2. Click "Create database"
3. **Production mode** (we'll set rules next)
4. Location: **us-central1** (or closest to you)
5. Click "Enable"

### Step 4: Configure Security Rules

In the Firestore console, go to "Rules" tab and paste:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Storyboards (will refine access later)
    match /storyboards/{storyboardId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Click **"Publish"**

### Step 5: Install and Test

```bash
cd frontend
npm install   # or pnpm install

# Restart dev server
npm run dev
```

Open browser console and look for:
```
[Firestore] ✓ Firestore initialized successfully
```

## 📊 Data Structure

Projects will be stored as:

```
users/
  {clerkUserId}/
    projects/
      {projectId}/
        - id
        - name  
        - createdAt
        - updatedAt
        - brandAssetIds[]
        - characterAssetIds[]
        - storyboardId
        - appState{...}
```

## 🔍 Verify It Works

### Option 1: Browser Console

```javascript
// In browser console:
import { canUseFirestore } from '@/lib/firebase';
console.log('Firestore available:', canUseFirestore());
// Should print: true
```

### Option 2: Check Logs

In the terminal running `npm run dev`, you should see:
```
[Firestore] Firebase app initialized: jant-vid-pipe-fire
[Firestore] ✓ Firestore initialized successfully
```

### Option 3: Manual Test

Add this temporarily to any page:

```typescript
import { canUseFirestore } from '@/lib/firebase';

console.log('Can use Firestore:', canUseFirestore());
```

## ⚠️ Troubleshooting

### "Firebase not configured" warning

**Problem:** Console shows: `[Firestore] Firebase not configured, using localStorage only`

**Solution:**
1. Check that `.env.local` exists in `frontend/` directory
2. Verify all `NEXT_PUBLIC_FIREBASE_*` vars are set
3. Restart dev server (`Ctrl+C` then `npm run dev`)

### "Permission denied" errors

**Problem:** Firestore operations fail with permission errors

**Solution:**
1. Verify security rules are published in Firebase Console
2. Make sure user is logged in (check Clerk auth)
3. Check that `userId` from Clerk is being passed correctly

### Module not found: 'firebase'

**Problem:** Import errors for Firebase

**Solution:**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

## 🎯 What's Next (Future PRs)

**Current Status:** Functions are ready but **NOT yet integrated**.

- ✅ PR 1: Functions available (YOU ARE HERE)
- ⏳ PR 2: Dual-write to localStorage + Firestore  
- ⏳ PR 3: Load from Firestore with localStorage fallback
- ⏳ PR 4: Backend storyboards to Firestore
- ⏳ PR 5: Remove localStorage, Firestore is source of truth

The app currently works **exactly as before** (localStorage only).

## 🧪 Optional: Skip Firebase Setup

If you don't set up Firebase:
- ✅ App works normally with localStorage
- ✅ No errors or crashes
- ⚠️ Console warning: `Firebase not configured, using localStorage only`
- ❌ No cross-device sync

This is intentional! You can develop without Firebase and add it later.

## 📝 Files Added

```
frontend/
  lib/firebase/
    index.ts           # Main exports
    config.ts          # Firebase config
    firestore.ts       # Firestore client init
    projects.ts        # Project CRUD operations  
    README.md          # Detailed documentation
  env.local.example    # Environment template
  package.json         # Added firebase@11.1.0
```

## 🔗 Useful Links

- [Firebase Console](https://console.firebase.google.com/project/jant-vid-pipe-fire)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Security Rules Reference](https://firebase.google.com/docs/firestore/security/get-started)

## ❓ Questions?

Check `frontend/lib/firebase/README.md` for detailed API documentation and usage examples.

