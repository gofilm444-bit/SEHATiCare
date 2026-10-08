import { apiFetch } from './client';

export interface PublicFacilityService {
  service: string;
  verified: boolean;
  is_active: boolean;
  appointment_required: boolean;
  opening_time: string | null;
  closing_time: string | null;
  contact_public: string | null;
  domicile_requirement: string | null;
  insurance_requirement: string | null;
  notes_public: string | null;
}

export interface PublicServiceFacility {
  id: string;
  name: string;
  facility_type: 'PUSKESMAS' | 'RUMAH_SAKIT' | 'KLINIK';
  district_name: string | null;
  address: string;
  public_contact: string | null;
  service_hours: string;
  description: string | null;
  region: {
    id: string;
    code: string;
    name: string;
  } | null;
  services: PublicFacilityService[];
}

export interface PatientReferral {
  public_id: string;
  target_facility: {
    id: string | null;
    name: string;
    address: string | null;
    public_contact: string | null;
  };
  source_facility: {
    id: string;
    name: string;
  } | null;
  referral_type: string;
  status: string;
  status_label: string;
  scheduling_preference: string | null;
  is_consent_enabled: boolean;
  companion_share: {
    is_enabled: boolean;
    share_target_facility: boolean;
  };
  requested_at: string;
  consented_at: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  cancelled_at: string | null;
  completed_at: string | null;
}

export interface DoctorOutgoingReferral {
  public_id: string;
  patient_public_id: string | null;
  patient_display_alias: string;
  source_facility: { id: string; name: string } | null;
  source_doctor: { id: string; display_alias: string | null } | null;
  target_facility: {
    id: string;
    name: string;
    address: string;
  };
  target_doctor: { id: string; display_alias: string | null } | null;
  initiation_type: string;
  referral_type: string;
  status: string;
  decline_reason: string | null;
  scheduling_preference: string | null;
  is_consent_enabled: boolean;
  requested_at: string;
  consented_at: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  cancelled_at: string | null;
  completed_at: string | null;
  events: Array<{
    id: string;
    event_type: string;
    occurred_at: string;
    safe_reason_code: string | null;
    actor_role: string | null;
  }>;
}

export interface DoctorIncomingReferralEnvelope {
  public_id: string;
  patient_display_alias: string;
  source_facility_name: string;
  target_facility_name: string;
  referral_type: string;
  status: string;
  scheduling_preference: string | null;
  requested_at: string;
  sent_at: string | null;
}

export interface CompanionReferral {
  public_id: string;
  patient_display_alias: string;
  status: string;
  generic_status_label: string;
  target_facility_name: string | null;
  requested_at: string;
  events: Array<{
    id: string;
    event_type: string;
    occurred_at: string;
  }>;
}

export interface DestinationClinician {
  id: string;
  public_id: string;
  display_alias: string;
  facility_name: string | null;
}

export interface AdminReferralSummary {
  total_requested: number;
  total_sent: number;
  total_accepted: number;
  total_declined: number;
  total_completed: number;
  by_type: Record<string, number>;
  by_facility: Record<string, number>;
}

// ==========================================
// PUBLIC DIRECTORY
// ==========================================

