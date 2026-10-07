import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AdminPortalPage } from './AdminPortalPage';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { role: 'ADMIN', full_name: 'Admin Test' },
    token: 'mock-admin-token-123',
    isAuthenticated: true,
    initializing: false,
    handleUnauthorized: vi.fn()
  })
}));

const mockItems = [
  {
    id: 'hero-uuid-1',
    section: 'hero',
    title: 'Hero Server PostgreSQL',
    summary: 'Deskripsi Hero dari database',
    status: 'Published',
    order: 1,
    imageUrl: undefined,
    linkUrl: undefined,
    mediaUrl: undefined,
    createdAt: '2026-08-15T10:00:00.000Z',
    updatedAt: '2026-08-15T10:00:00.000Z'
  }
];

describe('AdminPortalPage Centralized CMS', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('loads portal items from Admin API and never stores content to localStorage', async () => {
    // Seed some legacy storage to verify cleanup
    localStorage.setItem('sehaticare.portalContent.v1', JSON.stringify({ hero: [] }));

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/admin/content/portal')) {
        return new Response(JSON.stringify({ items: mockItems }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response('Not Found', { status: 404 });
    });

    render(<AdminPortalPage />);

    // Check loading indicator and eventual data
    expect(await screen.findByText('Hero Server PostgreSQL')).toBeInTheDocument();
    expect(screen.getByText('Deskripsi Hero dari database')).toBeInTheDocument();

    // Verify GET request was sent to /admin/content/portal with auth token
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/admin/content/portal'),
      expect.objectContaining({
        headers: expect.any(Headers)
      })
    );

    // Verify localStorage has NO portalContent stored
    expect(localStorage.getItem('sehaticare.portalContent.v1')).toBeNull();
    expect(localStorage.getItem('sehaticare.portalContent')).toBeNull();
  });

  it('creates new portal item through backend POST endpoint', async () => {
    let created = false;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method || 'GET').toUpperCase();

      if (url.includes('/admin/content/portal') && method === 'GET') {
        const items = created
          ? [
              ...mockItems,
              {
                id: 'hero-new-2',
                section: 'hero',
                title: 'Judul Baru Ditambahkan',
                summary: 'Ringkasan baru',
                status: 'Draft',
                order: 2,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }
            ]
          : mockItems;
        return new Response(JSON.stringify({ items }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (url.includes('/admin/content/portal') && method === 'POST') {
        created = true;
        const body = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            item: {
              id: 'hero-new-2',
              ...body,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response('Not Found', { status: 404 });
    });

    const user = userEvent.setup();
    render(<AdminPortalPage />);

    expect(await screen.findByText('Hero Server PostgreSQL')).toBeInTheDocument();

    // Click Tambah Baru
    await user.click(screen.getByRole('button', { name: /tambah baru/i }));

    // Fill form
    const titleInput = screen.getByLabelText(/judul/i);
    const summaryInput = screen.getByLabelText(/deskripsi singkat/i);
    await user.type(titleInput, 'Judul Baru Ditambahkan');
    await user.type(summaryInput, 'Ringkasan baru');

    // Submit form
    await user.click(screen.getByRole('button', { name: /^simpan$/i }));

    // Check POST request
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/admin/content/portal'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Judul Baru Ditambahkan')
        })
      );
    });

    // Check success message and new item in list
    expect(await screen.findByText('Konten berhasil ditambahkan ke database.')).toBeInTheDocument();
    expect(await screen.findByText('Judul Baru Ditambahkan')).toBeInTheDocument();

    // Confirm no localStorage pollution
    expect(localStorage.getItem('sehaticare.portalContent.v1')).toBeNull();
  });

  it('displays error feedback when backend request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/admin/content/portal')) {
        return new Response(JSON.stringify({ message: 'Koneksi database PostgreSQL terputus' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response('Not Found', { status: 404 });
    });

    render(<AdminPortalPage />);

    expect(
      await screen.findByText(/Koneksi database PostgreSQL terputus/i)
    ).toBeInTheDocument();
  });
});
