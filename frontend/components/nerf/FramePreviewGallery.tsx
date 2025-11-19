'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Image from 'next/image';

interface FramePreviewGalleryProps {
  jobId: string;
  framesRendered: number;
  totalFrames: number;
  previewInterval?: number; // Show every Nth frame
}

const FramePreviewGallery: React.FC<FramePreviewGalleryProps> = ({
  jobId,
  framesRendered,
  totalFrames,
  previewInterval = 10,
}) => {
  const [selectedFrame, setSelectedFrame] = useState<number | null>(null);
  const [loadedFrames, setLoadedFrames] = useState<Set<number>>(new Set());

  // Calculate which frames to show as previews
  const previewFrames = React.useMemo(() => {
    const frames: number[] = [];
    for (let i = previewInterval; i <= framesRendered; i += previewInterval) {
      frames.push(i);
    }
    return frames;
  }, [framesRendered, previewInterval]);

  const getFrameUrl = (frameNumber: number): string => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    return `${apiUrl}/api/nerf/frames/${jobId}/${frameNumber}`;
  };

  const handleFrameLoad = (frameNumber: number) => {
    setLoadedFrames(prev => new Set(prev).add(frameNumber));
  };

  const handleFrameClick = (frameNumber: number) => {
    setSelectedFrame(frameNumber === selectedFrame ? null : frameNumber);
  };

  if (previewFrames.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Preview Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Frame Previews ({previewFrames.length} of {totalFrames})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {previewFrames.map((frameNumber) => (
              <div
                key={frameNumber}
                className={`
                  relative aspect-video rounded-lg overflow-hidden cursor-pointer
                  transition-all duration-200 hover:scale-105 hover:shadow-lg
                  ${selectedFrame === frameNumber ? 'ring-2 ring-blue-500' : ''}
                `}
                onClick={() => handleFrameClick(frameNumber)}
              >
                <div className="relative w-full h-full bg-gray-100 dark:bg-gray-800">
                  <Image
                    src={getFrameUrl(frameNumber)}
                    alt={`Frame ${frameNumber}`}
                    fill
                    className="object-cover"
                    onLoad={() => handleFrameLoad(frameNumber)}
                    unoptimized // Since these are dynamically generated
                  />
                  {!loadedFrames.has(frameNumber) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-700">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    </div>
                  )}
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs py-1 px-2 text-center">
                  Frame {frameNumber}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Full-Size Preview Modal */}
      {selectedFrame !== null && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedFrame(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] w-full">
            <button
              className="absolute top-4 right-4 bg-white dark:bg-gray-800 text-gray-800 dark:text-white rounded-full p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition z-10"
              onClick={() => setSelectedFrame(null)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <div className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden">
              <Image
                src={getFrameUrl(selectedFrame)}
                alt={`Frame ${selectedFrame} - Full Size`}
                fill
                className="object-contain"
                unoptimized
              />
            </div>
            <div className="mt-4 text-center text-white">
              <p className="text-lg font-semibold">Frame {selectedFrame} of {totalFrames}</p>
              <p className="text-sm text-gray-300">Click outside to close</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FramePreviewGallery;

