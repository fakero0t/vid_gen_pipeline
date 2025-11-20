'use client';

import { useRouter } from 'next/navigation';
import { useProjectStore } from '@/store/projectStore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';

export function ProjectSwitcher() {
  const router = useRouter();
  const { currentProjectId, getCurrentProject, getProjectMetadata } = useProjectStore();

  const currentProject = currentProjectId ? getCurrentProject() : null;
  const allProjects = getProjectMetadata();
  
  // Get up to 5 most recent projects (excluding current)
  const recentProjects = allProjects
    .filter(p => p.id !== currentProjectId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  const handleSwitchProject = (projectId: string) => {
    const { loadProject, projects } = useProjectStore.getState();
    const project = projects.find(p => p.id === projectId);
    
    if (project) {
      loadProject(projectId);
      const currentStep = project.appState.currentStep;
      router.push(`/project/${projectId}/${currentStep}`);
    }
  };

  const handleViewAll = () => {
    router.push('/projects');
  };

  if (!currentProject) {
    return (
      <Button variant="outline" onClick={handleViewAll}>
        View Projects
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="min-w-[200px] justify-between">
          <span className="truncate">{currentProject.name}</span>
          <ChevronDown className="w-4 h-4 ml-2 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[250px]">
        {recentProjects.length > 0 && (
          <>
            {recentProjects.map((project) => (
              <DropdownMenuItem
                key={project.id}
                onClick={() => handleSwitchProject(project.id)}
                className="cursor-pointer"
              >
                <div className="flex items-center gap-2 w-full">
                  {project.thumbnail ? (
                    <img
                      src={project.thumbnail}
                      alt={project.name}
                      className="w-8 h-8 rounded object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded bg-muted" />
                  )}
                  <span className="truncate">{project.name}</span>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={handleViewAll} className="cursor-pointer">
          View All Projects
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
