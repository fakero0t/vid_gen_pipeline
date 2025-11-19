"use client";

import { useState } from "react";
import { useSignUp } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signUpSchema, type SignUpFormData } from "@/lib/auth/validation";
import { AuthInput } from "@/components/auth/AuthInput";
import { AuthButton } from "@/components/auth/AuthButton";
import { ErrorDisplay } from "@/components/auth/ErrorDisplay";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { layoutClasses } from "@/lib/layout";
import { cn } from "@/lib/utils";

/**
 * Custom sign-up page with name, email, and password registration
 * Handles callback URL parameter to redirect users back to their intended destination
 * Basic auth flow - no email verification required
 */
export default function SignUpPage() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [clerkError, setClerkError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Get callback URL from query params or default to /projects
  const callbackUrl = searchParams.get("callbackUrl") || "/projects";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
  });

  const onSubmit = async (data: SignUpFormData) => {
    if (!isLoaded) return;

    setIsLoading(true);
    setClerkError(null);

    try {
      const result = await signUp.create({
        firstName: data.firstName,
        lastName: data.lastName,
        emailAddress: data.email,
        password: data.password,
      });

      // Since we're using basic auth (no email verification),
      // we can immediately set the session as active
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.push(callbackUrl);
      } else {
        // Handle additional verification steps if needed
        setClerkError("Sign-up incomplete. Please try again.");
      }
    } catch (err: any) {
      setClerkError(err.errors?.[0]?.message || "An error occurred during sign-up");
    } finally {
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
            <ErrorDisplay error={clerkError} className="mb-4" />

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

