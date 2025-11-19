'use client';

import React from 'react';
import { ProductUpload } from '@/components/product/ProductUpload';
import COLMAPProgress from './COLMAPProgress';
import TrainingProgress from './TrainingProgress';
import RenderingProgress from './RenderingProgress';
import FramePreviewGallery from './FramePreviewGallery';
import { useNeRFPipeline } from '@/hooks/useNeRFPipeline';
import { useAppStore } from '@/store/appStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/**
 * Main NeRF Pipeline View Component
 * 
 * Orchestrates the complete NeRF pipeline:
 * 1. Product photo upload
 * 2. COLMAP processing (automatic)
 * 3. NeRF training (automatic)
 * 4. Frame rendering (automatic)
 */
export function NeRFPipelineView() {
  const {
    overallProgress,
    pipelineStatus,
    currentStage,
    estimatedTimeRemaining,
    error,
    colmapState,
    trainingState,
    renderingState,
    isPipelineComplete,
  } = useNeRFPipeline();

  // Show upload form if COLMAP hasn't started yet
  if (!colmapState) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>NeRF Product Video Pipeline</CardTitle>
              <CardDescription>
                Upload 50-200 photos of your product to create 1440 transparent frames
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProductUpload 
                onContinue={() => {
                  // Upload complete, COLMAP will start automatically
                  // Component will re-render when colmapState is set
                  console.log('[Pipeline] Upload complete, COLMAP will start automatically');
                }} 
              />
              
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg text-sm">
                <h4 className="font-semibold mb-2">What happens next:</h4>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Photos are validated and uploaded (~1-2 min)</li>
                  <li>COLMAP computes camera poses (~15-20 min)</li>
                  <li>NeRF trains a 3D model (~20-25 min)</li>
                  <li>1440 transparent frames are rendered (~15-20 min)</li>
                </ol>
                <p className="mt-3 text-muted-foreground">
                  <strong>Total time:</strong> ~50-65 minutes | <strong>Cost:</strong> ~$0.35-0.50
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Calculate stage progress for visual indicator
  const getStageStatus = (stage: string) => {
    if (currentStage === stage) return 'in-progress';
    if (currentStage === 'complete') return 'complete';
    
    const stageOrder = ['colmap', 'training', 'rendering', 'complete'];
    const currentIndex = stageOrder.indexOf(currentStage || 'colmap');
    const stageIndex = stageOrder.indexOf(stage);
    
    return currentIndex > stageIndex ? 'complete' : 'pending';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">NeRF Processing Pipeline</h1>
          <p className="text-muted-foreground">
            {Math.round(overallProgress)}% complete
          </p>
        </div>

        {/* Overall Progress */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Overall Progress</CardTitle>
              <Badge 
                variant={
                  pipelineStatus === 'complete' ? 'default' : 
                  pipelineStatus === 'failed' ? 'destructive' : 
                  'secondary'
                }
                className={pipelineStatus === 'complete' ? 'bg-green-500' : ''}
              >
                {pipelineStatus === 'complete' ? '✓ Complete' :
                 pipelineStatus === 'failed' ? 'Failed' :
                 pipelineStatus === 'processing' ? 'Processing' : 'Starting'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Pipeline Progress</span>
                  <span>{Math.round(overallProgress)}%</span>
                </div>
                <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${
                      pipelineStatus === 'failed' ? 'bg-red-500' :
                      pipelineStatus === 'complete' ? 'bg-green-500' :
                      'bg-blue-500'
                    }`}
                    style={{ width: `${overallProgress}%` }}
                  />
                </div>
              </div>

              {/* Stage Indicators */}
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className={`p-3 rounded-lg text-center ${
                  getStageStatus('colmap') === 'complete' ? 'bg-green-100 dark:bg-green-900' :
                  getStageStatus('colmap') === 'in-progress' ? 'bg-blue-100 dark:bg-blue-900' :
                  'bg-gray-100 dark:bg-gray-800'
                }`}>
                  <div className="font-semibold">COLMAP</div>
                  <div className="text-xs text-muted-foreground mt-1">Camera Poses</div>
                </div>
                <div className={`p-3 rounded-lg text-center ${
                  getStageStatus('training') === 'complete' ? 'bg-green-100 dark:bg-green-900' :
                  getStageStatus('training') === 'in-progress' ? 'bg-blue-100 dark:bg-blue-900' :
                  'bg-gray-100 dark:bg-gray-800'
                }`}>
                  <div className="font-semibold">Training</div>
                  <div className="text-xs text-muted-foreground mt-1">NeRF Model</div>
                </div>
                <div className={`p-3 rounded-lg text-center ${
                  getStageStatus('rendering') === 'complete' ? 'bg-green-100 dark:bg-green-900' :
                  getStageStatus('rendering') === 'in-progress' ? 'bg-blue-100 dark:bg-blue-900' :
                  'bg-gray-100 dark:bg-gray-800'
                }`}>
                  <div className="font-semibold">Rendering</div>
                  <div className="text-xs text-muted-foreground mt-1">1440 Frames</div>
                </div>
              </div>

              {/* Time Estimate */}
              {estimatedTimeRemaining && pipelineStatus === 'processing' && (
                <div className="text-sm text-center text-muted-foreground">
                  Estimated time remaining: {Math.ceil(estimatedTimeRemaining / 60)} minutes
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg text-sm text-red-600 dark:text-red-400">
                  <strong>{error.stage} Error:</strong> {error.message}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stage-Specific Progress */}
        {currentStage === 'colmap' && colmapState && (
          <COLMAPProgress colmap={colmapState} />
        )}

        {currentStage === 'training' && trainingState && (
          <TrainingProgress trainingState={trainingState} />
        )}

        {currentStage === 'rendering' && renderingState && (
          <>
            <RenderingProgress renderingState={renderingState} />
            
            {/* Frame Preview Gallery */}
            {renderingState.frames_rendered > 10 && (
              <FramePreviewGallery
                jobId={renderingState.job_id || ''}
                framesRendered={renderingState.frames_rendered}
                totalFrames={renderingState.total_frames}
                previewInterval={10}
              />
            )}
          </>
        )}

        {/* Completion State */}
        {isPipelineComplete && renderingState && (
          <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
            <CardHeader>
              <CardTitle className="text-green-700 dark:text-green-300">
                ✓ Pipeline Complete!
              </CardTitle>
              <CardDescription>
                All {renderingState.total_frames} transparent frames have been rendered
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Frames Generated:</span>{' '}
                  <span className="font-semibold">{renderingState.total_frames}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Format:</span>{' '}
                  <span className="font-semibold">1920x1080 PNG (transparent)</span>
                </div>
              </div>
              
              <div className="flex gap-3">
                <Button variant="default">
                  Download Frames
                </Button>
                <Button variant="outline" onClick={() => window.location.reload()}>
                  Start New Project
                </Button>
              </div>

              {/* Preview Gallery */}
              {renderingState.job_id && (
                <FramePreviewGallery
                  jobId={renderingState.job_id}
                  framesRendered={renderingState.total_frames}
                  totalFrames={renderingState.total_frames}
                  previewInterval={10}
                />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

