import crypto from 'node:crypto';

export const REFRESH_COOKIE_NAME = 'sehaticare_refresh';
export const CSRF_COOKIE_NAME = 'sehaticare_csrf';
export const CSRF_HEADER_NAME = 'x-csrf-token';

export function getRefreshCookieOptions(nodeEnv: string, ttlDays: number) {
  return {
    path: '/auth',
    httpOnly: true,
    secure: nodeEnv === 'production',
    sameSite: 'strict' as const,
    maxAge: ttlDays * 24 * 60 * 60
  };
}

export function getCsrfCookieOptions(nodeEnv: string, ttlDays: number) {
  return {
    path: '/',
    httpOnly: false,
    secure: nodeEnv === 'production',
    sameSite: 'strict' as const,
    maxAge: ttlDays * 24 * 60 * 60
  };
}

export function createCsrfToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function isValidCsrfToken(headerValue: string | undefined, cookieValue: string | undefined) {
  if (!headerValue || !cookieValue) return false;
  const header = Buffer.from(headerValue);
  const cookie = Buffer.from(cookieValue);
  return header.length === cookie.length && crypto.timingSafeEqual(header, cookie);
}
