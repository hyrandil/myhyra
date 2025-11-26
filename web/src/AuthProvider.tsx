import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { fetchSession, login as apiLogin, logout as apiLogout } from './api';
import { Role, UserInfo } from './types';

interface AuthContextValue {
  user: UserInfo | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetchSession()
      .then((res) => setUser(res.user))
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiLogin(email.trim(), password);
    setUser(res.user);
  };

  const logout = () => {
    apiLogout()
      .catch(() => undefined)
      .finally(() => setUser(null));
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      login,
      logout,
      hasRole: (...roles: Role[]) => {
        if (!user) return false;
        return roles.includes(user.role);
      },
    }),
    [user, ready]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('AuthContext missing');
  return ctx;
}
