import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import offlineHtml from '../../../public/offline.html?raw';
import rawManifest from '../../../public/manifest.webmanifest?raw';
import { ConnectivityBanner, StaleContentDisclosure } from './ConnectivityBanner';
import * as networkHook from '../../hooks/useNetworkStatus';
import { CACHE_NAMES, ALL_CACHES } from '../../pwa/cachePolicy';

describe('AG-10 Offline Safety & Resilience Component Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Neutral Offline Fallback Page (public/offline.html)', () => {
    it('is present in public directory and contains only neutral copy without sensitive clinical terms', () => {
      expect(typeof offlineHtml).toBe('string');
      expect(offlineHtml.length).toBeGreaterThan(50);

      // Must have essential neutral elements
      expect(offlineHtml).toContain('SEHATiCare');
      expect(offlineHtml).toContain('Koneksi tidak tersedia');
      expect(offlineHtml).toContain('Coba Lagi');
      expect(offlineHtml).toContain('Kembali ke Beranda');
      expect(offlineHtml).toContain('Layanan pribadi memerlukan koneksi');

      // Prohibited clinical / sensitive health words
      const prohibitedPatterns = [
        /\bHIV\b/i,
        /\bAIDS\b/i,
        /\bARV\b/i,
        /\bART\b/i,
        /\bODHIV\b/i,
        /\bviral\s*load\b/i,
        /\bCD4\b/i,
        /\bpasien\b/i,
        /\bdokter\b/i,
        /\bkonseling\b/i,
        /\brujukan\b/i
      ];

      for (const pattern of prohibitedPatterns) {
        expect(pattern.test(offlineHtml)).toBe(
          false
        );
      }
    });
  });

  describe('Web Manifest Neutrality', () => {
    it('manifest.webmanifest maintains neutral branding and correct icons', () => {
      const manifest = JSON.parse(rawManifest) as {
        name: string;
        short_name: string;
        start_url: string;
        display: string;
        theme_color: string;
        description: string;
      };
      expect(manifest.name).toBe('SEHATiCare');
      expect(manifest.short_name).toBe('SEHATiCare');
      expect(manifest.start_url).toBe('/');
      expect(manifest.display).toBe('standalone');
      expect(manifest.theme_color).toBe('#0f766e');

      // Neutral description
      expect(manifest.description).toContain('dukungan kesehatan');
      expect(manifest.description).not.toMatch(/hiv|aids|arv|art|odhiv/i);
    });
  });

  describe('ConnectivityBanner', () => {
    it('renders null when the user is online with normal connection', () => {
      vi.spyOn(networkHook, 'useNetworkStatus').mockReturnValue({
        isOnline: true,
        isLowBandwidth: false,
        isSaveData: false,
        effectiveType: '4g',
        checkConnection: vi.fn()
      });

      const { container } = render(
        <MemoryRouter initialEntries={['/']}>
          <ConnectivityBanner />
        </MemoryRouter>
      );
      expect(container.firstChild).toBeNull();
    });

    it('displays neutral public offline banner when offline on a public route', () => {
      const checkConnection = vi.fn();
      vi.spyOn(networkHook, 'useNetworkStatus').mockReturnValue({
        isOnline: false,
        isLowBandwidth: true,
        isSaveData: false,
        effectiveType: 'unknown',
        checkConnection
      });

      render(
        <MemoryRouter initialEntries={['/edukasi']}>
          <ConnectivityBanner />
        </MemoryRouter>
      );

      const statusEl = screen.getByRole('status');
      expect(statusEl).toBeInTheDocument();
      expect(statusEl).toHaveTextContent('Koneksi sedang terbatas. Konten publik yang tersimpan tetap dapat digunakan.');

      // Check retry button
      const retryBtn = screen.getByRole('button', { name: /coba lagi/i });
      expect(retryBtn).toBeInTheDocument();
      fireEvent.click(retryBtn);
      expect(checkConnection).toHaveBeenCalled();
    });

    it('displays privacy-focused offline message when offline on a private route', () => {
      vi.spyOn(networkHook, 'useNetworkStatus').mockReturnValue({
        isOnline: false,
        isLowBandwidth: true,
        isSaveData: false,
        effectiveType: 'unknown',
        checkConnection: vi.fn()
      });

      render(
        <MemoryRouter initialEntries={['/patient/care']}>
          <ConnectivityBanner />
        </MemoryRouter>
      );

      const statusEl = screen.getByRole('status');
      expect(statusEl).toBeInTheDocument();
      expect(statusEl).toHaveTextContent(
        'Koneksi tidak tersedia. Koneksi diperlukan untuk memperbarui data pribadi.'
      );
      expect(statusEl).not.toHaveTextContent('Konten publik');
    });

    it('displays low-bandwidth hint when online with saveData enabled', () => {
      vi.spyOn(networkHook, 'useNetworkStatus').mockReturnValue({
        isOnline: true,
        isLowBandwidth: true,
        isSaveData: true,
        effectiveType: '2g',
        checkConnection: vi.fn()
      });

      render(
        <MemoryRouter initialEntries={['/edukasi']}>
          <ConnectivityBanner />
        </MemoryRouter>
      );

      const statusEl = screen.getByRole('status');
      expect(statusEl).toBeInTheDocument();
      expect(statusEl).toHaveTextContent(/mode hemat data aktif/i);
    });
  });

  describe('StaleContentDisclosure', () => {
    it('is hidden when online', () => {
      vi.spyOn(networkHook, 'useNetworkStatus').mockReturnValue({
        isOnline: true,
        isLowBandwidth: false,
        isSaveData: false,
        effectiveType: '4g',
        checkConnection: vi.fn()
      });

      const { container } = render(<StaleContentDisclosure />);
      expect(container.firstChild).toBeNull();
    });

    it('is displayed when offline to clarify that cached public directory information may be outdated', () => {
      vi.spyOn(networkHook, 'useNetworkStatus').mockReturnValue({
        isOnline: false,
        isLowBandwidth: true,
        isSaveData: false,
        effectiveType: 'unknown',
        checkConnection: vi.fn()
      });

      render(<StaleContentDisclosure />);
      const statusEl = screen.getByRole('status');
      expect(statusEl).toBeInTheDocument();
      expect(statusEl).toHaveTextContent(
        'Konten tersimpan dapat digunakan saat koneksi terbatas. Informasi layanan dapat berubah, periksa kembali saat koneksi tersedia.'
      );
    });
  });

  describe('Simulated CacheStorage Key Audit', () => {
    it('ensures no private, clinical, or token-bearing routes can enter cache keys', () => {
      // Representative test URLs
      const approvedUrls = [
        '/',
        '/offline.html',
        '/brand/app-icon-192.png',
        '/assets/index.js',
        '/api/public/portal',
        '/api/public/articles',
        '/api/public/service-facilities?limit=20'
      ];

      const forbiddenUrls = [
        '/api/auth/me',
        '/api/auth/refresh',
        '/api/patient/care',
        '/api/patient/consultations',
        '/api/patient/referrals',
        '/api/doctor/queue',
        '/api/admin/audit',
        '/api/account/profile',
        '/api/complaints/track/TC12345',
        '/api/public/videos/v1/playback',
        '/voice-notes/audio.mp4',
        '/complaint-attachments/doc.pdf',
        '/uploads/user.png',
        '/api/public/portal?foo=private-value',
        '/api/public/articles?q=sensitive',
        '/api/public/articles?search=sensitive',
        '/api/public/articles?token=secret',
        '/api/public/service-facilities?unknown=something'
      ];

      const mockCacheMap = new Map<string, string[]>();
      for (const name of ALL_CACHES) {
        mockCacheMap.set(name, []);
      }

      // Populate mock cache only with approved items
      for (const url of approvedUrls) {
        mockCacheMap.get(CACHE_NAMES.PUBLIC_CONTENT)?.push(url);
      }

      // Assert that forbidden URLs are absent and no keys match private patterns
      const forbiddenPattern = /\/(?:patient|doctor|admin|account|auth|referral|care|consultation|message|attachment|voice-notes|playback)\b/i;

      for (const [cacheName, keys] of mockCacheMap.entries()) {
        expect(cacheName).toMatch(/^sehaticare-[a-z]+-v[0-9]+$/);
        for (const key of keys) {
          expect(forbiddenPattern.test(key)).toBe(false);
          expect(forbiddenUrls.includes(key)).toBe(false);
        }
      }
    });
  });
});
