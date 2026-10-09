/* eslint-disable no-restricted-globals */
// SEHATiCare Custom Service Worker — AG-10 / AG-10A
// Security Principle: DENY BY DEFAULT + EXPLICIT PUBLIC ALLOWLIST.
// NEVER cache private, clinical, or authenticated data.

const SHELL_CACHE = 'sehaticare-shell-v1';
const STATIC_CACHE = 'sehaticare-static-v1';
const PUBLIC_CONTENT_CACHE = 'sehaticare-public-v1';
const ALL_CURRENT_CACHES = [SHELL_CACHE, STATIC_CACHE, PUBLIC_CONTENT_CACHE];

const MAX_PUBLIC_ENTRIES = 50;

const PRECACHE_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.webmanifest',
  '/brand/app-icon-192.png',
  '/brand/app-icon-512.png',
  '/brand/hero-counselor-anonymous-v2.jpg'
];

// Explicit Public UI Navigation routes eligible for offline public shell
function isPublicOfflineSafeRoute(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/' || path === '/edukasi' || path === '/informasi-layanan') {
    return true;
  }
  if (path.startsWith('/edukasi/')) {
    return true;
  }
  return false;
}

// Explicit Public API paths eligible for Gate 1
const PUBLIC_API_PATHS = [
  '/public/portal',
  '/public/articles',
  '/public/videos',
  '/public/service-facilities',
  '/public/facilities',
  '/public/regions',
  '/public/content-categories',
  '/public/statistics'
];

// Allowed query parameter keys for public cached content (enums, pagination, ids).
// Any unknown query parameter causes immediate rejection (NETWORK ONLY / NEVER CACHE).
const ALLOWED_PUBLIC_QUERY_KEYS = [
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
];

// Strict validators for allowed public query parameter values.
// Arbitrary text, tokens, long strings, multiline, or malformed enums are rejected.
const PUBLIC_QUERY_VALUE_VALIDATORS = {
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

function stripApiPrefix(pathname) {
  if (pathname.startsWith('/api/')) {
    return pathname.slice(4);
  }
  if (pathname === '/api') {
    return '/';
  }
  return pathname;
}

function isAllowedPublicQueryParams(searchParams) {
  for (const [key, value] of searchParams.entries()) {
    if (!ALLOWED_PUBLIC_QUERY_KEYS.includes(key)) {
      return false;
    }
    const validator = PUBLIC_QUERY_VALUE_VALIDATORS[key];
    if (!validator || !validator(value)) {
      return false;
    }
  }
  return true;
}

function isPublicApiCandidate(url) {
  const canonical = stripApiPrefix(url.pathname);
  if (canonical.includes('/playback')) {
    return false;
  }
  if (!isAllowedPublicQueryParams(url.searchParams)) {
    return false;
  }
  return PUBLIC_API_PATHS.some((prefix) => canonical === prefix || canonical.startsWith(prefix + '/'));
}

function isStaticAsset(pathname) {
  const p = pathname.toLowerCase();
  if (
    p.includes('/voice-notes/') ||
    p.includes('/complaint-attachments/') ||
    p.includes('/documents/') ||
    p.includes('/playback/') ||
    p.includes('/uploads/')
  ) {
    return false;
  }
  return (
    p.startsWith('/assets/') ||
    p.startsWith('/brand/') ||
    p === '/manifest.webmanifest' ||
    p === '/favicon.ico' ||
    p === '/offline.html'
  );
}

// Bound cache size to prevent unlimited growth
async function trimCache(cacheName, maxEntries) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxEntries) {
      const excess = keys.length - maxEntries;
      for (let i = 0; i < excess; i++) {
        await cache.delete(keys[i]);
      }
    }
  } catch {
    // ignore
  }
}

// ------------------------------------------------------------------
// Lifecycle: install
// Precache critical public assets. Do NOT call skipWaiting() here so
// that a waiting worker forms naturally, allowing user-controlled update UX.
// ------------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      try {
        await cache.addAll(PRECACHE_ASSETS);
      } catch (err) {
        console.warn('[SW] Precache asset fetch failure:', err);
      }
    })
  );
});

// ------------------------------------------------------------------
// Lifecycle: activate
// Clean up outdated caches and claim existing clients.
// ------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key.startsWith('sehaticare-') && !ALL_CURRENT_CACHES.includes(key)) {
            return caches.delete(key);
          }
          return Promise.resolve(false);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ------------------------------------------------------------------
