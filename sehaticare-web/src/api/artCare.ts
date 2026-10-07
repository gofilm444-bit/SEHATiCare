import { apiFetch } from './client';

export interface ArtCarePlanItem {
  id: string;
  medication_name: string;
  strength: string | null;
  dose_instructions: string | null;
  frequency_per_day: number;
  timing_description: string | null;
  is_active: boolean;
  reminders?: Array<{
    public_id: string;
    display_label: string;
    is_active: boolean;
    times: string[];
  }>;
}

export interface PatientArtCarePlan {
  public_id: string;
  status: 'ACTIVE' | 'MODIFIED' | 'DISCONTINUED' | 'COMPLETED';
  started_at: string;
  ended_at: string | null;
  clinical_notes: string | null;
  change_reason: string | null;
  prescribed_by: {
    public_id: string;
    display_alias: string;
  } | null;
  items: ArtCarePlanItem[];
}

export interface DoctorArtCareResponse {
  patient: {
    public_id: string;
    display_alias: string | null;
  };
  active_plan: PatientArtCarePlan | null;
  history: PatientArtCarePlan[];
}

export interface AdherenceSummary {
  summary_period: string;
  doses_scheduled: number;
  doses_taken: number;
  doses_missed: number;
  adherence_percentage: number | null;
  upcoming_control_schedule: {
    starts_at: string;
    timezone: string;
  } | null;
}

export interface PatientConsentResponse {
  is_consent_enabled: boolean;
  consented_at: string | null;
  revoked_at: string | null;
  updated_at: string | null;
}

export interface CompanionAdherenceSupportResponse {
  support_consent_enabled: boolean;
  summary_period?: string;
  message?: string;
  summary: {
    doses_scheduled: number;
    doses_taken: number;
    doses_missed: number;
    adherence_percentage: number | null;
    upcoming_control_schedule: {
      starts_at: string;
      timezone: string;
    } | null;
  } | null;
}

// Patient API
export function getPatientArtCare(token: string) {
  return apiFetch<{ plan: PatientArtCarePlan | null }>('/patient/art-care', {}, { token });
}

export function getPatientArtCareHistory(token: string) {
  return apiFetch<{ items: PatientArtCarePlan[] }>('/patient/art-care/history', {}, { token });
}

export function getPatientAdherence(token: string, days = 7) {
  return apiFetch<{ summary: AdherenceSummary; disclaimer: string }>(
    `/patient/art-care/adherence?days=${days}`,
    {},
    { token }
  );
}

export function getPatientSupportConsent(token: string) {
  return apiFetch<PatientConsentResponse>('/patient/art-care/support-consent', {}, { token });
}

export function updatePatientSupportConsent(token: string, is_consent_enabled: boolean) {
  return apiFetch<PatientConsentResponse>(
    '/patient/art-care/support-consent',
    {
      method: 'PATCH',
      body: JSON.stringify({ is_consent_enabled })
    },
    { token }
  );
}

export function syncPatientReminder(
  token: string,
  data: {
    art_item_id: string;
    display_label?: string;
    reminder_times: string[];
    timezone?: string;
    notification_privacy?: 'NEUTRAL' | 'LABEL_IN_APP';
    is_active?: boolean;
  }
) {
  return apiFetch<{ public_id: string; display_label: string; is_active: boolean; times: string[] }>(
    '/patient/art-care/reminders',
    {
      method: 'POST',
      body: JSON.stringify(data)
    },
    { token }
  );
}

// Doctor API
export function getDoctorPatientArtCare(token: string, patientPublicId: string) {
  return apiFetch<DoctorArtCareResponse>(`/doctor/patients/${patientPublicId}/art-care`, {}, { token });
}

export function createDoctorPatientArtCare(
  token: string,
  patientPublicId: string,
  data: {
    items: Array<{
      medication_name: string;
      strength?: string | null;
      dose_instructions?: string | null;
      frequency_per_day?: number;
      timing_description?: string | null;
    }>;
    clinical_notes?: string | null;
    change_reason?: string | null;
  }
) {
  return apiFetch<PatientArtCarePlan>(
    `/doctor/patients/${patientPublicId}/art-care`,
    {
      method: 'POST',
      body: JSON.stringify(data)
    },
    { token }
  );
}

export function updateDoctorPatientArtCare(
  token: string,
  patientPublicId: string,
  planPublicId: string,
  data: {
    status?: 'ACTIVE' | 'MODIFIED' | 'DISCONTINUED' | 'COMPLETED';
    clinical_notes?: string | null;
    change_reason?: string | null;
  }
) {
  return apiFetch<PatientArtCarePlan>(
    `/doctor/patients/${patientPublicId}/art-care/${planPublicId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(data)
    },
    { token }
  );
}

export function getDoctorPatientAdherence(token: string, patientPublicId: string, days = 7) {
  return apiFetch<{ patient: { public_id: string; display_alias: string | null }; summary: AdherenceSummary }>(
    `/doctor/patients/${patientPublicId}/art-care/adherence?days=${days}`,
    {},
    { token }
  );
}

// Companion API
export function getCompanionAdherenceSupport(token: string, patientPublicId: string, days = 7) {
  return apiFetch<CompanionAdherenceSupportResponse>(
    `/companion/patients/${patientPublicId}/adherence-support?days=${days}`,
    {},
    { token }
  );
}
