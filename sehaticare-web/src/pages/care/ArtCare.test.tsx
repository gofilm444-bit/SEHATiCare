import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { PatientArtCareSection } from './PatientArtCareSection';
import { DoctorArtCareSection } from './DoctorArtCareSection';
import { CompanionAssignmentsPage } from '../stage4/ProfessionalRolePages';

const { unauthorized } = vi.hoisted(() => ({ unauthorized: vi.fn() }));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    token: 'valid-test-token',
    user: { role: 'PASIEN', public_id: 'usr_pat123' },
    handleUnauthorized: unauthorized,
    isAuthenticated: true
  })
}));

const mockPatientPlan = {
  plan: {
    public_id: 'art_plan_123',
    status: 'ACTIVE',
    started_at: '2026-03-01T08:00:00.000Z',
    ended_at: null,
    clinical_notes: 'Minum malam hari setelah makan.',
    change_reason: null,
    prescribed_by: {
      public_id: 'usr_doc1',
      display_alias: 'dr. Sarah Sp.PD'
    },
    items: [
      {
        id: 'item-1',
        medication_name: 'Tenofovir / Lamivudine / Dolutegravir',
        strength: '300/300/50 mg',
        dose_instructions: '1 tablet setelah makan',
        frequency_per_day: 1,
        timing_description: 'Malam hari',
        is_active: true,
        reminders: [
          {
            public_id: 'rem_1',
            display_label: 'Pengingat Minum Obat',
            is_active: true,
            times: ['20:00']
          }
        ]
      }
    ]
  }
};

const mockAdherence = {
  summary: {
    summary_period: '7 hari terakhir',
    doses_scheduled: 7,
    doses_taken: 7,
    doses_missed: 0,
    adherence_percentage: 100,
    upcoming_control_schedule: {
      starts_at: '2026-09-01T09:00:00.000Z',
      timezone: 'Asia/Jakarta'
    }
  },
  disclaimer: 'Catatan kepatuhan adalah sarana pendukung pribadi dan bukan pengganti konsultasi klinis.'
};

const mockConsentOff = {
  is_consent_enabled: false,
  consented_at: null,
  revoked_at: null,
  updated_at: '2026-08-01T08:00:00.000Z'
};

const mockConsentOn = {
  is_consent_enabled: true,
  consented_at: '2026-08-01T08:00:00.000Z',
  revoked_at: null,
  updated_at: '2026-08-01T08:00:00.000Z'
};

const mockCompanionSupportSummary = {
  support_consent_enabled: true,
  summary_period: '7 hari terakhir',
  summary: {
    doses_scheduled: 7,
    doses_taken: 6,
    doses_missed: 1,
    adherence_percentage: 85.7,
    upcoming_control_schedule: null
  }
};

