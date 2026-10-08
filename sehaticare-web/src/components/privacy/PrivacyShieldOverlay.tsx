import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { usePrivacy } from '../../context/PrivacyContext';
import { Button } from '../ui/button';
import { Icon } from '../ui/icons';

export function PrivacyShieldOverlay() {
  const { isShieldActive, preferences, deactivateShield, unlockWithReauth, quickExit } = usePrivacy();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Trap focus and set aria-hidden on other elements
  useEffect(() => {
    if (!isShieldActive) {
      setError(null);
      setPassword('');
      return;
    }

    const appRoot = document.getElementById('root');
    if (appRoot && containerRef.current) {
      // mark siblings as hidden for screen readers
    }

    // Focus initial interactive element
    if (preferences.require_reauth_to_unlock) {
      passwordInputRef.current?.focus();
    } else {
      const firstBtn = containerRef.current?.querySelector('button');
      firstBtn?.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Disallow Escape from bypassing reauth
      if (e.key === 'Escape') {
        e.preventDefault();
        return;
      }

      // Simple focus trap
      if (e.key === 'Tab' && containerRef.current) {
        const focusables = containerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isShieldActive, preferences.require_reauth_to_unlock]);

  if (!isShieldActive) {
    return null;
  }

  const handleUnlockSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Masukkan kata sandi untuk melanjutkan.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const ok = await unlockWithReauth(password);
      if (!ok) {
        setError('Kata sandi tidak valid. Silakan coba lagi.');
        setPassword('');
      } else {
        setPassword('');
      }
    } catch {
      setError('Verifikasi gagal. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-shield-title"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-900/98 p-6 text-white backdrop-blur-md select-none"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/90 p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 shadow-inner">
          <Icon name="shield" className="h-8 w-8 text-teal-400" />
        </div>

        <h1 id="privacy-shield-title" className="text-2xl font-bold tracking-tight text-white">
          SEHATiCare
        </h1>
        <p className="mt-2 text-base font-semibold text-slate-200">Layar dilindungi.</p>
        <p className="mt-1 text-sm text-slate-400">
          {preferences.require_reauth_to_unlock
            ? 'Verifikasi kata sandi Anda untuk melanjutkan.'
            : 'Buka kembali saat Anda siap.'}
        </p>

        {preferences.require_reauth_to_unlock ? (
          <form onSubmit={handleUnlockSubmit} className="mt-6 space-y-4 text-left">
            <div>
              <label htmlFor="reauth-password" className="block text-xs font-medium text-slate-300">
                Kata Sandi
              </label>
              <input
                ref={passwordInputRef}
                id="reauth-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi Anda"
                className="mt-1 block w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400"
                disabled={loading}
              />
            </div>

            {error ? (
              <p role="alert" className="text-xs font-medium text-rose-400">
                {error}
              </p>
            ) : null}

            <div className="flex flex-col gap-2 pt-2">
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-teal-600 font-semibold text-white hover:bg-teal-500 min-h-[44px]"
              >
                {loading ? 'Memverifikasi...' : 'Buka Layar'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={quickExit}
                className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white min-h-[44px]"
              >
                Keluar Cepat
              </Button>
            </div>
          </form>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            <Button
              type="button"
              onClick={deactivateShield}
              className="w-full bg-teal-600 font-semibold text-white hover:bg-teal-500 min-h-[44px]"
            >
              Lanjutkan
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={quickExit}
              className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white min-h-[44px]"
            >
              Keluar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
