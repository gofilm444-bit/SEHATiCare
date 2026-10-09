export const CACHE_NAMES = {
  SHELL: 'sehaticare-shell-v1',
  STATIC: 'sehaticare-static-v1',
  PUBLIC_CONTENT: 'sehaticare-public-v1'
} as const;

export const ALL_CACHES = Object.values(CACHE_NAMES);

export const OFFLINE_SAFE_MARKER_HEADER = 'x-sehaticare-offline-safe';

/**
 * Public UI routes that are explicitly safe to navigate while offline
 * and can be rendered using the cached neutral public application shell.
 */
export const PUBLIC_OFFLINE_SAFE_ROUTES = [
  '/',
  '/edukasi',
  '/informasi-layanan'
] as const;

/**
 * Private / authenticated routes that MUST NEVER receive cached application UI
 * or cached data. They must remain strictly NETWORK ONLY.
 */
export const PRIVATE_ROUTE_PREFIXES = [
  '/patient',
  '/doctor',
  '/admin',
  '/counselor',
  '/companion',
  '/outreach',
  '/complaint-officer',
  '/supervisor',
  '/counselor-application',
  '/account'
] as const;

/**
 * Public unauthenticated routes that involve credentials, tokens, or complaints.
 * These are NOT safe to cache offline and must remain NETWORK ONLY.
 */
export const SENSITIVE_UNAUTHENTICATED_PREFIXES = [
  '/login',
  '/register',
  '/register-counselor',
  '/recover-account',
  '/complaints'
] as const;

/**
 * Normalizes a pathname by stripping trailing slashes.
 */
export function normalizePathname(pathname: string): string {
  const trimmed = pathname.trim();
  if (trimmed === '' || trimmed === '/') return '/';
  return trimmed.replace(/\/+$/, '');
}

/**
 * Verifies if a UI navigation route is eligible for offline shell presentation.
 */
export function isPublicOfflineSafeRoute(rawPathname: string): boolean {
  const path = normalizePathname(rawPathname);

  // Exact public root and top-level pages
  if (path === '/' || path === '/edukasi' || path === '/informasi-layanan') {
    return true;
  }

  // Public education nested routes: /edukasi/:slug or /edukasi/video/:videoId
  if (path.startsWith('/edukasi/')) {
    return true;
  }

  return false;
}

/**
 * Verifies if a UI route belongs to an authenticated or private family.
 */
