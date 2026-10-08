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

// ==========================================
// AG-06: SIDE-EFFECTS, STOCK & REFILL SUPPORT
// ==========================================

export interface SideEffectEntry {
  public_id: string;
  severity: 'MILD' | 'MODERATE' | 'SEVERE';
  symptom_name: string;
  patient_note: string | null;
  status: 'ACTIVE' | 'RESOLVED';
  occurred_at: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  safety_guidance?: string | null;
  disclaimer?: string;
}

export interface MedicationStockEntry {
  public_id: string;
  recorded_at: string;
  quantity_remaining: number | null;
  unit: string | null;
  estimated_days_remaining: number | null;
  notes: string | null;
  plan_item?: {
    id: string;
    medication_name: string;
  } | null;
  created_at: string;
}

export interface RefillStatusSummary {
  refill_status: 'UNKNOWN' | 'OK' | 'DUE_SOON' | 'NEEDS_ATTENTION';
  status_label: string;
  estimated_days_remaining: number | null;
  refill_alert_threshold_days: number;
  last_recorded_at: string | null;
  safety_guidance: string | null;
  next_control_schedule: {
    starts_at: string;
    timezone: string;
  } | null;
}

export interface PatientStockResponse {
  refill_status: RefillStatusSummary;
  current_stock: MedicationStockEntry | null;
  history: MedicationStockEntry[];
}

export interface PatientRefillSettingsResponse {
  refill_alert_threshold_days: number;
}

export interface PatientRefillSupportConsentResponse {
  is_consent_enabled: boolean;
  consented_at: string | null;
  revoked_at: string | null;
  updated_at: string | null;
}

export interface CompanionRefillSupportResponse {
  support_consent_enabled: boolean;
  message?: string;
  summary: {
    refill_status: 'UNKNOWN' | 'OK' | 'DUE_SOON' | 'NEEDS_ATTENTION';
    coarse_days_bucket: string;
    coarse_days_bucket_label: string;
    next_control_schedule: {
      starts_at: string;
      timezone: string;
    } | null;
  } | null;
}

// Patient Side-Effects
export function getPatientSideEffects(token: string) {
  return apiFetch<{ items: SideEffectEntry[] }>('/patient/art-care/side-effects', {}, { token });
}

export function createPatientSideEffect(
  token: string,
  data: {
    symptom_name: string;
    severity: 'MILD' | 'MODERATE' | 'SEVERE';
    patient_note?: string | null;
    occurred_at?: string;
    art_care_plan_id?: string | null;
  }
) {
  return apiFetch<SideEffectEntry>(
    '/patient/art-care/side-effects',
    {
      method: 'POST',
      body: JSON.stringify(data)
    },
    { token }
  );
}

export function updatePatientSideEffect(
  token: string,
  entryId: string,
  data: {
    symptom_name?: string;
    severity?: 'MILD' | 'MODERATE' | 'SEVERE';
    patient_note?: string | null;
    status?: 'ACTIVE' | 'RESOLVED';
    resolved_at?: string | null;
  }
) {
  return apiFetch<SideEffectEntry>(
    `/patient/art-care/side-effects/${entryId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(data)
    },
    { token }
  );
}

// Patient Stock & Refill
export function getPatientStock(token: string) {
  return apiFetch<PatientStockResponse>('/patient/art-care/stock', {}, { token });
}

export function recordPatientStock(
  token: string,
  data: {
    art_plan_item_id?: string | null;
    quantity_remaining?: number | null;
    unit?: string | null;
    estimated_days_remaining?: number | null;
    notes?: string | null;
    recorded_at?: string;
  }
) {
  return apiFetch<MedicationStockEntry>(
    '/patient/art-care/stock',
    {
      method: 'POST',
      body: JSON.stringify(data)
    },
    { token }
  );
}

export function getPatientRefillSettings(token: string) {
  return apiFetch<PatientRefillSettingsResponse>('/patient/art-care/refill-settings', {}, { token });
}

export function updatePatientRefillSettings(token: string, refill_alert_threshold_days: number) {
  return apiFetch<PatientRefillSettingsResponse>(
    '/patient/art-care/refill-settings',
    {
      method: 'PATCH',
      body: JSON.stringify({ refill_alert_threshold_days })
    },
    { token }
  );
}

export function getPatientRefillSupportConsent(token: string) {
  return apiFetch<PatientRefillSupportConsentResponse>('/patient/art-care/refill-support-consent', {}, { token });
}

export function updatePatientRefillSupportConsent(token: string, is_consent_enabled: boolean) {
  return apiFetch<PatientRefillSupportConsentResponse>(
    '/patient/art-care/refill-support-consent',
    {
      method: 'PATCH',
      body: JSON.stringify({ is_consent_enabled })
    },
    { token }
  );
}

// Doctor API
export function getDoctorPatientSideEffects(token: string, patientPublicId: string) {
  return apiFetch<{ items: SideEffectEntry[] }>(`/doctor/patients/${patientPublicId}/art-care/side-effects`, {}, { token });
}

export function getDoctorPatientStockSummary(token: string, patientPublicId: string) {
  return apiFetch<PatientStockResponse>(`/doctor/patients/${patientPublicId}/art-care/stock-summary`, {}, { token });
}

// Companion API
export function getCompanionRefillSupport(token: string, patientPublicId: string) {
  return apiFetch<CompanionRefillSupportResponse>(`/companion/patients/${patientPublicId}/refill-support`, {}, { token });
}

