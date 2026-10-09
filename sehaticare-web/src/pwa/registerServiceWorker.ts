/**
 * SEHATiCare Service Worker Registration Utility
 * Registered only in production builds to avoid interfering with local Vite dev/HMR.
 */

export type ServiceWorkerUpdateHandler = (registration: ServiceWorkerRegistration) => void;

let updateCallbacks: ServiceWorkerUpdateHandler[] = [];

export function onServiceWorkerUpdate(callback: ServiceWorkerUpdateHandler): () => void {
  updateCallbacks.push(callback);
  return () => {
    updateCallbacks = updateCallbacks.filter((cb) => cb !== callback);
  };
}

export function isServiceWorkerSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator;
}

/**
 * Registers the production service worker, or unregisters in dev environment
 * to prevent dev worker poisoning.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isServiceWorkerSupported()) {
    return null;
  }

  // Never keep an active SW during Vite dev mode
  if (import.meta.env.DEV) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        // Only unregister SEHATiCare root scope
        if (registration.scope.startsWith(window.location.origin)) {
          await registration.unregister();
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });

    registration.addEventListener('updatefound', () => {
      const installingWorker = registration.installing;
      if (!installingWorker) return;

      installingWorker.addEventListener('statechange', () => {
        if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // A new version is installed and waiting to activate
          for (const callback of updateCallbacks) {
            callback(registration);
          }
          window.dispatchEvent(
            new CustomEvent('sehaticare-sw-update-available', { detail: { registration } })
          );
        }
      });
    });

    return registration;
  } catch (err) {
    // Service worker registration failures must fail safely without breaking the application
    console.warn('[SW] Registration failed safely:', err);
    return null;
  }
}

/**
 * Commands the waiting service worker to activate and reloads the window safely.
 */
export async function applyServiceWorkerUpdate(registration?: ServiceWorkerRegistration | null): Promise<void> {
  if (!isServiceWorkerSupported()) return;

  const reg = registration ?? (await navigator.serviceWorker.getRegistration('/'));
  if (reg?.waiting) {
    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  }, { once: true });
}

export async function unregisterServiceWorker(): Promise<boolean> {
  if (!isServiceWorkerSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    if (reg) {
      return await reg.unregister();
    }
    return false;
  } catch {
    return false;
  }
}
