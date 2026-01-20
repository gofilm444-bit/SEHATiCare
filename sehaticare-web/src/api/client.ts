import { AuthResponse } from '../types/auth';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

function joinUrl(base: string, path: string) {
  if (base.endsWith('/')) base = base.slice(0, -1);
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

type UnauthorizedHandler = () => void;

interface FetchOptions {
  token?: string | null;
  onUnauthorized?: UnauthorizedHandler;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  options: FetchOptions = {}
): Promise<T> {
  const headers = new Headers(init.headers);
  const hasBody = init.body !== undefined && init.body !== null;
  if (hasBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }

  const response = await fetch(joinUrl(API_BASE_URL, path), { ...init, headers });

  const rawText = await response.text();
  let data: unknown = null;
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = rawText;
    }
  }

  if (!response.ok) {
    const messageFromData =
      (data && typeof data === 'object' && 'message' in data && typeof (data as { message?: unknown }).message === 'string'
        ? (data as { message?: string }).message
        : null) ||
      (typeof data === 'string' ? data : null) ||
      response.statusText ||
      `Request failed (${response.status})`;

    if (response.status === 401) {
      options.onUnauthorized?.();
    }

    throw new Error(messageFromData);
  }

  return data as T;
}

export function loginRequest(email: string, password: string) {
  return apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
}
