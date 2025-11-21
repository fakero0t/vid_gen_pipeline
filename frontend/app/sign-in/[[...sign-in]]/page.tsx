"use client";

import { useState, useEffect } from "react";
import { useSignIn, useAuth } from "@clerk/nextjs";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signInSchema, type SignInFormData } from "@/lib/auth/validation";
import { AuthInput } from "@/components/auth/AuthInput";
import { AuthButton } from "@/components/auth/AuthButton";
import { ErrorDisplay } from "@/components/auth/ErrorDisplay";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { layoutClasses } from "@/lib/layout";
import { cn } from "@/lib/utils";

/**
 * Custom sign-in page with email and password authentication
 * Uses Clerk's built-in redirect handling via setActive() redirectUrl parameter
 * to eliminate race conditions and simplify the auth flow
 */
export default function SignInPage() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const { userId } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [clerkError, setClerkError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Get callback URL from query params or default to /projects
  const callbackUrl = searchParams.get("callbackUrl") || "/projects";

  // All hooks must be called before any conditional returns
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
  });

  // Redirect authenticated users immediately - check both isLoaded and userId
  useEffect(() => {
    if (isLoaded && userId) {
      // Small delay to ensure session is fully established
      const timer = setTimeout(() => {
        router.replace(callbackUrl);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoaded, userId, callbackUrl, router]);

  // Don't render form if already authenticated
  if (isLoaded && userId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Redirecting...</div>
      </div>
    );
  }

  const onSubmit = async (data: SignInFormData) => {
    if (!isLoaded) return;

    // Double-check: if user is already authenticated, redirect immediately
    if (userId) {
      router.replace(callbackUrl);
      return;
    }

    setIsLoading(true);
    setClerkError(null);

    try {
      const result = await signIn.create({
        identifier: data.email,
        password: data.password,
      });

      if (result.status === "complete") {
        // Check if session already exists before trying to set active
        // This prevents "Session already exists" errors
        try {
          await setActive({ 
            session: result.createdSessionId,
            redirectUrl: callbackUrl 
          });
        } catch (setActiveError: any) {
          // If setActive fails because session already exists, just redirect
          if (setActiveError.errors?.[0]?.message?.toLowerCase().includes("session") && 
              setActiveError.errors?.[0]?.message?.toLowerCase().includes("already")) {
            // Session already active, just redirect
            router.replace(callbackUrl);
            return;
          }
          throw setActiveError;
        }
        // No need for manual router.push() - Clerk handles redirect via redirectUrl
      } else {
        // Handle additional verification steps if needed
        setClerkError("Sign-in incomplete. Please try again.");
        setIsLoading(false);
      }
    } catch (err: any) {
      // Handle errors - check if it's a "session already exists" error
      const errorMessage = err.errors?.[0]?.message || err.message || "An error occurred during sign-in";
      
      // If session already exists, redirect instead of showing error
      if (errorMessage.toLowerCase().includes("session") && 
          errorMessage.toLowerCase().includes("already")) {
        router.replace(callbackUrl);
        return;
      }
      
      setClerkError(errorMessage);
      setIsLoading(false);
    }
    // Note: Don't set isLoading to false if setActive succeeds - Clerk will redirect
  };

  return (
    <div
      className={cn(
        layoutClasses.fullScreen,
        "flex items-center justify-center p-6 pt-24"
      )}
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Sign In</CardTitle>
          <CardDescription>
            Enter your email and password to access your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <ErrorDisplay error={clerkError} className="mb-4" />

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <AuthInput
                id="email"
                type="email"
                placeholder="you@example.com"
                {...register("email")}
                error={errors.email?.message}
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <AuthInput
                id="password"
                type="password"
                placeholder="Enter your password"
                {...register("password")}
                error={errors.password?.message}
                showPasswordToggle
                autoComplete="current-password"
              />
            </div>

            <AuthButton
              type="submit"
              className="w-full"
              isLoading={isLoading}
              disabled={!isLoaded || !!userId}
            >
              Sign In
            </AuthButton>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Don't have an account? </span>
            <Link
              href={`/sign-up${callbackUrl !== "/projects" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
              className="text-primary hover:underline font-medium"
            >
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

