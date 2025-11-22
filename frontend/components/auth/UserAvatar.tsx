"use client";

import { useFirebaseAuth } from "@/lib/firebase/AuthContext";
import { signOut } from "@/lib/firebase/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
 * User Avatar component with dropdown menu
 * Shows user's initials and provides navigation and sign-out functionality
 */
export function UserAvatar() {
  const { user } = useFirebaseAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/sign-in");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Get user initials from display name or email
  const getInitials = () => {
    if (user?.displayName) {
      const names = user.displayName.split(" ");
      return names
        .map((name) => name[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  // Get display name or email
  const getDisplayName = () => {
    return user?.displayName || user?.email || "User";
  };

  const initials = getInitials();
  const displayName = getDisplayName();
  const email = user?.email || "";

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
