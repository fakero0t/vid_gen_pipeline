import { getIdToken as getFirebaseIdToken } from "@/lib/firebase/auth";
import { getCurrentUser } from "@/lib/firebase/auth";

/**
 * Backend authentication helper functions using Firebase Auth
 */

/**
 * Get the Firebase ID token for authenticated requests
 * Use this when making API calls to your backend
 */
export async function getSessionToken(): Promise<string | null> {
  try {
    return await getFirebaseIdToken();
  } catch (error) {
    console.error("Error getting session token:", error);
    return null;
  }
}

/**
 * Create an authenticated fetch function that includes the Firebase ID token
 * in the Authorization header
 *
 * @example
 * ```typescript
 * const response = await authenticatedFetch('/api/endpoint', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *   },
 *   body: JSON.stringify(data)
 * });
 * ```
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getSessionToken();

  const headers = new Headers(options.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Check if the current user is authenticated
 * Useful for client-side checks
 */
export function isAuthenticated(): boolean {
  try {
    const user = getCurrentUser();
    return !!user;
  } catch (error) {
    console.error("Error checking authentication:", error);
    return false;
  }
}

/**
 * Get the current user ID
 * Returns null if not authenticated
 */
export function getCurrentUserId(): string | null {
  try {
    const user = getCurrentUser();
    return user?.uid || null;
  } catch (error) {
    console.error("Error getting user ID:", error);
    return null;
  }
}
