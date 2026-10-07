import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { PatientDashboard } from '../PatientDashboard';
import { UnifiedConsultationsPage } from '../patient/UnifiedConsultationsPage';
import { CompanionAssignmentsPage } from './ProfessionalRolePages';

const { unauthorized } = vi.hoisted(() => ({ unauthorized: vi.fn() }));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    token: 'jwt-mock-patient-token',
    handleUnauthorized: unauthorized,
    user: { id: 'usr_pat1', role: 'PASIEN', alias: 'Mawar' },
    isAuthenticated: true,
  }),
}));

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('AG-03 Frontend: Companion-Aware Consultation Routing & Care Conversation Bridge', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('Patient UI: PatientDashboard Companion Routing', () => {
    test('renders Hubungi Pendamping button when companion is active, and triggers conversation routing on click', async () => {
      const user = userEvent.setup();
      let startConversationCalled = false;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const url = String(input);
        const method = init?.method || 'GET';

        if (url.includes('/patient/companion/active-conversation')) {
          return jsonResponse({
            has_active_conversation: false,
            conversation_public_id: null,
            status: null,
          });
        }

        if (url.includes('/patient/companion/start-conversation') && method === 'POST') {
          startConversationCalled = true;
          return jsonResponse({
            conversation_public_id: 'svc_comp_123',
            is_reused: false,
            routed_to_companion: true,
            status: 'ASSIGNED',
          });
        }

        if (url.includes('/patient/companion')) {
          return jsonResponse({
            assigned: true,
            assignment_id: 'asg_long_1',
            companion: {
              public_id: 'cmp_maya',
              professional_name: 'Maya Pendamping',
              service_role: 'COMPANION',
              facility: { id: 'fac_1', name: 'Puskesmas Jayapura' },
            },
            started_at: '2026-08-17T08:00:00.000Z',
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

      // Verify companion card and action button
      expect(await screen.findByText('Pendamping Saya')).toBeInTheDocument();
      expect(await screen.findByText('Maya Pendamping')).toBeInTheDocument();
      const contactBtn = screen.getByRole('button', { name: /Hubungi Pendamping/i });
      expect(contactBtn).toBeInTheDocument();

      // Click Hubungi Pendamping
      await user.click(contactBtn);
      expect(startConversationCalled).toBe(true);

      // Verify privacy: no sensitive conversation tokens or rosters stored in Web Storage
      expect(localStorage.getItem('svc_comp_123')).toBeNull();
      expect(sessionStorage.getItem('svc_comp_123')).toBeNull();
      expect(JSON.stringify(localStorage) + JSON.stringify(sessionStorage)).not.toContain('Maya Pendamping');
    });

    test('resumes existing open conversation when active conversation already exists', async () => {
      const user = userEvent.setup();
      let activeConversationChecked = false;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);

        if (url.includes('/patient/companion/active-conversation')) {
          activeConversationChecked = true;
          return jsonResponse({
            has_active_conversation: true,
            conversation_public_id: 'svc_existing_456',
            status: 'ACTIVE',
          });
        }

        if (url.includes('/patient/companion')) {
          return jsonResponse({
            assigned: true,
            assignment_id: 'asg_long_2',
            companion: {
              public_id: 'cmp_budi',
              professional_name: 'Budi Pendamping',
              service_role: 'COMPANION',
              facility: null,
            },
            started_at: '2026-08-17T08:00:00.000Z',
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

      const contactBtn = await screen.findByRole('button', { name: /Hubungi Pendamping/i });
      await user.click(contactBtn);

      expect(activeConversationChecked).toBe(true);
    });

    test('displays Mulai Pendampingan button when no companion assigned yet', async () => {
      const user = userEvent.setup();
      let startQueueCalled = false;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const url = String(input);
        const method = init?.method || 'GET';

        if (url.includes('/patient/companion/start-conversation') && method === 'POST') {
          startQueueCalled = true;
          return jsonResponse({
            conversation_public_id: 'svc_queue_789',
            is_reused: false,
            routed_to_companion: false,
            status: 'QUEUED',
          });
        }

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

      expect(await screen.findByText('Belum ada pendamping aktif')).toBeInTheDocument();
      const startBtn = screen.getByRole('button', { name: /Mulai Pendampingan/i });
      expect(startBtn).toBeInTheDocument();

      await user.click(startBtn);
      expect(startQueueCalled).toBe(true);
    });

    test('displays safe error message when connecting to companion fails', async () => {
      const user = userEvent.setup();

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);

        if (url.includes('/patient/companion/active-conversation')) {
          return jsonResponse({ message: 'Layanan sedang sibuk' }, 503);
        }

        if (url.includes('/patient/companion')) {
          return jsonResponse({
            assigned: true,
            companion: {
              public_id: 'cmp_maya',
              professional_name: 'Maya Pendamping',
              service_role: 'COMPANION',
              facility: null,
            },
            started_at: '2026-08-17T08:00:00.000Z',
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

      const contactBtn = await screen.findByRole('button', { name: /Hubungi Pendamping/i });
      await user.click(contactBtn);

      expect(await screen.findByRole('alert')).toBeInTheDocument();
    });
  });

  describe('Companion UI: Pasien Dampingan Longitudinal Badge', () => {
    test('renders Pasien Dampingan badge for longitudinal sessions', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);

        if (url.includes('/companion/patients')) {
          return jsonResponse({ items: [] });
        }

        if (url.includes('/professional/assignments')) {
          return jsonResponse({
            items: [
              {
                public_id: 'svc_long_conv_1',
                status: 'ASSIGNED',
                priority: 1,
                subject: 'Pendampingan Berkelanjutan',
                service_intent: 'COMPANION_SUPPORT',
                assigned_at: '2026-08-17T10:00:00.000Z',
                last_activity_at: '2026-08-17T10:00:00.000Z',
                assignment_source: 'LONGITUDINAL',
                is_longitudinal: true,
              },
            ],
          });
        }

        return jsonResponse({});
      });

      render(
        <MemoryRouter>
          <CompanionAssignmentsPage />
        </MemoryRouter>
      );

      expect(await screen.findByText('Pendampingan Berkelanjutan')).toBeInTheDocument();
      const matching = screen.getAllByText('Pasien Dampingan');
      expect(matching.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Unified Consultations: Companion Support Label', () => {
    test('renders Pendampingan Berkelanjutan subtitle for companion support conversations', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);

        if (url.includes('/consultation-overview')) {
          return jsonResponse({
            items: [
              {
                id: 'svc_comp_conv',
                status: 'ACTIVE',
                title: 'Check-in Rutin',
                service_intent: 'COMPANION_SUPPORT',
                created_at: '2026-08-17T09:00:00.000Z',
                updated_at: '2026-08-17T09:30:00.000Z',
                has_unread: false,
                detail_path: '/patient/consultations/svc_comp_conv',
              },
            ],
          });
        }

        if (url.includes('/public/regions')) {
          return jsonResponse({ items: [] });
        }

        if (url.includes('/public/facilities')) {
          return jsonResponse({ items: [] });
        }

        return jsonResponse({});
      });

      render(
        <MemoryRouter>
          <UnifiedConsultationsPage />
        </MemoryRouter>
      );

      expect(await screen.findByText('Check-in Rutin')).toBeInTheDocument();
      expect(screen.getByText(/Pendampingan Berkelanjutan/i)).toBeInTheDocument();
    });
  });
});
