"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AuthButtonProps extends React.ComponentProps<typeof Button> {
  isLoading?: boolean;
}

/**
 * Reusable auth button component with loading states
 * Shows spinner and disables button during async operations
 */
export const AuthButton = React.forwardRef<HTMLButtonElement, AuthButtonProps>(
  ({ className, isLoading, disabled, children, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        className={cn(className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </Button>
    );
  }
);
AuthButton.displayName = "AuthButton";

