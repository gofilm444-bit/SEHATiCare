import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { anonymousLoginRequest, loginRequest, logoutRequest, refreshSessionRequest } from '../api/client';
import { AuthResponse, User, UserRole } from '../types/auth';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  initializing: boolean;
  login: (email: string, password: string) => Promise<AuthResponse>;
  anonymousLogin: (loginId: string, password: string) => Promise<AuthResponse>;
  logout: (redirect?: boolean) => void;
  handleUnauthorized: () => void;
  isPrivacyLocked: () => boolean;
  setPrivacyLock: () => void;
  clearPrivacyLock: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
import {
  isPrivacyLocked as checkPrivacyLocked,
  setPrivacyLockMarker,
  clearPrivacyLockMarker,
  PRIVACY_LOCK_KEY
} from '../lib/privacyLockStorage';
export { PRIVACY_LOCK_KEY };

const LEGACY_STORAGE_KEY = 'sehaticare.auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const refreshInFlight = useRef<Promise<AuthResponse> | null>(null);

  const isPrivacyLocked = useCallback(() => {
    return checkPrivacyLocked();
  }, []);

  const setPrivacyLock = useCallback(() => {
    setPrivacyLockMarker();
  }, []);

  const clearPrivacyLock = useCallback(() => {
    clearPrivacyLockMarker();
  }, []);

  const refreshSession = useCallback(() => {
    if (!refreshInFlight.current) {
      refreshInFlight.current = refreshSessionRequest().finally(() => {
        refreshInFlight.current = null;
      });
    }
    return refreshInFlight.current;
  }, []);

  useEffect(() => {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    if (isPrivacyLocked()) {
      setUser(null);
      setToken(null);
      setInitializing(false);
      return;
    }

    let active = true;
    void refreshSession()
      .then((response) => {
        if (!active) return;
        setUser(response.user);
        setToken(response.access_token);
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
        setToken(null);
      })
      .finally(() => {
        if (active) setInitializing(false);
      });
    return () => {
      active = false;
    };
  }, [isPrivacyLocked, refreshSession]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await loginRequest(email, password);
    clearPrivacyLock();
    setUser(response.user);
    setToken(response.access_token);
    return response;
  }, [clearPrivacyLock]);

  const anonymousLogin = useCallback(async (loginId: string, password: string) => {
    const response = await anonymousLoginRequest(loginId, password);
    clearPrivacyLock();
    setUser(response.user);
    setToken(response.access_token);
    return response;
  }, [clearPrivacyLock]);

  const logout = useCallback((redirect = true) => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    setPrivacyLockMarker();
    void logoutRequest()
      .catch(() => undefined)
      .finally(() => {
        if (redirect) window.location.assign('/');
      });
  }, []);

  const handleUnauthorized = useCallback(() => {
    if (checkPrivacyLocked()) {
      logout(true);
      return;
    }
    void refreshSession()
      .then((response) => {
        setUser(response.user);
        setToken(response.access_token);
      })
      .catch(() => logout(true));
  }, [logout, refreshSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token && user),
      initializing,
      login,
      anonymousLogin,
      logout,
      handleUnauthorized,
      isPrivacyLocked,
      setPrivacyLock,
      clearPrivacyLock
    }),
    [user, token, initializing, login, anonymousLogin, logout, handleUnauthorized, isPrivacyLocked, setPrivacyLock, clearPrivacyLock]
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
