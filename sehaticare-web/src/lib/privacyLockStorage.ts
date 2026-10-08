export const PRIVACY_LOCK_KEY = 'sehaticare_privacy_locked';

/**
 * Checks whether the browser has an active privacy-lock marker.
 * Checks both browser-wide localStorage (persists across new tabs/sessions)
 * and tab-scoped sessionStorage (defensive fallback).
 */
export function isPrivacyLocked(): boolean {
  try {
    const localVal = typeof localStorage !== 'undefined' ? localStorage.getItem(PRIVACY_LOCK_KEY) : null;
    const sessionVal = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(PRIVACY_LOCK_KEY) : null;
    return localVal === '1' || sessionVal === '1';
  } catch {
    return false;
  }
}

/**
 * Sets the non-sensitive privacy lock marker in both localStorage and sessionStorage.
 * Value is strictly "1" without user IDs, tokens, or health data.
 */
export function setPrivacyLockMarker(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PRIVACY_LOCK_KEY, '1');
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(PRIVACY_LOCK_KEY, '1');
    }
  } catch {
    // storage disabled or quota exceeded
  }
}

/**
 * Clears the privacy lock marker from both storages.
 * Must ONLY be called upon explicit user authentication (login/anonymousLogin).
 */
export function clearPrivacyLockMarker(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(PRIVACY_LOCK_KEY);
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(PRIVACY_LOCK_KEY);
    }
  } catch {
    // storage disabled
  }
}
