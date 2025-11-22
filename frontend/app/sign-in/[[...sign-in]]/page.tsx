"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signInSchema, type SignInFormData } from "@/lib/auth/validation";
import { signIn } from "@/lib/firebase/auth";
import { useFirebaseAuth } from "@/lib/firebase/AuthContext";
import { AuthInput } from "@/components/auth/AuthInput";
import { AuthButton } from "@/components/auth/AuthButton";
import { ErrorDisplay } from "@/components/auth/ErrorDisplay";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { layoutClasses } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { FirebaseError } from "firebase/app";

/**
 * Custom sign-in page with email and password authentication using Firebase
 * Handles callback URL preservation after auth
 */
export default function SignInPage() {
  const { isLoaded, userId } = useFirebaseAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [authError, setAuthError] = useState<string | null>(null);
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

  // Redirect authenticated users immediately
  useEffect(() => {
    if (isLoaded && userId) {
      router.replace(callbackUrl);
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

  const getFirebaseErrorMessage = (error: FirebaseError): string => {
    switch (error.code) {
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "Invalid email or password";
      case "auth/too-many-requests":
        return "Too many failed attempts. Please try again later";
      case "auth/user-disabled":
        return "This account has been disabled";
      case "auth/invalid-email":
        return "Invalid email address";
      default:
        return error.message || "An error occurred during sign-in";
    }
  };

  const onSubmit = async (data: SignInFormData) => {
    if (!isLoaded) return;

    // Double-check: if user is already authenticated, redirect immediately
    if (userId) {
      router.replace(callbackUrl);
      return;
    }

    setIsLoading(true);
    setAuthError(null);

    try {
      await signIn(data.email, data.password);
      // Auth state will be updated by onIdTokenChanged listener in AuthContext
      // Router will redirect via useEffect above
    } catch (err: any) {
      const errorMessage = err instanceof Error && "code" in err
        ? getFirebaseErrorMessage(err as FirebaseError)
        : "An error occurred during sign-in";
      
      setAuthError(errorMessage);
      setIsLoading(false);
    }
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
            <ErrorDisplay error={authError} className="mb-4" />

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
