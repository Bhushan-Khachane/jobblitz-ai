"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import api from "@/lib/api";

// ── Types ───────────────────────────────────────────────────────────────────

interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, full_name: string, phone?: string) => Promise<void>;
  logout: () => void;
}

// ── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: verify existing token
  useEffect(() => {
    const token = localStorage.getItem("jb_access_token");
    if (!token) {
      setIsLoading(false);
      return;
    }

    api
      .get<User>("/auth/me")
      .then((res) => {
        setUser(res.data);
      })
      .catch(() => {
        localStorage.removeItem("jb_access_token");
        localStorage.removeItem("jb_refresh_token");
        setUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Login
  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<{ access_token: string; refresh_token: string }>(
      "/auth/login",
      { email, password }
    );
    localStorage.setItem("jb_access_token", data.access_token);
    localStorage.setItem("jb_refresh_token", data.refresh_token);

    const me = await api.get<User>("/auth/me");
    setUser(me.data);
  }, []);

  // Register
  const register = useCallback(
    async (email: string, password: string, full_name: string, phone?: string) => {
      const { data } = await api.post<{ access_token: string; refresh_token: string }>(
        "/auth/register",
        { email, password, full_name, phone }
      );
      localStorage.setItem("jb_access_token", data.access_token);
      localStorage.setItem("jb_refresh_token", data.refresh_token);

      const me = await api.get<User>("/auth/me");
      setUser(me.data);
    },
    []
  );

  // Logout
  const logout = useCallback(() => {
    localStorage.removeItem("jb_access_token");
    localStorage.removeItem("jb_refresh_token");
    setUser(null);
    window.location.href = "/login";
  }, []);

  const isAuthenticated = user !== null;

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, isAuthenticated, login, register, logout }),
    [user, isLoading, isAuthenticated, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

export default AuthProvider;
