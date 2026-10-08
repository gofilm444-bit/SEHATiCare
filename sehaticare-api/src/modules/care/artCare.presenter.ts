export function toPatientArtCarePlanDto(plan: any) {
  if (!plan) return null;

  return {
    public_id: plan.public_id,
    status: plan.status,
    started_at: plan.started_at instanceof Date ? plan.started_at.toISOString() : plan.started_at,
    ended_at: plan.ended_at ? (plan.ended_at instanceof Date ? plan.ended_at.toISOString() : plan.ended_at) : null,
    clinical_notes: plan.clinical_notes || null,
    change_reason: plan.change_reason || null,
    prescribed_by: plan.prescribed_by
      ? {
          public_id: plan.prescribed_by.public_id,
          display_alias: plan.prescribed_by.display_alias || 'Dokter Penanggung Jawab'
        }
      : null,
    items: (plan.items || []).map((item: any) => ({
      id: item.id,
      medication_name: item.medication_name,
      strength: item.strength || null,
      dose_instructions: item.dose_instructions || null,
      frequency_per_day: item.frequency_per_day,
      timing_description: item.timing_description || null,
      is_active: item.is_active,
      reminders: (item.reminders || []).map((rem: any) => ({
        public_id: rem.public_id,
        display_label: rem.display_label,
        is_active: rem.is_active,
        times: (rem.times || []).map((t: any) => t.local_time)
      }))
    }))
  };
}

export function toDoctorArtCarePlanDto(plan: any) {
  if (!plan) return null;

  return {
    public_id: plan.public_id,
    patient_public_id: plan.patient?.public_id || null,
    patient_display_alias: plan.patient?.display_alias || null,
    status: plan.status,
    started_at: plan.started_at instanceof Date ? plan.started_at.toISOString() : plan.started_at,
    ended_at: plan.ended_at ? (plan.ended_at instanceof Date ? plan.ended_at.toISOString() : plan.ended_at) : null,
    clinical_notes: plan.clinical_notes || null,
    change_reason: plan.change_reason || null,
    items: (plan.items || []).map((item: any) => ({
      id: item.id,
      medication_name: item.medication_name,
      strength: item.strength || null,
      dose_instructions: item.dose_instructions || null,
      frequency_per_day: item.frequency_per_day,
      timing_description: item.timing_description || null,
      is_active: item.is_active
    })),
    created_at: plan.created_at instanceof Date ? plan.created_at.toISOString() : plan.created_at,
    updated_at: plan.updated_at instanceof Date ? plan.updated_at.toISOString() : plan.updated_at
  };
}

export function toCompanionAdherenceSupportDto(
  consentEnabled: boolean,
  stats?: {
    summary_period: string;
    doses_scheduled: number;
    doses_taken: number;
    doses_missed: number;
    adherence_percentage: number | null;
    upcoming_control_schedule: { starts_at: string; timezone: string } | null;
  } | null
) {
  if (!consentEnabled || !stats) {
    return {
      support_consent_enabled: false,
      message: 'Pasien belum mengaktifkan berbagi ringkasan dukungan kepatuhan.',
      summary: null
    };
  }

  // PRIVACY-SAFE PROJECTION:
  // Strictly omit medication names, regimens, strengths, doses, CD4, viral load, notes.
  return {
    support_consent_enabled: true,
    summary_period: stats.summary_period,
    summary: {
      doses_scheduled: stats.doses_scheduled,
      doses_taken: stats.doses_taken,
      doses_missed: stats.doses_missed,
      adherence_percentage: stats.adherence_percentage,
      upcoming_control_schedule: stats.upcoming_control_schedule
        ? {
            starts_at: stats.upcoming_control_schedule.starts_at,
            timezone: stats.upcoming_control_schedule.timezone
          }
        : null
    }
  };
}

export function toPatientConsentDto(consent: any) {
  return {
    is_consent_enabled: Boolean(consent?.is_consent_enabled),
    consented_at: consent?.consented_at instanceof Date ? consent.consented_at.toISOString() : consent?.consented_at || null,
    revoked_at: consent?.revoked_at instanceof Date ? consent.revoked_at.toISOString() : consent?.revoked_at || null,
    updated_at: consent?.updated_at instanceof Date ? consent.updated_at.toISOString() : consent?.updated_at || null
  };
}
