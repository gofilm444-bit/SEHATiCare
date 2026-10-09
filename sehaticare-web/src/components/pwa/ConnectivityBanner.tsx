import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { applyServiceWorkerUpdate, onServiceWorkerUpdate } from '../../pwa/registerServiceWorker';
import { isPrivateNetworkOnlyRoute } from '../../pwa/cachePolicy';
import { Icon } from '../ui/icons';

interface ConnectivityBannerProps {
  /**
   * Optional manual override. If omitted, automatically determined by current route.
   */
  isPrivateArea?: boolean;
}

export function ConnectivityBanner({ isPrivateArea }: ConnectivityBannerProps) {
  const location = useLocation();
  const effectiveIsPrivate = isPrivateArea ?? isPrivateNetworkOnlyRoute(location.pathname);
  const { isOnline, isLowBandwidth, isSaveData, checkConnection } = useNetworkStatus();
  const [retrying, setRetrying] = useState(false);
  const [waitingRegistration, setWaitingRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    const unsubscribe = onServiceWorkerUpdate((reg) => {
      setWaitingRegistration(reg);
    });

    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ registration: ServiceWorkerRegistration }>;
      if (customEvent.detail?.registration) {
        setWaitingRegistration(customEvent.detail.registration);
      }
    };

    window.addEventListener('sehaticare-sw-update-available', handleCustomEvent);
    return () => {
      unsubscribe();
      window.removeEventListener('sehaticare-sw-update-available', handleCustomEvent);
    };
  }, []);

  const handleRetry = () => {
    setRetrying(true);
    checkConnection();
    setTimeout(() => setRetrying(false), 1000);
  };

  const handleApplyUpdate = () => {
    void applyServiceWorkerUpdate(waitingRegistration);
  };

  // 1. App Update Available Banner
  if (waitingRegistration) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="relative z-50 flex flex-wrap items-center justify-between gap-3 border-b border-sky-300 bg-sky-50 px-4 py-2.5 text-xs text-sky-950 sm:px-6"
      >
        <div className="flex items-center gap-2">
          <Icon name="bell" className="h-4 w-4 shrink-0 text-sky-700" />
          <span>Pembaruan aplikasi tersedia. Muat ulang untuk mendapatkan versi terbaru.</span>
        </div>
        <button
          type="button"
          onClick={handleApplyUpdate}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-sky-800 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          Perbarui
        </button>
      </div>
    );
  }

  // 2. Completely Offline Banner
  if (!isOnline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="relative z-50 flex flex-wrap items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-950 sm:px-6"
      >
        <div className="flex items-center gap-2">
          <Icon name="shield" className="h-4 w-4 shrink-0 text-amber-700" />
          <span>
            {effectiveIsPrivate
              ? 'Koneksi tidak tersedia. Koneksi diperlukan untuk memperbarui data pribadi.'
              : 'Koneksi sedang terbatas. Konten publik yang tersimpan tetap dapat digunakan.'}
          </span>
        </div>
        <button
          type="button"
          onClick={handleRetry}
          disabled={retrying}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-amber-400 bg-white px-3.5 py-1.5 text-xs font-semibold text-amber-900 shadow-xs hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          {retrying ? 'Memeriksa…' : 'Coba Lagi'}
        </button>
      </div>
    );
  }

  // 3. Low-Bandwidth / Save-Data Hint (only if online and data saver is on)
  if (isLowBandwidth && isSaveData) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="relative z-50 flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-700 sm:px-6"
      >
        <div className="flex items-center gap-2">
          <Icon name="activity" className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          <span>Mode hemat data aktif. Media berukuran besar disesuaikan untuk kenyamanan koneksi.</span>
        </div>
      </div>
    );
  }

  return null;
}

/**
 * Notice displayed under public directories or articles to explain
 * that cached offline content may not reflect recent real-time changes.
 */
export function StaleContentDisclosure() {
  const { isOnline } = useNetworkStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs leading-5 text-slate-600"
    >
      <div className="flex items-start gap-2.5">
        <Icon name="help" className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
        <p>
          Konten tersimpan dapat digunakan saat koneksi terbatas. Informasi layanan dapat berubah, periksa kembali saat koneksi tersedia.
        </p>
      </div>
    </div>
  );
}
