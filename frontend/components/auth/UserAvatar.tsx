"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { LogOut, Folder, Palette } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Custom avatar dropdown component for authenticated users
 * Shows user profile image/initials with dropdown menu for account actions
 */
export function UserAvatar() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  // Show nothing while loading
  if (!isLoaded || !user) {
    return null;
  }

  // Get user initials from name or email
  const getInitials = () => {
    if (user.firstName || user.lastName) {
      const first = user.firstName?.charAt(0).toUpperCase() || "";
      const last = user.lastName?.charAt(0).toUpperCase() || "";
      return `${first}${last}` || user.emailAddresses[0]?.emailAddress?.charAt(0).toUpperCase() || "U";
    }
    return user.emailAddresses[0]?.emailAddress?.charAt(0).toUpperCase() || "U";
  };

  const initials = getInitials();
  const displayName = user.firstName && user.lastName
    ? `${user.firstName} ${user.lastName}`
    : user.firstName || user.lastName || user.emailAddresses[0]?.emailAddress || "User";
  const email = user.emailAddresses[0]?.emailAddress || "";

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative h-10 w-10 rounded-full",
            "hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          )}
          aria-label="User menu"
        >
          <Avatar className="h-10 w-10">
            <AvatarImage src={user.imageUrl} alt={displayName} />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-xs leading-none text-muted-foreground">{email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => router.push("/projects")}
          className="cursor-pointer"
        >
          <Folder className="mr-2 h-4 w-4" />
          <span>Projects</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push("/brand-assets")}
          className="cursor-pointer"
        >
          <Palette className="mr-2 h-4 w-4" />
          <span>Brand Assets</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