describe('AG-05 ART Care Plan & Adherence Support Frontend', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  test('PatientArtCareSection renders active plan, adherence summary, and toggles companion consent', async () => {
    let consentState = {
      is_consent_enabled: false,
      consented_at: null as string | null,
      revoked_at: null as string | null,
      updated_at: '2026-08-01T08:00:00.000Z'
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method || 'GET').toUpperCase();

      if (url.includes('/patient/art-care/history')) {
        return new Response(JSON.stringify({ items: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/patient/art-care/adherence')) {
        return new Response(JSON.stringify(mockAdherence), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/patient/art-care/support-consent') && method === 'GET') {
        return new Response(JSON.stringify(consentState), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/patient/art-care/support-consent') && method === 'PATCH') {
        consentState = { ...mockConsentOn, updated_at: new Date().toISOString() };
        return new Response(JSON.stringify(consentState), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/patient/art-care')) {
        return new Response(JSON.stringify(mockPatientPlan), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    render(<PatientArtCareSection token="valid-test-token" />);

    // 1. Renders active regimen
    expect(await screen.findByText(/Tenofovir \/ Lamivudine \/ Dolutegravir/i)).toBeInTheDocument();
    expect(screen.getByText(/300\/300\/50 mg/i)).toBeInTheDocument();
    expect(screen.getByText(/dr\. Sarah Sp\.PD/i)).toBeInTheDocument();

    // 2. Renders adherence summary
    expect(screen.getByText(/100%/i)).toBeInTheDocument();
    expect(screen.getByText(/dari total 7 jadwal tercatat/i)).toBeInTheDocument();

    // 3. Renders companion consent section (initially OFF)
    const consentButton = screen.getByRole('button', { name: /Aktifkan Berbagi Dukungan/i });
    expect(consentButton).toBeInTheDocument();

    // Toggle consent ON
    await userEvent.click(consentButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Cabut Izin Berbagi/i })).toBeInTheDocument();
    });

    // 4. Web storage privacy verification: no ART clinical data persisted
    expect(localStorage.getItem('sehaticare.art_care')).toBeNull();
    expect(sessionStorage.getItem('sehaticare.art_care')).toBeNull();
  });

  test('DoctorArtCareSection allows prescribing and viewing adherence evaluation', async () => {
    let doctorData: {
      patient: { public_id: string; display_alias: string | null };
      active_plan: any;
      history: any[];
    } = {
      patient: { public_id: 'usr_pat123', display_alias: 'Bintang Terang' },
      active_plan: null,
      history: []
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method || 'GET').toUpperCase();

      if (url.includes('/art-care/adherence')) {
        return new Response(JSON.stringify({ patient: doctorData.patient, summary: mockAdherence.summary }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/art-care') && method === 'GET') {
        return new Response(JSON.stringify(doctorData), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/art-care') && method === 'POST') {
        const body = JSON.parse(String(init?.body));
        const newPlan = {
          public_id: 'art_plan_new',
          status: 'ACTIVE',
          started_at: new Date().toISOString(),
          ended_at: null,
          clinical_notes: body.clinical_notes,
          change_reason: null,
          prescribed_by: { public_id: 'usr_doc1', display_alias: 'dr. Sarah' },
          items: body.items.map((it: any, idx: number) => ({
            id: `item-${idx}`,
            ...it,
            is_active: true
          }))
        };
        doctorData = {
          ...doctorData,
          active_plan: newPlan,
          history: []
        };
        return new Response(JSON.stringify(newPlan), { status: 201, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    render(<DoctorArtCareSection token="valid-test-token" patientPublicId="usr_pat123" />);

    // Renders empty state and prescription button
    expect(await screen.findByText(/Pasien ini belum memiliki terapi ART aktif/i)).toBeInTheDocument();
    const prescribeButton = screen.getByRole('button', { name: /Resepkan Terapi ART/i });
    await userEvent.click(prescribeButton);

    // Fill form
    const nameInput = screen.getByPlaceholderText(/Contoh: Tenofovir \+ Lamivudine \+ Dolutegravir/i);
    await userEvent.type(nameInput, 'TLD Regimen');

    const submitBtn = screen.getByRole('button', { name: /Simpan Resep Terapi/i });
    await userEvent.click(submitBtn);

    // Verify newly active plan appears
    expect(await screen.findByText(/TLD Regimen/i)).toBeInTheDocument();
  });

  test('Companion assignment list renders adherence support summary when consent is ON and NEVER leaks clinical data', async () => {
    const mockRoster = [
      {
        assignment_id: 'asg-1',
        patient_public_id: 'usr_pat123',
        alias: 'Bintang Terang',
        status: 'ACTIVE',
        started_at: '2026-03-01T08:00:00.000Z',
        facility: {
          id: 'fac-1',
          name: 'Puskesmas Kebon Jeruk'
        }
      }
    ];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/companion/patients/usr_pat123/adherence-support')) {
        return new Response(JSON.stringify(mockCompanionSupportSummary), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/companion/patients')) {
        return new Response(JSON.stringify({ items: mockRoster }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/professional/assignments')) {
        return new Response(JSON.stringify({ items: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    render(
      <MemoryRouter initialEntries={['/counselor/assignments']}>
        <Routes>
          <Route path="/counselor/assignments" element={<CompanionAssignmentsPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Check companion assignment loaded
    expect(await screen.findByText('Bintang Terang')).toBeInTheDocument();

    // Click "Cek Ringkasan Kepatuhan"
    const checkBtn = screen.getByRole('button', { name: /Cek Ringkasan Kepatuhan/i });
    await userEvent.click(checkBtn);

    // Check support adherence summary rendered
    expect(await screen.findByText(/Ringkasan Dukungan \(7 Hari\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Jadwal tercatat:/i)).toBeInTheDocument();
    expect(screen.getByText(/Ditandai selesai:/i)).toBeInTheDocument();
    expect(screen.getByText(/Belum tercatat\/terlewat:/i)).toBeInTheDocument();
    expect(screen.getByText(/85.7%/i)).toBeInTheDocument();

    // Strict Privacy Assertion: ABSOLUTELY NO CLINICAL LEAKAGE in companion UI
    expect(screen.queryByText(/Tenofovir/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Lamivudine/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Dolutegravir/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/TLD/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/CD4/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Viral Load/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/mg/i)).not.toBeInTheDocument();
  });

  test('Companion assignment list renders safe neutral state when consent is OFF', async () => {
    const mockRoster = [
      {
        assignment_id: 'asg-2',
        patient_public_id: 'usr_pat456',
        alias: 'Mentari Pagi',
        status: 'ACTIVE',
        started_at: '2026-03-01T08:00:00.000Z',
        facility: {
          id: 'fac-1',
          name: 'Puskesmas Kebon Jeruk'
        }
      }
    ];

    const mockConsentOffSummary = {
      support_consent_enabled: false,
      summary: null
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/companion/patients/usr_pat456/adherence-support')) {
        return new Response(JSON.stringify(mockConsentOffSummary), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/companion/patients')) {
        return new Response(JSON.stringify({ items: mockRoster }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/professional/assignments')) {
        return new Response(JSON.stringify({ items: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    render(
      <MemoryRouter initialEntries={['/counselor/assignments']}>
        <Routes>
          <Route path="/counselor/assignments" element={<CompanionAssignmentsPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Mentari Pagi')).toBeInTheDocument();

    // Click "Cek Ringkasan Kepatuhan"
    const checkBtn = screen.getByRole('button', { name: /Cek Ringkasan Kepatuhan/i });
    await userEvent.click(checkBtn);

    expect(await screen.findByText(/Pasien belum mengaktifkan berbagi ringkasan dukungan kepatuhan/i)).toBeInTheDocument();
    // No counts rendered
    expect(screen.queryByText(/Jadwal tercatat:/i)).not.toBeInTheDocument();
  });
});
