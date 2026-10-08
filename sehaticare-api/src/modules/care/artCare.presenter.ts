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

export function toPatientSideEffectDto(entry: any) {
  if (!entry) return null;

  return {
    public_id: entry.public_id,
    severity: entry.severity,
    symptom_name: entry.symptom_name,
    patient_note: entry.patient_note || null,
    status: entry.status,
    occurred_at: entry.occurred_at instanceof Date ? entry.occurred_at.toISOString() : entry.occurred_at,
    resolved_at: entry.resolved_at ? (entry.resolved_at instanceof Date ? entry.resolved_at.toISOString() : entry.resolved_at) : null,
    created_at: entry.created_at instanceof Date ? entry.created_at.toISOString() : entry.created_at,
    updated_at: entry.updated_at instanceof Date ? entry.updated_at.toISOString() : entry.updated_at,
    art_care_plan: entry.care_plan
      ? {
          public_id: entry.care_plan.public_id
        }
      : null,
    safety_guidance: entry.severity === 'SEVERE'
      ? 'Keluhan berat atau memburuk perlu dinilai tenaga kesehatan.'
      : null,
    disclaimer: 'Catatan ini membantu Anda mengingat keluhan untuk dibahas dengan tenaga kesehatan dan bukan merupakan diagnosis.'
  };
}

export function toDoctorSideEffectDto(entry: any) {
  if (!entry) return null;

  return {
    public_id: entry.public_id,
    severity: entry.severity,
    symptom_name: entry.symptom_name,
    patient_note: entry.patient_note || null,
    status: entry.status,
    occurred_at: entry.occurred_at instanceof Date ? entry.occurred_at.toISOString() : entry.occurred_at,
    resolved_at: entry.resolved_at ? (entry.resolved_at instanceof Date ? entry.resolved_at.toISOString() : entry.resolved_at) : null,
    created_at: entry.created_at instanceof Date ? entry.created_at.toISOString() : entry.created_at,
    updated_at: entry.updated_at instanceof Date ? entry.updated_at.toISOString() : entry.updated_at,
    art_care_plan: entry.care_plan
      ? {
          public_id: entry.care_plan.public_id
        }
      : null
  };
}

export function toPatientMedicationStockDto(stock: any) {
  if (!stock) return null;

  return {
    public_id: stock.public_id,
    recorded_at: stock.recorded_at instanceof Date ? stock.recorded_at.toISOString() : stock.recorded_at,
    quantity_remaining: stock.quantity_remaining !== null && stock.quantity_remaining !== undefined ? Number(stock.quantity_remaining) : null,
    unit: stock.unit || null,
    estimated_days_remaining: stock.estimated_days_remaining !== null && stock.estimated_days_remaining !== undefined ? Number(stock.estimated_days_remaining) : null,
    notes: stock.notes || null,
    plan_item: stock.plan_item
      ? {
          id: stock.plan_item.id,
          medication_name: stock.plan_item.medication_name
        }
      : null,
    created_at: stock.created_at instanceof Date ? stock.created_at.toISOString() : stock.created_at
  };
}