export async function fetchPublicServiceFacilities(query?: {
  region_id?: string;
  facility_type?: 'PUSKESMAS' | 'RUMAH_SAKIT' | 'KLINIK';
  service_type?: string;
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: PublicServiceFacility[]; total: number }> {
  const params = new URLSearchParams();
  if (query?.region_id) params.set('region_id', query.region_id);
  if (query?.facility_type) params.set('facility_type', query.facility_type);
  if (query?.service_type) params.set('service_type', query.service_type);
  if (query?.q) params.set('q', query.q);
  if (query?.limit) params.set('limit', String(query.limit));
  if (query?.offset) params.set('offset', String(query.offset));

  const qs = params.toString();
  return apiFetch<{ items: PublicServiceFacility[]; total: number }>(
    `/public/service-facilities${qs ? `?${qs}` : ''}`
  );
}

export async function fetchPublicServiceFacilityById(facilityId: string): Promise<PublicServiceFacility> {
  return apiFetch<PublicServiceFacility>(`/public/service-facilities/${facilityId}`);
}

// ==========================================
// PATIENT APIS
// ==========================================

export async function fetchPatientReferrals(): Promise<{ items: PatientReferral[] }> {
  return apiFetch<{ items: PatientReferral[] }>('/patient/referrals');
}

export async function fetchPatientReferralDetail(referralId: string): Promise<PatientReferral> {
  return apiFetch<PatientReferral>(`/patient/referrals/${referralId}`);
}

export async function requestPatientReferral(data: {
  target_facility_id: string;
  referral_type?: string;
  scheduling_preference?: string | null;
}): Promise<PatientReferral> {
  return apiFetch<PatientReferral>('/patient/referrals/request', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function updatePatientReferralConsent(
  referralId: string,
  isConsentEnabled: boolean
): Promise<PatientReferral> {
  return apiFetch<PatientReferral>(`/patient/referrals/${referralId}/consent`, {
    method: 'PATCH',
    body: JSON.stringify({ is_consent_enabled: isConsentEnabled })
  });
}

export async function cancelPatientReferral(referralId: string): Promise<PatientReferral> {
  return apiFetch<PatientReferral>(`/patient/referrals/${referralId}/cancel`, {
    method: 'POST'
  });
}

export async function updatePatientReferralCompanionShare(
  referralId: string,
  data: {
    is_enabled: boolean;
    share_target_facility?: boolean;
  }
): Promise<PatientReferral> {
  return apiFetch<PatientReferral>(`/patient/referrals/${referralId}/companion-share`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  });
}

// ==========================================
// DOCTOR APIS — SOURCE
// ==========================================

export async function fetchDoctorPatientReferrals(
  patientId: string
): Promise<{ items: DoctorOutgoingReferral[] }> {
  return apiFetch<{ items: DoctorOutgoingReferral[] }>(`/doctor/patients/${patientId}/referrals`);
}

export async function createDoctorReferralDraft(
  patientId: string,
  data: {
    target_facility_id: string;
    target_doctor_id?: string | null;
    referral_type: string;
    scheduling_preference?: string | null;
  }
): Promise<DoctorOutgoingReferral> {
  return apiFetch<DoctorOutgoingReferral>(`/doctor/patients/${patientId}/referrals`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function updateDoctorReferralDraft(
  referralId: string,
  data: {
    target_facility_id?: string;
    target_doctor_id?: string | null;
    referral_type?: string;
    scheduling_preference?: string | null;
  }
): Promise<DoctorOutgoingReferral> {
  return apiFetch<DoctorOutgoingReferral>(`/doctor/referrals/${referralId}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  });
}

export async function requestDoctorReferralConsent(referralId: string): Promise<DoctorOutgoingReferral> {
  return apiFetch<DoctorOutgoingReferral>(`/doctor/referrals/${referralId}/request-consent`, {
    method: 'POST'
  });
}

export async function sendDoctorReferral(referralId: string): Promise<DoctorOutgoingReferral> {
  return apiFetch<DoctorOutgoingReferral>(`/doctor/referrals/${referralId}/send`, {
    method: 'POST'
  });
}

export async function cancelDoctorReferral(referralId: string): Promise<DoctorOutgoingReferral> {
  return apiFetch<DoctorOutgoingReferral>(`/doctor/referrals/${referralId}/cancel`, {
    method: 'POST'
  });
}

export async function completeDoctorReferral(referralId: string): Promise<DoctorOutgoingReferral> {
  return apiFetch<DoctorOutgoingReferral>(`/doctor/referrals/${referralId}/complete`, {
    method: 'POST'
  });
}

export async function fetchEligibleDestinationClinicians(
  facilityId: string
): Promise<{ items: DestinationClinician[] }> {
  return apiFetch<{ items: DestinationClinician[] }>(
    `/doctor/referral-destinations/${facilityId}/clinicians`
  );
}

// ==========================================
// DOCTOR APIS — RECEIVING
// ==========================================

export async function fetchDoctorIncomingReferrals(): Promise<{ items: DoctorIncomingReferralEnvelope[] }> {
  return apiFetch<{ items: DoctorIncomingReferralEnvelope[] }>('/doctor/incoming-referrals');
}

export async function fetchDoctorIncomingReferralDetail(
  referralId: string
): Promise<DoctorIncomingReferralEnvelope> {
  return apiFetch<DoctorIncomingReferralEnvelope>(`/doctor/incoming-referrals/${referralId}`);
}

export async function acceptDoctorIncomingReferral(referralId: string): Promise<DoctorOutgoingReferral> {
  return apiFetch<DoctorOutgoingReferral>(`/doctor/incoming-referrals/${referralId}/accept`, {
    method: 'POST'
  });
}

export async function declineDoctorIncomingReferral(
  referralId: string,
  reason: string
): Promise<DoctorOutgoingReferral> {
  return apiFetch<DoctorOutgoingReferral>(`/doctor/incoming-referrals/${referralId}/decline`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  });
}

// ==========================================
// COMPANION APIS
// ==========================================

export async function fetchCompanionReferrals(): Promise<{ items: CompanionReferral[] }> {
  return apiFetch<{ items: CompanionReferral[] }>('/companion/referral-support');
}

export async function fetchCompanionPatientReferrals(
  patientId: string
): Promise<{ items: CompanionReferral[] }> {
  return apiFetch<{ items: CompanionReferral[] }>(`/companion/patients/${patientId}/referral-support`);
}

export async function recordCompanionReferralAction(
  referralId: string,
  actionType: 'ACKNOWLEDGED' | 'CONTACT_ATTEMPTED' | 'CONTACTED'
): Promise<CompanionReferral> {
  return apiFetch<CompanionReferral>(`/companion/referrals/${referralId}/actions`, {
    method: 'POST',
    body: JSON.stringify({ action_type: actionType })
  });
}

// ==========================================
// ADMIN APIS
// ==========================================

export async function fetchAdminReferralsSummary(): Promise<AdminReferralSummary> {
  return apiFetch<AdminReferralSummary>('/admin/governance/referrals/summary');
}
