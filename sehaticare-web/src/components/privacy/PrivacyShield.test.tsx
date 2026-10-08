import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { PrivacyProvider, usePrivacy } from '../../context/PrivacyContext';
import { PrivacyShieldOverlay } from './PrivacyShieldOverlay';

const mockUser = {
  id: 'usr_test_123',
  public_id: 'usr_test_123',
  full_name: 'Budi Santoso',
  role: 'PASIEN' as const,
  is_superadmin: false,
  account_mode: 'LEGACY' as const
};

let mockAuthContext = {
  user: mockUser,
  token: 'mock-token-xyz',
  isAuthenticated: true,
  initializing: false,
  login: vi.fn(),
  anonymousLogin: vi.fn(),
  logout: vi.fn(),
  handleUnauthorized: vi.fn(),
  isPrivacyLocked: () => false,
  setPrivacyLock: vi.fn(),
  clearPrivacyLock: vi.fn()
};

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => mockAuthContext
}));

function TestShieldConsumer() {
  const { isShieldActive, activateShield, deactivateShield } = usePrivacy();
  return (
    <div>
      <div id="private-content">
        <p>Private Clinical Dashboard</p>
        <p>Patient: Budi Santoso</p>
      </div>
      <button onClick={activateShield}>Buka Mode Privat</button>
      <button onClick={deactivateShield}>Tutup Mode Privat</button>
      <span data-testid="shield-state">{isShieldActive ? 'ACTIVE' : 'INACTIVE'}</span>
      <PrivacyShieldOverlay />
    </div>
  );
}

describe('AG-09 Privacy Shield Foundation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    localStorage.clear();

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/me/privacy-preferences')) {
        return new Response(
          JSON.stringify({
            lock_on_background: true,
            auto_lock_minutes: 5,
            require_reauth_to_unlock: false,
            discreet_page_titles: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
  });

  test('Privacy Shield is initially inactive and private content is visible', () => {
    render(
      <MemoryRouter>
        <PrivacyProvider>
          <TestShieldConsumer />
        </PrivacyProvider>
      </MemoryRouter>
    );

    expect(screen.getByTestId('shield-state').textContent).toBe('INACTIVE');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Private Clinical Dashboard')).toBeDefined();
  });

  test('Manual activation conceals screen with neutral overlay and zero clinical terms', async () => {
    render(
      <MemoryRouter>
        <PrivacyProvider>
          <TestShieldConsumer />
        </PrivacyProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('Buka Mode Privat'));

    expect(screen.getByTestId('shield-state').textContent).toBe('ACTIVE');
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();

    // Verify neutral copy
    expect(screen.getByText('SEHATiCare')).toBeDefined();
    expect(screen.getByText('Layar dilindungi.')).toBeDefined();
    expect(screen.getByText('Buka kembali saat Anda siap.')).toBeDefined();

    // Verify absence of sensitive terms on the shield dialog
    const dialogText = dialog.textContent || '';
    expect(dialogText).not.toMatch(/HIV/i);
    expect(dialogText).not.toMatch(/AIDS/i);
    expect(dialogText).not.toMatch(/ARV/i);
    expect(dialogText).not.toMatch(/ART/i);
    expect(dialogText).not.toMatch(/ODHIV/i);
    expect(dialogText).not.toMatch(/Budi Santoso/i);

    // Unlocking with "Lanjutkan" restores view
    const continueBtn = screen.getByText('Lanjutkan');
    fireEvent.click(continueBtn);
    expect(screen.getByTestId('shield-state').textContent).toBe('INACTIVE');
  });

  test('Re-authentication required: wrong password rejected, correct password unlocks', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/me/privacy-preferences')) {
        return new Response(
          JSON.stringify({
            lock_on_background: true,
            auto_lock_minutes: 5,
            require_reauth_to_unlock: true,
            discreet_page_titles: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/auth/re-authenticate')) {
        const body = JSON.parse(String(init?.body ?? '{}'));
        if (body.password === 'correct-secret-123') {
          return new Response(
            JSON.stringify({ ok: true, reauthenticated_at: new Date().toISOString(), expires_in_seconds: 300 }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({ message: 'Kata sandi tidak valid' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    render(
      <MemoryRouter>
        <PrivacyProvider>
          <TestShieldConsumer />
        </PrivacyProvider>
      </MemoryRouter>
    );

    // Wait for preferences to load
    await waitFor(() => {
      expect(screen.getByTestId('shield-state').textContent).toBe('INACTIVE');
    });

    fireEvent.click(screen.getByText('Buka Mode Privat'));
    expect(screen.getByTestId('shield-state').textContent).toBe('ACTIVE');

    // Should require password
    expect(screen.getByText('Verifikasi kata sandi Anda untuk melanjutkan.')).toBeDefined();
    const passwordInput = screen.getByLabelText('Kata Sandi');
    expect(passwordInput).toBeDefined();

    // Try wrong password
    fireEvent.change(passwordInput, { target: { value: 'wrong-pass' } });
    fireEvent.click(screen.getByText('Buka Layar'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByText('Kata sandi tidak valid. Silakan coba lagi.')).toBeDefined();
    });
    expect(screen.getByTestId('shield-state').textContent).toBe('ACTIVE');

    // Enter correct password
    fireEvent.change(passwordInput, { target: { value: 'correct-secret-123' } });
    fireEvent.click(screen.getByText('Buka Layar'));

    await waitFor(() => {
      expect(screen.getByTestId('shield-state').textContent).toBe('INACTIVE');
    });
  });

  test('Escape key cannot bypass the privacy shield', () => {
    render(
      <MemoryRouter>
        <PrivacyProvider>
          <TestShieldConsumer />
        </PrivacyProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('Buka Mode Privat'));
    expect(screen.getByTestId('shield-state').textContent).toBe('ACTIVE');

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(screen.getByTestId('shield-state').textContent).toBe('ACTIVE');
  });

  test('Document title is neutralized to SEHATiCare when shield is active', () => {
    document.title = 'Judul Lain';
    render(
      <MemoryRouter>
        <PrivacyProvider>
          <TestShieldConsumer />
        </PrivacyProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('Buka Mode Privat'));
    expect(document.title).toBe('SEHATiCare');
  });
});
