"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { authAPI, type User } from "@/lib/api";

// ── Types ───────────────────────────────────────────────────────────────────

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
}

// ── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // On mount: validate existing session
  useEffect(() => {
    const init = async () => {
      try {
        const { user: u } = await authAPI.session();
        setUser(u);
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  // Login
  const login = useCallback(async (email: string, password: string) => {
    await authAPI.signIn(email, password);
    const { user: u } = await authAPI.session();
    setUser(u);
    router.push("/dashboard");
  }, [router]);

  // Logout
  const logout = useCallback(async () => {
    await authAPI.signOut();
    setUser(null);
    router.push("/login");
  }, [router]);

  // Register
  const register = useCallback(async (email: string, password: string, name: string) => {
    await authAPI.signUp(email, password, name);
    const { user: u } = await authAPI.session();
    setUser(u);
    router.push("/onboarding");
  }, [router]);

  const value = useMemo<AuthContextType>(
    () => ({ user, isLoading, isAuthenticated: !!user, login, logout, register }),
    [user, isLoading, login, logout, register]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export default AuthProvider;
