"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

// ── Types ───────────────────────────────────────────────────────────────────

interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  location: string | null;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (email: string, password: string, full_name: string, phone?: string) => Promise<void>;
}

// ── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

// ── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // On mount: validate existing token
  useEffect(() => {
    const init = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("jb_access_token") : null;
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const { data } = await api.get<User>("/auth/me");
        setUser(data);
      } catch {
        localStorage.removeItem("jb_access_token");
        localStorage.removeItem("jb_refresh_token");
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  // Login
  const login = useCallback(async (email: string, password: string) => {
    const { data: tokens } = await api.post<{ access_token: string; refresh_token: string }>(
      "/auth/login",
      { email, password }
    );
    localStorage.setItem("jb_access_token", tokens.access_token);
    localStorage.setItem("jb_refresh_token", tokens.refresh_token);
    const { data: me } = await api.get<User>("/auth/me");
    setUser(me);
    router.push("/dashboard");
  }, [router]);

  // Logout
  const logout = useCallback(() => {
    localStorage.removeItem("jb_access_token");
    localStorage.removeItem("jb_refresh_token");
    setUser(null);
    router.push("/login");
  }, [router]);

  // Register
  const register = useCallback(async (email: string, password: string, full_name: string, phone?: string) => {
    const { data: tokens } = await api.post<{ access_token: string; refresh_token: string }>(
      "/auth/register",
      { email, password, full_name, phone }
    );
    localStorage.setItem("jb_access_token", tokens.access_token);
    localStorage.setItem("jb_refresh_token", tokens.refresh_token);
    const { data: me } = await api.get<User>("/auth/me");
    setUser(me);
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
