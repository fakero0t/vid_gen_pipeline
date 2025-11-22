import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Project, ProjectMetadata, AppStateSnapshot, CreateProjectRequest, UpdateProjectRequest } from '@/types/project.types';
import { migrateNumericStep } from '@/lib/steps';
import { useAppStore } from './appStore';
import { useSceneStore } from './sceneStore';
import { saveProjectToFirestore, canUseFirestore } from '@/lib/firebase';
import { getCurrentUserId } from '@/lib/auth/api';

const PROJECTS_STORAGE_KEY = 'jant-vid-pipe-projects';
const CURRENT_PROJECT_STORAGE_KEY = 'jant-vid-pipe-current-project-id';

interface ProjectStoreState {
  projects: Project[];
  currentProjectId: string | null;

  // CRUD operations
  createProject: (request?: CreateProjectRequest) => string;
  updateProject: (id: string, updates: UpdateProjectRequest) => void;
  deleteProject: (id: string) => void;
  duplicateProject: (id: string) => string;
  renameProject: (id: string, newName: string) => void;

  // Project selection
  selectProject: (id: string) => void;
  loadProject: (id: string) => void;

  // Auto-save
  saveCurrentProject: () => void;
  scheduleAutoSave: () => void;

  // Utilities
  getProjectMetadata: () => ProjectMetadata[];
  getCurrentProject: () => Project | null;
  generateThumbnail: (projectId: string) => Promise<string | undefined>;
}

let autoSaveTimer: NodeJS.Timeout | null = null;
const AUTO_SAVE_DEBOUNCE_MS = 1500;

// Helper to generate project name
function generateProjectName(existingProjects: Project[]): string {
  const projectNumbers = existingProjects
    .map(p => {
      const match = p.name.match(/^Project (\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(n => n > 0);
  
  const nextNumber = projectNumbers.length > 0 
    ? Math.max(...projectNumbers) + 1 
    : 1;
  
  return `Project ${nextNumber}`;
}

// Helper to create app state snapshot
function createAppStateSnapshot(): AppStateSnapshot {
  const appState = useAppStore.getState();
  return {
    currentStep: appState.currentStep,
    creativeBrief: appState.creativeBrief,
    chatMessages: appState.chatMessages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp.toISOString(),
    })),
    moods: appState.moods,
    selectedMoodId: appState.selectedMoodId,
    backgroundAssets: appState.backgroundAssets || [],
    selectedBackgroundIds: appState.selectedBackgroundIds || [],
    storyboardCompleted: appState.storyboardCompleted,
    audioUrl: appState.audioUrl,
    compositionJobId: appState.compositionJobId,
    finalVideo: appState.finalVideo,
  };
}

// Helper to restore app state from snapshot
function restoreAppState(snapshot: AppStateSnapshot): void {
  const appStore = useAppStore.getState();
  
  // Migrate old numeric steps to string-based steps
  const currentStep = typeof snapshot.currentStep === 'number' 
    ? migrateNumericStep(snapshot.currentStep)
    : snapshot.currentStep;
  
  appStore.setCurrentStep(currentStep);
  appStore.setCreativeBrief(snapshot.creativeBrief);
  // Restore chat messages, converting ISO strings back to Date objects
  appStore.setChatMessages(
    (snapshot.chatMessages || []).map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.timestamp),
    }))
  );
  appStore.setMoods(snapshot.moods);
  // Set selectedMoodId - if null, clear by setting to empty string
  appStore.selectMood(snapshot.selectedMoodId || '');
  appStore.setBackgroundAssets(snapshot.backgroundAssets || []);
  appStore.setSelectedBackgroundIds(snapshot.selectedBackgroundIds || []);
  appStore.setStoryboardCompleted(snapshot.storyboardCompleted);
  // Always set audioUrl, even if null, to clear previous project's audio
  appStore.setAudioUrl(snapshot.audioUrl || null);
  // Always set compositionJobId, even if null
  appStore.setCompositionJobId(snapshot.compositionJobId || null);
  // Always set finalVideo, even if null
  appStore.setFinalVideo(snapshot.finalVideo || null);
}

/**
 * Sync projects from Firestore on mount
 * Merges Firestore projects with localStorage, migrates localStorage-only projects
 */
