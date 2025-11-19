"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Loading skeleton component shown while Clerk checks authentication status
 * Matches navbar height and structure to prevent UI flicker on initial load
 */
export function AuthLoadingSkeleton() {
  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50",
        "bg-background border-b border-border",
        "h-16 flex items-center justify-between px-6"
      )}
      aria-label="Loading authentication"
    >
      {/* Logo/Brand skeleton */}
      <Skeleton className="h-8 w-32" />

      {/* Auth button skeleton */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  );
}

