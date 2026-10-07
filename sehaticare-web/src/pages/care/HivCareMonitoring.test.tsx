import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { PatientCareMonitoringPage } from '../patient/PatientCareMonitoringPage';
import { DoctorCareMonitoringSection } from '../doctor/DoctorCareMonitoringSection';
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

const mockPatientCareData = {
  care: {
    public_id: 'enr_123',
    status: 'ACTIVE',
    enrolled_at: '2026-03-01T08:00:00.000Z',
    ended_at: null,
    has_active_care: true,
    facility: {
      id: 'fac-1',
      name: 'Puskesmas Kebon Jeruk',
      facility_type: 'PUSKESMAS',
      address: 'Jl. Kebon Jeruk'
    }
  },
  latest_monitoring_date: '2026-08-01T10:00:00.000Z'
};

const mockDoctorCareData = {
  patient: {
    public_id: 'usr_pat123',
    display_alias: 'Bintang Terang'
  },
  care: {
    public_id: 'enr_123',
    status: 'ACTIVE',
    enrolled_at: '2026-03-01T08:00:00.000Z',
    facility: {
      id: 'fac-1',
      name: 'Puskesmas Kebon Jeruk'
    }
  },
  latest_monitoring_date: '2026-08-01T10:00:00.000Z'
};

const mockPatientMonitoringEntries = [
  {
    public_id: 'mon_test123',
    recorded_at: '2026-08-01T10:00:00.000Z',
    weight_kg: 62.5,
    cd4_count_cells_mm3: 520,
    viral_load_copies_ml: 40,
    viral_load_interpretation: 'NOT_DETECTED',
    tb_screening_result: 'NEGATIF',
    general_condition: 'Kondisi stabil, tidak ada keluhan penyerta',
    patient_note: 'Minum obat teratur tiap pukul 20:00',
    source: 'DOCTOR'
    // Notice: clinical_note_private is NEVER present in patient API responses!
  }
];

const mockDoctorMonitoringEntries = [
  {
    public_id: 'mon_test123',
    recorded_at: '2026-08-01T10:00:00.000Z',
    weight_kg: 62.5,
    cd4_count_cells_mm3: 520,
    viral_load_copies_ml: 40,
    viral_load_interpretation: 'NOT_DETECTED',
    tb_screening_result: 'NEGATIF',
    general_condition: 'Kondisi stabil',
    clinical_note_private: 'CATATAN_DOKTER_SANGAT_RAHASIA_DOKTER_ONLY',
    patient_note: 'Minum obat teratur tiap pukul 20:00',
    source: 'DOCTOR'
  }
];

