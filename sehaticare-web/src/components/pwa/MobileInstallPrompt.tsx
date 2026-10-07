import { useCallback, useEffect, useState } from 'react';
import { AccessibleModal } from '../ui/AccessibleModal';
import { Button } from '../ui/button';

type InstallChoice = {
  outcome: 'accepted' | 'dismissed';
  platform: string;
};

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
}

const DISMISSED_KEY = 'sehaticare-install-prompt-dismissed';

function isMobileBrowser() {
  const mobileHint = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData?.mobile;
  return mobileHint ?? /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function isStandalone() {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches;
}

function wasDismissed() {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function rememberDismissal() {
  try {
    sessionStorage.setItem(DISMISSED_KEY, 'true');
  } catch {
    // The prompt still works when browser storage is disabled.
  }
}

export function MobileInstallPrompt() {
  const [open, setOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [installing, setInstalling] = useState(false);

  const close = useCallback(() => {
    rememberDismissal();
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!isMobileBrowser() || isStandalone() || wasDismissed()) return;

    const fallbackTimer = window.setTimeout(() => setOpen(true), 1200);
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setOpen(true);
    };
    const handleInstalled = () => {
      rememberDismissal();
      setInstallPrompt(null);
      setOpen(false);
    };

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.clearTimeout(fallbackTimer);
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) {
      setShowInstructions(true);
      return;
    }

    setInstalling(true);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice.outcome === 'accepted') {
        rememberDismissal();
        setOpen(false);
      }
    } finally {
      setInstalling(false);
    }
  };

  return (
    <AccessibleModal
      open={open}
      onClose={close}
      title="Tambahkan SEHATiCare ke layar utama"
      description="Akses lebih cepat dari ikon di HP Anda."
    >
      <div className="space-y-5">
        <div className="flex items-center gap-4 rounded-2xl bg-emerald-50 p-4">
          <img src="/brand/app-icon-192.png" alt="" className="h-16 w-16 rounded-2xl bg-white object-cover shadow-sm" />
          <div>
            <p className="font-bold text-slate-950">SEHATiCare</p>
            <p className="mt-1 text-sm leading-5 text-slate-600">Buka seperti aplikasi tanpa mencari alamat situs lagi.</p>
          </div>
        </div>

        {showInstructions ? (
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-slate-700" role="status">
            Ketuk menu <strong>⋮</strong> di kanan atas Chrome, lalu pilih <strong>Tambahkan ke layar utama</strong> atau <strong>Instal aplikasi</strong>.
          </div>
        ) : null}

        <p className="text-sm leading-6 text-slate-600">
          Instalasi tidak mengubah akun atau data Anda. Beberapa fitur tetap memerlukan koneksi internet.
        </p>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={close}>Nanti saja</Button>
          <Button onClick={install} disabled={installing}>
            {installing ? 'Menyiapkan…' : 'Tambahkan ke layar utama'}
          </Button>
        </div>
      </div>
    </AccessibleModal>
  );
}
