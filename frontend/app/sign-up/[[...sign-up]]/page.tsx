"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signUpSchema, type SignUpFormData } from "@/lib/auth/validation";
import { signUp } from "@/lib/firebase/auth";
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
import { updateProfile } from "firebase/auth";

/**
 * Custom sign-up page with name, email, and password registration using Firebase
 * Handles callback URL preservation after auth
 * Basic auth flow - no email verification required
 */
export default function SignUpPage() {
  const { isLoaded, userId, user } = useFirebaseAuth();
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
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
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
      case "auth/email-already-in-use":
        return "An account with this email already exists";
      case "auth/weak-password":
        return "Password is too weak. Please use a stronger password";
      case "auth/invalid-email":
        return "Invalid email address";
      case "auth/operation-not-allowed":
        return "Email/password accounts are not enabled";
      default:
        return error.message || "An error occurred during sign-up";
    }
  };

  const onSubmit = async (data: SignUpFormData) => {
    if (!isLoaded) return;

    setIsLoading(true);
    setAuthError(null);

    try {
      const result = await signUp(data.email, data.password);
      
      // Set user display name (combines firstName and lastName)
      if (result.user) {
        await updateProfile(result.user, {
          displayName: `${data.firstName} ${data.lastName}`,
        });
      }

      // Auth state will be updated by onIdTokenChanged listener in AuthContext
      // Router will redirect via useEffect above
    } catch (err: any) {
      const errorMessage = err instanceof Error && "code" in err
        ? getFirebaseErrorMessage(err as FirebaseError)
        : "An error occurred during sign-up";
      
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
          <CardTitle className="text-2xl">Sign Up</CardTitle>
          <CardDescription>
            Create an account to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <ErrorDisplay error={authError} className="mb-4" />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <AuthInput
                  id="firstName"
                  type="text"
                  placeholder="John"
                  {...register("firstName")}
                  error={errors.firstName?.message}
                  autoComplete="given-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <AuthInput
                  id="lastName"
                  type="text"
                  placeholder="Doe"
                  {...register("lastName")}
                  error={errors.lastName?.message}
                  autoComplete="family-name"
                />
              </div>
            </div>

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
                placeholder="At least 6 characters"
                {...register("password")}
                error={errors.password?.message}
                showPasswordToggle
                autoComplete="new-password"
              />
            </div>

            <AuthButton
              type="submit"
              className="w-full"
              isLoading={isLoading}
              disabled={!isLoaded}
            >
              Sign Up
            </AuthButton>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <Link
              href={`/sign-in${callbackUrl !== "/projects" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
              className="text-primary hover:underline font-medium"
            >
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
