import { AuthResponse } from '../types/auth';

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export const API_BASE_URL = configuredApiBaseUrl || '/api';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly responseBody: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function joinUrl(base: string, path: string) {
  if (base.endsWith('/')) base = base.slice(0, -1);
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

type UnauthorizedHandler = () => void;

interface FetchOptions {
  token?: string | null;
  onUnauthorized?: UnauthorizedHandler;
}

type InflightEntry = {
  controller: AbortController;
  requestId: number;
  promise: Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

const inflightRequests = new Map<string, InflightEntry>();

const isAbortError = (err: unknown) =>
  Boolean(
    err &&
      typeof err === 'object' &&
      'name' in err &&
      (err as { name?: string }).name === 'AbortError'
  );

const attachAbortSignal = (signal: AbortSignal | null | undefined, controller: AbortController) => {
  if (!signal) return;
  if (signal.aborted) {
    controller.abort();
    return;
  }
  signal.addEventListener('abort', () => controller.abort(), { once: true });
};

const createInflightEntry = (): InflightEntry => {
  const entry = {
    controller: new AbortController(),
    requestId: 1,
    promise: Promise.resolve(),
    resolve: () => {},
    reject: () => {}
  } satisfies Omit<InflightEntry, 'promise'> & { promise: Promise<unknown> };
  entry.promise = new Promise((resolve, reject) => {
    entry.resolve = resolve;
    entry.reject = reject;
  });
  return entry;
};

const doFetch = async <T>(
  url: string,
  init: RequestInit,
  options: FetchOptions,
  signal?: AbortSignal
): Promise<T> => {
  const headers = new Headers(init.headers);
  const hasBody = init.body !== undefined && init.body !== null;
  if (hasBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }

  let response: Response;
  try {
    response = await fetch(url, { ...init, credentials: 'include', headers, signal });
  } catch (err) {
    if (isAbortError(err)) {
      throw err;
    }
    throw new Error('Tidak dapat terhubung ke layanan. Silakan coba lagi.');
  }

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
      (data &&
      typeof data === 'object' &&
      'message' in data &&
      typeof (data as { message?: unknown }).message === 'string'
        ? (data as { message?: string }).message
        : null) ||
      (typeof data === 'string' ? data : null) ||
      response.statusText ||
      `Request failed (HTTP ${response.status})`;

    if (response.status === 401) {
      options.onUnauthorized?.();
    }

    throw new ApiError(messageFromData, response.status, data);
  }

  return data as T;
};

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  options: FetchOptions = {}
): Promise<T> {
  const url = joinUrl(API_BASE_URL, path);
  const method = (init.method ?? 'GET').toUpperCase();
  const key = `${method} ${url}`;
  const shouldLock = method === 'GET' || method === 'HEAD';

  if (!shouldLock) {
    return doFetch<T>(url, init, options, init.signal ?? undefined);
  }

  let entry = inflightRequests.get(key);
  if (entry) {
    return entry.promise as Promise<T>;
  }
  entry = createInflightEntry();
  inflightRequests.set(key, entry);

  const requestId = entry.requestId;
  const controller = new AbortController();
  entry.controller = controller;
  attachAbortSignal(init.signal, controller);

  void (async () => {
    try {
      const data = await doFetch<T>(url, init, options, controller.signal);
      if (entry && entry.requestId !== requestId) return;
      inflightRequests.delete(key);
      entry?.resolve(data);
    } catch (err) {
      if (entry && entry.requestId !== requestId) return;
      inflightRequests.delete(key);
      entry?.reject(err);
    }
  })();

  return entry.promise as Promise<T>;
}

export function loginRequest(email: string, password: string) {
  return apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
}

export function anonymousLoginRequest(login_id: string, password: string) {
  return apiFetch<AuthResponse>('/auth/anonymous/login', { method: 'POST', body: JSON.stringify({ login_id, password }) });
}

export type AnonymousCredentials = { public_id: string; login_id: string; alias: string; recovery_code: string };
export function registerAnonymousRequest(body: Record<string, unknown>) {
  return apiFetch<AnonymousCredentials>('/auth/anonymous/register', { method: 'POST', body: JSON.stringify(body) });
}
export function recoverAnonymousRequest(body: Record<string, unknown>) {
  return apiFetch<{ recovery_code: string }>('/auth/anonymous/recover', { method: 'POST', body: JSON.stringify(body) });
}

