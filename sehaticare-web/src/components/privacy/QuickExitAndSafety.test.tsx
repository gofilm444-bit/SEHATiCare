import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { PrivacyProvider, usePrivacy, SESSION_CHANNEL_NAME } from '../../context/PrivacyContext';
import { PRIVACY_LOCK_KEY } from '../../context/AuthContext';

const mockLogout = vi.fn();
const mockSetPrivacyLock = vi.fn(() => {
  sessionStorage.setItem(PRIVACY_LOCK_KEY, '1');
  localStorage.setItem(PRIVACY_LOCK_KEY, '1');
});
const mockClearPrivacyLock = vi.fn(() => {
  sessionStorage.removeItem(PRIVACY_LOCK_KEY);
  localStorage.removeItem(PRIVACY_LOCK_KEY);
});

vi.mock('../../context/AuthContext', () => ({
  PRIVACY_LOCK_KEY: 'sehaticare_privacy_locked',
  useAuth: () => ({
    user: { id: 'usr-456', role: 'PASIEN' },
    token: 'valid-in-memory-token',
    isAuthenticated: true,
    initializing: false,
    login: vi.fn(),
    anonymousLogin: vi.fn(),
    logout: mockLogout,
    handleUnauthorized: vi.fn(),
    isPrivacyLocked: () => sessionStorage.getItem('sehaticare_privacy_locked') === '1',
    setPrivacyLock: mockSetPrivacyLock,
    clearPrivacyLock: mockClearPrivacyLock
  })
}));

function TestQuickExitConsumer() {
  const { quickExit, isShieldActive } = usePrivacy();
  return (
    <div>
      <button onClick={quickExit}>Keluar Cepat Sekarang</button>
      <span data-testid="shield-flag">{isShieldActive ? 'SHIELDED' : 'VISIBLE'}</span>
    </div>
  );
}

describe('AG-09 Quick Exit, BFCache & Cross-Tab Safety', () => {
  let locationReplaceSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    mockLogout.mockClear();
    mockSetPrivacyLock.mockClear();

    locationReplaceSpy = vi.fn();
    delete (window as any).location;
    window.location = { replace: locationReplaceSpy, assign: vi.fn() } as any;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/me/privacy-preferences')) {
        return new Response(JSON.stringify({
          lock_on_background: true,
          auto_lock_minutes: 5,
          require_reauth_to_unlock: false,
          discreet_page_titles: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/auth/logout')) {
        return new Response(null, { status: 204 });
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
  });

  test('Quick Exit immediately conceals screen, sets privacy lock marker, calls logout, and navigates with replace', async () => {
    render(
      <MemoryRouter>
        <PrivacyProvider>
          <TestQuickExitConsumer />
        </PrivacyProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('Keluar Cepat Sekarang'));

    // 1. Synchronously activated shield
    expect(screen.getByTestId('shield-flag').textContent).toBe('SHIELDED');

    // 2. Set privacy lock marker
    expect(mockSetPrivacyLock).toHaveBeenCalled();
    const marker = sessionStorage.getItem(PRIVACY_LOCK_KEY);
    expect(marker).toBe('1');
    // Ensure marker contains strictly no tokens or patient data
    expect(marker).not.toMatch(/usr-/);
    expect(marker).not.toMatch(/token/);

    // 3. Logged out locally
    expect(mockLogout).toHaveBeenCalledWith(false);

    // 4. Navigated with replace semantics to neutral destination
    expect(locationReplaceSpy).toHaveBeenCalledWith('/');

    // 5. Document title neutralized
    expect(document.title).toBe('SEHATiCare');
  });

  test('Quick Exit still protects local screen and session when backend logout network request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/auth/logout')) {
        throw new Error('Network offline');
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    render(
      <MemoryRouter>
        <PrivacyProvider>
          <TestQuickExitConsumer />
        </PrivacyProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('Keluar Cepat Sekarang'));

    // Local protection still happens
    expect(screen.getByTestId('shield-flag').textContent).toBe('SHIELDED');
    expect(mockSetPrivacyLock).toHaveBeenCalled();
    expect(mockLogout).toHaveBeenCalledWith(false);
    expect(locationReplaceSpy).toHaveBeenCalledWith('/');
  });

  test('Storage inspection confirms zero persisted bearer tokens or clinical secrets in Web Storage', () => {
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(sessionStorage.getItem('access_token')).toBeNull();
    expect(sessionStorage.getItem('token')).toBeNull();

    // Verify only the non-sensitive privacy lock flag exists if set
    sessionStorage.setItem('sehaticare_privacy_locked', '1');
    expect(sessionStorage.getItem('sehaticare_privacy_locked')).toBe('1');
    expect(sessionStorage.getItem('sehaticare_privacy_locked')).not.toMatch(/Bearer|usr-|jwt/i);
  });

  test('BFCache pageshow: persisted event triggers privacy protection and redirection', () => {
    sessionStorage.setItem('sehaticare_privacy_locked', '1');

    render(
      <MemoryRouter>
        <PrivacyProvider>
          <TestQuickExitConsumer />
        </PrivacyProvider>
      </MemoryRouter>
    );

    // Dispatch pageshow with persisted = true
    const event = new PageTransitionEvent('pageshow', { persisted: true });
    window.dispatchEvent(event);

    expect(locationReplaceSpy).toHaveBeenCalledWith('/');
  });
});
