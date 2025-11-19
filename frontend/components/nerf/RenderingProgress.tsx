'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { RenderingState } from '@/types/nerf.types';
import { formatDuration } from '@/lib/utils';

interface RenderingProgressProps {
  renderingState: RenderingState | null;
}

const RenderingProgress: React.FC<RenderingProgressProps> = ({ renderingState }) => {
  if (!renderingState || renderingState.status === 'idle') {
    return null;
  }

  const {
    status,
    progress,
    frames_rendered,
    total_frames,
    current_batch,
    total_batches,
    rendering_speed,
    estimated_time_remaining,
    error,
  } = renderingState;

  const getStatusBadge = () => {
    if (status === 'failed') {
      return <Badge variant="destructive">Failed</Badge>;
    }
    if (status === 'complete') {
      return <Badge variant="default" className="bg-green-500">Complete</Badge>;
    }
    return <Badge variant="secondary">Rendering</Badge>;
  };

  const getProgressColor = (): string => {
    if (status === 'failed') return 'bg-red-500';
    if (status === 'complete') return 'bg-green-500';
    return 'bg-purple-500';
  };

  const formatSpeed = (speed: number): string => {
    if (speed < 1) {
      return `${(speed * 60).toFixed(1)} frames/min`;
    }
    return `${speed.toFixed(2)} frames/sec`;
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Frame Rendering
          {getStatusBadge()}
        </CardTitle>
        <CardDescription>
          {status === 'complete' 
            ? `All ${total_frames} frames rendered successfully`
            : `Rendering transparent PNG frames for compositing`
          }
        </CardDescription>
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

          {/* Frame Count */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Frames Rendered:</span>{' '}
              <span className="font-semibold">{frames_rendered.toLocaleString()} / {total_frames.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Current Batch:</span>{' '}
              <span className="font-semibold">{current_batch + 1} / {total_batches}</span>
            </div>
          </div>

          {/* Batch Progress Bar */}
          {status === 'processing' && (
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Batch {current_batch + 1} Progress</span>
                <span>{frames_rendered % 100} / 100 frames</span>
              </div>
              <Progress 
                value={(frames_rendered % 100)} 
                className="bg-purple-400"
              />
            </div>
          )}

          {/* Rendering Speed */}
          {rendering_speed && status === 'processing' && (
            <div className="text-sm">
              <span className="text-muted-foreground">Rendering Speed:</span>{' '}
              <span className="font-mono">{formatSpeed(rendering_speed)}</span>
            </div>
          )}

          {/* Time Estimate */}
          {estimated_time_remaining !== undefined && status === 'processing' && (
            <div className="text-sm">
              <span className="text-muted-foreground">Estimated Time Remaining:</span>{' '}
              <span>{formatDuration(estimated_time_remaining)}</span>
            </div>
          )}

          {/* Output Info */}
          {status === 'complete' && (
            <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg text-sm space-y-2">
              <div className="font-semibold text-green-700 dark:text-green-300">
                ✓ Rendering Complete
              </div>
              <div className="text-muted-foreground">
                {total_frames} transparent PNG frames ready for compositing with scenes and moods
              </div>
              <div className="text-muted-foreground">
                Resolution: 1920x1080 • Format: PNG with alpha channel
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="text-red-500 text-sm p-3 bg-red-50 dark:bg-red-950 rounded">
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Rendering Details */}
          {status === 'processing' && (
            <div className="text-xs text-muted-foreground space-y-1">
              <div>• Circular camera trajectory (360° orbit)</div>
              <div>• Transparent background for compositing</div>
              <div>• High-quality anti-aliasing enabled</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default RenderingProgress;

