import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getPrivacyPreferencesRequest, logoutRequest, reauthenticateRequest, updatePrivacyPreferencesRequest } from '../api/client';
import { useAuth } from './AuthContext';
import { PrivacyPreferences, PrivacyPreferencesPatch } from '../types/privacy';

export const SESSION_CHANNEL_NAME = 'sehaticare-session';

export interface PrivacyContextValue {
  isShieldActive: boolean;
  preferences: PrivacyPreferences;
  loadingPreferences: boolean;
  activateShield: () => void;
  deactivateShield: () => void;
  unlockWithReauth: (password: string) => Promise<boolean>;
  quickExit: () => void;
  updatePreferences: (patch: PrivacyPreferencesPatch) => Promise<void>;
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
  const channelRef = useRef<BroadcastChannel | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

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
    // 1. Immediately hide private UI synchronously
    setIsShieldActive(true);
    document.title = 'SEHATiCare';

    // 2. Set client privacy lock marker
    setPrivacyLock();

    // 3. Broadcast to all open tabs with neutral payload
    broadcastEvent('QUICK_EXIT');

    // 4. Clear authenticated in-memory state & call logout with keepalive
    void logoutRequest({ keepalive: true }).catch(() => undefined);
    logout(false);

    // 5. Navigate with replace semantics to neutral landing
    window.location.replace('/');
  }, [broadcastEvent, logout, setPrivacyLock]);

  // Activate Privacy Shield
  const activateShield = useCallback(() => {
    setIsShieldActive(true);
    document.title = 'SEHATiCare';
    broadcastEvent('PRIVACY_LOCK');
  }, [broadcastEvent]);

  // Deactivate Privacy Shield
  const deactivateShield = useCallback(() => {
    if (preferences.require_reauth_to_unlock) {
      // Must unlock via re-auth
      return;
    }
    setIsShieldActive(false);
  }, [preferences.require_reauth_to_unlock]);

  // Unlock with password re-auth
  const unlockWithReauth = useCallback(
    async (password: string): Promise<boolean> => {
      if (!token) return false;
      try {
        const res = await reauthenticateRequest(token, password);
        if (res.ok) {
          setIsShieldActive(false);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [token]
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
        setIsShieldActive(true);
        logout(false);
        window.location.replace('/');
      } else if (data.type === 'PRIVACY_LOCK') {
        setIsShieldActive(true);
      }
    };

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [logout, setPrivacyLock]);

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
      deactivateShield: () => {},
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
