import { useEffect, useRef } from 'react';

type PollOptions = { silent?: boolean; signal?: AbortSignal };

type UseMessagesPollingOptions = {
  consultationId?: string;
  enabled?: boolean;
  getDelay: () => number;
  loadMessages: (options?: PollOptions) => Promise<void> | void;
  loadDetail?: () => void;
  detailIntervalMs?: number | null;
  initialDelayMs?: number;
  hiddenDelayMs?: number;
};

export function useMessagesPolling({
  consultationId,
  enabled = true,
  getDelay,
  loadMessages,
  loadDetail,
  detailIntervalMs,
  initialDelayMs = 6000,
  hiddenDelayMs = 6000
}: UseMessagesPollingOptions) {
  const startedRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);
  const pendingImmediateRef = useRef(false);
  const lastDetailPollRef = useRef(0);
  const loadMessagesRef = useRef(loadMessages);
  const loadDetailRef = useRef(loadDetail);
  const getDelayRef = useRef(getDelay);

  useEffect(() => {
    loadMessagesRef.current = loadMessages;
  }, [loadMessages]);

  useEffect(() => {
    loadDetailRef.current = loadDetail;
  }, [loadDetail]);

  useEffect(() => {
    getDelayRef.current = getDelay;
  }, [getDelay]);

  useEffect(() => {
    if (!consultationId || !enabled) return;
    if (startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;

    const schedule = (delay: number) => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        void tick();
      }, delay);
    };

    const tick = async () => {
      if (cancelled) return;
      if (document.visibilityState !== 'visible') {
        schedule(hiddenDelayMs);
        return;
      }
      if (inFlightRef.current) {
        pendingImmediateRef.current = true;
        return;
      }

      inFlightRef.current = true;
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await loadMessagesRef.current({ silent: true, signal: controller.signal });

        if (loadDetailRef.current) {
          if (detailIntervalMs === null) {
            // skip detail polling
          } else if (!detailIntervalMs || detailIntervalMs <= 0) {
            loadDetailRef.current();
          } else {
            const now = Date.now();
            if (now - lastDetailPollRef.current >= detailIntervalMs) {
              lastDetailPollRef.current = now;
              loadDetailRef.current();
            }
          }
        }
      } finally {
        inFlightRef.current = false;
      }

      const nextDelay = pendingImmediateRef.current ? 0 : getDelayRef.current();
      pendingImmediateRef.current = false;
      schedule(nextDelay);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (inFlightRef.current) {
          pendingImmediateRef.current = true;
          return;
        }
        schedule(0);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    schedule(initialDelayMs);

    return () => {
      cancelled = true;
      startedRef.current = false;
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      inFlightRef.current = false;
      pendingImmediateRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [consultationId, detailIntervalMs, enabled, hiddenDelayMs, initialDelayMs]);
}
