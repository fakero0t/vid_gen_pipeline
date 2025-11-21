'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';

/**
 * Root page - redirects based on authentication status
 * - If authenticated: redirect to /projects
 * - If not authenticated: redirect to /sign-in
 * 
 * Note: Middleware handles the actual protection, this is just for the root path
 */
export default function Home() {
  const router = useRouter();
  const { isLoaded, userId } = useAuth();

  useEffect(() => {
    if (!isLoaded) return; // Wait for auth to load

    // Redirect immediately based on auth status
    if (userId) {
      router.replace('/projects');
    } else {
      router.replace('/sign-in');
    }
  }, [isLoaded, userId, router]);

  // Show loading state while checking auth
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-display-md text-foreground animate-pulse">Loading...</div>
    </div>
  );
}
