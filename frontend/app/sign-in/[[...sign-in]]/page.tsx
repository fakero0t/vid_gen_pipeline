"use client";

import { useState } from "react";
import { useSignIn } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
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
 * Handles callback URL parameter to redirect users back to their intended destination
 */
export default function SignInPage() {
  const { isLoaded, signIn, setActive } = useSignIn();
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
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
  });

  const onSubmit = async (data: SignInFormData) => {
    if (!isLoaded) return;

    setIsLoading(true);
    setClerkError(null);

    try {
      const result = await signIn.create({
        identifier: data.email,
        password: data.password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.push(callbackUrl);
      } else {
        // Handle additional verification steps if needed
        setClerkError("Sign-in incomplete. Please try again.");
      }
    } catch (err: any) {
      setClerkError(err.errors?.[0]?.message || "An error occurred during sign-in");
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
              disabled={!isLoaded}
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

