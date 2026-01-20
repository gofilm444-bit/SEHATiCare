import { useCallback } from 'react';
import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';

export function useApiClient() {
  const { token, handleUnauthorized } = useAuth();

  return useCallback(
    async function fetcher<T>(path: string, init?: RequestInit) {
      return apiFetch<T>(path, init, { token, onUnauthorized: handleUnauthorized });
    },
    [token, handleUnauthorized]
  );
}
