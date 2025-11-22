'use client';

import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { StoryboardScene, SceneState, GenerationStatus } from '@/types/storyboard.types';
import { Button } from '@/components/ui/button';
import { GripVertical } from 'lucide-react';

interface SceneTimelineNewProps {
  scenes: StoryboardScene[];
  sceneOrder: string[];
  currentSceneIndex: number;
  onSceneClick: (index: number) => void;
  onAddScene?: () => void;
  onRemoveScene?: (sceneId: string) => void;
  onReorderScenes?: (newOrder: string[]) => void;
  isGenerating?: boolean;
}

// Color coding based on PRD specifications
const getSceneColor = (state: SceneState, generationStatus: GenerationStatus | undefined, hasError: boolean): string => {
  if (hasError) {
    return 'hsl(0, 70%, 50%)'; // Red for errors
  }

  switch (state) {
    case 'text':
      return 'hsl(220, 10%, 40%)'; // Gray
    case 'image':
      return 'hsl(45, 90%, 60%)'; // Yellow
    case 'video':
      return 'hsl(140, 70%, 50%)'; // Green
    default:
      return 'hsl(220, 10%, 40%)'; // Default gray
  }
};

const getSceneLabel = (state: SceneState): string => {
  switch (state) {
    case 'text':
      return 'Text';
    case 'image':
      return 'Image';
    case 'video':
      return 'Video';
    default:
      return 'Unknown';
  }
};

const isSceneGenerating = (scene: StoryboardScene): boolean => {
  return (
    scene.generation_status.image === 'generating' ||
    scene.generation_status.video === 'generating'
  );
};

interface SortableSceneButtonProps {
  scene: StoryboardScene;
  index: number;
  isActive: boolean;
  isGenerating: boolean;
  canDrag: boolean;
  canDelete: boolean;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

function SortableSceneButton({
  scene,
  index,
  isActive,
  isGenerating: isSceneGenerating,
  canDrag,
  canDelete,
  onClick,
  onDelete,
}: SortableSceneButtonProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: scene.id,
    disabled: !canDrag,
  });

  const hasError = scene.error_message !== null && scene.error_message !== undefined;
  const color = getSceneColor(
    scene.state,
    scene.state === 'image' ? scene.generation_status.image : scene.generation_status.video,
    hasError
  );

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group flex items-center gap-1 flex-shrink-0"
    >
      {/* Drag handle - only visible on hover */}
      {canDrag && (
        <div
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
          aria-label={`Drag to reorder scene ${index + 1}`}
          title="Drag to reorder"
        >
          <GripVertical className="w-3 h-3 text-muted-foreground hover:text-foreground" />
        </div>
      )}
      
      <button
        onClick={onClick}
        className={`
          w-8 h-8 rounded-md border-2 transition-colors duration-200 flex items-center justify-center relative flex-shrink-0
          hover:ring-2 hover:ring-primary/30 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
          ${isActive ? 'border-primary shadow-md ring-2 ring-primary/20' : 'border-transparent'}
          ${isSceneGenerating ? 'animate-pulse' : ''}
          cursor-pointer
          ${isDragging ? 'z-50' : ''}
        `}
        style={{ backgroundColor: color }}
        aria-label={`Scene ${index + 1}: ${getSceneLabel(scene.state)} state${isActive ? ' (current)' : ''}`}
        aria-current={isActive ? 'true' : undefined}
        title={`Scene ${index + 1}: ${getSceneLabel(scene.state)}${hasError ? ' (Error)' : ''}`}
      >
        {/* Scene number - compact */}
        <span className="text-xs font-bold text-white drop-shadow-sm">
          {index + 1}
        </span>
        
        {/* Error indicator - small dot */}
        {hasError && !isSceneGenerating && (
          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border border-white" />
        )}
        
        {/* Generating indicator - small spinner */}
        {isSceneGenerating && (
          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 border border-white border-t-transparent rounded-full animate-spin" />
        )}

        {/* Delete button - show on hover */}
        {canDelete && onDelete && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onDelete(e);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onDelete(e as any);
              }
            }}
            role="button"
            tabIndex={0}
            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1"
            aria-label={`Delete scene ${index + 1}`}
            title={`Delete scene ${index + 1}`}
          >
            <span className="text-white text-[10px] leading-none">×</span>
          </div>
        )}
      </button>
    </div>
  );
}

