"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, onIdTokenChanged } from "firebase/auth";
import { auth } from "./config";

/**
 * Auth context type definition
 */
interface AuthContextType {
  user: User | null;
  loading: boolean;
  userId: string | null;
}

/**
 * Create the auth context
 */
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  userId: null,
});

/**
 * Auth Provider component
 * Listens to Firebase auth state changes and provides auth data to children
 * Uses onIdTokenChanged instead of onAuthStateChanged to handle token refresh automatically
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to ID token changes (includes token refresh)
    // This ensures tokens are always fresh and prevents 1-hour expiry issues
    const unsubscribe = onIdTokenChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    userId: user?.uid || null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Custom hook to use the auth context
 * Provides the same API as Clerk's useAuth() for easier migration
 */
export function useFirebaseAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error("useFirebaseAuth must be used within an AuthProvider");
  }

  return {
    user: context.user,
    userId: context.userId,
    isLoaded: !context.loading,
    isSignedIn: !!context.user,
    loading: context.loading,
  };
}

