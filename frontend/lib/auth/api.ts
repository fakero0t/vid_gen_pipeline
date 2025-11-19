import { auth } from "@clerk/nextjs/server";

/**
 * Backend authentication helper functions
 * Future-ready for when backend endpoints require authentication
 */

/**
 * Get the Clerk session token for authenticated requests
 * Use this when making API calls to your backend
 */
export async function getSessionToken(): Promise<string | null> {
  try {
    const { getToken } = await auth();
    return await getToken();
  } catch (error) {
    console.error("Error getting session token:", error);
    return null;
  }
}

/**
 * Create an authenticated fetch function that includes the Clerk session token
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
 * Useful for server-side checks
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const { userId } = await auth();
    return !!userId;
  } catch (error) {
    console.error("Error checking authentication:", error);
    return false;
  }
}

/**
 * Get the current user ID
 * Returns null if not authenticated
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const { userId } = await auth();
    return userId;
  } catch (error) {
    console.error("Error getting user ID:", error);
    return null;
  }
}

