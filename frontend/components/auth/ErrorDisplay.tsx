"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ErrorDisplayProps {
  error: string | null | undefined;
  className?: string;
}

/**
 * Component to display Clerk errors consistently
 * Provides friendly error messages for common Clerk errors
 */
export function ErrorDisplay({ error, className }: ErrorDisplayProps) {
  if (!error) {
    return null;
  }

  // Map common Clerk errors to user-friendly messages
  const getFriendlyMessage = (errorMessage: string): string => {
    const lowerError = errorMessage.toLowerCase();

    if (lowerError.includes("invalid") && lowerError.includes("password")) {
      return "Invalid email or password. Please check your credentials and try again.";
    }

    if (lowerError.includes("user") && lowerError.includes("exist")) {
      return "An account with this email already exists. Please sign in instead.";
    }

    if (lowerError.includes("password") && lowerError.includes("weak")) {
      return "Password is too weak. Please use a stronger password (at least 6 characters).";
    }

    if (lowerError.includes("data breach") || lowerError.includes("compromised")) {
      return "This password has been found in a data breach. Please use a different password for security.";
    }

    if (lowerError.includes("rate limit") || lowerError.includes("too many")) {
      return "Too many attempts. Please wait a moment and try again.";
    }

    if (lowerError.includes("network") || lowerError.includes("fetch")) {
      return "Network error. Please check your connection and try again.";
    }

    if (lowerError.includes("session") && lowerError.includes("expired")) {
      return "Your session has expired. Please sign in again.";
    }

    // Return original error if no mapping found
    return errorMessage;
  };

  const friendlyMessage = getFriendlyMessage(error);

  return (
    <Alert variant="destructive" className={cn(className)}>
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>{friendlyMessage}</AlertDescription>
    </Alert>
  );
}

