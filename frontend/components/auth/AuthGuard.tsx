"use client";

import { useFirebaseAuth } from "@/lib/firebase/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * AuthGuard component - ensures user is authenticated before rendering children
 * Redirects to sign-in if not authenticated
 * Shows loading state while checking auth
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoaded, userId } = useFirebaseAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && !userId) {
      // User is not authenticated, redirect to sign-in with callback URL
      const currentPath = window.location.pathname;
      const signInUrl = `/sign-in${currentPath !== '/' ? `?callbackUrl=${encodeURIComponent(currentPath)}` : ''}`;
      router.replace(signInUrl);
    }
  }, [isLoaded, userId, router]);

  // Show loading while auth is being checked
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Don't render children if not authenticated (redirect is in progress)
  if (!userId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Redirecting to sign in...</div>
      </div>
    );
  }

  // User is authenticated, render children
  return <>{children}</>;
}