export function SceneTimelineNew({
  scenes,
  sceneOrder,
  currentSceneIndex,
  onSceneClick,
  onAddScene,
  onRemoveScene,
  onReorderScenes,
  isGenerating = false,
}: SceneTimelineNewProps) {
  const [localOrder, setLocalOrder] = useState(sceneOrder);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [sceneToDelete, setSceneToDelete] = useState<{ id: string; index: number } | null>(null);

  // Update local order when sceneOrder prop changes
  React.useEffect(() => {
    setLocalOrder(sceneOrder);
  }, [sceneOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const canDrag = !isGenerating && onReorderScenes !== undefined;
  const canAdd = !isGenerating && sceneOrder.length < 20 && onAddScene !== undefined;
  const canDelete = !isGenerating && sceneOrder.length > 3 && onRemoveScene !== undefined;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !onReorderScenes) {
      return;
    }

    const oldIndex = localOrder.indexOf(active.id as string);
    const newIndex = localOrder.indexOf(over.id as string);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(localOrder, oldIndex, newIndex);
      setLocalOrder(newOrder);
      onReorderScenes(newOrder);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, sceneId: string, index: number) => {
    e.stopPropagation();
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;

    setSceneToDelete({ id: sceneId, index });
    setShowConfirmDialog(true);
  };

  const handleConfirmDelete = () => {
    if (sceneToDelete && onRemoveScene) {
      onRemoveScene(sceneToDelete.id);
    }
    setShowConfirmDialog(false);
    setSceneToDelete(null);
  };

  const handleCancelDelete = () => {
    setShowConfirmDialog(false);
    setSceneToDelete(null);
  };

  const sceneToDeleteData = sceneToDelete
    ? scenes.find(s => s.id === sceneToDelete.id)
    : null;

  const hasGeneratedContent = sceneToDeleteData
    ? !!(sceneToDeleteData.image_url || sceneToDeleteData.video_url)
    : false;

  return (
    <div className="w-full">
      {/* Confirmation Dialog */}
      {showConfirmDialog && sceneToDelete && sceneToDeleteData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Delete Scene {sceneToDelete.index + 1}?</h3>
            <div className="space-y-2 mb-4">
              <p className="text-sm text-muted-foreground">
                Scene {sceneToDelete.index + 1}: {getSceneLabel(sceneToDeleteData.state)} state
              </p>
              {hasGeneratedContent && (
                <div className="text-sm text-amber-600 dark:text-amber-400">
                  ⚠️ This scene has generated content:
                  {sceneToDeleteData.image_url && <div>• Image</div>}
                  {sceneToDeleteData.video_url && <div>• Video</div>}
                </div>
              )}
              <p className="text-sm text-destructive font-medium">
                Warning: This action cannot be undone. All content for this scene will be lost.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelDelete}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmDelete}
              >
                Delete Scene
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Compact horizontal timeline - just scene numbers */}
      <div className="flex items-center justify-between flex-wrap">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={localOrder}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {localOrder.map((sceneId, index) => {
                const scene = scenes.find(s => s.id === sceneId);
                if (!scene) return null;

                const isActive = index === currentSceneIndex;
                const isSceneGeneratingState = isSceneGenerating(scene);

                return (
                  <SortableSceneButton
                    key={scene.id}
                    scene={scene}
                    index={index}
                    isActive={isActive}
                    isGenerating={isSceneGeneratingState}
                    canDrag={canDrag}
                    canDelete={canDelete}
                    onClick={() => onSceneClick(index)}
                    onDelete={(e) => handleDeleteClick(e, scene.id, index)}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>

        {/* Add Scene Button */}
        {canAdd && onAddScene && (
          <button
            onClick={onAddScene}
            className="w-8 h-8 rounded-md border-2 border-dashed border-border hover:border-primary hover:bg-primary/10 flex items-center justify-center transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 ml-4"
            aria-label="Add new scene"
            title={sceneOrder.length >= 20 ? 'Maximum 20 scenes reached' : 'Add new scene'}
          >
            <span className="text-muted-foreground hover:text-primary text-lg leading-none">+</span>
          </button>
        )}
      </div>
    </div>
  );
}
