import { describe, it, expect } from 'vitest';
import {
  CACHE_NAMES,
  ALL_CACHES,
  OFFLINE_SAFE_MARKER_HEADER,
  isPublicOfflineSafeRoute,
  isPrivateNetworkOnlyRoute,
  isSensitiveUnauthenticatedRoute,
  isAllowedPublicQueryParams,
  isPublicOfflineSafeApiRequest,
  isPublicOfflineSafeApiResponse,
  canCacheApiResponse,
  isStaticAssetUrl,
  stripApiPrefix,
  normalizePathname
} from './cachePolicy';

describe('AG-10 Cache Policy & Classification', () => {
  describe('Cache Names Neutrality', () => {
    it('uses neutral cache names without clinical or sensitive health terms', () => {
      const sensitivePatterns = [/hiv/i, /aids/i, /arv/i, /art/i, /odhiv/i, /patient/i, /clinical/i, /referral/i];
      for (const cacheName of ALL_CACHES) {
        expect(cacheName).toMatch(/^sehaticare-[a-z]+-v[0-9]+$/);
        for (const pattern of sensitivePatterns) {
          expect(pattern.test(cacheName)).toBe(false);
        }
      }
      expect(CACHE_NAMES.SHELL).toBe('sehaticare-shell-v1');
      expect(CACHE_NAMES.STATIC).toBe('sehaticare-static-v1');
      expect(CACHE_NAMES.PUBLIC_CONTENT).toBe('sehaticare-public-v1');
    });
  });

  describe('UI Route Classification', () => {
    it('classifies public offline-safe UI routes correctly', () => {
      expect(isPublicOfflineSafeRoute('/')).toBe(true);
      expect(isPublicOfflineSafeRoute('/edukasi')).toBe(true);
      expect(isPublicOfflineSafeRoute('/edukasi/')).toBe(true);
      expect(isPublicOfflineSafeRoute('/edukasi/pencegahan-dasar')).toBe(true);
      expect(isPublicOfflineSafeRoute('/edukasi/video/vid_123')).toBe(true);
      expect(isPublicOfflineSafeRoute('/informasi-layanan')).toBe(true);
      expect(isPublicOfflineSafeRoute('/informasi-layanan/')).toBe(true);
    });

    it('denies private routes from being classified as offline-safe', () => {
      expect(isPublicOfflineSafeRoute('/patient')).toBe(false);
      expect(isPublicOfflineSafeRoute('/patient/care')).toBe(false);
      expect(isPublicOfflineSafeRoute('/patient/consultations')).toBe(false);
      expect(isPublicOfflineSafeRoute('/patient/medication-reminders')).toBe(false);
      expect(isPublicOfflineSafeRoute('/doctor')).toBe(false);
      expect(isPublicOfflineSafeRoute('/doctor/history')).toBe(false);
      expect(isPublicOfflineSafeRoute('/admin')).toBe(false);
      expect(isPublicOfflineSafeRoute('/admin/portal')).toBe(false);
      expect(isPublicOfflineSafeRoute('/account')).toBe(false);
      expect(isPublicOfflineSafeRoute('/counselor')).toBe(false);
      expect(isPublicOfflineSafeRoute('/companion')).toBe(false);
      expect(isPublicOfflineSafeRoute('/outreach')).toBe(false);
      expect(isPublicOfflineSafeRoute('/complaint-officer')).toBe(false);
      expect(isPublicOfflineSafeRoute('/supervisor')).toBe(false);
    });

    it('classifies private route family as strictly network only', () => {
      expect(isPrivateNetworkOnlyRoute('/patient')).toBe(true);
      expect(isPrivateNetworkOnlyRoute('/patient/care')).toBe(true);
      expect(isPrivateNetworkOnlyRoute('/patient/adherence')).toBe(true);
      expect(isPrivateNetworkOnlyRoute('/doctor')).toBe(true);
      expect(isPrivateNetworkOnlyRoute('/doctor/consultations/c1')).toBe(true);
      expect(isPrivateNetworkOnlyRoute('/admin')).toBe(true);
      expect(isPrivateNetworkOnlyRoute('/admin/audit')).toBe(true);
      expect(isPrivateNetworkOnlyRoute('/account')).toBe(true);
      expect(isPrivateNetworkOnlyRoute('/counselor')).toBe(true);
      expect(isPrivateNetworkOnlyRoute('/companion')).toBe(true);
      expect(isPrivateNetworkOnlyRoute('/outreach')).toBe(true);
      expect(isPrivateNetworkOnlyRoute('/complaint-officer')).toBe(true);
      expect(isPrivateNetworkOnlyRoute('/supervisor')).toBe(true);
      expect(isPrivateNetworkOnlyRoute('/counselor-application')).toBe(true);

      // Public routes must NOT be in private family
      expect(isPrivateNetworkOnlyRoute('/')).toBe(false);
      expect(isPrivateNetworkOnlyRoute('/edukasi')).toBe(false);
      expect(isPrivateNetworkOnlyRoute('/informasi-layanan')).toBe(false);
    });

    it('classifies unauthenticated sensitive routes as sensitive (NETWORK ONLY)', () => {
      expect(isSensitiveUnauthenticatedRoute('/login')).toBe(true);
      expect(isSensitiveUnauthenticatedRoute('/register')).toBe(true);
      expect(isSensitiveUnauthenticatedRoute('/register-counselor')).toBe(true);
      expect(isSensitiveUnauthenticatedRoute('/recover-account')).toBe(true);
      expect(isSensitiveUnauthenticatedRoute('/complaints/new')).toBe(true);
      expect(isSensitiveUnauthenticatedRoute('/complaints/track')).toBe(true);

      expect(isPublicOfflineSafeRoute('/login')).toBe(false);
      expect(isPublicOfflineSafeRoute('/register')).toBe(false);
      expect(isPublicOfflineSafeRoute('/recover-account')).toBe(false);
      expect(isPublicOfflineSafeRoute('/complaints/new')).toBe(false);
      expect(isPublicOfflineSafeRoute('/complaints/track')).toBe(false);
    });
  });

  describe('Query Parameter Privacy', () => {
    it('disallows arbitrary free-text search queries or token-bearing parameters', () => {
      expect(isAllowedPublicQueryParams(new URLSearchParams('search=hiv'))).toBe(false);
      expect(isAllowedPublicQueryParams(new URLSearchParams('q=klinik'))).toBe(false);
      expect(isAllowedPublicQueryParams(new URLSearchParams('token=xyz'))).toBe(false);
      expect(isAllowedPublicQueryParams(new URLSearchParams('code=123'))).toBe(false);
      expect(isAllowedPublicQueryParams(new URLSearchParams('secret=abc'))).toBe(false);
      expect(isAllowedPublicQueryParams(new URLSearchParams('email=user@test.org'))).toBe(false);
      expect(isAllowedPublicQueryParams(new URLSearchParams('phone=08123'))).toBe(false);
      expect(isAllowedPublicQueryParams(new URLSearchParams('custom_param=val'))).toBe(false);
    });

    it('allows controlled safe enum and pagination parameters', () => {
      expect(isAllowedPublicQueryParams(new URLSearchParams('limit=20'))).toBe(true);
      expect(isAllowedPublicQueryParams(new URLSearchParams('limit=20&page=1'))).toBe(true);
      expect(isAllowedPublicQueryParams(new URLSearchParams('regionId=reg-123&type=KLINIK'))).toBe(true);
      expect(isAllowedPublicQueryParams(new URLSearchParams('service=COUNSELING&year=2026'))).toBe(true);
      expect(isAllowedPublicQueryParams(new URLSearchParams('service_type=REFERRAL_INTAKE&region_id=reg-1'))).toBe(true);
    });
  });

  describe('Gate 1: Public API Request Safety', () => {
    it('allows approved public content endpoints on GET', () => {
      expect(isPublicOfflineSafeApiRequest('/public/portal')).toBe(true);
      expect(isPublicOfflineSafeApiRequest('/api/public/portal')).toBe(true);
      expect(isPublicOfflineSafeApiRequest('/public/articles')).toBe(true);
      expect(isPublicOfflineSafeApiRequest('/public/articles/pencegahan-dasar')).toBe(true);
      expect(isPublicOfflineSafeApiRequest('/public/videos')).toBe(true);
      expect(isPublicOfflineSafeApiRequest('/public/videos/vid-123')).toBe(true);
      expect(isPublicOfflineSafeApiRequest('/public/service-facilities')).toBe(true);
      expect(isPublicOfflineSafeApiRequest('/public/service-facilities/fac-1')).toBe(true);
      expect(isPublicOfflineSafeApiRequest('/public/facilities')).toBe(true);
      expect(isPublicOfflineSafeApiRequest('/public/regions')).toBe(true);
      expect(isPublicOfflineSafeApiRequest('/public/content-categories')).toBe(true);
      expect(isPublicOfflineSafeApiRequest('/public/statistics')).toBe(true);
    });

    it('strictly denies non-GET methods', () => {
      expect(isPublicOfflineSafeApiRequest('/public/portal', { method: 'POST' })).toBe(false);
      expect(isPublicOfflineSafeApiRequest('/public/articles', { method: 'PUT' })).toBe(false);
      expect(isPublicOfflineSafeApiRequest('/public/facilities', { method: 'DELETE' })).toBe(false);
    });

    it('strictly denies requests containing an Authorization header', () => {
      expect(
        isPublicOfflineSafeApiRequest('/public/articles', {
          headers: { Authorization: 'Bearer token123' }
        })
      ).toBe(false);
      expect(
        isPublicOfflineSafeApiRequest('/public/service-facilities', {
          headers: new Headers({ authorization: 'Bearer token123' })
        })
      ).toBe(false);
    });

    it('strictly denies private, clinical, auth, and complaint endpoints', () => {
      expect(isPublicOfflineSafeApiRequest('/auth/me')).toBe(false);
      expect(isPublicOfflineSafeApiRequest('/auth/login')).toBe(false);
      expect(isPublicOfflineSafeApiRequest('/auth/refresh')).toBe(false);
      expect(isPublicOfflineSafeApiRequest('/patient/care')).toBe(false);
      expect(isPublicOfflineSafeApiRequest('/patient/referrals')).toBe(false);
      expect(isPublicOfflineSafeApiRequest('/patient/monitoring')).toBe(false);
      expect(isPublicOfflineSafeApiRequest('/doctor/queue')).toBe(false);
      expect(isPublicOfflineSafeApiRequest('/admin/audit')).toBe(false);
      expect(isPublicOfflineSafeApiRequest('/counselor/conversations')).toBe(false);
      expect(isPublicOfflineSafeApiRequest('/companion/referral-support')).toBe(false);
      expect(isPublicOfflineSafeApiRequest('/complaints/track/TC12345')).toBe(false);
      expect(isPublicOfflineSafeApiRequest('/complaint-admin/queue')).toBe(false);
      expect(isPublicOfflineSafeApiRequest('/public/videos/v1/playback')).toBe(false);
    });
  });

  describe('Gate 2: Response Offline Marker & Cache-Control', () => {
    it('accepts responses with marker 1 and public cache headers', () => {
      expect(
        isPublicOfflineSafeApiResponse({
          status: 200,
          headers: {
            [OFFLINE_SAFE_MARKER_HEADER]: '1',
            'cache-control': 'public, max-age=60, stale-while-revalidate=300'
          }
        })
      ).toBe(true);
    });

    it('rejects responses missing the offline-safe marker', () => {
      expect(
        isPublicOfflineSafeApiResponse({
          status: 200,
          headers: {
            'cache-control': 'public, max-age=60'
          }
        })
      ).toBe(false);
    });

    it('rejects responses with non-200 status', () => {
      expect(
        isPublicOfflineSafeApiResponse({
          status: 404,
          headers: { [OFFLINE_SAFE_MARKER_HEADER]: '1' }
        })
      ).toBe(false);
      expect(
        isPublicOfflineSafeApiResponse({
          status: 500,
          headers: { [OFFLINE_SAFE_MARKER_HEADER]: '1' }
        })
      ).toBe(false);
    });

    it('rejects responses containing no-store or private Cache-Control', () => {
      expect(
        isPublicOfflineSafeApiResponse({
          status: 200,
          headers: {
            [OFFLINE_SAFE_MARKER_HEADER]: '1',
            'cache-control': 'no-store, no-cache, must-revalidate, private'
          }
        })
      ).toBe(false);

      expect(
        isPublicOfflineSafeApiResponse({
          status: 200,
          headers: {
            [OFFLINE_SAFE_MARKER_HEADER]: '1',
            'cache-control': 'private, max-age=60'
          }
        })
      ).toBe(false);
    });
  });

  describe('Combined canCacheApiResponse (Gate 1 + Gate 2)', () => {
    it('approves legitimate public content responses', () => {
      const allowed = canCacheApiResponse(
        { method: 'GET', url: '/public/portal' },
        {
          status: 200,
          headers: {
            'x-sehaticare-offline-safe': '1',
            'cache-control': 'public, max-age=60'
          }
        }
      );
      expect(allowed).toBe(true);
    });

    it('fails closed when Gate 1 fails (even if response header is manipulated)', () => {
      const allowed = canCacheApiResponse(
        { method: 'GET', url: '/patient/care' },
        {
          status: 200,
          headers: {
            'x-sehaticare-offline-safe': '1',
            'cache-control': 'public, max-age=60'
          }
        }
      );
      expect(allowed).toBe(false);
    });

    it('fails closed when Gate 2 fails (marker missing on public path)', () => {
      const allowed = canCacheApiResponse(
        { method: 'GET', url: '/public/articles' },
        {
          status: 200,
          headers: {
            'cache-control': 'public, max-age=60'
          }
        }
      );
      expect(allowed).toBe(false);
    });
  });

  describe('Static Asset Identification', () => {
    it('classifies neutral application assets as static', () => {
      expect(isStaticAssetUrl('/assets/index-D7b39a.js')).toBe(true);
      expect(isStaticAssetUrl('/assets/index-A41c88.css')).toBe(true);
      expect(isStaticAssetUrl('/brand/app-icon-192.png')).toBe(true);
      expect(isStaticAssetUrl('/manifest.webmanifest')).toBe(true);
      expect(isStaticAssetUrl('/favicon.ico')).toBe(true);
      expect(isStaticAssetUrl('/offline.html')).toBe(true);
    });

    it('strictly denies user uploads, signed attachments, and voice notes from static cache', () => {
      expect(isStaticAssetUrl('/voice-notes/audio-123.mp4')).toBe(false);
      expect(isStaticAssetUrl('/complaint-attachments/att-123')).toBe(false);
      expect(isStaticAssetUrl('/documents/license.pdf')).toBe(false);
      expect(isStaticAssetUrl('/playback/video.mp4')).toBe(false);
    });
  });

  describe('Utility normalization', () => {
    it('normalizes paths and strips API prefixes accurately', () => {
      expect(normalizePathname('/edukasi/')).toBe('/edukasi');
      expect(normalizePathname('/')).toBe('/');
      expect(stripApiPrefix('/api/public/portal')).toBe('/public/portal');
      expect(stripApiPrefix('/public/portal')).toBe('/public/portal');
      expect(stripApiPrefix('/api')).toBe('/');
    });
  });
});
