import { useEffect, useState } from 'react';
import api, { setAuthToken } from '../api';

type Role = 'user' | 'admin';

export interface CurrentUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}

interface LoginResponse {
  token: string;
  user: CurrentUser;
}

export function useAuth() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      setAuthToken(token);
    }
  }, [token]);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setAuthToken(undefined);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return { user, token, login, logout };
}
