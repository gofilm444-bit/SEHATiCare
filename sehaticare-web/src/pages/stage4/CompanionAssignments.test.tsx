import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { PatientDashboard } from '../PatientDashboard';
import {
  AdminProfessionalAssignmentsPage,
  CompanionAssignmentsPage,
} from './ProfessionalRolePages';

const { unauthorized } = vi.hoisted(() => ({ unauthorized: vi.fn() }));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    token: 'jwt-mock-token',
    handleUnauthorized: unauthorized,
    user: { id: 'usr_test', role: 'ADMIN', alias: 'Admin 1' },
    isAuthenticated: true,
  }),
}));

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('AG-02 Frontend: Longitudinal Patient-Companion Assignments', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('Admin UI: AdminProfessionalAssignmentsPage', () => {
    test('loads longitudinal assignments, candidate lists, and displays table', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/admin/companion-assignments/candidates')) {
          return jsonResponse({
            companions: [
              {
                public_id: 'cmp_1',
                professional_name: 'Pendamping Dewi',
                facility_id: null,
                service_role: 'COMPANION',
                is_active: true,
                verification_status: 'VERIFIED',
              },
            ],
            patients: [
              {
                public_id: 'pat_1',
                alias: 'Bunga Merah',
                has_active_companion: false,
              },
            ],
          });
        }
        if (url.includes('/admin/companion-assignments')) {
          return jsonResponse({
            items: [
              {
                id: 'asg_123',
                patient: { public_id: 'pat_1', alias: 'Bunga Merah' },
                companion: { public_id: 'cmp_1', professional_name: 'Pendamping Dewi' },
                facility: { id: 'fac_1', name: 'Klinik Sehati' },
                status: 'ACTIVE',
                started_at: '2026-08-16T10:00:00.000Z',
                ended_at: null,
                end_reason: null,
                created_at: '2026-08-16T10:00:00.000Z',
              },
            ],
          });
        }
        return jsonResponse({});
      });

      render(
        <MemoryRouter>
          <AdminProfessionalAssignmentsPage />
        </MemoryRouter>
      );

      expect(await screen.findByText('Bunga Merah')).toBeInTheDocument();
      expect(screen.getByText('Pendamping Dewi')).toBeInTheDocument();
      expect(screen.getByText('Klinik Sehati')).toBeInTheDocument();
      expect(screen.getByText('ACTIVE')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Ganti' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Akhiri' })).toBeInTheDocument();
    });

    test('allows creating, reassigning, and ending an assignment', async () => {
      let currentStatus = 'ACTIVE';
      let currentCompanion = 'Pendamping Dewi';

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const url = String(input);
        const method = init?.method || 'GET';

        if (url.includes('/admin/companion-assignments/candidates')) {
          return jsonResponse({
            companions: [
              {
                public_id: 'cmp_1',
                professional_name: 'Pendamping Dewi',
                facility_id: null,
                service_role: 'COMPANION',
                is_active: true,
                verification_status: 'VERIFIED',
              },
              {
                public_id: 'cmp_2',
                professional_name: 'Pendamping Budi',
                facility_id: null,
                service_role: 'COMPANION',
                is_active: true,
                verification_status: 'VERIFIED',
              },
            ],
            patients: [
              {
                public_id: 'pat_1',
                alias: 'Bunga Merah',
                has_active_companion: currentStatus === 'ACTIVE',
              },
            ],
          });
        }

        if (url.includes('/reassign') && method === 'PUT') {
          currentCompanion = 'Pendamping Budi';
          return jsonResponse({
            id: 'asg_new',
            patient: { public_id: 'pat_1', alias: 'Bunga Merah' },
            companion: { public_id: 'cmp_2', professional_name: 'Pendamping Budi' },
            facility: null,
            status: 'ACTIVE',
            started_at: '2026-08-16T11:00:00.000Z',
            ended_at: null,
            end_reason: null,
            created_at: '2026-08-16T11:00:00.000Z',
          });
        }

        if (url.includes('/end') && method === 'PUT') {
          currentStatus = 'ENDED';
          return jsonResponse({
            id: 'asg_123',
            patient: { public_id: 'pat_1', alias: 'Bunga Merah' },
            companion: { public_id: 'cmp_1', professional_name: currentCompanion },
            facility: null,
            status: 'ENDED',
            started_at: '2026-08-16T10:00:00.000Z',
            ended_at: '2026-08-16T12:00:00.000Z',
            end_reason: 'Pasien mandiri',
            created_at: '2026-08-16T10:00:00.000Z',
          });
        }

        if (url.includes('/admin/companion-assignments') && method === 'POST') {
          return jsonResponse({
            id: 'asg_123',
            patient: { public_id: 'pat_1', alias: 'Bunga Merah' },
            companion: { public_id: 'cmp_1', professional_name: 'Pendamping Dewi' },
            facility: null,
            status: 'ACTIVE',
            started_at: '2026-08-16T10:00:00.000Z',
            ended_at: null,
            end_reason: null,
            created_at: '2026-08-16T10:00:00.000Z',
          });
        }

        if (url.includes('/admin/companion-assignments')) {
          return jsonResponse({
            items: [
              {
                id: 'asg_123',
                patient: { public_id: 'pat_1', alias: 'Bunga Merah' },
                companion: { public_id: 'cmp_1', professional_name: currentCompanion },
                facility: null,
                status: currentStatus,
                started_at: '2026-08-16T10:00:00.000Z',
                ended_at: currentStatus === 'ENDED' ? '2026-08-16T12:00:00.000Z' : null,
                end_reason: currentStatus === 'ENDED' ? 'Pasien mandiri' : null,
                created_at: '2026-08-16T10:00:00.000Z',
              },
            ],
          });
        }

        return jsonResponse({});
      });

      const user = userEvent.setup();
      render(
        <MemoryRouter>
          <AdminProfessionalAssignmentsPage />
        </MemoryRouter>
      );

      expect(await screen.findByText('Bunga Merah')).toBeInTheDocument();

      // Test Reassign action
      await user.click(screen.getByRole('button', { name: 'Ganti' }));
      expect(await screen.findByRole('heading', { name: 'Ganti Pendamping (Reassign)' })).toBeInTheDocument();
      await user.selectOptions(screen.getByLabelText('Pilih pendamping baru'), 'cmp_2');
      await user.click(screen.getByRole('button', { name: 'Ganti Pendamping' }));

      expect(await screen.findByText('Pendamping berhasil dialihkan (reassign).')).toBeInTheDocument();

      // Test End action
      await user.click(screen.getByRole('button', { name: 'Akhiri' }));
      expect(await screen.findByRole('heading', { name: 'Akhiri Pendampingan' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Akhiri Pendampingan' }));

      expect(await screen.findByText('Penugasan pendamping berhasil diakhiri.')).toBeInTheDocument();
      expect(fetchSpy).toHaveBeenCalled();
    });

    test('displays error message when API fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Koneksi terputus'));

      render(
        <MemoryRouter>
          <AdminProfessionalAssignmentsPage />
        </MemoryRouter>
      );

      expect(await screen.findByRole('alert')).toHaveTextContent('Tidak dapat terhubung ke layanan');
    });
  });

  describe('Companion UI: CompanionAssignmentsPage', () => {
    test('displays assigned patient roster and empty state correctly without web storage leaks', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/companion/patients')) {
          return jsonResponse({
            items: [
              {
                assignment_id: 'asg_1',
                patient_public_id: 'usr_pat1',
                alias: 'Mentari Pagi',
                status: 'ACTIVE',
                started_at: '2026-08-16T08:00:00.000Z',
                facility: { id: 'fac_1', name: 'Puskesmas Abepura' },
              },
            ],
          });
        }
        if (url.includes('/professional/assignments')) {
          return jsonResponse({ items: [] });
        }
        return jsonResponse({});
      });

      render(
        <MemoryRouter>
          <CompanionAssignmentsPage />
        </MemoryRouter>
      );

      expect(await screen.findByText('Mentari Pagi')).toBeInTheDocument();
      expect(screen.getByText('ID: usr_pat1')).toBeInTheDocument();
      expect(screen.getByText('Fasilitas: Puskesmas Abepura')).toBeInTheDocument();

      // Verify privacy: no roster stored in localStorage or sessionStorage
      expect(localStorage.getItem('companion_patients')).toBeNull();
      expect(sessionStorage.getItem('companion_patients')).toBeNull();
      expect(JSON.stringify(localStorage) + JSON.stringify(sessionStorage)).not.toContain('Mentari Pagi');
    });

    test('displays clean empty state when no patients assigned', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/companion/patients')) {
          return jsonResponse({ items: [] });
        }
        if (url.includes('/professional/assignments')) {
          return jsonResponse({ items: [] });
        }
        return jsonResponse({});
      });

      render(
        <MemoryRouter>
          <CompanionAssignmentsPage />
        </MemoryRouter>
      );

      expect(
        await screen.findByText('Belum ada pasien yang ditugaskan.')
      ).toBeInTheDocument();
    });
  });

  describe('Patient UI: PatientDashboard', () => {
    test('renders active companion information when assigned', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/patient/companion')) {
          return jsonResponse({
            assigned: true,
            companion: {
              public_id: 'cmp_99',
              professional_name: 'Pendamping Sarah',
              service_role: 'COMPANION',
              facility: { id: 'fac_2', name: 'RSUD Jayapura' },
            },
            started_at: '2026-08-16T09:00:00.000Z',
          });
        }
        if (url.includes('/consultation-overview')) {
          return jsonResponse({ items: [] });
        }
        return jsonResponse({});
      });

      render(
        <MemoryRouter>
          <PatientDashboard />
        </MemoryRouter>
      );

      expect(await screen.findByText('Pendamping Saya')).toBeInTheDocument();
      expect(await screen.findByText('Pendamping Sarah')).toBeInTheDocument();
      expect(screen.getByText('Fasilitas: RSUD Jayapura')).toBeInTheDocument();
      expect(screen.getByText('Pendamping Aktif')).toBeInTheDocument();
    });

    test('renders clean empty state when no companion assigned', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/patient/companion')) {
          return jsonResponse({
            assigned: false,
            companion: null,
            started_at: null,
          });
        }
        if (url.includes('/consultation-overview')) {
          return jsonResponse({ items: [] });
        }
        return jsonResponse({});
      });

      render(
        <MemoryRouter>
          <PatientDashboard />
        </MemoryRouter>
      );

      expect(await screen.findByText('Pendamping Saya')).toBeInTheDocument();
      expect(await screen.findByText('Belum ada pendamping aktif')).toBeInTheDocument();
    });
  });
});