async function syncProjectsFromFirestore(
  userId: string,
  localProjects: Project[]
): Promise<Project[]> {
  try {
    console.log('[ProjectStore] Loading projects from Firestore...');
    
    // Load all projects from Firestore
    const { loadProjectsFromFirestore, batchSaveProjectsToFirestore } = await import('@/lib/firebase');
    const firestoreProjects = await loadProjectsFromFirestore(userId);
    
    console.log('[ProjectStore] Loaded from Firestore:', firestoreProjects.length, 'projects');
    console.log('[ProjectStore] Local projects:', localProjects.length, 'projects');
    
    // Create a map of Firestore projects by ID for easy lookup
    const firestoreMap = new Map(firestoreProjects.map(p => [p.id, p]));
    const localMap = new Map(localProjects.map(p => [p.id, p]));
    
    // Find projects that exist in localStorage but not in Firestore (need migration)
    const projectsToMigrate: Project[] = [];
    for (const localProject of localProjects) {
      if (!firestoreMap.has(localProject.id)) {
        projectsToMigrate.push(localProject);
      }
    }
    
    // Migrate localStorage-only projects to Firestore
    if (projectsToMigrate.length > 0) {
      console.log('[ProjectStore] Migrating', projectsToMigrate.length, 'projects to Firestore...');
      const migrated = await batchSaveProjectsToFirestore(userId, projectsToMigrate);
      console.log('[ProjectStore] ✓ Migrated', migrated, 'projects to Firestore');
    }
    
    // Merge: Firestore projects take precedence, plus any newly migrated projects
    // Use Firestore version if project exists in both (it's the source of truth)
    const mergedProjects: Project[] = [];
    const allProjectIds = new Set([
      ...firestoreMap.keys(),
      ...localMap.keys()
    ]);
    
    for (const projectId of allProjectIds) {
      const firestoreProject = firestoreMap.get(projectId);
      const localProject = localMap.get(projectId);
      
      if (firestoreProject) {
        // Firestore version exists - use it (source of truth)
        mergedProjects.push(firestoreProject);
      } else if (localProject) {
        // Only in localStorage (just migrated)
        mergedProjects.push(localProject);
      }
    }
    
    // Sort by updatedAt (most recent first)
    mergedProjects.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    
    console.log('[ProjectStore] ✓ Synced:', mergedProjects.length, 'total projects');
    return mergedProjects;
    
  } catch (error) {
    console.error('[ProjectStore] Failed to sync from Firestore:', error);
    console.log('[ProjectStore] Falling back to localStorage projects');
    // On error, return localStorage projects (fallback)
    return localProjects;
  }
}

