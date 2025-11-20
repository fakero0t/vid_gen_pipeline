'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';

/**
 * Root page - redirects based on authentication status
 * - If authenticated: redirect to /projects
 * - If not authenticated: redirect to /sign-in
 */
export default function Home() {
  const router = useRouter();
  const { isLoaded, userId } = useAuth();

  useEffect(() => {
    if (!isLoaded) return; // Wait for auth to load

    if (userId) {
      // User is authenticated, go to projects
      router.replace('/projects');
    } else {
      // User is not authenticated, go to sign-in
      router.replace('/sign-in');
    }
  }, [isLoaded, userId, router]);

  // Show loading state while checking auth
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-muted-foreground">Loading...</div>
    </div>
  );
}
