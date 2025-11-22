'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebaseAuth } from '@/lib/firebase/AuthContext';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { layoutClasses } from '@/lib/layout';
import { cn, formatDistanceToNow } from '@/lib/utils';
import { useProjectStore } from '@/store/projectStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { STEP_LABELS } from '@/lib/steps';
import { AssetSelectionStep } from '@/components/projects/AssetSelectionStep';
import { listBrandAssets, getBrandAssetImageUrl } from '@/lib/api/brand';
import { listCharacterAssets, getCharacterAssetImageUrl } from '@/lib/api/character';
import type { BrandAssetStatus } from '@/types/brand.types';
import type { CharacterAssetStatus } from '@/types/character.types';

export default function ProjectsPage() {
  const router = useRouter();
  const { userId } = useFirebaseAuth();
  const { projects, getProjectMetadata, createProject, deleteProject, renameProject, duplicateProject } = useProjectStore();
  const [isMounted, setIsMounted] = useState(false);
  const [projectMetadata, setProjectMetadata] = useState<ReturnType<typeof getProjectMetadata>>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  
  // Create project modal state
  const [createStep, setCreateStep] = useState<'name' | 'brand' | 'character'>('name');
  const [selectedBrandAssetIds, setSelectedBrandAssetIds] = useState<string[]>([]);
  const [selectedCharacterAssetIds, setSelectedCharacterAssetIds] = useState<string[]>([]);
  const [brandAssets, setBrandAssets] = useState<BrandAssetStatus[]>([]);
  const [characterAssets, setCharacterAssets] = useState<CharacterAssetStatus[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);

  // Handle hydration - only access localStorage after mount
  useEffect(() => {
    setIsMounted(true);
    setProjectMetadata(getProjectMetadata());
  }, []);

  // Refresh metadata when projects change (only after mount)
  useEffect(() => {
    if (isMounted) {
      setProjectMetadata(getProjectMetadata());
    }
  }, [projects, getProjectMetadata, isMounted]);

  // Sort by updatedAt (most recent first) - only after mount
  const sortedProjects = isMounted 
    ? [...projectMetadata].sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
    : [];

  const handleOpenCreateModal = async () => {
    setIsLoadingAssets(true);
    setCreateStep('name');
    setSelectedBrandAssetIds([]);
    setSelectedCharacterAssetIds([]);
    setProjectName('');
    
    if (!userId) {
      return;
    }

    try {
      // Fetch both asset types
      const [brands, characters] = await Promise.all([
        listBrandAssets(userId),
        listCharacterAssets(userId),
      ]);
      
      setBrandAssets(brands);
      setCharacterAssets(characters);
      
      // Check if user has assets - redirect if missing
      // Bypassed brand asset requirement for testing
      // if (brands.length === 0) {
      //   router.push('/brand-assets?from=create-project');
      //   setIsLoadingAssets(false);
      //   return;
      // }
      
      if (characters.length === 0) {
        router.push('/character-assets?from=create-project');
        setIsLoadingAssets(false);
        return;
      }
      
      // Both exist, show modal
      setShowCreateModal(true);
    } catch (error) {
      console.error('Failed to load assets:', error);
      // Still show modal, but assets will be empty
      setShowCreateModal(true);
    } finally {
      setIsLoadingAssets(false);
    }
  };

  const handleCreateProject = () => {
    // Validate selections - bypassed brand asset requirement for testing
    if (selectedCharacterAssetIds.length === 0) {
      return; // Should not happen due to button disable, but safety check
    }
    
    const name = projectName.trim() || undefined;
    const projectId = createProject({ 
      name,
      brandAssetIds: selectedBrandAssetIds.length > 0 ? selectedBrandAssetIds : undefined,
      characterAssetIds: selectedCharacterAssetIds,
    });
    
    // Reset state
    setProjectName('');
    setSelectedBrandAssetIds([]);
    setSelectedCharacterAssetIds([]);
    setCreateStep('name');
    setShowCreateModal(false);
    
    // Route to chat page
    router.push(`/project/${projectId}/chat`);
  };

  const handleNextStep = () => {
    if (createStep === 'name') {
      setCreateStep('brand');
    } else if (createStep === 'brand') {
      // Bypassed brand asset requirement for testing - can proceed without selection
      setCreateStep('character');
    }
  };

  const handleBackStep = () => {
    if (createStep === 'character') {
      setCreateStep('brand');
    } else if (createStep === 'brand') {
      setCreateStep('name');
    }
  };

  const canProceedToNext = () => {
    if (createStep === 'name') {
      return true; // Name is optional
    } else if (createStep === 'brand') {
      return true; // Bypassed brand asset requirement for testing
    } else if (createStep === 'character') {
      return selectedCharacterAssetIds.length > 0;
    }
    return false;
  };

  const handleRenameProject = () => {
    if (!selectedProject || !projectName.trim()) return;
    renameProject(selectedProject, projectName.trim());
    setProjectName('');
    setShowRenameModal(false);
    setSelectedProject(null);
  };

  const handleDeleteProject = () => {
    if (!selectedProject) return;
    const project = projectMetadata.find(p => p.id === selectedProject);
    if (project && deleteConfirmName === project.name) {
      deleteProject(selectedProject);
      setDeleteConfirmName('');
      setShowDeleteModal(false);
      setSelectedProject(null);
    }
  };

  const handleOpenRename = (projectId: string, currentName: string) => {
    setSelectedProject(projectId);
    setProjectName(currentName);
    setShowRenameModal(true);
  };

  const handleOpenDelete = (projectId: string) => {
    setSelectedProject(projectId);
    setDeleteConfirmName('');
    setShowDeleteModal(true);
  };

  const handleDuplicate = (projectId: string) => {
    const { projects } = useProjectStore.getState();
    const newProjectId = duplicateProject(projectId);
    const duplicatedProject = projects.find(p => p.id === newProjectId);
    const currentStep = duplicatedProject?.appState.currentStep || 'chat';
    router.push(`/project/${newProjectId}/${currentStep}`);
  };

  const handleProjectClick = (projectId: string) => {
    // Verify project exists before routing
    const { loadProject, projects } = useProjectStore.getState();
    const project = projects.find(p => p.id === projectId);
    
    if (!project) {
      console.error(`Project not found: ${projectId}`);
      return;
    }

    // Load the project before routing to ensure correct state
    try {
      loadProject(projectId);
      // Route to the project's current step instead of always going to chat
      const currentStep = project.appState.currentStep;
      router.push(`/project/${projectId}/${currentStep}`);
    } catch (error) {
      console.error('Failed to load project:', error);
      // Still route - the page will handle the error
      const currentStep = project.appState.currentStep;
      router.push(`/project/${projectId}/${currentStep}`);
    }
  };

  return (
    <AuthGuard>
      <div className={cn(layoutClasses.fullScreen, 'flex flex-col pt-[calc(3.5rem+1.5rem)]')}>
        <main className={cn(layoutClasses.scrollableContainer, 'flex-1 p-3 sm:p-4')}>
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6 animate-fadeIn">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight">
                Your <span className="text-gradient">Projects</span>
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Manage and view all your video generation projects
              </p>
            </div>
            <Button onClick={handleOpenCreateModal} size="default" disabled={isLoadingAssets}>
              <Plus className="w-4 h-4 mr-1.5" />
              Create
            </Button>
          </div>

          {!isMounted ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed rounded-lg">
              <p className="text-muted-foreground text-center">
                Loading projects...
              </p>
            </div>
          ) : sortedProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed rounded-lg">
              <p className="text-muted-foreground text-center mb-4">
                No projects yet. Start creating your first video project!
              </p>
              <Button onClick={handleOpenCreateModal} disabled={isLoadingAssets}>
                <Plus className="w-4 h-4 mr-2" />
                Create Project
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedProjects.map((project) => (
                <Card
                  key={project.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleProjectClick(project.id)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="truncate">{project.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {STEP_LABELS[project.currentStep]}
                        </CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          onClick={(e) => e.stopPropagation()}
                          className="ml-2"
                        >
                          <MoreVertical className="w-4 h-4 text-muted-foreground" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenRename(project.id, project.name);
                            }}
                          >
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicate(project.id);
                            }}
                          >
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDelete(project.id);
                            }}
                            className="text-destructive"
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {project.thumbnail ? (
                      <div className="aspect-video w-full rounded-md overflow-hidden bg-muted mb-3">
                        <img
                          src={project.thumbnail}
                          alt={project.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="aspect-video w-full rounded-md bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-3">
                        <div className="text-center px-4">
                          <p className="text-2xl font-bold text-foreground/80 line-clamp-2">
                            {project.name}
                          </p>
                        </div>
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Updated {formatDistanceToNow(project.updatedAt)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg mx-auto shadow-2xl flex flex-col border-2 border-[rgb(255,81,1)]/20">
            <CardHeader className="pb-4 mockupper-bg">
              <CardTitle className="text-2xl mockupper-primary font-bold">Create New Project</CardTitle>
              {createStep === 'name' && (
                <CardDescription className="text-sm mt-1.5 text-muted-foreground">
                  Enter a name for your project (optional - will auto-generate if left blank)
                </CardDescription>
              )}
              {createStep === 'brand' && (
                <CardDescription className="text-sm mt-1.5 text-muted-foreground">
                  Select the brand assets to use in this project
                </CardDescription>
              )}
              {createStep === 'character' && (
                <CardDescription className="text-sm mt-1.5 text-muted-foreground">
                  Select the character assets to use in this project
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto pb-6">
              {createStep === 'name' && (
                <div className="space-y-2">
                  <Label htmlFor="project-name" className="text-sm font-medium">
                    Project Name
                  </Label>
                  <Input
                    id="project-name"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Project 1"
                    className="h-11 focus-visible:border-[rgb(255,81,1)] focus-visible:ring-[rgb(255,81,1)]/50"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && canProceedToNext()) {
                        handleNextStep();
                      } else if (e.key === 'Escape') {
                        setShowCreateModal(false);
                        setProjectName('');
                        setCreateStep('name');
                      }
                    }}
                    autoFocus
                  />
                </div>
              )}
              
              {createStep === 'brand' && (
                <AssetSelectionStep
                  assetType="brand"
                  selectedIds={selectedBrandAssetIds}
                  onSelectionChange={setSelectedBrandAssetIds}
                  onNext={handleNextStep}
                  onBack={handleBackStep}
                  isLoading={isLoadingAssets}
                  assets={brandAssets}
                  getImageUrl={getBrandAssetImageUrl}
                />
              )}
              
              {createStep === 'character' && (
                <AssetSelectionStep
                  assetType="character"
                  selectedIds={selectedCharacterAssetIds}
                  onSelectionChange={setSelectedCharacterAssetIds}
                  onNext={handleCreateProject}
                  onBack={handleBackStep}
                  isLoading={isLoadingAssets}
                  assets={characterAssets}
                  getImageUrl={getCharacterAssetImageUrl}
                />
              )}
            </CardContent>
            <div className="flex justify-between items-center px-6 py-4 border-t mockupper-bg">
              <div>
                {createStep !== 'name' && (
                  <Button
                    variant="outline"
                    onClick={handleBackStep}
                    size="default"
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateModal(false);
                    setProjectName('');
                    setSelectedBrandAssetIds([]);
                    setSelectedCharacterAssetIds([]);
                    setCreateStep('name');
                  }}
                  size="default"
                >
                  Cancel
                </Button>
                {createStep === 'character' ? (
                  <Button 
                    onClick={handleCreateProject}
                    disabled={!canProceedToNext()}
                    size="default"
                  >
                    Create Project
                  </Button>
                ) : (
                  <Button 
                    onClick={handleNextStep}
                    disabled={!canProceedToNext()}
                    size="default"
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Rename Project Modal */}
      {showRenameModal && selectedProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Rename Project</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="rename-project-name">Project Name</Label>
                <Input
                  id="rename-project-name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleRenameProject();
                    } else if (e.key === 'Escape') {
                      setShowRenameModal(false);
                      setProjectName('');
                      setSelectedProject(null);
                    }
                  }}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRenameModal(false);
                    setProjectName('');
                    setSelectedProject(null);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleRenameProject} disabled={!projectName.trim()}>
                  Rename
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Delete Project</CardTitle>
              <CardDescription>
                This action cannot be undone. Type the project name to confirm.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="delete-confirm-name">Project Name</Label>
                <Input
                  id="delete-confirm-name"
                  value={deleteConfirmName}
                  onChange={(e) => setDeleteConfirmName(e.target.value)}
                  placeholder={projectMetadata.find(p => p.id === selectedProject)?.name}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleDeleteProject();
                    } else if (e.key === 'Escape') {
                      setShowDeleteModal(false);
                      setDeleteConfirmName('');
                      setSelectedProject(null);
                    }
                  }}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmName('');
                    setSelectedProject(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteProject}
                  disabled={
                    deleteConfirmName !== projectMetadata.find(p => p.id === selectedProject)?.name
                  }
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
    </AuthGuard>
  );
}
