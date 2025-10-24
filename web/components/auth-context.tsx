"use client";

import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type LoginResult = {
  success: boolean;
  message?: string;
};

type AuthContextValue = {
  token: string | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_STORAGE_KEY = "hvshop_admin_access_token";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export function AuthProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const storedToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (storedToken) {
      setToken(storedToken);
    }
    setReady(true);
  }, []);

  const logout = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
    setToken(null);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, message: "Invalid email or password." };
        }

        const errorBody = await response.text();
        return { success: false, message: errorBody || "Login failed. Please try again." };
      }

      const payload = (await response.json()) as { accessToken?: string };
      const accessToken = payload.accessToken;
      if (!accessToken) {
        return { success: false, message: "Server returned an empty access token." };
      }
      if (typeof window !== "undefined") {
        window.localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
      }
      setToken(accessToken);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed. Please verify your credentials.";
      return { success: false, message };
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      ready,
      login,
      logout,
    }),
    [login, logout, ready, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