export function isPrivateNetworkOnlyRoute(rawPathname: string): boolean {
  const path = normalizePathname(rawPathname);
  return PRIVATE_ROUTE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/**
 * Verifies if a UI route is unauthenticated but sensitive (auth/complaint flows).
 */
export function isSensitiveUnauthenticatedRoute(rawPathname: string): boolean {
  const path = normalizePathname(rawPathname);
  return SENSITIVE_UNAUTHENTICATED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/**
 * Paths under /api or root that are genuinely public and safe for offline caching.
 */
const PUBLIC_API_EXACT_OR_PREFIXES = [
  '/public/portal',
  '/public/articles',
  '/public/videos',
  '/public/service-facilities',
  '/public/facilities',
  '/public/regions',
  '/public/content-categories',
  '/public/statistics'
];

/**
 * Allowed query parameters for public cached content (enums, pagination, ids).
 * Any unknown query key causes immediate rejection (NETWORK ONLY / NEVER CACHE).
 */
export const ALLOWED_PUBLIC_QUERY_KEYS = [
  'limit',
  'page',
  'pageSize',
  'regionId',
  'region_id',
  'type',
  'service',
  'service_type',
  'year',
  'periodType',
  'category'
] as const;

export const ALLOWED_QUERY_KEYS = new Set(ALLOWED_PUBLIC_QUERY_KEYS);

/**
 * Strict validators for allowed public query parameter values.
 * Arbitrary text, tokens, long strings, multiline, or malformed enums are rejected.
 */
export const PUBLIC_QUERY_VALUE_VALIDATORS: Record<string, (val: string) => boolean> = {
  page: (val) => /^[1-9][0-9]{0,3}$/.test(val) && Number(val) <= 1000,
  limit: (val) => /^[1-9][0-9]{0,2}$/.test(val) && Number(val) <= 200,
  pageSize: (val) => /^[1-9][0-9]{0,2}$/.test(val) && Number(val) <= 200,
  year: (val) => /^20[2-9][0-9]$/.test(val),
  periodType: (val) => /^(?:MONTHLY|QUARTERLY|SEMESTER|YEARLY)$/.test(val),
  type: (val) => /^(?:PUSKESMAS|RUMAH_SAKIT|KLINIK)$/.test(val),
  service: (val) => /^(?:COUNSELING|HIV_TESTING|ARV_SERVICE|DISABILITY_ACCESS|PHARMACY)$/.test(val),
  service_type: (val) => /^[A-Z_]{3,32}$/.test(val),
  regionId: (val) => /^[a-zA-Z0-9_-]{1,64}$/.test(val),
  region_id: (val) => /^[a-zA-Z0-9_-]{1,64}$/.test(val),
  category: (val) => /^[a-z0-9-]{1,64}$/.test(val)
};

/**
 * Inspects URL search parameters:
 * 1. Denies any unknown parameter name (never cache unknown queries).
 * 2. Enforces strict shape/bounds on all parameter values.
 */
export function isAllowedPublicQueryParams(searchParams: URLSearchParams): boolean {
  for (const [key, value] of searchParams.entries()) {
    if (!ALLOWED_QUERY_KEYS.has(key as any)) {
      return false;
    }
    const validator = PUBLIC_QUERY_VALUE_VALIDATORS[key];
    if (!validator || !validator(value)) {
      return false;
    }
  }
  return true;
}

/**
 * Strips `/api` prefix if present for uniform route matching.
 */
export function stripApiPrefix(pathname: string): string {
  if (pathname.startsWith('/api/')) {
    return pathname.slice(4);
  }
  if (pathname === '/api') {
    return '/';
  }
  return pathname;
}

/**
 * Verifies Gate 1: Public API request path and method safety.
 * Only GET requests may enter CacheStorage; HEAD and non-GET are strictly NETWORK ONLY.
 */
export function isPublicOfflineSafeApiRequest(
  urlOrString: URL | string,
  options?: {
    method?: string;
    headers?: HeadersInit | Headers;
  }
): boolean {
  const method = (options?.method ?? 'GET').toUpperCase();
  if (method !== 'GET') {
    return false;
  }

  // Deny if Authorization header exists
  if (options?.headers) {
    const headers = options.headers instanceof Headers
      ? options.headers
      : new Headers(options.headers);
    if (headers.has('authorization') || headers.has('Authorization')) {
      return false;
    }
  }

  const parsedUrl = typeof urlOrString === 'string'
    ? new URL(urlOrString, 'http://localhost')
    : urlOrString;

  const rawPath = parsedUrl.pathname;
  const canonicalPath = stripApiPrefix(rawPath);

  // Explicit blacklist: playback / streaming signed URLs are NEVER cached
  if (canonicalPath.includes('/playback')) {
    return false;
  }

  // Check if query params are privacy-safe (reject unknown keys and invalid shapes)
  if (parsedUrl.search && !isAllowedPublicQueryParams(parsedUrl.searchParams)) {
    return false;
  }

  // Must match explicit public API paths
  const matchesAllowlist = PUBLIC_API_EXACT_OR_PREFIXES.some((allowed) => {
    return canonicalPath === allowed || canonicalPath.startsWith(`${allowed}/`);
  });

  return matchesAllowlist;
}

/**
 * Verifies Gate 2: Server response marker and Cache-Control headers.
 */
export function isPublicOfflineSafeApiResponse(
  responseOrHeaders: {
    status?: number;
    headers: Headers | Record<string, string>;
  }
): boolean {
  const status = responseOrHeaders.status ?? 200;
  if (status !== 200) {
    return false;
  }

  const getHeader = (name: string): string | null => {
    const headers = responseOrHeaders.headers;
    if (headers instanceof Headers) {
      return headers.get(name);
    }
    const lowerName = name.toLowerCase();
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === lowerName) {
        return headers[key];
      }
    }
    return null;
  };

  // Must have offline-safe marker header
  const marker = getHeader(OFFLINE_SAFE_MARKER_HEADER);
  if (marker !== '1') {
    return false;
  }

  // Must not have no-store or private Cache-Control
  const cacheControl = getHeader('cache-control') || '';
  if (cacheControl.includes('no-store') || cacheControl.includes('private')) {
    return false;
  }

  return true;
}

/**
 * Combined Gate 1 + Gate 2 check for caching an API response.
 */
export function canCacheApiResponse(
  request: {
    method?: string;
    url: string | URL;
    headers?: HeadersInit | Headers;
  },
  response: {
    status?: number;
    headers: Headers | Record<string, string>;
  }
): boolean {
  if (!isPublicOfflineSafeApiRequest(request.url, { method: request.method, headers: request.headers })) {
    return false;
  }
  return isPublicOfflineSafeApiResponse(response);
}

/**
 * Verifies if a resource URL is a static asset safe for Cache-First handling.
 */
export function isStaticAssetUrl(pathname: string): boolean {
  const path = normalizePathname(pathname);

  // Exclude signed attachments or user uploads
  if (
    path.includes('/voice-notes/') ||
    path.includes('/complaint-attachments/') ||
    path.includes('/documents/') ||
    path.includes('/playback/') ||
    path.includes('/uploads/')
  ) {
    return false;
  }

  if (
    path.startsWith('/assets/') ||
    path.startsWith('/brand/') ||
    path === '/manifest.webmanifest' ||
    path === '/favicon.ico' ||
    path === '/offline.html'
  ) {
    return true;
  }

  return false;
}
