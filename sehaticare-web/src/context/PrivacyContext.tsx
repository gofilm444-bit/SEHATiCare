import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  getPrivacyPreferencesRequest,
  getSelfUserRequest,
  logoutRequest,
  reauthenticateRequest,
  updatePrivacyPreferencesRequest,
  verifyReauthProofRequest
} from '../api/client';
import { useAuth } from './AuthContext';
import { PrivacyPreferences, PrivacyPreferencesPatch } from '../types/privacy';
import { PRIVACY_LOCK_KEY } from '../lib/privacyLockStorage';

export const SESSION_CHANNEL_NAME = 'sehaticare-session';

export interface PrivacyContextValue {
  isShieldActive: boolean;
  preferences: PrivacyPreferences;
  loadingPreferences: boolean;
  activateShield: () => void;
  deactivateShield: () => Promise<void>;
  unlockWithReauth: (password: string) => Promise<boolean>;
  quickExit: () => void;
  updatePreferences: (patch: PrivacyPreferencesPatch) => Promise<void>;
}

interface ReauthProof {
  token: string;
  userId: string;
  expiresAt: number;
}

const DEFAULT_PREFERENCES: PrivacyPreferences = {
  lock_on_background: true,
  auto_lock_minutes: 5,
  require_reauth_to_unlock: false,
  discreet_page_titles: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

const PrivacyContext = createContext<PrivacyContextValue | undefined>(undefined);

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const { user, token, logout, setPrivacyLock, isPrivacyLocked } = useAuth();
  const [isShieldActive, setIsShieldActive] = useState(false);
  const [preferences, setPreferences] = useState<PrivacyPreferences>(DEFAULT_PREFERENCES);
  const [loadingPreferences, setLoadingPreferences] = useState(false);
  const [reauthProof, setReauthProof] = useState<ReauthProof | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Invalidate in-RAM re-auth proof whenever the user changes or logs out
  useEffect(() => {
    setReauthProof(null);
  }, [user?.id]);

  // Broadcast helper - NEVER sends sensitive payload
  const broadcastEvent = useCallback((type: 'QUICK_EXIT' | 'LOGOUT' | 'PRIVACY_LOCK') => {
    try {
      if (channelRef.current) {
        channelRef.current.postMessage({ type });
      }
    } catch {
      // BroadcastChannel unsupported or failed
    }
  }, []);

  // Fetch preferences when authenticated
  useEffect(() => {
    let active = true;
    if (!token) {
      setPreferences(DEFAULT_PREFERENCES);
      return;
    }
    setLoadingPreferences(true);
    getPrivacyPreferencesRequest(token)
      .then((data) => {
        if (active) setPreferences(data);
      })
      .catch(() => {
        // Fallback to default safe preferences
      })
      .finally(() => {
        if (active) setLoadingPreferences(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  // Page title neutralization
  useEffect(() => {
    if (isShieldActive || preferences.discreet_page_titles) {
      document.title = 'SEHATiCare';
    }
  }, [isShieldActive, preferences.discreet_page_titles]);

  // Quick Exit implementation
  const quickExit = useCallback(() => {
    // 1. Immediately hide private UI synchronously & purge re-auth proof
    setIsShieldActive(true);
    setReauthProof(null);
    document.title = 'SEHATiCare';

    // 2. Set client privacy lock marker (browser-wide in localStorage + sessionStorage)
    setPrivacyLock();

    // 3. Broadcast to all open tabs with neutral payload
    broadcastEvent('QUICK_EXIT');

    // 4. Clear authenticated in-memory state & call logout with keepalive
    void logoutRequest({ keepalive: true }).catch(() => undefined);
    logout(false);

    // 5. Navigate with replace semantics to neutral landing
    try {
      window.location.replace('/');
    } catch {
      // environment without window
    }
  }, [broadcastEvent, logout, setPrivacyLock]);

  // Activate Privacy Shield
  const activateShield = useCallback(() => {
    setIsShieldActive(true);
    document.title = 'SEHATiCare';
    broadcastEvent('PRIVACY_LOCK');
  }, [broadcastEvent]);

  // Deactivate Privacy Shield
  const deactivateShield = useCallback(async () => {
    // 1. Guard against privacy-locked or unauthenticated state
    if (isPrivacyLocked() || !token || !user) {
      setIsShieldActive(true);
      try {
        window.location.replace('/');
      } catch {}
      return;
    }

    // 2. If re-auth is required, enforce valid in-RAM cryptographic proof
    if (preferences.require_reauth_to_unlock) {
      if (!reauthProof || reauthProof.userId !== user.id || reauthProof.expiresAt <= Date.now()) {
        return;
      }
      try {
        const verifyRes = await verifyReauthProofRequest(token, reauthProof.token);
        if (verifyRes && verifyRes.valid === false) {
          setReauthProof(null);
          return;
        }
      } catch {
        setReauthProof(null);
        return;
      }
    }

    // 3. Revalidate active session with backend before lifting shield to ensure session wasn't revoked elsewhere
    try {
      await getSelfUserRequest(token);
    } catch {
      // Session invalid or revoked while shielded - do NOT reveal stale private UI
      setIsShieldActive(true);
      logout(true);
      return;
    }

    setIsShieldActive(false);
  }, [isPrivacyLocked, preferences.require_reauth_to_unlock, token, user, reauthProof, logout]);

  // Unlock with password re-auth
  const unlockWithReauth = useCallback(
    async (password: string): Promise<boolean> => {
      if (!token || !user) return false;
      try {
        const res = await reauthenticateRequest(token, password);
        if (res.ok && res.proof_token) {
          setReauthProof({
            token: res.proof_token,
            userId: user.id,
            expiresAt: Date.now() + (res.expires_in_seconds || 300) * 1000
          });
          setIsShieldActive(false);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [token, user]
  );

  // Update preferences
  const updatePreferences = useCallback(
    async (patch: PrivacyPreferencesPatch) => {
      if (!token) return;
      const updated = await updatePrivacyPreferencesRequest(token, patch);
      setPreferences(updated);
    },
    [token]
  );

  // Cross-tab broadcast listener
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.BroadcastChannel === 'undefined') {
      return;
    }

    const channel = new BroadcastChannel(SESSION_CHANNEL_NAME);
    channelRef.current = channel;

    channel.onmessage = (event: MessageEvent) => {
      const data = event.data as { type?: string } | undefined;
      if (!data || typeof data.type !== 'string') return;

      if (data.type === 'QUICK_EXIT' || data.type === 'LOGOUT') {
        setPrivacyLock();
        setReauthProof(null);
        setIsShieldActive(true);
        logout(false);
        try {
          window.location.replace('/');
        } catch {}
      } else if (data.type === 'PRIVACY_LOCK') {
        setIsShieldActive(true);
      }
    };

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [logout, setPrivacyLock]);

  // Cross-tab storage listener fallback (e.g., when BroadcastChannel is unsupported)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorage = (event: StorageEvent) => {
      if (event.key === PRIVACY_LOCK_KEY && event.newValue === '1') {
        setReauthProof(null);
        setIsShieldActive(true);
        logout(false);
        try {
          window.location.replace('/');
        } catch {}
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, [logout]);

  // Inactivity auto-lock timer
  useEffect(() => {
    if (!token || !user) return;
    const lockMinutes = preferences.auto_lock_minutes;
    if (!lockMinutes || lockMinutes <= 0) return;

    const thresholdMs = lockMinutes * 60 * 1000;
    lastActivityRef.current = Date.now();

    const recordActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((evt) => window.addEventListener(evt, recordActivity, { passive: true }));

    const interval = setInterval(() => {
      const idleTime = Date.now() - lastActivityRef.current;
      if (idleTime >= thresholdMs) {
        setIsShieldActive(true);
      }
    }, 5000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, recordActivity));
      clearInterval(interval);
    };
  }, [preferences.auto_lock_minutes, token, user]);

  // Background / Visibility auto-lock
  useEffect(() => {
    if (!token || !user) return;
    if (!preferences.lock_on_background) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        setIsShieldActive(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [preferences.lock_on_background, token, user]);

  // BFCache / pageshow listener
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        if (isPrivacyLocked() || !token) {
          setIsShieldActive(true);
          window.location.replace('/');
        }
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    return () => {
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [isPrivacyLocked, token]);

  const value = useMemo<PrivacyContextValue>(
    () => ({
      isShieldActive,
      preferences,
      loadingPreferences,
      activateShield,
      deactivateShield,
      unlockWithReauth,
      quickExit,
      updatePreferences
    }),
    [
      isShieldActive,
      preferences,
      loadingPreferences,
      activateShield,
      deactivateShield,
      unlockWithReauth,
      quickExit,
      updatePreferences
    ]
  );

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

export function usePrivacy(): PrivacyContextValue {
  const context = useContext(PrivacyContext);
  if (!context) {
    return {
      isShieldActive: false,
      preferences: DEFAULT_PREFERENCES,
      loadingPreferences: false,
      activateShield: () => {},
      deactivateShield: async () => {},
      unlockWithReauth: async () => false,
      quickExit: () => {
        try {
          window.location.replace('/');
        } catch {
          // window unavailable
        }
      },
      updatePreferences: async () => {}
    };
  }
  return context;
}
