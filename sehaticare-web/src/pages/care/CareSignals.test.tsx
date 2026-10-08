import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { PatientCareSignalsSection } from './PatientCareSignalsSection';
import { DoctorCareSignalsQueue } from '../doctor/DoctorCareSignalsQueue';
import { CompanionFollowUpSection } from '../stage4/CompanionFollowUpSection';
import * as careSignalsApi from '../../api/careSignals';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    token: 'valid-test-token',
    user: { role: 'PASIEN', public_id: 'usr_pat123' },
    isAuthenticated: true
  })
}));

describe('AG-07: Care Signals, Overdue Follow-up & Human Escalation UX', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('Patient UX: renders Perlu Tindak Lanjut section, empathetic guidance, and follow-up consent toggle', async () => {
    const user = userEvent.setup();

    vi.spyOn(careSignalsApi, 'fetchPatientCareSignals').mockResolvedValue({
      items: [
        {
          public_id: 'sig_1',
          signal_type: 'FOLLOW_UP_OVERDUE',
          priority: 'ATTENTION',
          status: 'OPEN',
          detected_at: '2026-10-01T08:00:00.000Z',
          display_title: 'Jadwal Kontrol Telah Terlewat',
          display_message: 'Jadwal kontrol Anda telah terlewat. Silakan atur kembali jadwal kontrol untuk kesinambungan layanan.',
          safety_guidance: null,
          cta: { label: 'Atur Jadwal Kontrol', action: 'SCHEDULE_FOLLOW_UP' },
          acknowledged_at: null,
          resolved_at: null
        },
        {
          public_id: 'sig_2',
          signal_type: 'SEVERE_SIDE_EFFECT_REPORTED',
          priority: 'PRIORITY',
          status: 'OPEN',
          detected_at: '2026-10-02T08:00:00.000Z',
          display_title: 'Keluhan Perlu Penilaian Tenaga Kesehatan',
          display_message: 'Keluhan berat atau memburuk perlu dinilai tenaga kesehatan. Jangan ragu untuk berkonsultasi.',
          safety_guidance: 'Keluhan berat atau memburuk perlu dinilai tenaga kesehatan. Jika Anda mengalami keadaan gawat darurat, segera cari pertolongan melalui layanan kesehatan/darurat setempat.',
          cta: { label: 'Konsultasi Dokter', action: 'DOCTOR_CONSULTATION' },
          acknowledged_at: null,
          resolved_at: null
        }
      ]
    });

    vi.spyOn(careSignalsApi, 'fetchFollowUpSupportConsent').mockResolvedValue({
      is_consent_enabled: false,
      consented_at: null,
      revoked_at: null,
      updated_at: null
    });

    const updateConsentSpy = vi.spyOn(careSignalsApi, 'updateFollowUpSupportConsent').mockResolvedValue({
      is_consent_enabled: true,
      consented_at: '2026-10-08T12:00:00.000Z',
      revoked_at: null,
      updated_at: '2026-10-08T12:00:00.000Z'
    });

    render(
      <MemoryRouter>
        <PatientCareSignalsSection token="valid-test-token" />
      </MemoryRouter>
    );

    expect(await screen.findByText('Perlu Tindak Lanjut')).toBeInTheDocument();
    expect(await screen.findByText('Jadwal Kontrol Telah Terlewat')).toBeInTheDocument();
    expect(await screen.findByText('Keluhan Perlu Penilaian Tenaga Kesehatan')).toBeInTheDocument();
    expect(screen.getByText(/keadaan gawat darurat/i)).toBeInTheDocument();

    // Toggle follow-up consent
    const toggleBtn = screen.getByRole('button', { name: /Aktifkan Dukungan/i });
    await user.click(toggleBtn);

    await waitFor(() => {
      expect(updateConsentSpy).toHaveBeenCalledWith(true);
    });
  });

  test('Doctor UX: renders Antrean Tindak Lanjut with priority badges and action capabilities', async () => {
    const user = userEvent.setup();

    vi.spyOn(careSignalsApi, 'fetchDoctorCareSignals').mockResolvedValue({
      items: [
        {
          public_id: 'sig_doc_1',
          patient_public_id: 'pat_1',
          patient_display_alias: 'Bintang Terang',
          signal_type: 'SEVERE_SIDE_EFFECT_REPORTED',
          signal_scope: 'CLINICAL',
          priority: 'PRIORITY',
          status: 'OPEN',
          clinical_title: 'Laporan Efek Samping Berat',
          detected_at: '2026-10-05T08:00:00.000Z',
          overdue_bucket: null,
          overdue_days: null,
          request_category: null,
          preferred_contact_time: null,
          acknowledged_at: null,
          resolved_at: null,
          dismissed_at: null,
          actions: []
        }
      ]
    });

    const updateStatusSpy = vi.spyOn(careSignalsApi, 'updateDoctorCareSignalStatus').mockResolvedValue({} as any);

    render(
      <MemoryRouter>
        <DoctorCareSignalsQueue />
      </MemoryRouter>
    );

    expect(await screen.findByText('Antrean Tindak Lanjut')).toBeInTheDocument();
    expect(await screen.findByText('Laporan Efek Samping Berat')).toBeInTheDocument();
    expect(screen.getByText('Bintang Terang')).toBeInTheDocument();
    expect(screen.getByText('PRIORITAS')).toBeInTheDocument();

    const ackBtn = screen.getByRole('button', { name: /Tandai Dilihat/i });
    await user.click(ackBtn);

    await waitFor(() => {
      expect(updateStatusSpy).toHaveBeenCalledWith('sig_doc_1', 'ACKNOWLEDGED');
    });
  });

  test('Companion UX: renders Perlu Dukungan queue with strictly generic non-clinical wording', async () => {
    const user = userEvent.setup();

    vi.spyOn(careSignalsApi, 'fetchCompanionFollowUpSignals').mockResolvedValue({
      items: [
        {
          public_id: 'sig_comp_1',
          patient_public_id: 'pat_1',
          patient_display_alias: 'Pasien Dampingan 1',
          signal_type: 'FOLLOW_UP_OVERDUE',
          priority: 'ATTENTION',
          status: 'OPEN',
          support_title: 'Kontrol perlu ditindaklanjuti',
          support_description: 'Jadwal kontrol terlewat. Mohon dampingi untuk tindak lanjut penjadwalan.',
          overdue_bucket: '1_TO_7_DAYS',
          preferred_contact_time: null,
          detected_at: '2026-10-04T08:00:00.000Z',
          acknowledged_at: null,
          actions: []
        },
        {
          public_id: 'sig_comp_2',
          patient_public_id: 'pat_2',
          patient_display_alias: 'Pasien Dampingan 2',
          signal_type: 'REFILL_NEEDS_ATTENTION',
          priority: 'ATTENTION',
          status: 'OPEN',
          support_title: 'Persediaan kesehatan perlu diperiksa',
          support_description: 'Pengguna melaporkan persediaan menipis. Mohon tanyakan status pengambilan berikutnya.',
          overdue_bucket: null,
          preferred_contact_time: null,
          detected_at: '2026-10-06T08:00:00.000Z',
          acknowledged_at: null,
          actions: []
        }
      ]
    });

    const actionSpy = vi.spyOn(careSignalsApi, 'recordCompanionCareSignalAction').mockResolvedValue({} as any);

    render(
      <MemoryRouter>
        <CompanionFollowUpSection />
      </MemoryRouter>
    );

    expect(await screen.findByText('Perlu Dukungan')).toBeInTheDocument();
    expect(await screen.findByText('Kontrol perlu ditindaklanjuti')).toBeInTheDocument();
    expect(await screen.findByText('Persediaan kesehatan perlu diperiksa')).toBeInTheDocument();

    // Verify clinical terms are NOT rendered
    expect(screen.queryByText(/Efek samping berat/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ARV/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/HIV/i)).not.toBeInTheDocument();

    const seenButtons = screen.getAllByRole('button', { name: /Tandai sudah dilihat/i });
    await user.click(seenButtons[0]);

    await waitFor(() => {
      expect(actionSpy).toHaveBeenCalledWith('sig_comp_1', { action_type: 'ACKNOWLEDGED' });
    });
  });
});
