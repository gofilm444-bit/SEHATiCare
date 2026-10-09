import { describe, it, expect, vi } from 'vitest';
import swSource from '../../public/sw.js?raw';
import {
  isPublicOfflineSafeApiRequest,
  isAllowedPublicQueryParams as tsIsAllowedQueryParams,
  CACHE_NAMES,
  ALL_CACHES
} from './cachePolicy';

describe('AG-10A Service Worker Runtime Policy Parity & Cache-Key Privacy Audit', () => {
  describe('Static Source Security Audit of public/sw.js', () => {
    it('does not contain blacklist-only query key logic', () => {
      // Must not rely on a blacklist like DISALLOWED_QUERY_KEYS
      expect(swSource).not.toContain('const DISALLOWED_QUERY_KEYS');
      expect(swSource).not.toContain('let DISALLOWED_QUERY_KEYS');
      expect(swSource).not.toContain('var DISALLOWED_QUERY_KEYS');
      expect(swSource).not.toContain('hasDisallowedQuery');
    });

    it('implements explicit allowed query keys allowlist and value validators', () => {
      expect(swSource).toContain('ALLOWED_PUBLIC_QUERY_KEYS');
      expect(swSource).toContain('PUBLIC_QUERY_VALUE_VALIDATORS');
      expect(swSource).toContain('isAllowedPublicQueryParams');
    });

    it('strictly restricts fetch handler to GET requests only', () => {
      // Must reject non-GET including HEAD requests
      expect(swSource).toContain("if (request.method !== 'GET')");
      expect(swSource).not.toContain("request.method !== 'HEAD'");
    });

    it('does not unconditionally call skipWaiting() during install lifecycle', () => {
      // Find install listener
      const installMatch = swSource.match(/addEventListener\(\s*['"]install['"][\s\S]*?\n\}\);/);
      expect(installMatch).toBeTruthy();
      const installCode = installMatch![0];
      expect(installCode).not.toContain('skipWaiting()');
    });

    it('retains skipWaiting() on message event for user-initiated update UX', () => {
      const messageMatch = swSource.match(/addEventListener\(\s*['"]message['"][\s\S]*?\n\}\);/);
      expect(messageMatch).toBeTruthy();
      const messageCode = messageMatch![0];
      expect(messageCode).toContain('SKIP_WAITING');
      expect(messageCode).toContain('self.skipWaiting()');
    });

    it('restricts root shell cache updates to requests for pathname "/"', () => {
      expect(swSource).toMatch(/url\.pathname === '\/'/);
    });

    it('excludes /uploads/ from static asset caching', () => {
      expect(swSource).toContain("p.includes('/uploads/')");
    });
  });

  describe('Runtime Policy Execution & Parity with cachePolicy.ts', () => {
    // Helper to evaluate sw.js isolated functions in an execution context
    function createSwSandbox() {
      const mockSelf: Record<string, any> = {
        location: { origin: 'http://localhost' },
        addEventListener: vi.fn(),
        clients: { claim: vi.fn().mockResolvedValue(undefined) },
        skipWaiting: vi.fn()
      };

      // Wrap sw.js into a function closure exposing its top-level functions
      const scriptWithExports = `
        ${swSource}
        return {
          isPublicApiCandidate,
          isAllowedPublicQueryParams,
          isStaticAsset,
          isPublicOfflineSafeRoute
        };
      `;

      const fn = new Function('self', 'caches', scriptWithExports);
      const exports = fn(mockSelf, {});
      return { ...exports, self: mockSelf };
    }

    it('reproduces and fixes the runtime query policy drift', () => {
      const sw = createSwSandbox();
      const isPublicApiCandidate = sw.isPublicApiCandidate as (url: URL) => boolean;
      const isAllowedPublicQueryParams = sw.isAllowedPublicQueryParams as (params: URLSearchParams) => boolean;

      // Case A: /api/public/portal (no query) => candidate
      const urlA = new URL('http://localhost/api/public/portal');
      expect(isPublicApiCandidate(urlA)).toBe(true);
      expect(isPublicOfflineSafeApiRequest(urlA)).toBe(true);

      // Case B: /api/public/portal?foo=private-value => MUST NOT be candidate
      const urlB = new URL('http://localhost/api/public/portal?foo=private-value');
      expect(isPublicApiCandidate(urlB)).toBe(false);
      expect(isPublicOfflineSafeApiRequest(urlB)).toBe(false);
      expect(isAllowedPublicQueryParams(urlB.searchParams)).toBe(false);
      expect(tsIsAllowedQueryParams(urlB.searchParams)).toBe(false);

      // Case C: /api/public/articles?q=sensitive => MUST NOT be candidate
      const urlC = new URL('http://localhost/api/public/articles?q=sensitive');
      expect(isPublicApiCandidate(urlC)).toBe(false);
      expect(isPublicOfflineSafeApiRequest(urlC)).toBe(false);
      expect(isAllowedPublicQueryParams(urlC.searchParams)).toBe(false);

      // Case D: /api/public/articles?search=sensitive => MUST NOT be candidate
      const urlD = new URL('http://localhost/api/public/articles?search=sensitive');
      expect(isPublicApiCandidate(urlD)).toBe(false);
      expect(isPublicOfflineSafeApiRequest(urlD)).toBe(false);
      expect(isAllowedPublicQueryParams(urlD.searchParams)).toBe(false);

      // Case E: /api/public/articles?token=secret => MUST NOT be candidate
      const urlE = new URL('http://localhost/api/public/articles?token=secret');
      expect(isPublicApiCandidate(urlE)).toBe(false);
      expect(isPublicOfflineSafeApiRequest(urlE)).toBe(false);
      expect(isAllowedPublicQueryParams(urlE.searchParams)).toBe(false);

      // Case F: /api/public/service-facilities?unknown=something => MUST NOT be candidate
      const urlF = new URL('http://localhost/api/public/service-facilities?unknown=something');
      expect(isPublicApiCandidate(urlF)).toBe(false);
      expect(isPublicOfflineSafeApiRequest(urlF)).toBe(false);
      expect(isAllowedPublicQueryParams(urlF.searchParams)).toBe(false);

      // Case G: known safe structured query => eligible
      const urlG = new URL('http://localhost/api/public/service-facilities?limit=20&page=1');
      expect(isPublicApiCandidate(urlG)).toBe(true);
      expect(isPublicOfflineSafeApiRequest(urlG)).toBe(true);
      expect(isAllowedPublicQueryParams(urlG.searchParams)).toBe(true);
      expect(tsIsAllowedQueryParams(urlG.searchParams)).toBe(true);
    });

    it('enforces identical query key & value validation between sw.js and cachePolicy.ts', () => {
      const sw = createSwSandbox();
      const swIsAllowed = sw.isAllowedPublicQueryParams as (params: URLSearchParams) => boolean;

      const testQueries = [
        // Unknown keys
        'foo=bar',
        'q=test',
        'search=text',
        'token=123',
        'code=abc',
        'email=user@test.org',
        'phone=0812345678',
        'password=pass',
        'note=hello',
        'name=patient',
        'address=home',
        // Out of bounds / malformed values
        'limit=0',
        'limit=201',
        'limit=abc',
        'limit=10%20OR%201=1',
        'page=0',
        'page=-1',
        'page=1001',
        'page=first',
        'year=1999',
        'year=2105',
        'year=invalid',
        'periodType=UNKNOWN',
        'periodType=monthly',
        'type=HOSPITAL',
        'type=puskesmas',
        'service=UNKNOWN',
        'service_type=invalid%20with%20spaces',
        'category=invalid spaces',
        'category=UPPERCASE',
        `category=${'a'.repeat(65)}`,
        `regionId=${'x'.repeat(65)}`,
        'regionId=reg;select',
        // Valid combinations
        '',
        'limit=20',
        'limit=100&page=5',
        'regionId=reg-123&type=KLINIK',
        'service=COUNSELING&year=2026&periodType=MONTHLY',
        'service_type=REFERRAL_INTAKE&region_id=reg_abc',
        'category=edukasi-pencegahan&page=1&limit=10'
      ];

      for (const queryString of testQueries) {
        const params = new URLSearchParams(queryString);
        const swResult = swIsAllowed(params);
        const tsResult = tsIsAllowedQueryParams(params);
        expect(swResult).toBe(tsResult);
      }
    });

    it('enforces static asset classifications identically', () => {
      const sw = createSwSandbox();
      const swIsStatic = sw.isStaticAsset as (pathname: string) => boolean;

      const testAssets = [
        { path: '/assets/index.js', expected: true },
        { path: '/assets/index.css', expected: true },
        { path: '/brand/app-icon-192.png', expected: true },
        { path: '/brand/hero-counselor-anonymous-v2.jpg', expected: true },
        { path: '/manifest.webmanifest', expected: true },
        { path: '/offline.html', expected: true },
        { path: '/favicon.ico', expected: true },
        // Disallowed
        { path: '/voice-notes/audio-123.mp4', expected: false },
        { path: '/complaint-attachments/att-123', expected: false },
        { path: '/documents/license.pdf', expected: false },
        { path: '/playback/video.mp4', expected: false },
        { path: '/uploads/user.png', expected: false }
      ];

      for (const asset of testAssets) {
        expect(swIsStatic(asset.path)).toBe(asset.expected);
      }
    });
  });

  describe('Full Runtime Fetch Handler & CacheStorage Simulation', () => {
    /**
     * In-memory CacheStorage simulation to audit actual persisted cache keys
     */
    function createMockCacheStorage() {
      const cachesMap = new Map<string, Map<string, any>>();

      const mockCacheStorage = {
        open: vi.fn(async (cacheName: string) => {
          if (!cachesMap.has(cacheName)) {
            cachesMap.set(cacheName, new Map());
          }
          const store = cachesMap.get(cacheName)!;

          return {
            put: vi.fn(async (reqOrUrl: any, res: any) => {
              const key = typeof reqOrUrl === 'string' ? reqOrUrl : reqOrUrl.url || reqOrUrl;
              store.set(key, res);
            }),
            match: vi.fn(async (reqOrUrl: any) => {
              const key = typeof reqOrUrl === 'string' ? reqOrUrl : reqOrUrl.url || reqOrUrl;
              return store.get(key) || null;
            }),
            keys: vi.fn(async () => Array.from(store.keys()).map((k) => ({ url: k }))),
            delete: vi.fn(async (keyObj: any) => {
              const k = keyObj?.url || keyObj;
              return store.delete(k);
            })
          };
        }),
        match: vi.fn(async (reqOrUrl: any) => {
          const key = typeof reqOrUrl === 'string' ? reqOrUrl : reqOrUrl.url || reqOrUrl;
          for (const store of cachesMap.values()) {
            if (store.has(key)) return store.get(key);
          }
          return null;
        }),
        keys: vi.fn(async () => Array.from(cachesMap.keys())),
        delete: vi.fn(async (cacheName: string) => cachesMap.delete(cacheName)),
        _map: cachesMap
      };

      return mockCacheStorage;
    }

    it('simulates runtime fetch events and audits that NO unsafe query keys enter CacheStorage', async () => {
      const mockCaches = createMockCacheStorage();
      const mockFetch = vi.fn();

      const listeners: Record<string, Function[]> = {};

      const mockSelf: Record<string, any> = {
        location: { origin: 'http://localhost' },
        addEventListener: (event: string, handler: Function) => {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push(handler);
        },
        clients: { claim: vi.fn().mockResolvedValue(undefined) },
        skipWaiting: vi.fn()
      };

      class MockResponse {
        status: number;
        headers: Headers;
        ok: boolean;
        body: any;
        constructor(body: any, init?: any) {
          this.body = body;
          this.status = init?.status ?? 200;
          this.ok = this.status >= 200 && this.status < 300;
          this.headers = new Headers(init?.headers);
        }
        clone() {
          return new MockResponse(this.body, { status: this.status, headers: this.headers });
        }
      }

      const scriptWithRunner = `
        ${swSource}
      `;

      const fn = new Function('self', 'caches', 'fetch', 'Response', scriptWithRunner);
      fn(mockSelf, mockCaches, mockFetch, MockResponse);

      const fetchListener = listeners['fetch']?.[0];
      expect(fetchListener).toBeDefined();

      async function dispatchFetch(options: {
        method?: string;
        url: string;
        mode?: string;
        headers?: Record<string, string>;
        mockResponseHeaders?: Record<string, string>;
      }) {
        const method = options.method || 'GET';
        const reqHeaders = new Headers(options.headers);
        const req = {
          method,
          url: options.url,
          mode: options.mode || 'cors',
          headers: reqHeaders
        };

        const resHeaders = new Headers({
          'Content-Type': 'application/json',
          'x-sehaticare-offline-safe': '1',
          'cache-control': 'public, max-age=60',
          ...(options.mockResponseHeaders || {})
        });

        mockFetch.mockResolvedValueOnce(new MockResponse('{"ok":true}', { status: 200, headers: resHeaders }));

        let respondWithPromise: Promise<any> | null = null;
        const event = {
          request: req,
          respondWith: (p: Promise<any>) => {
            respondWithPromise = p;
          }
        };

        fetchListener(event);
        if (respondWithPromise) {
          await respondWithPromise;
        }
      }

      // 1. Process candidate with unknown query parameter => MUST NOT BE PUT IN CACHE
      await dispatchFetch({ url: 'http://localhost/api/public/portal?foo=private-value' });

      // 2. Process candidate with search query => MUST NOT BE PUT IN CACHE
      await dispatchFetch({ url: 'http://localhost/api/public/articles?q=sensitive' });

      // 3. Process candidate with token query => MUST NOT BE PUT IN CACHE
      await dispatchFetch({ url: 'http://localhost/api/public/articles?token=secret' });

      // 4. Process candidate with malformed query => MUST NOT BE PUT IN CACHE
      await dispatchFetch({ url: 'http://localhost/api/public/service-facilities?limit=9999' });

      // 5. Process HEAD request on valid public path => MUST NOT BE PUT IN CACHE
      await dispatchFetch({ method: 'HEAD', url: 'http://localhost/api/public/portal' });

      // 6. Process POST request on valid public path => MUST NOT BE PUT IN CACHE
      await dispatchFetch({ method: 'POST', url: 'http://localhost/api/public/portal' });

      // 7. Process Private API request => MUST NOT BE PUT IN CACHE
      await dispatchFetch({ url: 'http://localhost/api/patient/care' });
      await dispatchFetch({ url: 'http://localhost/api/auth/me' });

      // 8. Process Playback video request => MUST NOT BE PUT IN CACHE
      await dispatchFetch({ url: 'http://localhost/api/public/videos/v1/playback' });

      // 9. Process Valid Public API with valid query => MUST BE PUT IN CACHE
      await dispatchFetch({ url: 'http://localhost/api/public/service-facilities?limit=20&page=1' });

      // 10. Process Valid Public API without query => MUST BE PUT IN CACHE
      await dispatchFetch({ url: 'http://localhost/api/public/portal' });

      // 11. Process Public Navigation to sub-route => MUST NOT OVERWRITE '/' in SHELL_CACHE
      await dispatchFetch({ mode: 'navigate', url: 'http://localhost/edukasi/pencegahan-dasar' });

      // 12. Process Public Navigation to root '/' => MUST BE PUT IN SHELL_CACHE
      await dispatchFetch({ mode: 'navigate', url: 'http://localhost/' });

      // -----------------------------------------------------------
      // CACHE INSPECTION: Enumerate actual CacheStorage keys
      // -----------------------------------------------------------
      const publicContentStore = mockCaches._map.get(CACHE_NAMES.PUBLIC_CONTENT) || new Map();
      const shellStore = mockCaches._map.get(CACHE_NAMES.SHELL) || new Map();

      const publicKeys = Array.from(publicContentStore.keys());
      const shellKeys = Array.from(shellStore.keys());

      // Assert expected entries in public cache
      expect(publicKeys).toContain('http://localhost/api/public/portal');
      expect(publicKeys).toContain('http://localhost/api/public/service-facilities?limit=20&page=1');

      // Assert NO unsafe query parameters exist in ANY stored cache key
      for (const key of publicKeys) {
        expect(key).not.toContain('foo=');
        expect(key).not.toContain('q=');
        expect(key).not.toContain('search=');
        expect(key).not.toContain('token=');
        expect(key).not.toContain('code=');
        expect(key).not.toContain('email=');
        expect(key).not.toContain('phone=');
        expect(key).not.toContain('unknown=');
        expect(key).not.toContain('limit=9999');
        expect(key).not.toContain('playback');
        expect(key).not.toContain('patient');
        expect(key).not.toContain('auth');
      }

      // Assert SHELL_CACHE did NOT receive '/edukasi/pencegahan-dasar' under key '/'
      // Root shell was only updated by root '/' navigation
      expect(shellKeys).toContain('/');
      expect(shellKeys).not.toContain('/edukasi/pencegahan-dasar');

      // Assert all cache names used are neutral
      for (const cacheName of mockCaches._map.keys()) {
        expect(cacheName).toMatch(/^sehaticare-[a-z]+-v[0-9]+$/);
        expect(ALL_CACHES).toContain(cacheName);
      }
    });
  });
});
