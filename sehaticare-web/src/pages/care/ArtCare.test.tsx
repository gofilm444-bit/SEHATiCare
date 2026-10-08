import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { PatientArtCareSection } from './PatientArtCareSection';
import { DoctorArtCareSection } from './DoctorArtCareSection';
import { CompanionAssignmentsPage } from '../stage4/ProfessionalRolePages';
import { SideEffectEntry, PatientStockResponse } from '../../api/artCare';

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

describe('AG-06 ART Side-Effects, Personal Stock & Refill Support Frontend', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  const mockSideEffects: SideEffectEntry[] = [
    {
      public_id: 'se-1',
      occurred_at: '2026-08-10T10:00:00.000Z',
      severity: 'MILD',
      symptom_name: 'Mual ringan pagi hari',
      patient_note: 'Membaik setelah minum air hangat',
      status: 'ACTIVE',
      resolved_at: null,
      created_at: '2026-08-10T10:00:00.000Z',
      updated_at: '2026-08-10T10:00:00.000Z',
      disclaimer: 'Catatan ini membantu Anda mengingat keluhan untuk dibahas dengan tenaga kesehatan dan bukan merupakan diagnosis.'
    }
  ];

  const mockStockData: PatientStockResponse = {
    current_stock: {
      public_id: 'stk-1',
      recorded_at: '2026-08-15T08:00:00.000Z',
      quantity_remaining: 14,
      unit: 'tablet',
      estimated_days_remaining: 7,
      notes: null,
      plan_item: null,
      created_at: '2026-08-15T08:00:00.000Z'
    },
    refill_status: {
      refill_status: 'DUE_SOON' as const,
      status_label: 'Perlu Dijadwalkan',
      estimated_days_remaining: 7,
      refill_alert_threshold_days: 7,
      last_recorded_at: '2026-08-15T08:00:00.000Z',
      safety_guidance: null,
      next_control_schedule: {
        starts_at: '2026-08-22T09:00:00.000Z',
        timezone: 'Asia/Jakarta'
      }
    },
    history: []
  };

  const mockRefillSettings = {
    refill_alert_threshold_days: 7
  };

  const mockRefillConsent = {
    is_consent_enabled: false,
    consented_at: null as string | null,
    revoked_at: null as string | null,
    updated_at: '2026-08-15T08:00:00.000Z'
  };

  test('PatientArtCareSection handles side-effect notes, stock tracking, and refill consent', async () => {
    let sideEffectsList = [...mockSideEffects];
    let refillConsentState = { ...mockRefillConsent };
    let currentStockData = { ...mockStockData };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method || 'GET').toUpperCase();

      if (url.includes('/patient/art-care/side-effects/se-1') && method === 'PATCH') {
        const updated = { ...sideEffectsList[0], status: 'RESOLVED' as const, resolved_at: new Date().toISOString() };
        sideEffectsList = [updated];
        return new Response(JSON.stringify(updated), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/patient/art-care/side-effects') && method === 'GET') {
        return new Response(JSON.stringify({ items: sideEffectsList }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/patient/art-care/side-effects') && method === 'POST') {
        const body = JSON.parse(String(init?.body));
        const newEntry = {
          public_id: 'se-new-2',
          occurred_at: body.occurred_at || new Date().toISOString(),
          severity: body.severity,
          symptom_name: body.symptom_name,
          patient_note: body.patient_note || null,
          status: 'ACTIVE' as const,
          resolved_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        sideEffectsList = [newEntry, ...sideEffectsList];
        return new Response(JSON.stringify(newEntry), { status: 201, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/patient/art-care/stock') && method === 'GET') {
        return new Response(JSON.stringify(currentStockData), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/patient/art-care/stock') && method === 'POST') {
        const body = JSON.parse(String(init?.body));
        const newStock = {
          public_id: 'stk-new',
          recorded_at: new Date().toISOString(),
          quantity_remaining: body.quantity_remaining,
          unit: body.unit || 'tablet',
          estimated_days_remaining: body.estimated_days_remaining,
          notes: body.notes || null,
          plan_item: null,
          created_at: new Date().toISOString()
        };
        currentStockData = {
          ...currentStockData,
          current_stock: newStock,
          refill_status: {
            ...currentStockData.refill_status,
            refill_status: 'OK' as const,
            status_label: 'Persediaan Aman',
            estimated_days_remaining: body.estimated_days_remaining
          }
        };
        return new Response(JSON.stringify(newStock), { status: 201, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/patient/art-care/refill-settings')) {
        return new Response(JSON.stringify(mockRefillSettings), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/patient/art-care/refill-support-consent') && method === 'GET') {
        return new Response(JSON.stringify(refillConsentState), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/patient/art-care/refill-support-consent') && method === 'PATCH') {
        refillConsentState = {
          is_consent_enabled: true,
          consented_at: new Date().toISOString(),
          revoked_at: null,
          updated_at: new Date().toISOString()
        };
        return new Response(JSON.stringify(refillConsentState), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/patient/art-care/history')) {
        return new Response(JSON.stringify({ items: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/patient/art-care/adherence')) {
        return new Response(JSON.stringify(mockAdherence), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/patient/art-care/support-consent')) {
        return new Response(JSON.stringify(mockConsentOff), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/patient/art-care')) {
        return new Response(JSON.stringify(mockPatientPlan), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    render(<PatientArtCareSection token="valid-test-token" />);

    // 1. Catatan Efek Samping section renders non-stigmatizing disclaimer
    expect(await screen.findByText(/Catatan Efek Samping/i)).toBeInTheDocument();
    expect(screen.getByText(/Catatan ini membantu Anda mengingat keluhan untuk dibahas dengan tenaga kesehatan dan bukan merupakan diagnosis/i)).toBeInTheDocument();
    expect(screen.getByText('Mual ringan pagi hari')).toBeInTheDocument();

    // Mark as resolved
    const resolveBtn = screen.getByRole('button', { name: /Tandai Selesai/i });
    await userEvent.click(resolveBtn);
    expect(await screen.findByText(/Status keluhan telah ditandai selesai/i)).toBeInTheDocument();

    // Open Add Side Effect Form and verify safety guidance on SEVERE
    const addSideEffectBtn = screen.getByRole('button', { name: /\+ Tambah Catatan/i });
    await userEvent.click(addSideEffectBtn);

    const descInput = screen.getByLabelText(/Gejala \/ Keluhan/i);
    await userEvent.type(descInput, 'Pusing berputar dan pandangan kabur');

    const severitySelect = screen.getByLabelText(/Tingkat Keluhan/i);
    fireEvent.change(severitySelect, { target: { value: 'SEVERE' } });

    // Verify neutral safety guidance appears
    expect(await screen.findByText(/Keluhan berat atau memburuk perlu dinilai tenaga kesehatan/i)).toBeInTheDocument();

    // 2. Persediaan Obat Pribadi & Refill section renders
    expect(screen.getByText(/Persediaan Obat Pribadi & Refill/i)).toBeInTheDocument();
    expect(screen.getByText(/Perlu Dijadwalkan/i)).toBeInTheDocument(); // DUE_SOON badge
    expect(screen.getAllByText(/7 Hari/i).length).toBeGreaterThan(0);

    // Open stock update form
    const updateStockBtn = screen.getByRole('button', { name: /Perbarui Persediaan/i });
    await userEvent.click(updateStockBtn);

    const estDaysInput = screen.getByLabelText(/Estimasi Sisa Hari/i);
    await userEvent.clear(estDaysInput);
    await userEvent.type(estDaysInput, '14');

    const saveStockBtn = screen.getByRole('button', { name: /Simpan Pembaruan/i });
    await userEvent.click(saveStockBtn);

    // 3. Dukungan Refill dari Pendamping consent toggle
    expect(screen.getByText('Dukungan Refill dari Pendamping')).toBeInTheDocument();
    const enableRefillConsentBtn = screen.getByRole('button', { name: /Aktifkan Dukungan Refill/i });
    await userEvent.click(enableRefillConsentBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Cabut Izin Refill/i })).toBeInTheDocument();
    });

    // Zero sensitive browser storage
    expect(localStorage.getItem('sehaticare.art_side_effects')).toBeNull();
    expect(localStorage.getItem('sehaticare.art_medication_stock')).toBeNull();
    expect(sessionStorage.getItem('sehaticare.art_side_effects')).toBeNull();
  });

  test('DoctorArtCareSection displays patient side-effects and stock summary in read-only mode', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/doctor/patients/usr_pat123/art-care/side-effects')) {
        return new Response(JSON.stringify({
          items: mockSideEffects
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/doctor/patients/usr_pat123/art-care/stock-summary')) {
        return new Response(JSON.stringify(mockStockData), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/doctor/patients/usr_pat123/art-care/adherence')) {
        return new Response(JSON.stringify({ patient: { public_id: 'usr_pat123' }, summary: mockAdherence.summary }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/doctor/patients/usr_pat123/art-care')) {
        return new Response(JSON.stringify({ patient: { public_id: 'usr_pat123' }, active_plan: mockPatientPlan.plan, history: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    render(<DoctorArtCareSection token="valid-test-token" patientPublicId="usr_pat123" />);

    // Renders side effects history
    expect(await screen.findByText(/Catatan Keluhan \/ Efek Samping Pasien/i)).toBeInTheDocument();
    expect(screen.getByText('Mual ringan pagi hari')).toBeInTheDocument();
    expect(screen.getByText('Ringan')).toBeInTheDocument();

    // Renders stock & refill status
    expect(screen.getByText(/Status Persediaan Obat & Kesiapan Refill Pasien/i)).toBeInTheDocument();
    expect(screen.getByText('Perlu Dijadwalkan')).toBeInTheDocument();

    // Doctor has NO button to modify patient stock or consent
    expect(screen.queryByRole('button', { name: /Perbarui Persediaan/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Aktifkan Dukungan Refill/i })).not.toBeInTheDocument();
  });

  test('Companion assignment list renders refill support summary when consent is ON and preserves strict privacy', async () => {
    const mockRoster = [
      {
        assignment_id: 'asg-3',
        patient_public_id: 'usr_pat789',
        alias: 'Cahaya Senja',
        status: 'ACTIVE',
        started_at: '2026-03-01T08:00:00.000Z',
        facility: {
          id: 'fac-1',
          name: 'Puskesmas Kebon Jeruk'
        }
      }
    ];

    const mockRefillSupportResponse = {
      support_consent_enabled: true,
      summary: {
        refill_status: 'DUE_SOON' as const,
        coarse_days_bucket: '4_TO_7_DAYS',
        coarse_days_bucket_label: '4 - 7 hari',
        next_control_schedule: {
          starts_at: '2026-08-25T08:00:00.000Z',
          timezone: 'Asia/Jakarta'
        }
      }
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/companion/patients/usr_pat789/refill-support')) {
        return new Response(JSON.stringify(mockRefillSupportResponse), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/companion/patients/usr_pat789/adherence-support')) {
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

    expect(await screen.findByText('Cahaya Senja')).toBeInTheDocument();

    // Click "Cek Status Refill"
    const refillBtn = screen.getByRole('button', { name: /Cek Status Refill/i });
    await userEvent.click(refillBtn);

    // Verify support summary rendered
    expect(await screen.findByText(/Status Kesiapan Refill/i)).toBeInTheDocument();
    expect(screen.getByText(/4 - 7 hari/i)).toBeInTheDocument();
    expect(screen.getByText(/Perlu Dukungan Refill/i)).toBeInTheDocument();

    // Strict Privacy: zero drug names, dosages, exact quantity, side-effect notes
    expect(screen.queryByText(/Tenofovir/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Lamivudine/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Dolutegravir/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/TLD/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Mual/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tablet/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/mg/i)).not.toBeInTheDocument();
  });
});