export type AccountProfile = { public_id: string; login_id: string | null; display_alias: string; account_mode: 'LEGACY' | 'ANONYMOUS'; avatar_key: string | null; preferred_language: string; timezone: string; accessibility_preferences?: Record<string, boolean> | null; notification_preferences?: Record<string, boolean> | null; recovery_enabled: boolean; role: string; created_at: string };
export function getAccountProfileRequest(token: string) { return apiFetch<AccountProfile>('/account/profile', {}, { token }); }
export function updateAccountProfileRequest(token: string, body: Record<string, unknown>) { return apiFetch<AccountProfile>('/account/profile', { method: 'PUT', body: JSON.stringify(body) }, { token }); }
export function changePasswordRequest(token: string, body: Record<string, unknown>) { return apiFetch<void>('/account/password', { method: 'POST', body: JSON.stringify(body) }, { token }); }
export function regenerateRecoveryRequest(token: string, password: string) { return apiFetch<{ recovery_code: string }>('/account/recovery-code/regenerate', { method: 'POST', body: JSON.stringify({ password }) }, { token }); }
export function logoutAllRequest(token: string) { return apiFetch<void>('/account/logout-all', { method: 'POST' }, { token }); }
export function convertAnonymousRequest(token: string, body: Record<string, unknown>) { return apiFetch<AnonymousCredentials>('/account/convert-anonymous', { method: 'POST', body: JSON.stringify(body) }, { token }); }

export const MANAGED_USER_ROLES = ['PASIEN', 'DOKTER', 'ADMIN', 'COUNSELOR', 'COMPLAINT_OFFICER', 'SUPERVISOR'] as const;
export type ManagedUserRole = typeof MANAGED_USER_ROLES[number];
export type AdminUser = { public_id: string; display_alias: string; full_name?: string; email?: string | null; account_mode: 'LEGACY' | 'ANONYMOUS'; role: ManagedUserRole; is_superadmin: boolean; is_active: boolean; is_self: boolean; can_manage: boolean; created_at: string; updated_at: string };
export type AdminUserList = { items: AdminUser[]; total: number; page: number; pageSize: number; is_superadmin: boolean };
export function adminUsersRequest(token: string, page: number, search: string, role = '', status = '') { return apiFetch<AdminUserList>(`/admin/users?page=${page}&pageSize=20&search=${encodeURIComponent(search)}&role=${encodeURIComponent(role)}&status=${encodeURIComponent(status)}`, {}, { token }); }
export function adminUserDetailRequest(token: string, publicId: string) { return apiFetch<AdminUser>(`/admin/users/${encodeURIComponent(publicId)}`, {}, { token }); }
export function adminCreateUserRequest(token: string, body: {email:string;full_name:string;display_alias?:string;role:ManagedUserRole;password:string;password_confirmation:string;is_active?:boolean}) { return apiFetch<AdminUser>('/admin/users', { method: 'POST', body: JSON.stringify(body) }, { token }); }
export function adminUpdateUserRequest(token: string, publicId: string, body: {full_name?:string;display_alias?:string|null;role?:ManagedUserRole}) { return apiFetch<AdminUser>(`/admin/users/${encodeURIComponent(publicId)}`, { method: 'PATCH', body: JSON.stringify(body) }, { token }); }
export function adminUserStatusRequest(token: string, publicId: string, is_active: boolean) { return apiFetch<{ public_id: string; is_active: boolean }>(`/admin/users/${encodeURIComponent(publicId)}/status`, { method: 'PUT', body: JSON.stringify({ is_active }) }, { token }); }
export function adminResetUserPasswordRequest(token: string, publicId: string, new_password: string, password_confirmation: string) { return apiFetch<{success:boolean}>(`/admin/users/${encodeURIComponent(publicId)}/reset-password`, { method: 'POST', body: JSON.stringify({ new_password, password_confirmation }) }, { token }); }
export function adminRevokeUserSessionsRequest(token: string, publicId: string) { return apiFetch<{success:boolean}>(`/admin/users/${encodeURIComponent(publicId)}/revoke-sessions`, { method: 'POST' }, { token }); }

function readCookie(name: string) {
  const prefix = `${encodeURIComponent(name)}=`;
  const value = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return value ? decodeURIComponent(value.slice(prefix.length)) : null;
}

function csrfHeaders() {
  const token = readCookie('sehaticare_csrf');
  const headers = new Headers();
  if (token) headers.set('X-CSRF-Token', token);
  return headers;
}

export function refreshSessionRequest() {
  return apiFetch<AuthResponse>('/auth/refresh', {
    method: 'POST',
    headers: csrfHeaders()
  });
}

export function logoutRequest(options?: { keepalive?: boolean }) {
  return apiFetch<void>('/auth/logout', {
    method: 'POST',
    headers: csrfHeaders(),
    ...(options?.keepalive ? { keepalive: true } : {})
  });
}

export function getPrivacyPreferencesRequest(token: string) {
  return apiFetch<import('../types/privacy').PrivacyPreferences>('/me/privacy-preferences', {}, { token });
}

export function updatePrivacyPreferencesRequest(token: string, body: import('../types/privacy').PrivacyPreferencesPatch) {
  return apiFetch<import('../types/privacy').PrivacyPreferences>('/me/privacy-preferences', {
    method: 'PATCH',
    body: JSON.stringify(body)
  }, { token });
}

export function reauthenticateRequest(token: string, password: string) {
  return apiFetch<{ ok: boolean; reauthenticated_at: string; expires_in_seconds: number }>(
    '/auth/re-authenticate',
    {
      method: 'POST',
      body: JSON.stringify({ password })
    },
    { token }
  );
}
