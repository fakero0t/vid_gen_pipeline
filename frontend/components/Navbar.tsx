"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/auth/UserAvatar";
import { AuthLoadingSkeleton } from "@/components/auth/AuthLoadingSkeleton";
import { useProjectStore } from "@/store/projectStore";
import { cn } from "@/lib/utils";

/**
 * Main navbar component with authentication state
 * Shows loading skeleton while auth is loading, then conditionally renders
 * sign-in button or user avatar based on authentication status
 * Displays current project name in the center when on a project page
 */
export function Navbar() {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const { getCurrentProject } = useProjectStore();

  // Check if we're on a project page
  const isProjectPage = pathname?.startsWith("/project/");
  const currentProject = isProjectPage ? getCurrentProject() : null;

  // Show loading skeleton while Clerk is checking auth status
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
        <h1 className="font-display text-lg font-bold tracking-tight">
          AI Video Pipeline
        </h1>
      </div>

      {/* Project Name - center */}
      {currentProject && (
        <div className="flex items-center justify-center flex-1">
          <h2 
            className="font-display text-sm sm:text-base font-bold lowercase truncate max-w-[200px] sm:max-w-[300px]"
            style={{
              background: 'linear-gradient(90deg, rgb(255, 81, 1) 0%, rgb(255, 200, 50) 50%, rgb(196, 230, 43) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
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

