export function toPublicFacilityDto(facility: any) {
  return {
    id: facility.id,
    name: facility.name,
    facility_type: facility.facility_type,
    district_name: facility.district_name || null,
    address: facility.address,
    public_contact: facility.public_contact || null,
    service_hours: facility.service_hours,
    description: facility.description || null,
    region: facility.regions
      ? {
          id: facility.regions.id,
          code: facility.regions.code,
          name: facility.regions.name
        }
      : null,
    services: (facility.facility_services || []).map((s: any) => ({
      service: s.service,
      verified: s.verified,
      is_active: s.is_active !== undefined ? s.is_active : true,
      appointment_required: Boolean(s.appointment_required),
      opening_time: s.opening_time || null,
      closing_time: s.closing_time || null,
      contact_public: s.contact_public || null,
      domicile_requirement: s.domicile_requirement || null,
      insurance_requirement: s.insurance_requirement || null,
      notes_public: s.notes_public || null
    }))
  };
}

export function toPatientReferralDto(referral: any) {
  let statusLabel = 'Menunggu Tindak Lanjut';
  switch (referral.status) {
    case 'REQUESTED':
      statusLabel = 'Permintaan Rujukan Terkirim';
      break;
    case 'DRAFT':
      statusLabel = 'Disiapkan Tenaga Kesehatan';
      break;
    case 'PENDING_PATIENT_CONSENT':
      statusLabel = 'Menunggu Persetujuan Anda';
      break;
    case 'CONSENTED':
      statusLabel = 'Persetujuan Diberikan';
      break;
    case 'SENT':
      statusLabel = 'Rujukan Telah Dikirim ke Fasilitas Tujuan';
      break;
    case 'ACCEPTED':
      statusLabel = 'Rujukan Diterima Fasilitas Tujuan';
      break;
    case 'DECLINED':
      statusLabel = 'Rujukan Belum Dapat Diterima';
      break;
    case 'CANCELLED':
      statusLabel = 'Rujukan Dibatalkan';
      break;
    case 'COMPLETED':
      statusLabel = 'Rujukan Selesai';
      break;
  }

  return {
    public_id: referral.public_id,
    target_facility: {
      id: referral.target_facility?.id || null,
      name: referral.target_facility?.name || 'Fasilitas Tujuan',
      address: referral.target_facility?.address || null,
      public_contact: referral.target_facility?.public_contact || null
    },
    source_facility: referral.source_facility
      ? {
          id: referral.source_facility.id,
          name: referral.source_facility.name
        }
      : null,
    referral_type: referral.referral_type,
    status: referral.status,
    status_label: statusLabel,
    scheduling_preference: referral.scheduling_preference || null,
    is_consent_enabled: Boolean(referral.consent?.is_consent_enabled),
    companion_share: referral.companion_share
      ? {
          is_enabled: Boolean(referral.companion_share.is_enabled),
          share_target_facility: Boolean(referral.companion_share.share_target_facility)
        }
      : { is_enabled: false, share_target_facility: false },
    requested_at: referral.requested_at instanceof Date ? referral.requested_at.toISOString() : referral.requested_at,
    consented_at: referral.consented_at instanceof Date ? referral.consented_at.toISOString() : referral.consented_at || null,
    sent_at: referral.sent_at instanceof Date ? referral.sent_at.toISOString() : referral.sent_at || null,
    accepted_at: referral.accepted_at instanceof Date ? referral.accepted_at.toISOString() : referral.accepted_at || null,
    declined_at: referral.declined_at instanceof Date ? referral.declined_at.toISOString() : referral.declined_at || null,
    cancelled_at: referral.cancelled_at instanceof Date ? referral.cancelled_at.toISOString() : referral.cancelled_at || null,
    completed_at: referral.completed_at instanceof Date ? referral.completed_at.toISOString() : referral.completed_at || null
  };
}

