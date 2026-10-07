import { hiv_care_enrollments, hiv_monitoring_entries } from '@prisma/client';

export type PatientCareDto = {
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
};

export type PatientMonitoringDto = {
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
};

export type DoctorMonitoringDto = {
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
};

export type AdminEnrollmentDto = {
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
};

export function toPatientCareDto(
  enrollment: (hiv_care_enrollments & { facility?: any }) | null
): PatientCareDto | null {
  if (!enrollment) return null;
  return {
    public_id: enrollment.public_id,
    status: enrollment.status,
    enrolled_at: enrollment.enrolled_at.toISOString(),
    ended_at: enrollment.ended_at ? enrollment.ended_at.toISOString() : null,
    facility: enrollment.facility
      ? {
          id: enrollment.facility.id,
          name: enrollment.facility.name,
          facility_type: enrollment.facility.facility_type,
          address: enrollment.facility.address
        }
      : null,
    has_active_care: enrollment.status === 'ACTIVE'
  };
}

export function toPatientMonitoringDto(
  entry: hiv_monitoring_entries
): PatientMonitoringDto {
  return {
    public_id: entry.public_id,
    recorded_at: entry.recorded_at.toISOString(),
    weight_kg: entry.weight_kg !== null ? Number(entry.weight_kg) : null,
    cd4_count_cells_mm3: entry.cd4_count_cells_mm3,
    viral_load_copies_ml: entry.viral_load_copies_ml,
    viral_load_interpretation: entry.viral_load_interpretation,
    tb_screening_result: entry.tb_screening_result,
    general_condition: entry.general_condition,
    patient_note: entry.patient_note,
    source: entry.source,
    is_self_report: entry.source === 'PATIENT'
  };
}

export function toDoctorMonitoringDto(
  entry: hiv_monitoring_entries
): DoctorMonitoringDto {
  return {
    public_id: entry.public_id,
    recorded_at: entry.recorded_at.toISOString(),
    weight_kg: entry.weight_kg !== null ? Number(entry.weight_kg) : null,
    cd4_count_cells_mm3: entry.cd4_count_cells_mm3,
    viral_load_copies_ml: entry.viral_load_copies_ml,
    viral_load_interpretation: entry.viral_load_interpretation,
    tb_screening_result: entry.tb_screening_result,
    general_condition: entry.general_condition,
    patient_note: entry.patient_note,
    clinical_note_private: entry.clinical_note_private,
    source: entry.source,
    archived_at: entry.archived_at ? entry.archived_at.toISOString() : null,
    created_at: entry.created_at.toISOString(),
    updated_at: entry.updated_at.toISOString()
  };
}

export function toAdminEnrollmentDto(
  enrollment: hiv_care_enrollments & {
    patient: { public_id: string; display_alias?: string | null };
    facility?: { id: string; name: string; facility_type: string } | null;
  }
): AdminEnrollmentDto {
  return {
    public_id: enrollment.public_id,
    patient_public_id: enrollment.patient.public_id,
    patient_alias: enrollment.patient.display_alias || 'Anonim',
    facility: enrollment.facility
      ? {
          id: enrollment.facility.id,
          name: enrollment.facility.name,
          facility_type: enrollment.facility.facility_type
        }
      : null,
    status: enrollment.status,
    enrolled_at: enrollment.enrolled_at.toISOString(),
    ended_at: enrollment.ended_at ? enrollment.ended_at.toISOString() : null,
    end_reason: enrollment.end_reason,
    created_at: enrollment.created_at.toISOString(),
    updated_at: enrollment.updated_at.toISOString()
  };
}
