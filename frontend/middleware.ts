import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Clerk middleware configuration
 * Protects routes and handles callback URL preservation
 * 
 * Note: Sign-in and sign-up routes are automatically excluded from protection
 */
const isProtectedRoute = createRouteMatcher([
  "/",
  "/projects(.*)",
  "/project(.*)",
  "/brand-assets(.*)",
  "/character-assets(.*)",
]);

// Routes that should never be protected (auth pages)
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId, redirectToSignIn } = await auth();

  // Skip protection for public routes (sign-in, sign-up)
  if (isPublicRoute(req)) {
    // But if user is already authenticated, redirect them away from auth pages
    // This prevents authenticated users from seeing sign-in/sign-up forms
    if (userId) {
      const callbackUrl = req.nextUrl.searchParams.get("callbackUrl") || "/projects";
      return NextResponse.redirect(new URL(callbackUrl, req.url));
    }
    return NextResponse.next();
  }

  // Check if the route is protected
  if (isProtectedRoute(req)) {
    // If user is not authenticated, redirect to sign-in
    if (!userId) {
      // Use redirectToSignIn which handles callback URLs automatically
      return redirectToSignIn({ returnBackUrl: req.url });
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

