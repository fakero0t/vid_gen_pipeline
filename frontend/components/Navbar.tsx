"use client";

import { useFirebaseAuth } from "@/lib/firebase/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/auth/UserAvatar";
import { AuthLoadingSkeleton } from "@/components/auth/AuthLoadingSkeleton";
import { useProjectStore } from "@/store/projectStore";
import { useAppStore } from "@/store/appStore";
import { STEPS } from "@/lib/steps";
import { cn } from "@/lib/utils";

/**
 * Main navbar component with authentication state
 * Shows loading skeleton while auth is loading, then conditionally renders
 * sign-in button or user avatar based on authentication status
 * Displays current project name in the center when on a project page
 * Shows back button on chat, mood, scenes, and backgrounds pages
 */
export function Navbar() {
  const { isLoaded, isSignedIn } = useFirebaseAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { getCurrentProject } = useProjectStore();
  const { setCurrentStep } = useAppStore();

  // Check if we're on a project page
  const isProjectPage = pathname?.startsWith("/project/");
  const currentProject = isProjectPage ? getCurrentProject() : null;
  const projectId = isProjectPage ? pathname.split("/")[2] : null;

  // Check if we're on chat, mood, scenes, or backgrounds page to show back button
  const isChatPage = pathname?.includes("/chat");
  const isMoodPage = pathname?.includes("/mood");
  const isScenesPage = pathname?.includes("/scenes");
  const isBackgroundsPage = pathname?.includes("/backgrounds");

  const handleBack = () => {
    if (isChatPage) {
      router.push("/projects");
    } else if (isMoodPage && projectId) {
      setCurrentStep(STEPS.CHAT);
      router.push(`/project/${projectId}/chat`);
    } else if (isScenesPage && projectId) {
      setCurrentStep(STEPS.BACKGROUNDS);
      router.push(`/project/${projectId}/backgrounds`);
    } else if (isBackgroundsPage && projectId) {
      setCurrentStep(STEPS.MOOD);
      router.push(`/project/${projectId}/mood`);
    }
  };

  const getBackButtonText = () => {
    if (isChatPage) return "Back to Projects";
    if (isMoodPage) return "Back to Chat";
    if (isScenesPage) return "Back to Background Selection";
    if (isBackgroundsPage) return "Back to Mood Selection";
    return "";
  };

  // Show loading skeleton while Firebase is checking auth status
  if (!isLoaded) {
    return <AuthLoadingSkeleton />;
  }

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50",
        "bg-background/80 backdrop-blur-md border-b border-border",
        "h-14 flex items-center px-4 sm:px-6"
      )}
      aria-label="Main navigation"
    >
      {/* Logo/Brand - left side */}
      <div className="flex items-center flex-1">
        <button
          onClick={() => router.push("/projects")}
          className="font-display text-lg font-bold tracking-tight cursor-pointer hover:opacity-80 transition-opacity"
          style={{
            background: 'linear-gradient(90deg, rgb(255, 81, 1) 0%, rgb(255, 200, 50) 50%, rgb(196, 230, 43) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          AI Video Pipeline
        </button>
        {/* Back button - shown on chat, mood, scenes, and backgrounds pages */}
        {(isChatPage || isMoodPage || isScenesPage || isBackgroundsPage) && (
          <button
            onClick={handleBack}
            className="ml-6 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-all duration-200 hover:gap-2 flex-shrink-0"
          >
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            {getBackButtonText()}
          </button>
        )}
      </div>

      {/* Project Name - center */}
      {currentProject && (
        <div className="flex items-center justify-center flex-1">
          <h2 className="font-display text-sm sm:text-base font-bold lowercase truncate max-w-[200px] sm:max-w-[300px] text-foreground">
            {currentProject.name.toLowerCase()}
          </h2>
        </div>
      )}

      {/* Auth section - right side */}
      <div className="flex items-center gap-3 flex-1 justify-end">
        {isSignedIn ? (
          <UserAvatar />
        ) : (
          <Button
            onClick={() => router.push("/sign-in")}
            variant="default"
            size="sm"
          >
            Sign In
          </Button>
        )}
      </div>
    </nav>
  );
}
