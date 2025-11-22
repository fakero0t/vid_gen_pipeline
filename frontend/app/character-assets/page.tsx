'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { layoutClasses } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { CharacterAssetUpload } from '@/components/character/CharacterAssetUpload';
import { CharacterAssetList } from '@/components/character/CharacterAssetList';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

/**
 * Protected character assets page - character asset management interface
 * This route is protected by AuthGuard
 */
function CharacterAssetsPageContent() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const searchParams = useSearchParams();
  const router = useRouter();
  const fromCreateProject = searchParams.get('from') === 'create-project';

  const handleUploadComplete = (assetId: string) => {
    // Trigger refresh of the asset list
    setRefreshTrigger(prev => prev + 1);
    
    // If redirected from project creation, redirect back after upload
    if (fromCreateProject) {
      // Small delay to ensure the asset is visible in the list
      setTimeout(() => {
        router.push('/projects');
      }, 500);
    }
  };

  const handleAssetDeleted = (assetId: string) => {
    // Asset list will automatically refresh via refreshTrigger
    // This callback is here for potential future use (e.g., analytics)
  };

  return (
    <div
      className={cn(
        layoutClasses.fullScreen,
        "flex flex-col pt-16"
      )}
    >
      <main className="flex-1 flex flex-col overflow-hidden p-6">
        <div className="max-w-6xl mx-auto flex-1 flex flex-col min-h-0 w-full">
          {fromCreateProject && (
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4 flex-shrink-0">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1 text-sm">
                    Character Assets Required
                  </h3>
                  <p className="text-xs text-blue-800 dark:text-blue-200">
                    You need at least one character asset to create a project. Upload your character assets below, then return to create your project.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/projects')}
                  className="ml-4 flex-shrink-0"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Projects
                </Button>
              </div>
            </div>
          )}
          <div className="mb-3 flex-shrink-0 flex items-center justify-between">
            <h1 className="text-2xl font-bold">Character Assets</h1>
            <div className="w-80">
              <CharacterAssetUpload onUploadComplete={handleUploadComplete} />
            </div>
          </div>

          {/* Asset List Section - Takes remaining space */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <CharacterAssetList 
              onAssetDeleted={handleAssetDeleted}
              refreshTrigger={refreshTrigger}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default function CharacterAssetsPage() {
  return (
    <AuthGuard>
      <Suspense fallback={
        <div className={cn(layoutClasses.fullScreen, "flex flex-col pt-16")}>
          <main className="flex-1 flex flex-col overflow-hidden p-6">
            <div className="max-w-6xl mx-auto flex-1 flex flex-col min-h-0 w-full">
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading...</p>
              </div>
            </div>
          </main>
        </div>
      }>
        <CharacterAssetsPageContent />
      </Suspense>
    </AuthGuard>
  );
}

