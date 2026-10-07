import { apiFetch } from './client';

export interface PatientCareSummaryResponse {
  care: {
    public_id: string;
    status: string;
    enrolled_at: string;
    ended_at: string | null;
    facility: {
      id: string;
      name: string;
      facility_type: string;
      address: string;
    } | null;
    has_active_care: boolean;
  } | null;
  latest_monitoring_date: string | null;
}

export interface PatientMonitoringEntry {
  public_id: string;
  recorded_at: string;
  weight_kg: number | null;
  cd4_count_cells_mm3: number | null;
  viral_load_copies_ml: number | null;
  viral_load_interpretation: string | null;
  tb_screening_result: string | null;
  general_condition: string | null;
  patient_note: string | null;
  source: string;
  is_self_report: boolean;
}

export interface DoctorMonitoringEntry {
  public_id: string;
  recorded_at: string;
  weight_kg: number | null;
  cd4_count_cells_mm3: number | null;
  viral_load_copies_ml: number | null;
  viral_load_interpretation: string | null;
  tb_screening_result: string | null;
  general_condition: string | null;
  patient_note: string | null;
  clinical_note_private: string | null;
  source: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DoctorPatientCareSummaryResponse {
  patient: {
    public_id: string;
    display_alias: string | null;
  };
  care: {
    public_id: string;
    status: string;
    enrolled_at: string;
    facility: {
      id: string;
      name: string;
    } | null;
  } | null;
  latest_monitoring_date: string | null;
}

export interface AdminCareEnrollmentItem {
  public_id: string;
  patient_public_id: string;
  patient_alias: string;
  facility: {
    id: string;
    name: string;
    facility_type: string;
  } | null;
  status: string;
  enrolled_at: string;
  ended_at: string | null;
  end_reason: string | null;
  created_at: string;
  updated_at: string;
}

export function getPatientCare(token: string) {
  return apiFetch<PatientCareSummaryResponse>('/patient/care', {}, { token });
}

export function getPatientMonitoring(token: string, page = 1, limit = 20) {
  return apiFetch<{ items: PatientMonitoringEntry[]; total: number; page: number; limit: number }>(
    `/patient/monitoring?page=${page}&limit=${limit}`,
    {},
    { token }
  );
}

export function createPatientSelfReport(
  token: string,
  data: {
    recorded_at: string;
    weight_kg?: number | null;
    general_condition?: string | null;
    patient_note?: string | null;
  }
) {
  return apiFetch<PatientMonitoringEntry>(
    '/patient/monitoring',
    {
      method: 'POST',
      body: JSON.stringify(data)
    },
    { token }
  );
}

export function getDoctorPatientCare(token: string, publicId: string) {
  return apiFetch<DoctorPatientCareSummaryResponse>(
    `/doctor/patients/${encodeURIComponent(publicId)}/care`,
    {},
    { token }
  );
}

export function getDoctorPatientMonitoring(
  token: string,
  publicId: string,
  page = 1,
  limit = 20,
  includeArchived = false
) {
  return apiFetch<{ items: DoctorMonitoringEntry[]; total: number; page: number; limit: number }>(
    `/doctor/patients/${encodeURIComponent(publicId)}/monitoring?page=${page}&limit=${limit}&include_archived=${includeArchived}`,
    {},
    { token }
  );
}

export function createDoctorMonitoring(
  token: string,
  publicId: string,
  data: {
    recorded_at: string;
    weight_kg?: number | null;
    cd4_count_cells_mm3?: number | null;
    viral_load_copies_ml?: number | null;
    viral_load_interpretation?: string | null;
    tb_screening_result?: string | null;
    general_condition?: string | null;
    clinical_note_private?: string | null;
  }
) {
  return apiFetch<DoctorMonitoringEntry>(
    `/doctor/patients/${encodeURIComponent(publicId)}/monitoring`,
    {
      method: 'POST',
      body: JSON.stringify(data)
    },
    { token }
  );
}

export function updateDoctorMonitoring(
  token: string,
  id: string,
  data: {
    recorded_at?: string;
    weight_kg?: number | null;
    cd4_count_cells_mm3?: number | null;
    viral_load_copies_ml?: number | null;
    viral_load_interpretation?: string | null;
    tb_screening_result?: string | null;
    general_condition?: string | null;
    clinical_note_private?: string | null;
  }
) {
  return apiFetch<DoctorMonitoringEntry>(
    `/doctor/monitoring/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      body: JSON.stringify(data)
    },
    { token }
  );
}

export function archiveDoctorMonitoring(token: string, id: string) {
  return apiFetch<DoctorMonitoringEntry>(
    `/doctor/monitoring/${encodeURIComponent(id)}/archive`,
    {
      method: 'POST'
    },
    { token }
  );
}

export function getAdminCareEnrollments(token: string, status = 'ALL', page = 1, limit = 20) {
  return apiFetch<{ items: AdminCareEnrollmentItem[]; total: number; page: number; limit: number }>(
    `/admin/care-enrollments?status=${encodeURIComponent(status)}&page=${page}&limit=${limit}`,
    {},
    { token }
  );
}

export function createAdminCareEnrollment(
  token: string,
  data: { patient_public_id: string; facility_id?: string | null }
) {
  return apiFetch<AdminCareEnrollmentItem>(
    '/admin/care-enrollments',
    {
      method: 'POST',
      body: JSON.stringify(data)
    },
    { token }
  );
}

export function transferAdminCareEnrollment(
  token: string,
  id: string,
  data: { facility_id: string; transfer_reason?: string | null }
) {
  return apiFetch<AdminCareEnrollmentItem>(
    `/admin/care-enrollments/${encodeURIComponent(id)}/transfer`,
    {
      method: 'PUT',
      body: JSON.stringify(data)
    },
    { token }
  );
}

export function endAdminCareEnrollment(
  token: string,
  id: string,
  data: { end_reason: string }
) {
  return apiFetch<AdminCareEnrollmentItem>(
    `/admin/care-enrollments/${encodeURIComponent(id)}/end`,
    {
      method: 'PUT',
      body: JSON.stringify(data)
    },
    { token }
  );
}

export function getDoctorConsultationCare(token: string, consultationId: string) {
  return apiFetch<{
    care: {
      public_id: string;
      status: string;
      enrolled_at: string;
      facility: { id: string; name: string } | null;
    } | null;
    latest_monitoring_date: string | null;
  }>(`/doctor/consultations/${encodeURIComponent(consultationId)}/care`, {}, { token });
}

export function getDoctorConsultationMonitoring(
  token: string,
  consultationId: string,
  page = 1,
  limit = 20,
  includeArchived = false
) {
  return apiFetch<{ items: DoctorMonitoringEntry[]; total: number; page: number; limit: number }>(
    `/doctor/consultations/${encodeURIComponent(consultationId)}/monitoring?page=${page}&limit=${limit}&include_archived=${includeArchived}`,
    {},
    { token }
  );
}

export function createDoctorConsultationMonitoring(
  token: string,
  consultationId: string,
  data: {
    recorded_at: string;
    weight_kg?: number | null;
    cd4_count_cells_mm3?: number | null;
    viral_load_copies_ml?: number | null;
    viral_load_interpretation?: string | null;
    tb_screening_result?: string | null;
    general_condition?: string | null;
    clinical_note_private?: string | null;
  }
) {
  return apiFetch<DoctorMonitoringEntry>(
    `/doctor/consultations/${encodeURIComponent(consultationId)}/monitoring`,
    {
      method: 'POST',
      body: JSON.stringify(data)
    },
    { token }
  );
}

