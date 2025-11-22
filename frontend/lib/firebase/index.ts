/**
 * Firebase Library Exports
 * 
 * Central export point for all Firebase functionality.
 */

// Configuration
export { firebaseConfig, isFirebaseConfigured } from './config';

// Firestore client
export {
  initializeFirestore,
  getFirestoreDb,
  isFirestoreAvailable,
} from './firestore';

// Project operations
export {
  saveProjectToFirestore,
  loadProjectFromFirestore,
  loadProjectsFromFirestore,
  deleteProjectFromFirestore,
  batchSaveProjectsToFirestore,
  canUseFirestore,
} from './projects';