export function toDoctorOutgoingReferralDto(referral: any) {
  return {
    public_id: referral.public_id,
    patient_public_id: referral.patient?.public_id || null,
    patient_display_alias: referral.patient?.display_alias || 'Pasien',
    source_facility: referral.source_facility
      ? { id: referral.source_facility.id, name: referral.source_facility.name }
      : null,
    source_doctor: referral.source_doctor
      ? { id: referral.source_doctor.id, display_alias: referral.source_doctor.display_alias }
      : null,
    target_facility: {
      id: referral.target_facility.id,
      name: referral.target_facility.name,
      address: referral.target_facility.address
    },
    target_doctor: referral.target_doctor
      ? { id: referral.target_doctor.id, display_alias: referral.target_doctor.display_alias }
      : null,
    initiation_type: referral.initiation_type,
    referral_type: referral.referral_type,
    status: referral.status,
    decline_reason: referral.decline_reason || null,
    scheduling_preference: referral.scheduling_preference || null,
    is_consent_enabled: Boolean(referral.consent?.is_consent_enabled),
    requested_at: referral.requested_at instanceof Date ? referral.requested_at.toISOString() : referral.requested_at,
    consented_at: referral.consented_at instanceof Date ? referral.consented_at.toISOString() : referral.consented_at || null,
    sent_at: referral.sent_at instanceof Date ? referral.sent_at.toISOString() : referral.sent_at || null,
    accepted_at: referral.accepted_at instanceof Date ? referral.accepted_at.toISOString() : referral.accepted_at || null,
    declined_at: referral.declined_at instanceof Date ? referral.declined_at.toISOString() : referral.declined_at || null,
    cancelled_at: referral.cancelled_at instanceof Date ? referral.cancelled_at.toISOString() : referral.cancelled_at || null,
    completed_at: referral.completed_at instanceof Date ? referral.completed_at.toISOString() : referral.completed_at || null,
    events: (referral.events || []).map((e: any) => ({
      id: e.id,
      event_type: e.event_type,
      occurred_at: e.occurred_at instanceof Date ? e.occurred_at.toISOString() : e.occurred_at,
      safe_reason_code: e.safe_reason_code || null,
      actor_role: e.actor?.role || null
    }))
  };
}

export function toDoctorIncomingReferralEnvelopeDto(referral: any) {
  // PRIVACY GUARANTEE:
  // Minimal Pre-Acceptance Intake Envelope!
  // MUST NOT expose ART regimen, medications, dosages, VL/CD4, lab monitoring, side effects, or clinical notes!
  return {
    public_id: referral.public_id,
    patient_display_alias: referral.patient?.display_alias || 'Pasien Rujukan',
    source_facility_name: referral.source_facility?.name || 'Fasilitas Pengirim',
    target_facility_name: referral.target_facility?.name || 'Fasilitas Penerima',
    referral_type: referral.referral_type,
    status: referral.status,
    scheduling_preference: referral.scheduling_preference || null,
    requested_at: referral.requested_at instanceof Date ? referral.requested_at.toISOString() : referral.requested_at,
    sent_at: referral.sent_at instanceof Date ? referral.sent_at.toISOString() : referral.sent_at || null
  };
}

export function toCompanionReferralDto(referral: any) {
  // PRIVACY GUARANTEE:
  // Strictly generic operational status.
  // Companion MUST NEVER receive clinical details, medication names, dosages, VL/CD4, clinical notes, or doctor assignments!
  let genericStatusLabel = 'Permintaan layanan sedang diproses';
  if (['REQUESTED', 'DRAFT', 'PENDING_PATIENT_CONSENT', 'CONSENTED', 'SENT'].includes(referral.status)) {
    genericStatusLabel = 'Menunggu tindak lanjut fasilitas';
  } else if (referral.status === 'ACCEPTED') {
    genericStatusLabel = 'Layanan sudah dijadwalkan';
  } else if (referral.status === 'COMPLETED') {
    genericStatusLabel = 'Proses selesai';
  } else if (['CANCELLED', 'DECLINED'].includes(referral.status)) {
    genericStatusLabel = 'Layanan dibatalkan / perlu penyesuaian';
  }

  const shareTargetFacility = Boolean(referral.companion_share?.share_target_facility);

  return {
    public_id: referral.public_id,
    patient_display_alias: referral.patient?.display_alias || 'Pasien Dampingan',
    status: referral.status,
    generic_status_label: genericStatusLabel,
    target_facility_name: shareTargetFacility ? referral.target_facility?.name || null : null,
    requested_at: referral.requested_at instanceof Date ? referral.requested_at.toISOString() : referral.requested_at,
    events: (referral.events || [])
      .filter((e: any) =>
        ['SUPPORT_CONTACT_ATTEMPTED', 'SUPPORT_CONTACTED', 'COMPANION_STATUS_SHARING_ENABLED'].includes(e.event_type)
      )
      .map((e: any) => ({
        id: e.id,
        event_type: e.event_type,
        occurred_at: e.occurred_at instanceof Date ? e.occurred_at.toISOString() : e.occurred_at
      }))
  };
}

export function toAdminReferralSummaryDto(stats: {
  total_requested: number;
  total_sent: number;
  total_accepted: number;
  total_declined: number;
  total_completed: number;
  by_type: Record<string, number>;
  by_facility: Record<string, number>;
}) {
  return {
    total_requested: stats.total_requested,
    total_sent: stats.total_sent,
    total_accepted: stats.total_accepted,
    total_declined: stats.total_declined,
    total_completed: stats.total_completed,
    by_type: stats.by_type,
    by_facility: stats.by_facility
  };
}