describe('AG-04 HIV Care Enrollment & Clinical Monitoring Frontend', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  test('patient care page renders care status and monitoring list, and NEVER renders private doctor notes', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/patient/care')) {
        return new Response(JSON.stringify(mockPatientCareData), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/patient/monitoring')) {
        return new Response(JSON.stringify({ items: mockPatientMonitoringEntries, total: 1, page: 1, limit: 30 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    render(
      <MemoryRouter initialEntries={['/patient/care']}>
        <Routes>
          <Route path="/patient/care" element={<PatientCareMonitoringPage />} />
        </Routes>
      </MemoryRouter>
    );

    // 1. Care Status
    expect(await screen.findByText(/Perawatan Aktif Terdaftar/i)).toBeInTheDocument();
    expect(screen.getByText('Puskesmas Kebon Jeruk')).toBeInTheDocument();

    // 2. Monitoring entries
    expect(screen.getByText(/520/)).toBeInTheDocument();
    expect(screen.getByText(/40/)).toBeInTheDocument();
    expect(screen.getByText(/Kondisi stabil, tidak ada keluhan penyerta/)).toBeInTheDocument();

    // 3. Privacy check: doctor private note is NOT in DOM
    expect(screen.queryByText(/CATATAN_DOKTER_SANGAT_RAHASIA/i)).not.toBeInTheDocument();

    // 4. Web storage privacy check
    expect(localStorage.getItem('sehaticare.hiv_monitoring')).toBeNull();
    expect(sessionStorage.getItem('sehaticare.hiv_monitoring')).toBeNull();
  });

  test('patient can submit self-report entry with safe non-clinical fields only', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method || 'GET').toUpperCase();
      if (url.includes('/patient/care')) {
        return new Response(JSON.stringify(mockPatientCareData), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/patient/monitoring') && method === 'GET') {
        return new Response(JSON.stringify({ items: [], total: 0, page: 1, limit: 30 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/patient/monitoring') && method === 'POST') {
        const payload = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            public_id: 'mon_self_new',
            recorded_at: payload.recorded_at,
            weight_kg: payload.weight_kg,
            general_condition: payload.general_condition,
            patient_note: payload.patient_note,
            source: 'PATIENT'
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/patient/care']}>
        <Routes>
          <Route path="/patient/care" element={<PatientCareMonitoringPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Perawatan Aktif Terdaftar/i)).toBeInTheDocument();

    // Open self-report form
    const toggleBtn = screen.getByRole('button', { name: /Tambah Catatan Mandiri/i });
    await user.click(toggleBtn);

    // Form should not contain CD4, Viral Load, or TB screening fields
    expect(screen.queryByLabelText(/CD4/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Viral Load/i)).not.toBeInTheDocument();

    // Fill safe fields
    const weightInput = screen.getByLabelText(/Berat Badan/i);
    const conditionInput = screen.getByLabelText(/Kondisi Umum/i);
    const noteInput = screen.getByLabelText(/Catatan Tambahan/i);

    fireEvent.change(weightInput, { target: { value: '61.5' } });
    fireEvent.change(conditionInput, { target: { value: 'Sehat bugar' } });
    fireEvent.change(noteInput, { target: { value: 'Tidur cukup 8 jam' } });

    const submitBtn = screen.getByRole('button', { name: /Simpan Catatan/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Catatan pemantauan mandiri berhasil disimpan/i)).toBeInTheDocument();
    });

    // Verify payload sent
    const postCall = fetchSpy.mock.calls.find(c => String(c[0]).includes('/patient/monitoring') && (c[1] as any)?.method === 'POST');
    expect(postCall).toBeDefined();
    const sentData = JSON.parse(String((postCall![1] as any).body));
    expect(sentData.weight_kg).toBe(61.5);
    expect(sentData.general_condition).toBe('Sehat bugar');
    expect(sentData.patient_note).toBe('Tidur cukup 8 jam');
    expect(sentData.cd4_count_cells_mm3).toBeUndefined();
  });

  test('doctor care monitoring section allows doctor to view and submit clinical entry with private note', async () => {
    let doctorEntries = [...mockDoctorMonitoringEntries];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method || 'GET').toUpperCase();
      if (url.includes('/doctor/consultations/cons-123/care')) {
        return new Response(JSON.stringify(mockDoctorCareData), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/doctor/consultations/cons-123/monitoring') && method === 'GET') {
        return new Response(JSON.stringify({ items: doctorEntries, total: doctorEntries.length, page: 1, limit: 50 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/doctor/consultations/cons-123/monitoring') && method === 'POST') {
        const payload = JSON.parse(String(init?.body));
        const newEntry = {
          public_id: 'mon_doc_new',
          recorded_at: payload.recorded_at,
          weight_kg: payload.weight_kg,
          cd4_count_cells_mm3: payload.cd4_count_cells_mm3,
          viral_load_copies_ml: payload.viral_load_copies_ml,
          viral_load_interpretation: payload.viral_load_interpretation,
          tb_screening_result: payload.tb_screening_result,
          general_condition: payload.general_condition,
          clinical_note_private: payload.clinical_note_private,
          patient_note: null,
          source: 'DOCTOR'
        };
        doctorEntries.push(newEntry as any);
        return new Response(JSON.stringify(newEntry), { status: 201, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DoctorCareMonitoringSection token="doc-token" consultationId="cons-123" />
      </MemoryRouter>
    );

    // Initial render displays patient care status & entries
    expect(await screen.findByText(/Pemantauan Klinis & Care Enrollment Pasien/i)).toBeInTheDocument();
    expect(await screen.findByText('CATATAN_DOKTER_SANGAT_RAHASIA_DOKTER_ONLY')).toBeInTheDocument();

    // Open doctor entry form
    const addBtn = screen.getByRole('button', { name: /Tambah Pemantauan/i });
    await user.click(addBtn);

    // Form inputs exist for CD4, Viral Load, TB, and private notes
    expect(screen.getByLabelText(/CD4/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Viral Load \(copies\/mL\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Skrining/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Catatan Privat Dokter/i)).toBeInTheDocument();

    // Fill form
    fireEvent.change(screen.getByLabelText(/CD4/i), { target: { value: '600' } });
    fireEvent.change(screen.getByLabelText(/Viral Load \(copies\/mL\)/i), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText(/Skrining/i), { target: { value: 'NEGATIF' } });
    fireEvent.change(screen.getByLabelText(/Catatan Privat Dokter/i), { target: { value: 'Respons terapi memuaskan' } });

    const submitDocBtn = screen.getByRole('button', { name: /Simpan Catatan Pemantauan/i });
    await user.click(submitDocBtn);

    await waitFor(() => {
      expect(screen.getByText(/Catatan pemantauan klinis berhasil disimpan/i)).toBeInTheDocument();
    });
  });

  test('companion assignments page preserves strict privacy wall and NEVER leaks clinical data', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/companion/patients')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                assignment_id: 'asg_1',
                patient_public_id: 'usr_pat123',
                alias: 'Bintang Terang',
                status: 'ACTIVE',
                started_at: '2026-04-01T08:00:00.000Z',
                facility: { id: 'fac_1', name: 'Puskesmas Kebon Jeruk' }
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/professional/assignments')) {
        return new Response(JSON.stringify({ items: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    render(
      <MemoryRouter>
        <CompanionAssignmentsPage />
      </MemoryRouter>
    );

    // Companion sees patient alias & roster
    expect(await screen.findByText('Bintang Terang')).toBeInTheDocument();

    // Privacy wall verification: absolutely no clinical fields or values leak into companion UI
    expect(screen.queryByText(/CD4/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Viral Load/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Skrining TB/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/CATATAN_DOKTER/i)).not.toBeInTheDocument();
  });
});
