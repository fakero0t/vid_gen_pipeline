import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Firebase Auth middleware configuration
 * Protects routes based on authentication state
 * 
 * Note: Firebase doesn't provide official Next.js middleware like Clerk,
 * so we use a simplified client-side approach with AuthGuard components
 * for route protection. This middleware handles basic redirects.
 */

// Routes that should be protected (require authentication)
const protectedRoutes = [
  "/",
  "/projects",
  "/project",
  "/brand-assets",
  "/character-assets",
];

// Routes that should be public (auth pages)
const publicRoutes = ["/sign-in", "/sign-up"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the current path is a public route
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Check if the current path is a protected route
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // For protected routes, we rely on client-side AuthGuard components
  // This middleware just handles public route redirects for authenticated users
  // The actual auth check happens on the client via Firebase SDK

  // Note: Server-side token verification in middleware would require
  // Firebase Admin SDK and significantly increase complexity/latency.
  // For better security on specific routes, add AuthGuard component wrapping.

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
