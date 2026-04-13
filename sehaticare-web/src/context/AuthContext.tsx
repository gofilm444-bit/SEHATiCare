import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loginRequest } from '../api/client';
import { AuthResponse, User, UserRole } from '../types/auth';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  initializing: boolean;
  login: (email: string, password: string) => Promise<AuthResponse>;
  logout: (redirect?: boolean) => void;
  handleUnauthorized: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const STORAGE_KEY = 'sehaticare.auth';

interface StoredAuth {
  token: string;
  user: User;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as StoredAuth;
        setUser(parsed.user);
        setToken(parsed.token);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setInitializing(false);
  }, []);

  const persist = useCallback((payload: StoredAuth) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await loginRequest(email, password);
    setUser(response.user);
    setToken(response.access_token);
    persist({ token: response.access_token, user: response.user });
    return response;
  }, [persist]);

  const logout = useCallback((redirect = true) => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(STORAGE_KEY);
    if (redirect) {
      window.location.href = '/';
    }
  }, []);

  const handleUnauthorized = useCallback(() => {
    logout(true);
  }, [logout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token && user),
      initializing,
      login,
      logout,
      handleUnauthorized
    }),
    [user, token, initializing, login, logout, handleUnauthorized]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

export function hasRole(user: User | null, roles?: UserRole[]) {
  if (!roles) return true;
  if (!user) return false;
  return roles.includes(user.role);
}
