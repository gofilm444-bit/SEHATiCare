import { apiFetch } from './client';

export interface CareSignalAction {
  id: string;
  action_type:
    | 'ACKNOWLEDGED'
    | 'CONTACT_ATTEMPTED'
    | 'CONTACTED'
    | 'FOLLOW_UP_SCHEDULED'
    | 'ESCALATED_TO_CLINICAL'
    | 'RESOLVED'
    | 'DISMISSED';
  occurred_at: string;
  next_follow_up_at: string | null;
  actor_role: string | null;
  actor_display_alias: string;
}

export interface PatientCareSignal {
  public_id: string;
  signal_type:
    | 'SEVERE_SIDE_EFFECT_REPORTED'
    | 'FOLLOW_UP_OVERDUE'
    | 'REFILL_NEEDS_ATTENTION'
    | 'PATIENT_REQUESTED_CLINICAL_CONTACT'
    | 'PATIENT_REQUESTED_COMPANION_SUPPORT';
  priority: 'ROUTINE' | 'ATTENTION' | 'PRIORITY';
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';
  detected_at: string;
  display_title: string;
  display_message: string;
  safety_guidance: string | null;
  cta: {
    label: string;
    action: string;
  } | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
}

export interface DoctorCareSignal {
  public_id: string;
  patient_public_id: string;
  patient_display_alias: string;
  signal_type:
    | 'SEVERE_SIDE_EFFECT_REPORTED'
    | 'FOLLOW_UP_OVERDUE'
    | 'REFILL_NEEDS_ATTENTION'
    | 'PATIENT_REQUESTED_CLINICAL_CONTACT'
    | 'PATIENT_REQUESTED_COMPANION_SUPPORT';
  signal_scope: 'CLINICAL' | 'SUPPORT';
  priority: 'ROUTINE' | 'ATTENTION' | 'PRIORITY';
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';
  clinical_title: string;
  detected_at: string;
  overdue_bucket: string | null;
  overdue_days: number | null;
  request_category: string | null;
  preferred_contact_time: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  dismissed_at: string | null;
  actions: CareSignalAction[];
}

export interface CompanionCareSignal {
  public_id: string;
  patient_public_id: string;
  patient_display_alias: string;
  signal_type:
    | 'FOLLOW_UP_OVERDUE'
    | 'REFILL_NEEDS_ATTENTION'
    | 'PATIENT_REQUESTED_COMPANION_SUPPORT';
  priority: 'ROUTINE' | 'ATTENTION' | 'PRIORITY';
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';
  support_title: string;
  support_description: string;
  overdue_bucket: string | null;
  preferred_contact_time: string | null;
  detected_at: string;
  acknowledged_at: string | null;
  actions: CareSignalAction[];
}

export interface FollowUpSupportConsent {
  is_consent_enabled: boolean;
  consented_at: string | null;
  revoked_at: string | null;
  updated_at: string | null;
}

export interface CareSignalsAdminSummary {
  total_open: number;
  total_acknowledged: number;
  total_resolved: number;
  by_type: Record<string, number>;
  by_scope: Record<string, number>;
  by_priority: Record<string, number>;
}

// ==========================================
// PATIENT API CALLS
// ==========================================

export async function fetchPatientCareSignals(): Promise<{ items: PatientCareSignal[] }> {
  return apiFetch<{ items: PatientCareSignal[] }>('/patient/care-signals');
}

export async function requestClinicalContact(data?: {
  category?: 'GENERAL_HEALTH_SUPPORT' | 'MEDICATION_QUESTION' | 'FOLLOW_UP_HELP' | 'OTHER';
  preferred_contact_time?: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'ANYTIME';
}): Promise<PatientCareSignal> {
  return apiFetch<PatientCareSignal>('/patient/care-signals/request-clinical-contact', {
    method: 'POST',
    body: JSON.stringify(data || {})
  });
}

export async function requestCompanionSupport(data?: {
  preferred_contact_time?: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'ANYTIME';
}): Promise<PatientCareSignal> {
  return apiFetch<PatientCareSignal>('/patient/care-signals/request-companion-support', {
    method: 'POST',
    body: JSON.stringify(data || {})
  });
}

export async function fetchFollowUpSupportConsent(): Promise<FollowUpSupportConsent> {
  return apiFetch<FollowUpSupportConsent>('/patient/care/follow-up-support-consent');
}

export async function updateFollowUpSupportConsent(
  is_consent_enabled: boolean
): Promise<FollowUpSupportConsent> {
  return apiFetch<FollowUpSupportConsent>('/patient/care/follow-up-support-consent', {
    method: 'PATCH',
    body: JSON.stringify({ is_consent_enabled })
  });
}

// ==========================================
// DOCTOR API CALLS
// ==========================================

export async function fetchDoctorCareSignals(params?: {
  status?: string;
  scope?: string;
}): Promise<{ items: DoctorCareSignal[] }> {
  const query = new URLSearchParams();
  if (params?.status) query.append('status', params.status);
  if (params?.scope) query.append('scope', params.scope);
  const qStr = query.toString();
  return apiFetch<{ items: DoctorCareSignal[] }>(`/doctor/care-signals${qStr ? `?${qStr}` : ''}`);
}

export async function fetchDoctorPatientCareSignals(
  patientId: string
): Promise<{ items: DoctorCareSignal[] }> {
  return apiFetch<{ items: DoctorCareSignal[] }>(`/doctor/patients/${patientId}/care-signals`);
}

export async function updateDoctorCareSignalStatus(
  signalId: string,
  status: 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED'
): Promise<DoctorCareSignal> {
  return apiFetch<DoctorCareSignal>(`/doctor/care-signals/${signalId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
}

export async function recordDoctorCareSignalAction(
  signalId: string,
  data: {
    action_type:
      | 'ACKNOWLEDGED'
      | 'CONTACT_ATTEMPTED'
      | 'CONTACTED'
      | 'FOLLOW_UP_SCHEDULED'
      | 'ESCALATED_TO_CLINICAL'
      | 'RESOLVED'
      | 'DISMISSED';
    next_follow_up_at?: string | null;
  }
): Promise<DoctorCareSignal> {
  return apiFetch<DoctorCareSignal>(`/doctor/care-signals/${signalId}/actions`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

// ==========================================
// COMPANION API CALLS
// ==========================================

export async function fetchCompanionFollowUpSignals(): Promise<{ items: CompanionCareSignal[] }> {
  return apiFetch<{ items: CompanionCareSignal[] }>('/companion/follow-up-signals');
}

export async function fetchCompanionPatientFollowUpSignals(
  patientId: string
): Promise<{ items: CompanionCareSignal[] }> {
  return apiFetch<{ items: CompanionCareSignal[] }>(`/companion/patients/${patientId}/follow-up-signals`);
}

export async function recordCompanionCareSignalAction(
  signalId: string,
  data: {
    action_type:
      | 'ACKNOWLEDGED'
      | 'CONTACT_ATTEMPTED'
      | 'CONTACTED'
      | 'FOLLOW_UP_SCHEDULED'
      | 'ESCALATED_TO_CLINICAL';
    next_follow_up_at?: string | null;
  }
): Promise<CompanionCareSignal> {
  return apiFetch<CompanionCareSignal>(`/companion/care-signals/${signalId}/actions`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

// ==========================================
// ADMIN API CALLS
// ==========================================

export async function fetchAdminCareSignalsSummary(): Promise<CareSignalsAdminSummary> {
  return apiFetch<CareSignalsAdminSummary>('/admin/governance/care-signals/summary');
}
