"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/auth/UserAvatar";
import { AuthLoadingSkeleton } from "@/components/auth/AuthLoadingSkeleton";
import { cn } from "@/lib/utils";

/**
 * Main navbar component with authentication state
 * Shows loading skeleton while auth is loading, then conditionally renders
 * sign-in button or user avatar based on authentication status
 */
export function Navbar() {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();

  // Show loading skeleton while Clerk is checking auth status
  if (!isLoaded) {
    return <AuthLoadingSkeleton />;
  }

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50",
        "bg-background border-b border-border",
        "h-16 flex items-center justify-between px-6"
      )}
      aria-label="Main navigation"
    >
      {/* Logo/Brand - placeholder for now */}
      <div className="flex items-center">
        <h1 className="text-lg font-semibold">AI Video Pipeline</h1>
      </div>

      {/* Auth section */}
      <div className="flex items-center gap-4">
        {isSignedIn ? (
          <UserAvatar />
        ) : (
          <Button
            onClick={() => router.push("/sign-in")}
            variant="default"
            size="default"
          >
            Sign In
          </Button>
        )}
      </div>
    </nav>
  );
}

