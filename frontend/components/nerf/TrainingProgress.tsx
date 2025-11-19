'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { NeRFTrainingState, TrainingStage } from '@/types/nerf.types';
import { formatDuration } from '@/lib/utils';

interface TrainingProgressProps {
  trainingState: NeRFTrainingState | null;
}

const TrainingProgress: React.FC<TrainingProgressProps> = ({ trainingState }) => {
  if (!trainingState || trainingState.status === 'idle') {
    return null;
  }

  const {
    status,
    progress,
    stage_progress,
    current_iteration,
    total_iterations,
    loss,
    psnr,
    ssim,
    gpu_type,
    estimated_time_remaining,
    elapsed_time,
    cost_so_far,
    stage_details,
    error,
  } = trainingState;

  // Stage titles based on current progress
  const stageTitles: Record<string, string> = {
    data_preparation: "1/3: Preparing Training Data",
    training: "2/3: Training NeRF Model",
    validation: "3/3: Validating Model",
    complete: "Training Complete",
  };

  const getStageTitle = (): string => {
    if (!stage_details) return "Training in Progress";
    
    if (stage_details.prepare.status === "in_progress") {
      return stageTitles.data_preparation;
    } else if (stage_details.train.status === "in_progress") {
      return stageTitles.training;
    } else if (stage_details.validation.status === "in_progress") {
      return stageTitles.validation;
    } else if (status === "complete") {
      return stageTitles.complete;
    }
    
    return "Training in Progress";
  };

  const getProgressColor = (): string => {
    if (status === 'failed') return 'bg-red-500';
    if (status === 'complete') return 'bg-green-500';
    return 'bg-blue-500';
  };

  const getStatusBadge = () => {
    if (status === 'failed') {
      return <Badge variant="destructive">Failed</Badge>;
    }
    if (status === 'complete') {
      return <Badge variant="default" className="bg-green-500">Complete</Badge>;
    }
    return <Badge variant="secondary">Processing</Badge>;
  };

  const getCurrentOperation = (): string => {
    if (!stage_details) return "Initializing...";
    
    if (stage_details.prepare.status === "in_progress") {
      return "Converting COLMAP output to NeRF Studio format...";
    } else if (stage_details.train.status === "in_progress") {
      if (current_iteration && total_iterations) {
        return `Training iteration ${current_iteration.toLocaleString()} of ${total_iterations.toLocaleString()}`;
      }
      return "Training NeRF model...";
    } else if (stage_details.validation.status === "in_progress") {
      return "Validating trained model quality...";
    } else if (status === "complete") {
      return "Training complete! Model ready for rendering.";
    }
    
    return "Processing...";
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          NeRF Training
          {getStatusBadge()}
        </CardTitle>
        <CardDescription>{getStageTitle()}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Overall Progress */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Overall Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className={getProgressColor()} />
          </div>

          {/* Current Operation */}
          <p className="text-sm text-muted-foreground">{getCurrentOperation()}</p>

          {/* Stage Progress (if in training stage) */}
          {stage_details?.train.status === "in_progress" && stage_progress !== undefined && (
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Training Stage Progress</span>
                <span>{Math.round(stage_progress)}%</span>
              </div>
              <Progress value={stage_progress} className="bg-blue-400" />
            </div>
          )}

          {/* Training Metrics */}
          {(loss !== undefined || psnr !== undefined) && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              {loss !== undefined && (
                <div>
                  <span className="text-muted-foreground">Loss:</span>{' '}
                  <span className="font-mono">{loss.toFixed(4)}</span>
                </div>
              )}
              {psnr !== undefined && (
                <div>
                  <span className="text-muted-foreground">PSNR:</span>{' '}
                  <span className="font-mono">{psnr.toFixed(2)} dB</span>
                </div>
              )}
            </div>
          )}

          {/* Validation Metrics */}
          {ssim !== undefined && (
            <div className="text-sm">
              <span className="text-muted-foreground">SSIM:</span>{' '}
              <span className="font-mono">{ssim.toFixed(4)}</span>
            </div>
          )}

          {/* GPU Type */}
          {gpu_type && (
            <div className="text-sm">
              <span className="text-muted-foreground">GPU:</span>{' '}
              <Badge variant="outline">{gpu_type}</Badge>
            </div>
          )}

          {/* Time and Cost */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            {elapsed_time !== undefined && (
              <div>
                <span className="text-muted-foreground">Elapsed:</span>{' '}
                <span>{formatDuration(elapsed_time)}</span>
              </div>
            )}
            {estimated_time_remaining !== undefined && status === 'processing' && (
              <div>
                <span className="text-muted-foreground">Remaining:</span>{' '}
                <span>{formatDuration(estimated_time_remaining)}</span>
              </div>
            )}
          </div>

          {cost_so_far !== undefined && (
            <div className="text-sm">
              <span className="text-muted-foreground">Cost so far:</span>{' '}
              <span className="font-semibold">${cost_so_far.toFixed(2)}</span>
            </div>
          )}

          {/* Stage Details */}
          {stage_details && (
            <div className="space-y-2">
              <div className="text-sm font-semibold">Pipeline Stages:</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className={`p-2 rounded ${
                  stage_details.prepare.status === "complete" ? "bg-green-100 dark:bg-green-900" :
                  stage_details.prepare.status === "in_progress" ? "bg-blue-100 dark:bg-blue-900" :
                  stage_details.prepare.status === "failed" ? "bg-red-100 dark:bg-red-900" :
                  "bg-gray-100 dark:bg-gray-800"
                }`}>
                  <div className="font-semibold">Prepare</div>
                  <div className="text-muted-foreground capitalize">{stage_details.prepare.status}</div>
                  {stage_details.prepare.duration && (
                    <div className="text-muted-foreground">{formatDuration(stage_details.prepare.duration)}</div>
                  )}
                </div>
                <div className={`p-2 rounded ${
                  stage_details.train.status === "complete" ? "bg-green-100 dark:bg-green-900" :
                  stage_details.train.status === "in_progress" ? "bg-blue-100 dark:bg-blue-900" :
                  stage_details.train.status === "failed" ? "bg-red-100 dark:bg-red-900" :
                  "bg-gray-100 dark:bg-gray-800"
                }`}>
                  <div className="font-semibold">Train</div>
                  <div className="text-muted-foreground capitalize">{stage_details.train.status}</div>
                  {stage_details.train.duration && (
                    <div className="text-muted-foreground">{formatDuration(stage_details.train.duration)}</div>
                  )}
                </div>
                <div className={`p-2 rounded ${
                  stage_details.validation.status === "complete" ? "bg-green-100 dark:bg-green-900" :
                  stage_details.validation.status === "in_progress" ? "bg-blue-100 dark:bg-blue-900" :
                  stage_details.validation.status === "failed" ? "bg-red-100 dark:bg-red-900" :
                  "bg-gray-100 dark:bg-gray-800"
                }`}>
                  <div className="font-semibold">Validate</div>
                  <div className="text-muted-foreground capitalize">{stage_details.validation.status}</div>
                  {stage_details.validation.duration && (
                    <div className="text-muted-foreground">{formatDuration(stage_details.validation.duration)}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="text-red-500 text-sm p-3 bg-red-50 dark:bg-red-950 rounded">
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Quality Warning */}
          {status === "complete" && psnr !== undefined && psnr < 25 && (
            <div className="text-yellow-600 dark:text-yellow-400 text-sm p-3 bg-yellow-50 dark:bg-yellow-950 rounded">
              <strong>Quality Warning:</strong> Model quality is below recommended threshold (PSNR &lt; 25). Consider retraining with more images or higher quality settings.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TrainingProgress;