export const useProjectStore = create<ProjectStoreState>()(
  persist(
    (set, get) => ({
      projects: [],
      currentProjectId: null,

      createProject: (request) => {
        const state = get();
        const projectId = crypto.randomUUID();
        const now = new Date().toISOString();
        const name = request?.name || generateProjectName(state.projects);

        const newProject: Project = {
          id: projectId,
          name,
          createdAt: now,
          updatedAt: now,
          brandAssetIds: request?.brandAssetIds || [],
          characterAssetIds: request?.characterAssetIds || [],
          backgroundAssetIds: request?.backgroundAssetIds || [],
          appState: createAppStateSnapshot(),
        };

        set({
          projects: [...state.projects, newProject],
          currentProjectId: projectId,
        });

        // Reset app store for new project
        useAppStore.getState().reset();
        useSceneStore.getState().reset();

      console.log('[ProjectStore] Created new project:', {
        id: projectId,
        name,
        brandAssetIds: newProject.brandAssetIds?.length || 0,
        characterAssetIds: newProject.characterAssetIds?.length || 0,
      });

        return projectId;
      },

      updateProject: (id, updates) => {
        const state = get();
        const projectIndex = state.projects.findIndex(p => p.id === id);
        if (projectIndex === -1) return;

        const updatedProjects = [...state.projects];
        updatedProjects[projectIndex] = {
          ...updatedProjects[projectIndex],
          ...updates,
          updatedAt: new Date().toISOString(),
        };

        set({ projects: updatedProjects });
      },

      deleteProject: (id) => {
        const state = get();
        const filteredProjects = state.projects.filter(p => p.id !== id);
        
        let newCurrentProjectId = state.currentProjectId;
        if (state.currentProjectId === id) {
          // If deleting current project, select first available or null
          newCurrentProjectId = filteredProjects.length > 0 ? filteredProjects[0].id : null;
          if (newCurrentProjectId) {
            get().loadProject(newCurrentProjectId);
          } else {
            // Reset stores if no projects left
            useAppStore.getState().reset();
            useSceneStore.getState().reset();
          }
        }

        set({
          projects: filteredProjects,
          currentProjectId: newCurrentProjectId,
        });
      },

      duplicateProject: (id) => {
        const state = get();
        const project = state.projects.find(p => p.id === id);
        if (!project) return id;

        const newProjectId = crypto.randomUUID();
        const now = new Date().toISOString();
        const duplicatedName = `${project.name} (Copy)`;

        const duplicatedProject: Project = {
          ...project,
          id: newProjectId,
          name: duplicatedName,
          createdAt: now,
          updatedAt: now,
          thumbnail: undefined, // Don't copy thumbnail
        };

        set({
          projects: [...state.projects, duplicatedProject],
          currentProjectId: newProjectId,
        });

        // Load the duplicated project
        get().loadProject(newProjectId);

        return newProjectId;
      },

      renameProject: (id, newName) => {
        get().updateProject(id, { name: newName });
      },

      selectProject: (id) => {
        set({ currentProjectId: id });
      },

      loadProject: (id) => {
        const state = get();
        const project = state.projects.find(p => p.id === id);
        if (!project) {
          console.error(`[ProjectStore] Project not found: ${id}`);
          return;
        }

        console.log('[ProjectStore] Loading project:', { 
          id, 
          name: project.name,
          hasCreativeBrief: !!project.appState.creativeBrief,
          moodsCount: project.appState.moods.length,
          currentStep: project.appState.currentStep,
          storyboardId: project.storyboardId 
        });

        // Set as current project
        set({ currentProjectId: id });

        // Reset scene store FIRST to clear any previous project's scenes
        useSceneStore.getState().reset();

        // Restore app state
        restoreAppState(project.appState);

        // Load storyboard if storyboardId exists
        if (project.storyboardId) {
          console.log('[ProjectStore] Loading storyboard for project:', project.storyboardId);
          useSceneStore.getState().loadStoryboard(project.storyboardId).catch(err => {
            // If storyboard not found, clear the reference
            const errorMessage = err instanceof Error ? err.message : String(err);
            if (errorMessage.includes('STORYBOARD_NOT_FOUND') || 
                errorMessage.includes('404') || 
                errorMessage.includes('not found')) {
              console.warn('[ProjectStore] Storyboard not found, clearing reference from project');
              get().updateProject(id, { storyboardId: undefined });
            } else {
              console.error('[ProjectStore] Failed to load storyboard:', err);
            }
          });
        } else {
          console.log('[ProjectStore] No storyboard associated with this project yet');
        }
      },

      saveCurrentProject: () => {
        const state = get();
        if (!state.currentProjectId) return;

        const projectIndex = state.projects.findIndex(p => p.id === state.currentProjectId);
        if (projectIndex === -1) return;

        const appStateSnapshot = createAppStateSnapshot();
        const sceneState = useSceneStore.getState();
        const storyboardId = sceneState.storyboard?.storyboard_id;

        const updatedProjects = [...state.projects];
        const projectName = updatedProjects[projectIndex].name;
        const updatedProject = {
          ...updatedProjects[projectIndex],
          appState: appStateSnapshot,
          storyboardId,
          updatedAt: new Date().toISOString(),
        };
        updatedProjects[projectIndex] = updatedProject;

        // Save to localStorage (existing behavior via persist middleware)
        set({ projects: updatedProjects });
        
        console.log('[ProjectStore] Auto-saved to localStorage:', { 
          id: state.currentProjectId, 
          name: projectName,
          hasCreativeBrief: !!appStateSnapshot.creativeBrief,
          moodsCount: appStateSnapshot.moods.length,
          currentStep: appStateSnapshot.currentStep
        });

        // NEW: Also save to Firestore (non-blocking)
        if (typeof window !== 'undefined') {
          const userId = getCurrentUserId();
          
          if (!userId) {
            console.log('[ProjectStore] Skipping Firestore sync (user not authenticated)');
            return;
          }

          if (!canUseFirestore()) {
            console.log('[ProjectStore] Skipping Firestore sync (Firestore not available)');
            return;
          }

          // Async Firestore save (don't await - non-blocking)
          saveProjectToFirestore(userId, updatedProject)
            .then(() => {
              console.log('[ProjectStore] ✓ Synced to Firestore:', updatedProject.id);
            })
            .catch((error) => {
              console.error('[ProjectStore] Failed to sync to Firestore:', error);
              // Don't throw - localStorage save already succeeded
            });
        }
      },

      scheduleAutoSave: () => {
        if (autoSaveTimer) {
          clearTimeout(autoSaveTimer);
        }
        autoSaveTimer = setTimeout(() => {
          get().saveCurrentProject();
          autoSaveTimer = null;
        }, AUTO_SAVE_DEBOUNCE_MS);
      },

      getProjectMetadata: () => {
        const state = get();
        return state.projects.map(project => ({
          id: project.id,
          name: project.name,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          thumbnail: project.thumbnail,
          storyboardId: project.storyboardId,
          currentStep: project.appState.currentStep,
        }));
      },

      getCurrentProject: () => {
        const state = get();
        if (!state.currentProjectId) return null;
        return state.projects.find(p => p.id === state.currentProjectId) || null;
      },

      generateThumbnail: async (projectId) => {
        const state = get();
        const project = state.projects.find(p => p.id === projectId);
        if (!project) return undefined;

        // Priority 1: Try to get thumbnail from storyboard scenes
        if (project.storyboardId) {
          try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const response = await fetch(`${API_URL}/api/storyboards/${project.storyboardId}`);
            if (response.ok) {
              const data = await response.json();
              const scenes = data.scenes || [];
              // Find first scene with an image
              const sceneWithImage = scenes.find((scene: any) => scene.image_url);
              if (sceneWithImage) {
                return sceneWithImage.image_url;
              }
            }
          } catch (error) {
            console.error('[ProjectStore] Failed to fetch storyboard for thumbnail:', error);
          }
        }

        // Priority 2: Try to get thumbnail from mood images
        if (project.appState.moods.length > 0) {
          const firstMood = project.appState.moods[0];
          if (firstMood.images.length > 0) {
            return firstMood.images[0].url;
          }
        }

        // Priority 3: No image available, will use project name fallback
        return undefined;
      },
    }),
    {
      name: PROJECTS_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        projects: state.projects,
        currentProjectId: state.currentProjectId,
      }),
    }
  )
);