// Lifecycle: message
// Activated when user clicks "Perbarui" in the update banner.
// ------------------------------------------------------------------
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ------------------------------------------------------------------
// Lifecycle: fetch (DENY BY DEFAULT)
// ------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Rule 1: Only GET requests may enter CacheStorage; non-GET (including HEAD) are strictly NETWORK ONLY
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Rule 2: Non-http/https ignored
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // Rule 3: Cross-origin is NETWORK ONLY
  if (url.origin !== self.location.origin) {
    return;
  }

  // Rule 4: Requests with Authorization header are strictly NETWORK ONLY
  if (request.headers.has('Authorization') || request.headers.has('authorization')) {
    return;
  }

  // ----------------------------------------------------------------
  // CASE A: Navigation Requests (request.mode === 'navigate')
  // ----------------------------------------------------------------
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request, url));
    return;
  }

  // ----------------------------------------------------------------
  // CASE B: Static Assets (Cache-First)
  // ----------------------------------------------------------------
  if (isStaticAsset(url.pathname)) {
    event.respondWith(handleStaticAsset(request));
    return;
  }

  // ----------------------------------------------------------------
  // CASE C: Public Content API (Two-Gate: Gate 1 URL + Gate 2 Marker)
  // ----------------------------------------------------------------
  if (isPublicApiCandidate(url)) {
    event.respondWith(handlePublicApi(request));
    return;
  }

  // ----------------------------------------------------------------
  // CASE D: All other requests (Private routes, unknown paths)
  // Strictly NETWORK ONLY — no caching, no fallback.
  // ----------------------------------------------------------------
});

async function handleNavigation(request, url) {
  const isPublic = isPublicOfflineSafeRoute(url.pathname);

  if (isPublic) {
    try {
      const response = await fetch(request);
      // ONLY update root shell if the navigation response is genuinely for root '/'
      if (response && response.ok && (url.pathname === '/' || url.pathname === '')) {
        const shellCache = await caches.open(SHELL_CACHE);
        await shellCache.put('/', response.clone());
      }
      return response;
    } catch {
      // Offline fallback for public navigation: return cached public shell or offline.html specifically from SHELL_CACHE
      const shellCache = await caches.open(SHELL_CACHE);
      const cachedShell = await shellCache.match('/');
      if (cachedShell) return cachedShell;
      const cachedOffline = await shellCache.match('/offline.html');
      if (cachedOffline) return cachedOffline;
      return new Response('Koneksi tidak tersedia.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  }

  // PRIVATE / UNAPPROVED NAVIGATION: NETWORK ONLY
  // If network fails, serve neutral offline fallback specifically from SHELL_CACHE.
  // NEVER serve cached public shell or old private page!
  try {
    return await fetch(request);
  } catch {
    const shellCache = await caches.open(SHELL_CACHE);
    const cachedOffline = await shellCache.match('/offline.html');
    if (cachedOffline) return cachedOffline;
    return new Response('Koneksi diperlukan untuk membuka layanan pribadi.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

async function handleStaticAsset(request) {
  const staticCache = await caches.open(STATIC_CACHE);
  const cached = await staticCache.match(request);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await staticCache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    throw err;
  }
}

async function handlePublicApi(request) {
  // Network-First with timeout (3500ms) + Safe Cache Fallback
  const timeoutMs = 3500;
  let timeoutId;

  const networkPromise = (async () => {
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(request, { signal: controller.signal });
      clearTimeout(timeoutId);

      // GATE 2: Server response verification
      const isSafeMarker = response.headers.get('x-sehaticare-offline-safe') === '1';
      const cacheControl = response.headers.get('cache-control') || '';
      const isNotNoStore = !cacheControl.includes('no-store') && !cacheControl.includes('private');

      if (response.ok && isSafeMarker && isNotNoStore) {
        const publicCache = await caches.open(PUBLIC_CONTENT_CACHE);
        await publicCache.put(request, response.clone());
        void trimCache(PUBLIC_CONTENT_CACHE, MAX_PUBLIC_ENTRIES);
      }

      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  })();

  try {
    return await networkPromise;
  } catch {
    // Network failed or timed out: Fallback to safe public cached response specifically from PUBLIC_CONTENT_CACHE
    const publicCache = await caches.open(PUBLIC_CONTENT_CACHE);
    const cached = await publicCache.match(request);
    if (cached) {
      return cached;
    }
    // Fail cleanly if not in cache
    return new Response(
      JSON.stringify({ message: 'Koneksi terbatas dan konten belum tersimpan.' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
