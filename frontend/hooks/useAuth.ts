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

interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  location: string | null;
}

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    full_name: string;
    phone?: string;
  }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("jb_access_token");
    if (token) {
      refreshUser().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [refreshUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("jb_access_token", data.access_token);
      localStorage.setItem("jb_refresh_token", data.refresh_token);
      await refreshUser();
    },
    [refreshUser]
  );

  const register = useCallback(
    async (payload: {
      email: string;
      password: string;
      full_name: string;
      phone?: string;
    }) => {
      const { data } = await api.post("/auth/register", payload);
      localStorage.setItem("jb_access_token", data.access_token);
      localStorage.setItem("jb_refresh_token", data.refresh_token);
      await refreshUser();
    },
    [refreshUser]
  );

  const logout = useCallback(() => {
    localStorage.removeItem("jb_access_token");
    localStorage.removeItem("jb_refresh_token");
    setUser(null);
    window.location.href = "/login";
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser }),
    [user, loading, login, register, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
