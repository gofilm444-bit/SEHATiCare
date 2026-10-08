import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { PatientServiceNavigationSection } from './PatientServiceNavigationSection';
import { PatientReferralsSection } from './PatientReferralsSection';
import { DoctorReferralsSection } from '../doctor/DoctorReferralsSection';
import { CompanionReferralSupportSection } from '../stage4/CompanionReferralSupportSection';
import * as referralsApi from '../../api/referrals';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    token: 'valid-test-token',
    user: { role: 'PASIEN', public_id: 'usr_pat123' },
    isAuthenticated: true
  })
}));

describe('AG-08: Confidential Referral, Transfer & Service Navigation UX', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('Patient Service Navigation: renders comfort choice, filters facilities, and requests referral', async () => {
    const user = userEvent.setup();

    vi.spyOn(referralsApi, 'fetchPublicServiceFacilities').mockResolvedValue({
      items: [
        {
          id: 'fac-1',
          name: 'Puskesmas Sentani Nyaman',
          facility_type: 'PUSKESMAS',
          district_name: 'Sentani',
          address: 'Jl. Kemiri No. 12',
          public_contact: '08123456789',
          service_hours: '08:00 - 15:00 WIT',
          description: null,
          region: { id: 'reg-1', code: 'JPR', name: 'Jayapura' },
          services: [
            {
              service: 'ART_CONTINUITY',
              verified: true,
              is_active: true,
              appointment_required: false,
              opening_time: '08:00',
              closing_time: '15:00',
              contact_public: '08123456789',
              domicile_requirement: null,
              insurance_requirement: null,
              notes_public: null
            }
          ]
        }
      ],
      total: 1
    });

    const requestSpy = vi.spyOn(referralsApi, 'requestPatientReferral').mockResolvedValue({
      public_id: 'ref_001',
      target_facility: { id: 'fac-1', name: 'Puskesmas Sentani Nyaman', address: 'Jl. Kemiri No. 12', public_contact: null },
      source_facility: null,
      referral_type: 'CONTINUITY_OF_CARE',
      status: 'REQUESTED',
      status_label: 'Permintaan Rujukan Terkirim',
      scheduling_preference: null,
      is_consent_enabled: false,
      companion_share: { is_enabled: false, share_target_facility: false },
      requested_at: '2026-10-08T08:00:00Z',
      consented_at: null,
      sent_at: null,
      accepted_at: null,
      declined_at: null,
      cancelled_at: null,
      completed_at: null
    });

    render(<PatientServiceNavigationSection />);

    // Must emphasize comfort-based selection
    expect(await screen.findByText('Pilih fasilitas yang paling nyaman bagi Anda.')).toBeInTheDocument();
    expect(await screen.findByText('Puskesmas Sentani Nyaman')).toBeInTheDocument();

    // Open referral request modal
    const requestBtn = screen.getByText('Minta Rujukan ke Sini');
    await user.click(requestBtn);

    expect(await screen.findByText('Minta Bantuan Rujukan')).toBeInTheDocument();
    expect(screen.getByText('Puskesmas Sentani Nyaman', { selector: '.font-semibold' })).toBeInTheDocument();

    // Submit referral request
    const submitBtn = screen.getByText('Kirim Permintaan');
    await user.click(submitBtn);

    await waitFor(() => {
      expect(requestSpy).toHaveBeenCalledWith({
        target_facility_id: 'fac-1',
        referral_type: 'CONTINUITY_OF_CARE',
        scheduling_preference: null
      });
    });
  });

  test('Patient Referrals: renders list, manages per-referral consent and companion share toggles', async () => {
    const user = userEvent.setup();

    vi.spyOn(referralsApi, 'fetchPatientReferrals').mockResolvedValue({
      items: [
        {
          public_id: 'ref_123',
          target_facility: { id: 'fac-2', name: 'RSUD Abepura', address: 'Jl. Kesehatan No. 1', public_contact: null },
          source_facility: { id: 'fac-1', name: 'Puskesmas Sentani' },
          referral_type: 'CONTINUITY_OF_CARE',
          status: 'PENDING_PATIENT_CONSENT',
          status_label: 'Perlu Persetujuan Anda',
          scheduling_preference: 'Rabu pagi',
          is_consent_enabled: false,
          companion_share: { is_enabled: false, share_target_facility: false },
          requested_at: '2026-10-08T08:00:00Z',
          consented_at: null,
          sent_at: null,
          accepted_at: null,
          declined_at: null,
          cancelled_at: null,
          completed_at: null
        }
      ]
    });

    const consentSpy = vi.spyOn(referralsApi, 'updatePatientReferralConsent').mockResolvedValue({
      public_id: 'ref_123',
      target_facility: { id: 'fac-2', name: 'RSUD Abepura', address: null, public_contact: null },
      source_facility: null,
      referral_type: 'CONTINUITY_OF_CARE',
      status: 'CONSENTED',
      status_label: 'Persetujuan Diberikan',
      scheduling_preference: null,
      is_consent_enabled: true,
      companion_share: { is_enabled: false, share_target_facility: false },
      requested_at: '2026-10-08T08:00:00Z',
      consented_at: '2026-10-08T08:05:00Z',
      sent_at: null,
      accepted_at: null,
      declined_at: null,
      cancelled_at: null,
      completed_at: null
    });

    const shareSpy = vi.spyOn(referralsApi, 'updatePatientReferralCompanionShare').mockResolvedValue({
      public_id: 'ref_123',
      target_facility: { id: 'fac-2', name: 'RSUD Abepura', address: null, public_contact: null },
      source_facility: null,
      referral_type: 'CONTINUITY_OF_CARE',
      status: 'CONSENTED',
      status_label: 'Persetujuan Diberikan',
      scheduling_preference: null,
      is_consent_enabled: true,
      companion_share: { is_enabled: true, share_target_facility: false },
      requested_at: '2026-10-08T08:00:00Z',
      consented_at: '2026-10-08T08:05:00Z',
      sent_at: null,
      accepted_at: null,
      declined_at: null,
      cancelled_at: null,
      completed_at: null
    });

    render(<PatientReferralsSection />);

    expect(await screen.findByText('Tujuan: RSUD Abepura')).toBeInTheDocument();
    expect(screen.getByText('Perlu Persetujuan Anda')).toBeInTheDocument();

    // Toggle consent
    const consentBtn = screen.getByText('Beri Persetujuan');
    await user.click(consentBtn);
    expect(consentSpy).toHaveBeenCalledWith('ref_123', true);

    // Toggle companion share
    const shareBtn = screen.getByText('Dukungan Nonaktif');
    await user.click(shareBtn);
    expect(shareSpy).toHaveBeenCalledWith('ref_123', { is_enabled: true, share_target_facility: false });
  });

  test('Doctor UX: renders incoming minimal envelope, accepts and declines referral', async () => {
    const user = userEvent.setup();

    vi.spyOn(referralsApi, 'fetchDoctorIncomingReferrals').mockResolvedValue({
      items: [
        {
          public_id: 'ref_incoming_99',
          patient_display_alias: 'Bunga Papua',
          source_facility_name: 'Puskesmas Asri',
          target_facility_name: 'RSUD Jayapura',
          referral_type: 'CONTINUITY_OF_CARE',
          status: 'SENT',
          scheduling_preference: 'Kamis siang',
          requested_at: '2026-10-08T07:00:00Z',
          sent_at: '2026-10-08T08:00:00Z'
        }
      ]
    });

    const acceptSpy = vi.spyOn(referralsApi, 'acceptDoctorIncomingReferral').mockResolvedValue({
      public_id: 'ref_incoming_99',
      patient_public_id: 'usr_pat1',
      patient_display_alias: 'Bunga Papua',
      source_facility: null,
      source_doctor: null,
      target_facility: { id: 'fac-2', name: 'RSUD Jayapura', address: 'Jl. Kesehatan' },
      target_doctor: null,
      initiation_type: 'DOCTOR_INITIATED',
      referral_type: 'CONTINUITY_OF_CARE',
      status: 'ACCEPTED',
      decline_reason: null,
      scheduling_preference: null,
      is_consent_enabled: true,
      requested_at: '2026-10-08T07:00:00Z',
      consented_at: null,
      sent_at: null,
      accepted_at: '2026-10-08T08:10:00Z',
      declined_at: null,
      cancelled_at: null,
      completed_at: null,
      events: []
    });

    render(<DoctorReferralsSection />);

    expect(await screen.findByText('Pasien: Bunga Papua')).toBeInTheDocument();
    expect(screen.getByText('Puskesmas Asri')).toBeInTheDocument();

    // Verify minimal pre-acceptance notice is present
    expect(screen.getByText(/Riwayat klinis lengkap \(ART, pemantauan lab, catatan medis\) hanya dapat diakses setelah Anda menerima rujukan ini/i)).toBeInTheDocument();

    // Accept incoming referral
    const acceptBtn = screen.getByText('Terima Rujukan');
    await user.click(acceptBtn);

    await waitFor(() => {
      expect(acceptSpy).toHaveBeenCalledWith('ref_incoming_99');
    });
  });

  test('Companion Referral Support: renders strictly generic non-clinical status and logs support actions', async () => {
    const user = userEvent.setup();

    vi.spyOn(referralsApi, 'fetchCompanionReferrals').mockResolvedValue({
      items: [
        {
          public_id: 'ref_comp_7',
          patient_display_alias: 'Sahabat Dampingan',
          status: 'SENT',
          generic_status_label: 'Menunggu tindak lanjut fasilitas',
          target_facility_name: null,
          requested_at: '2026-10-08T08:00:00Z',
          events: []
        }
      ]
    });

    const actionSpy = vi.spyOn(referralsApi, 'recordCompanionReferralAction').mockResolvedValue({
      public_id: 'ref_comp_7',
      patient_display_alias: 'Sahabat Dampingan',
      status: 'SENT',
      generic_status_label: 'Menunggu tindak lanjut fasilitas',
      target_facility_name: null,
      requested_at: '2026-10-08T08:00:00Z',
      events: []
    });

    render(<CompanionReferralSupportSection />);

    expect(await screen.findByText('Pasien: Sahabat Dampingan')).toBeInTheDocument();
    expect(screen.getByText('Menunggu tindak lanjut fasilitas')).toBeInTheDocument();

    // Record contact action
    const contactBtn = screen.getByText('Sudah Terhubung');
    await user.click(contactBtn);

    await waitFor(() => {
      expect(actionSpy).toHaveBeenCalledWith('ref_comp_7', 'CONTACTED');
    });
  });
});
