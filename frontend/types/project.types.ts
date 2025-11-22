import type { StepName } from '@/lib/steps';
import type { CreativeBrief } from '@/types/chat.types';
import type { Mood } from '@/types/mood.types';

/**
 * Project interface representing a complete video generation project.
 * Stores full app state snapshot and references to storyboard.
 */
export interface Project {
  id: string;
  name: string;
  createdAt: string; // ISO 8601 date string
  updatedAt: string; // ISO 8601 date string
  thumbnail?: string; // Base64 or URL to thumbnail image
  storyboardId?: string; // Reference to storyboard (not full state)
  brandAssetIds?: string[]; // Array of selected brand asset IDs (optional for backward compatibility)
  characterAssetIds?: string[]; // Array of selected character asset IDs (optional for backward compatibility)
  appState: AppStateSnapshot; // Full snapshot of appStore state
}

/**
 * Lightweight project metadata for listings.
 * Used when displaying project cards without loading full state.
 */
export interface ProjectMetadata {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  thumbnail?: string;
  storyboardId?: string;
  currentStep: StepName;
}

/**
 * Snapshot of appStore state for persistence.
 * This is a serializable representation of the app state.
 */
export interface AppStateSnapshot {
  currentStep: StepName;
  creativeBrief: CreativeBrief | null;
  chatMessages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string; // ISO string for serialization
  }>;
  moods: Mood[];
  selectedMoodId: string | null;
  storyboardCompleted: boolean;
  audioUrl: string | null;
  compositionJobId: string | null;
  finalVideo: any | null;
}

/**
 * Request type for creating a new project.
 */
export interface CreateProjectRequest {
  name?: string; // Optional - will auto-generate if not provided
  brandAssetIds?: string[]; // Array of selected brand asset IDs
  characterAssetIds?: string[]; // Array of selected character asset IDs
}

/**
 * Request type for updating a project.
 */
export interface UpdateProjectRequest {
  name?: string;
  thumbnail?: string;
  storyboardId?: string;
  brandAssetIds?: string[];
  characterAssetIds?: string[];
}
