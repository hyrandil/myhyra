import { createContext, useContext, useMemo, useState } from 'react';
import { login as apiLogin } from './api';
import { Role, UserInfo } from './types';

interface AuthContextValue {
  user: (UserInfo & { token: string }) | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<(UserInfo & { token: string }) | null>(() => {
    const token = localStorage.getItem('token');
    const payload = localStorage.getItem('user');
    if (token && payload) {
      try {
        const parsed = JSON.parse(payload) as UserInfo;
        return { ...parsed, token };
      } catch (error) {
        return null;
      }
    }
    return null;
  });

  const login = async (email: string, password: string) => {
    const res = await apiLogin(email.trim(), password);
    localStorage.setItem('token', res.token);
    localStorage.setItem('user', JSON.stringify(res.user));
    setUser({ ...res.user, token: res.token });
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      login,
      logout,
      hasRole: (...roles: Role[]) => {
        if (!user) return false;
        return roles.includes(user.role);
      },
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('AuthContext missing');
  return ctx;
}