// Subscribe to appStore changes to trigger auto-save
if (typeof window !== 'undefined') {
  // Clean up old localStorage keys from previous persistence system
  const cleanupOldStorage = () => {
    const oldKeys = ['jant-vid-pipe-app-state', 'jant-vid-pipe-storyboard-state'];
    oldKeys.forEach(key => {
      if (localStorage.getItem(key)) {
        console.log('[ProjectStore] Cleaning up old localStorage key:', key);
        localStorage.removeItem(key);
      }
    });
  };
  cleanupOldStorage();

  useAppStore.subscribe(() => {
    useProjectStore.getState().scheduleAutoSave();
  });

  // On initial load, if there's a current project, restore its state
  const initializeCurrentProject = () => {
    const { currentProjectId, projects } = useProjectStore.getState();
    if (currentProjectId && projects.length > 0) {
      const currentProject = projects.find(p => p.id === currentProjectId);
      if (currentProject) {
        console.log('[ProjectStore] Restoring current project state on load:', currentProjectId);
        restoreAppState(currentProject.appState);
        
        // Also restore storyboard if it exists
        if (currentProject.storyboardId) {
          console.log('[ProjectStore] Restoring storyboard on load:', currentProject.storyboardId);
          useSceneStore.getState().loadStoryboard(currentProject.storyboardId).catch(err => {
            // If storyboard not found, clear the reference
            const projectStore = useProjectStore.getState();
            const errorMessage = err instanceof Error ? err.message : String(err);
            if (errorMessage.includes('STORYBOARD_NOT_FOUND') || 
                errorMessage.includes('404') || 
                errorMessage.includes('not found')) {
              console.warn('[ProjectStore] Storyboard not found on restore, clearing reference');
              projectStore.updateProject(currentProject.id, { storyboardId: undefined });
            } else {
              console.error('[ProjectStore] Failed to restore storyboard:', err);
            }
          });
        }
      }
    }
  };

  // Wait for hydration to complete, then initialize
  let hasInitialized = false;
  const unsubscribe = useProjectStore.subscribe((state) => {
    if (!hasInitialized && state.projects.length > 0) {
      initializeCurrentProject();
      hasInitialized = true;
      unsubscribe();
    }
  });
  
  // Also try immediately in case hydration already happened
  initializeCurrentProject();

  // Sync projects from Firestore on mount
  const syncFromFirestore = async () => {
    // Wait for auth to be ready
    const checkAuth = () => {
      const userId = getCurrentUserId();
      if (!userId) {
        console.log('[ProjectStore] Skipping Firestore sync (user not authenticated)');
        return;
      }
      
      if (!canUseFirestore()) {
        console.log('[ProjectStore] Skipping Firestore sync (Firestore not available)');
        return;
      }
      
      // Get current localStorage projects
      const { projects: localProjects } = useProjectStore.getState();
      
      // Sync with Firestore
      syncProjectsFromFirestore(userId, localProjects)
        .then((mergedProjects) => {
          // Update store with merged projects
          useProjectStore.setState({ projects: mergedProjects });
          console.log('[ProjectStore] ✓ Store updated with Firestore projects');
        })
        .catch((error) => {
          console.error('[ProjectStore] Firestore sync failed:', error);
          // Store already has localStorage projects, so app continues working
        });
    };
    
    // Delay check to allow auth to initialize
    // Firebase Auth needs a moment to restore session
    setTimeout(checkAuth, 500);
  };

  // Run sync on mount
  syncFromFirestore();
}

