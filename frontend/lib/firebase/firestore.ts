/**
 * Firebase Firestore Client
 * 
 * Initializes Firebase app and Firestore database for client-side use.
 * Handles graceful degradation if Firebase is not configured.
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { firebaseConfig, isFirebaseConfigured } from './config';

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let isInitialized = false;
let initializationError: Error | null = null;

/**
 * Initialize Firebase app and Firestore
 * Safe to call multiple times - will only initialize once
 */
export function initializeFirestore(): { db: Firestore | null; error: Error | null } {
  // Return cached result if already initialized
  if (isInitialized) {
    return { db, error: initializationError };
  }

  try {
    // Check if Firebase is configured
    if (!isFirebaseConfigured()) {
      const error = new Error(
        'Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_* environment variables in .env.local'
      );
      console.warn('[Firestore] Firebase not configured, using localStorage only');
      initializationError = error;
      isInitialized = true;
      return { db: null, error };
    }

    // Initialize Firebase app (only if not already initialized)
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
      console.log('[Firestore] Firebase app initialized:', firebaseConfig.projectId);
    } else {
      app = getApps()[0];
      console.log('[Firestore] Using existing Firebase app');
    }

    // Get Firestore instance
    db = getFirestore(app);

    // Connect to emulator in development if configured
    if (
      process.env.NODE_ENV === 'development' &&
      process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST
    ) {
      const [host, port] = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST.split(':');
      connectFirestoreEmulator(db, host, parseInt(port, 10));
      console.log('[Firestore] Connected to emulator:', host, port);
    }

    console.log('[Firestore] ✓ Firestore initialized successfully');
    isInitialized = true;
    return { db, error: null };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[Firestore] Failed to initialize Firebase:', err);
    initializationError = err;
    isInitialized = true;
    return { db: null, error: err };
  }
}

/**
 * Get Firestore database instance
 * Returns null if not configured or initialization failed
 */
export function getFirestoreDb(): Firestore | null {
  if (!isInitialized) {
    const result = initializeFirestore();
    return result.db;
  }
  return db;
}

/**
 * Check if Firestore is available
 */
export function isFirestoreAvailable(): boolean {
  return getFirestoreDb() !== null;
}

// Auto-initialize on import (safe for Next.js SSR)
if (typeof window !== 'undefined') {
  initializeFirestore();
}