export function computeRefillStatus(estimatedDays: number | null | undefined, thresholdDays: number = 7): {
  status: 'UNKNOWN' | 'OK' | 'DUE_SOON' | 'NEEDS_ATTENTION';
  status_label: string;
  coarse_bucket: '>7_DAYS' | '4_TO_7_DAYS' | '1_TO_3_DAYS' | 'NEEDS_ATTENTION' | 'UNKNOWN';
  coarse_bucket_label: string;
} {
  if (estimatedDays === null || estimatedDays === undefined) {
    return {
      status: 'UNKNOWN',
      status_label: 'Belum ada estimasi sisa persediaan',
      coarse_bucket: 'UNKNOWN',
      coarse_bucket_label: 'Belum diketahui'
    };
  }

  if (estimatedDays <= 0) {
    return {
      status: 'NEEDS_ATTENTION',
      status_label: 'Persediaan obat perlu perhatian segera',
      coarse_bucket: 'NEEDS_ATTENTION',
      coarse_bucket_label: 'Perlu perhatian segera'
    };
  }

  if (estimatedDays <= thresholdDays) {
    let bucket: '>7_DAYS' | '4_TO_7_DAYS' | '1_TO_3_DAYS' = '1_TO_3_DAYS';
    let bucketLabel = '1–3 hari';
    if (estimatedDays >= 4 && estimatedDays <= 7) {
      bucket = '4_TO_7_DAYS';
      bucketLabel = '4–7 hari';
    } else if (estimatedDays > 7) {
      bucket = '>7_DAYS';
      bucketLabel = '> 7 hari';
    }

    return {
      status: 'DUE_SOON',
      status_label: 'Persediaan obat menipis, jadwalkan refill',
      coarse_bucket: bucket,
      coarse_bucket_label: bucketLabel
    };
  }

  let bucket: '>7_DAYS' | '4_TO_7_DAYS' = '>7_DAYS';
  let bucketLabel = '> 7 hari';
  if (estimatedDays >= 4 && estimatedDays <= 7) {
    bucket = '4_TO_7_DAYS';
    bucketLabel = '4–7 hari';
  }

  return {
    status: 'OK',
    status_label: 'Persediaan obat mencukupi',
    coarse_bucket: bucket,
    coarse_bucket_label: bucketLabel
  };
}

export function toRefillStatusDto(input: {
  latestStock?: any | null;
  thresholdDays?: number;
  nextControl?: { starts_at: string; timezone: string } | null;
}) {
  const threshold = input.thresholdDays ?? 7;
  const estimatedDays = input.latestStock?.estimated_days_remaining !== null && input.latestStock?.estimated_days_remaining !== undefined
    ? Number(input.latestStock.estimated_days_remaining)
    : null;

  const derived = computeRefillStatus(estimatedDays, threshold);

  return {
    refill_status: derived.status,
    status_label: derived.status_label,
    estimated_days_remaining: estimatedDays,
    refill_alert_threshold_days: threshold,
    last_recorded_at: input.latestStock?.recorded_at instanceof Date
      ? input.latestStock.recorded_at.toISOString()
      : input.latestStock?.recorded_at || null,
    safety_guidance: ['DUE_SOON', 'NEEDS_ATTENTION'].includes(derived.status)
      ? 'Saatnya memeriksa persediaan kesehatan Anda dan merencanakan jadwal pengambilan berikutnya.'
      : null,
    next_control_schedule: input.nextControl || null
  };
}

export function toCompanionRefillSupportDto(
  consentEnabled: boolean,
  refillData?: {
    status: 'UNKNOWN' | 'OK' | 'DUE_SOON' | 'NEEDS_ATTENTION';
    coarse_bucket: string;
    coarse_bucket_label: string;
    next_control_schedule: { starts_at: string; timezone: string } | null;
  } | null
) {
  if (!consentEnabled || !refillData) {
    return {
      support_consent_enabled: false,
      message: 'Pasien belum mengaktifkan dukungan pengingat refill untuk pendamping.',
      summary: null
    };
  }

  // PRIVACY-SAFE PROJECTION:
  // Strictly omit medication names, regimen, exact quantity, side-effects, notes.
  return {
    support_consent_enabled: true,
    summary: {
      refill_status: refillData.status,
      coarse_days_bucket: refillData.coarse_bucket,
      coarse_days_bucket_label: refillData.coarse_bucket_label,
      next_control_schedule: refillData.next_control_schedule
        ? {
            starts_at: refillData.next_control_schedule.starts_at,
            timezone: refillData.next_control_schedule.timezone
          }
        : null
    }
  };
}

export function toPatientRefillSettingsDto(setting: any) {
  return {
    refill_alert_threshold_days: setting?.refill_alert_threshold_days ?? 7
  };
}

export function toPatientRefillSupportConsentDto(consent: any) {
  return {
    is_consent_enabled: Boolean(consent?.is_consent_enabled),
    consented_at: consent?.consented_at instanceof Date ? consent.consented_at.toISOString() : consent?.consented_at || null,
    revoked_at: consent?.revoked_at instanceof Date ? consent.revoked_at.toISOString() : consent?.revoked_at || null,
    updated_at: consent?.updated_at instanceof Date ? consent.updated_at.toISOString() : consent?.updated_at || null
  };
}

