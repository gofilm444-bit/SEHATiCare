import { AuthResponse } from '../types/auth';

export const API_BASE_URL = '/api';

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
    response = await fetch(url, { ...init, headers, signal });
  } catch (err) {
    if (isAbortError(err)) {
      throw err;
    }
    console.debug('[apiFetch] network error', { url, method: init.method ?? 'GET', err });
    throw new Error(`Failed to fetch (${url})`);
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
    console.debug('[apiFetch] bad response', { url, status: response.status, statusText: response.statusText });
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

    throw new Error(`${messageFromData} (HTTP ${response.status})`);
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
    return doFetch<T>(url, init, options, init.signal);
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
