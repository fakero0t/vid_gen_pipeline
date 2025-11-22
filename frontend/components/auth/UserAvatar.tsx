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
import { LogOut, Folder, Palette, User } from "lucide-react";
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
            "relative h-9 w-9 rounded-full",
            "hover:bg-secondary transition-all duration-300",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          )}
          aria-label="User menu"
        >
          <Avatar className="h-9 w-9 border-2 border-[rgb(255,81,1)]/30">
            <AvatarImage src={user.imageUrl} alt={displayName} />
            <AvatarFallback className="bg-[rgb(255,81,1)] text-[rgb(196,230,43)] text-xs font-display font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className={cn(
          "w-56 rounded-xl border-2 shadow-lg",
          "bg-card backdrop-blur-sm",
          "animate-scaleIn"
        )}
        sideOffset={8}
      >
        <DropdownMenuLabel className="px-3 py-2.5">
          <div className="flex flex-col space-y-0.5">
            <p className="text-sm font-display font-bold leading-none">{displayName}</p>
            <p className="text-xs leading-none text-muted-foreground font-sans">{email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-1" />
        <DropdownMenuItem
          onClick={() => router.push("/projects")}
          className={cn(
            "cursor-pointer rounded-lg mx-1 my-0.5",
            "transition-all duration-200",
            "hover:bg-secondary"
          )}
        >
          <Folder className="mr-2 h-4 w-4" />
          <span className="font-sans">Projects</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push("/brand-assets")}
          className={cn(
            "cursor-pointer rounded-lg mx-1 my-0.5",
            "transition-all duration-200",
            "hover:bg-secondary"
          )}
        >
          <Palette className="mr-2 h-4 w-4" />
          <span className="font-sans">Brand Assets</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push("/character-assets")}
          className={cn(
            "cursor-pointer rounded-lg mx-1 my-0.5",
            "transition-all duration-200",
            "hover:bg-secondary"
          )}
        >
          <User className="mr-2 h-4 w-4" />
          <span className="font-sans">Characters</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-1" />
        <DropdownMenuItem
          onClick={handleSignOut}
          variant="destructive"
          className={cn(
            "cursor-pointer rounded-lg mx-1 my-0.5",
            "transition-all duration-200",
            "hover:bg-destructive/10 dark:hover:bg-destructive/20"
          )}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span className="font-sans text-destructive">Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

