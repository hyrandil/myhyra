import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { fetchProfile, login as loginRequest, setAuthToken, TokenResponse, UserProfile } from '../api';

interface AuthContextState {
  token: string | null;
  user: UserProfile | null;
  login: (username: string, password: string, totp?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextState | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('authToken'));
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    setAuthToken(token);
    if (token) {
      localStorage.setItem('authToken', token);
      fetchProfile()
        .then(setUser)
        .catch(() => setUser(null));
    } else {
      localStorage.removeItem('authToken');
      setUser(null);
    }
  }, [token]);

  const login = async (username: string, password: string, totp?: string) => {
    const response: TokenResponse = await loginRequest(username, password, totp);
    setToken(response.access_token);
  };

  const logout = () => {
    setToken(null);
  };

  const value = useMemo(() => ({ token, user, login, logout }), [token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
