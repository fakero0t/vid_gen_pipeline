import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Clerk middleware configuration
 * Protects routes and handles callback URL preservation
 */
const isProtectedRoute = createRouteMatcher([
  "/",
  "/projects(.*)",
  "/project(.*)",
  "/brand-assets(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId, redirectToSignIn } = await auth();

  // Check if the route is protected
  if (isProtectedRoute(req)) {
    // If user is not authenticated, redirect to sign-in
    if (!userId) {
      // For root path, redirect to sign-in without callback (will go to projects after sign-in)
      if (req.nextUrl.pathname === '/') {
        return NextResponse.redirect(new URL("/sign-in", req.url));
      }
      // For other protected routes, redirect with callback URL
      const signInUrl = new URL("/sign-in", req.url);
      signInUrl.searchParams.set("callbackUrl", req.url);
      return NextResponse.redirect(signInUrl);
    }
  }

  // Allow the request to proceed
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};

