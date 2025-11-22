/**
 * Firestore Project Operations
 * 
 * CRUD operations for projects in Firestore.
 * Gracefully handles cases where Firestore is not available.
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
  DocumentData,
} from 'firebase/firestore';
import { getFirestoreDb, isFirestoreAvailable } from './firestore';
import type { Project } from '@/types/project.types';

/**
 * Get the projects collection reference for a user
 */
function getUserProjectsCollection(userId: string) {
  const db = getFirestoreDb();
  if (!db) {
    throw new Error('Firestore not available');
  }
  return collection(db, `users/${userId}/projects`);
}

/**
 * Save a project to Firestore
 * 
 * @param userId - Clerk user ID
 * @param project - Project object to save
 * @throws Error if Firestore is not available or operation fails
 */
export async function saveProjectToFirestore(
  userId: string,
  project: Project
): Promise<void> {
  if (!isFirestoreAvailable()) {
    throw new Error('Firestore not available');
  }

  const db = getFirestoreDb()!;
  const projectRef = doc(db, `users/${userId}/projects/${project.id}`);

  // Convert Date objects to ISO strings for Firestore
  const firestoreProject = {
    ...project,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    // Ensure arrays are defined (Firestore doesn't handle undefined well)
    brandAssetIds: project.brandAssetIds || [],
    characterAssetIds: project.characterAssetIds || [],
    backgroundAssetIds: project.backgroundAssetIds || [],
  };

  await setDoc(projectRef, firestoreProject, { merge: true });
  console.log('[Firestore] Saved project:', project.id, project.name);
}

/**
 * Load a specific project from Firestore
 * 
 * @param userId - Clerk user ID
 * @param projectId - Project ID to load
 * @returns Project object or null if not found
 * @throws Error if Firestore is not available
 */
export async function loadProjectFromFirestore(
  userId: string,
  projectId: string
): Promise<Project | null> {
  if (!isFirestoreAvailable()) {
    throw new Error('Firestore not available');
  }

  const db = getFirestoreDb()!;
  const projectRef = doc(db, `users/${userId}/projects/${projectId}`);
  const projectSnap = await getDoc(projectRef);

  if (!projectSnap.exists()) {
    console.log('[Firestore] Project not found:', projectId);
    return null;
  }

  const data = projectSnap.data() as Project;
  console.log('[Firestore] Loaded project:', projectId, data.name);
  return data;
}

/**
 * Load all projects for a user from Firestore
 * 
 * @param userId - Clerk user ID
 * @returns Array of projects, sorted by updatedAt (most recent first)
 * @throws Error if Firestore is not available
 */
export async function loadProjectsFromFirestore(userId: string): Promise<Project[]> {
  if (!isFirestoreAvailable()) {
    throw new Error('Firestore not available');
  }

  const db = getFirestoreDb()!;
  const projectsRef = collection(db, `users/${userId}/projects`);
  const q = query(projectsRef, orderBy('updatedAt', 'desc'));
  const snapshot = await getDocs(q);

  const projects = snapshot.docs.map((doc) => doc.data() as Project);
  console.log('[Firestore] Loaded projects:', projects.length);
  return projects;
}

/**
 * Delete a project from Firestore
 * 
 * @param userId - Clerk user ID
 * @param projectId - Project ID to delete
 * @throws Error if Firestore is not available
 */
export async function deleteProjectFromFirestore(
  userId: string,
  projectId: string
): Promise<void> {
  if (!isFirestoreAvailable()) {
    throw new Error('Firestore not available');
  }

  const db = getFirestoreDb()!;
  const projectRef = doc(db, `users/${userId}/projects/${projectId}`);
  await deleteDoc(projectRef);
  console.log('[Firestore] Deleted project:', projectId);
}

/**
 * Batch save multiple projects to Firestore
 * Useful for migration from localStorage
 * 
 * @param userId - Clerk user ID
 * @param projects - Array of projects to save
 * @returns Number of projects successfully saved
 */
export async function batchSaveProjectsToFirestore(
  userId: string,
  projects: Project[]
): Promise<number> {
  if (!isFirestoreAvailable()) {
    throw new Error('Firestore not available');
  }

  let savedCount = 0;
  const errors: Array<{ projectId: string; error: unknown }> = [];

  for (const project of projects) {
    try {
      await saveProjectToFirestore(userId, project);
      savedCount++;
    } catch (error) {
      console.error('[Firestore] Failed to save project:', project.id, error);
      errors.push({ projectId: project.id, error });
    }
  }

  if (errors.length > 0) {
    console.warn('[Firestore] Some projects failed to save:', errors);
  }

  console.log('[Firestore] Batch save complete:', savedCount, '/', projects.length);
  return savedCount;
}

/**
 * Check if Firestore operations are available
 * 
 * @returns true if Firestore is configured and available
 */
export function canUseFirestore(): boolean {
  return isFirestoreAvailable();
}

