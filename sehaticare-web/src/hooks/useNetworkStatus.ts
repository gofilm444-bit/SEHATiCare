import { useEffect, useState, useCallback } from 'react';

export type EffectiveConnectionType = '4g' | '3g' | '2g' | 'slow-2g' | 'unknown';

export interface NetworkStatus {
  isOnline: boolean;
  isLowBandwidth: boolean;
  isSaveData: boolean;
  effectiveType: EffectiveConnectionType;
  checkConnection: () => void;
}

interface NetworkInformation extends EventTarget {
  readonly effectiveType?: string;
  readonly saveData?: boolean;
  addEventListener(type: 'change', listener: EventListener): void;
  removeEventListener(type: 'change', listener: EventListener): void;
}

function getNetworkInfo(): NetworkInformation | null {
  if (typeof navigator === 'undefined') return null;
  const nav = navigator as Navigator & {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  };
  return nav.connection || nav.mozConnection || nav.webkitConnection || null;
}

function parseEffectiveType(rawType?: string): EffectiveConnectionType {
  if (!rawType) return 'unknown';
  const lower = rawType.toLowerCase();
  if (lower === '4g' || lower === '3g' || lower === '2g' || lower === 'slow-2g') {
    return lower;
  }
  return 'unknown';
}

/**
 * Hook to monitor network online/offline and low-bandwidth status.
 * Never persists network history to persistent browser storage.
 */
export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  const [isSaveData, setIsSaveData] = useState<boolean>(() => {
    const conn = getNetworkInfo();
    return Boolean(conn?.saveData);
  });

  const [effectiveType, setEffectiveType] = useState<EffectiveConnectionType>(() => {
    const conn = getNetworkInfo();
    return parseEffectiveType(conn?.effectiveType);
  });

  const updateStatus = useCallback(() => {
    const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
    setIsOnline(online);

    const conn = getNetworkInfo();
    setIsSaveData(Boolean(conn?.saveData));
    setEffectiveType(parseEffectiveType(conn?.effectiveType));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => updateStatus();
    const handleOffline = () => updateStatus();
    const handleConnectionChange = () => updateStatus();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const conn = getNetworkInfo();
    if (conn && typeof conn.addEventListener === 'function') {
      conn.addEventListener('change', handleConnectionChange);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (conn && typeof conn.removeEventListener === 'function') {
        conn.removeEventListener('change', handleConnectionChange);
      }
    };
  }, [updateStatus]);

  const isLowBandwidth =
    !isOnline ||
    isSaveData ||
    effectiveType === '2g' ||
    effectiveType === 'slow-2g';

  return {
    isOnline,
    isLowBandwidth,
    isSaveData,
    effectiveType,
    checkConnection: updateStatus
  };
}
