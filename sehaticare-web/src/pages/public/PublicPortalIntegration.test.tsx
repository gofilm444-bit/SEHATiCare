import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicLandingPage } from './PublicLandingPage';
import { PublicEducationPage } from './PublicEducationPage';

const mockPublicPortalResponse = {
  items: [
    {
      id: 'backend-edu-1',
      section: 'edukasiAwal',
      title: 'Materi HIV dari Backend API',
      summary: 'Ringkasan materi dari PostgreSQL',
      order: 1,
      status: 'Published',
      updatedAt: '2026-08-15T10:00:00.000Z'
    }
  ],
  sections: {
    hero: [],
    carouselImages: [],
    edukasiAwal: [
      {
        id: 'backend-edu-1',
        title: 'Materi HIV dari Backend API',
        summary: 'Ringkasan materi dari PostgreSQL',
        order: 1,
        status: 'Published',
        updatedAt: '2026-08-15T10:00:00.000Z'
      }
    ],
    video: [],
    infografis: [],
    faq: []
  }
};

describe('Public Portal Backend Single Source of Truth', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('PublicLandingPage cleans up legacy localStorage and uses public API data', async () => {
    localStorage.setItem('sehaticare.portalContent.v1', JSON.stringify({ stale: true }));

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/public/portal')) {
        return new Response(JSON.stringify(mockPublicPortalResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url.includes('/public/articles') || url.includes('/public/videos')) {
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response('Not Found', { status: 404 });
    });

    render(
      <MemoryRouter>
        <PublicLandingPage />
      </MemoryRouter>
    );

    // Verify API called
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/public/portal'),
      expect.anything()
    );

    // Verify content from backend appears in UI
    expect(await screen.findByText('Materi HIV dari Backend API')).toBeInTheDocument();

    // Verify legacy localStorage key was purged and not re-written
    expect(localStorage.getItem('sehaticare.portalContent.v1')).toBeNull();
    expect(localStorage.getItem('sehaticare.portalContent')).toBeNull();
  });

  it('PublicLandingPage provides graceful fallback when backend fails without writing to localStorage', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/public/portal')) {
        return new Response('Service Unavailable', { status: 503 });
      }
      if (url.includes('/public/articles') || url.includes('/public/videos')) {
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response('Not Found', { status: 404 });
    });

    render(
      <MemoryRouter>
        <PublicLandingPage />
      </MemoryRouter>
    );

    // Safe fallback from seedContent is shown
    expect(await screen.findByText('Edukasi Awal HIV')).toBeInTheDocument();

    // No localStorage writing occurred
    expect(localStorage.getItem('sehaticare.portalContent.v1')).toBeNull();
    expect(localStorage.getItem('sehaticare.portalContent')).toBeNull();
  });

  it('PublicEducationPage loads content from public API and purges legacy storage', async () => {
    localStorage.setItem('sehaticare.portalContent.v1', JSON.stringify({ old: true }));

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/public/portal')) {
        return new Response(JSON.stringify(mockPublicPortalResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response('Not Found', { status: 404 });
    });

    render(
      <MemoryRouter>
        <PublicEducationPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Materi HIV dari Backend API')).toBeInTheDocument();
    expect(localStorage.getItem('sehaticare.portalContent.v1')).toBeNull();
  });
});
