export function computeOverdueBucket(startsAt: Date, now: Date = new Date()): {
  bucket: '1_TO_7_DAYS' | '8_TO_30_DAYS' | 'OVER_30_DAYS';
  label: string;
  days_overdue: number;
} {
  const diffMs = Math.max(0, now.getTime() - startsAt.getTime());
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (days <= 7) {
    return {
      bucket: '1_TO_7_DAYS',
      label: '1–7 hari terlewat',
      days_overdue: days
    };
  }
  if (days <= 30) {
    return {
      bucket: '8_TO_30_DAYS',
      label: '8–30 hari terlewat',
      days_overdue: days
    };
  }
  return {
    bucket: 'OVER_30_DAYS',
    label: '> 30 hari terlewat',
    days_overdue: days
  };
}

export function toPatientCareSignalDto(signal: any) {
  let displayTitle = 'Pemberitahuan Layanan';
  let displayMessage = 'Ada pembaruan pada status layanan Anda.';
  let cta: { label: string; action: string } | null = null;
  let safetyGuidance: string | null = null;

  switch (signal.signal_type) {
    case 'SEVERE_SIDE_EFFECT_REPORTED':
      displayTitle = 'Keluhan Perlu Penilaian Tenaga Kesehatan';
      displayMessage =
        'Keluhan berat atau memburuk perlu dinilai tenaga kesehatan. Jangan ragu untuk berkonsultasi.';
      safetyGuidance =
        'Keluhan berat atau memburuk perlu dinilai tenaga kesehatan. Jika Anda mengalami keadaan gawat darurat, segera cari pertolongan melalui layanan kesehatan/darurat setempat.';
      cta = { label: 'Konsultasi Dokter', action: 'DOCTOR_CONSULTATION' };
      break;

    case 'FOLLOW_UP_OVERDUE':
      displayTitle = 'Jadwal Kontrol Telah Terlewat';
      displayMessage =
        'Jadwal kontrol Anda telah terlewat. Silakan atur kembali jadwal kontrol untuk kesinambungan layanan.';
      cta = { label: 'Atur Jadwal Kontrol', action: 'SCHEDULE_FOLLOW_UP' };
      break;

    case 'REFILL_NEEDS_ATTENTION':
      displayTitle = 'Persediaan Kesehatan Perlu Diperiksa';
      displayMessage =
        'Persediaan kesehatan Anda perlu diperiksa. Perbarui catatan persediaan Anda agar jadwal pengambilan tetap terjaga.';
      cta = { label: 'Perbarui Persediaan', action: 'UPDATE_STOCK' };
      break;

    case 'PATIENT_REQUESTED_CLINICAL_CONTACT':
      displayTitle = 'Permintaan Kontak Tenaga Kesehatan';
      displayMessage =
        'Permintaan Anda untuk dihubungi tenaga kesehatan telah diterima dan sedang menunggu tindak lanjut.';
      cta = { label: 'Menunggu Tindak Lanjut', action: 'NONE' };
      break;

    case 'PATIENT_REQUESTED_COMPANION_SUPPORT':
      displayTitle = 'Permintaan Dukungan Pendamping';
      displayMessage =
        'Permintaan dukungan pendamping telah diteruskan ke pendamping Anda.';
      cta = { label: 'Hubungi Pendamping', action: 'CHAT_COMPANION' };
      break;
  }

  return {
    public_id: signal.public_id,
    signal_type: signal.signal_type,
    priority: signal.priority,
    status: signal.status,
    detected_at: signal.detected_at instanceof Date ? signal.detected_at.toISOString() : signal.detected_at,
    display_title: displayTitle,
    display_message: displayMessage,
    safety_guidance: safetyGuidance,
    cta,
    acknowledged_at: signal.acknowledged_at instanceof Date ? signal.acknowledged_at.toISOString() : signal.acknowledged_at || null,
    resolved_at: signal.resolved_at instanceof Date ? signal.resolved_at.toISOString() : signal.resolved_at || null
  };
}

export function toDoctorCareSignalDto(signal: any) {
  let clinicalTitle = 'Sinyal Layanan';
  switch (signal.signal_type) {
    case 'SEVERE_SIDE_EFFECT_REPORTED':
      clinicalTitle = 'Laporan Efek Samping Berat';
      break;
    case 'FOLLOW_UP_OVERDUE':
      clinicalTitle = 'Jadwal Kontrol Terlewat (Perlu Tindak Lanjut)';
      break;
    case 'REFILL_NEEDS_ATTENTION':
      clinicalTitle = 'Persediaan Obat Habis / Kritis';
      break;
    case 'PATIENT_REQUESTED_CLINICAL_CONTACT':
      clinicalTitle = 'Permintaan Kontak Klinis Pasien';
      break;
    case 'PATIENT_REQUESTED_COMPANION_SUPPORT':
      clinicalTitle = 'Permintaan Dukungan Pendamping';
      break;
  }

  const metadata = (signal.metadata || {}) as Record<string, any>;

  return {
    public_id: signal.public_id,
    patient_public_id: signal.patient?.public_id || null,
    patient_display_alias: signal.patient?.display_alias || 'Pasien',
    signal_type: signal.signal_type,
    signal_scope: signal.signal_scope,
    priority: signal.priority,
    status: signal.status,
    clinical_title: clinicalTitle,
    detected_at: signal.detected_at instanceof Date ? signal.detected_at.toISOString() : signal.detected_at,
    overdue_bucket: metadata.overdue_bucket || null,
    overdue_days: metadata.overdue_days !== undefined ? metadata.overdue_days : null,
    request_category: metadata.category || null,
    preferred_contact_time: metadata.preferred_contact_time || null,
    acknowledged_at: signal.acknowledged_at instanceof Date ? signal.acknowledged_at.toISOString() : signal.acknowledged_at || null,
    resolved_at: signal.resolved_at instanceof Date ? signal.resolved_at.toISOString() : signal.resolved_at || null,
    dismissed_at: signal.dismissed_at instanceof Date ? signal.dismissed_at.toISOString() : signal.dismissed_at || null,
    actions: (signal.actions || []).map((action: any) => ({
      id: action.id,
      action_type: action.action_type,
      occurred_at: action.occurred_at instanceof Date ? action.occurred_at.toISOString() : action.occurred_at,
      next_follow_up_at: action.next_follow_up_at instanceof Date ? action.next_follow_up_at.toISOString() : action.next_follow_up_at || null,
      actor_role: action.actor?.role || null,
      actor_display_alias: action.actor?.display_alias || 'Petugas'
    }))
  };
}

export function toCompanionCareSignalDto(signal: any) {
  // PRIVACY GUARANTEE:
  // Companion payloads MUST NEVER contain:
  // - medication identity / names
  // - dosage
  // - exact stock quantity
  // - side effect data / symptoms / free text
  // - clinical notes
  // - SEVERE_SIDE_EFFECT_REPORTED or PATIENT_REQUESTED_CLINICAL_CONTACT signals

  let supportTitle = 'Perlu Dukungan';
  let supportDescription = 'Pengguna membutuhkan tindak lanjut.';

  switch (signal.signal_type) {
    case 'FOLLOW_UP_OVERDUE':
      supportTitle = 'Kontrol perlu ditindaklanjuti';
      supportDescription = 'Jadwal kontrol terlewat. Mohon dampingi untuk tindak lanjut penjadwalan.';
      break;
    case 'REFILL_NEEDS_ATTENTION':
      supportTitle = 'Persediaan kesehatan perlu diperiksa';
      supportDescription = 'Pengguna melaporkan persediaan menipis. Mohon tanyakan status pengambilan berikutnya.';
      break;
    case 'PATIENT_REQUESTED_COMPANION_SUPPORT':
      supportTitle = 'Pengguna meminta dukungan';
      supportDescription = 'Pengguna secara aktif meminta pendamping untuk menghubungi.';
      break;
  }

  const metadata = (signal.metadata || {}) as Record<string, any>;

  return {
    public_id: signal.public_id,
    patient_public_id: signal.patient?.public_id || null,
    patient_display_alias: signal.patient?.display_alias || 'Pasien Dampingan',
    signal_type: signal.signal_type,
    priority: signal.priority,
    status: signal.status,
    support_title: supportTitle,
    support_description: supportDescription,
    overdue_bucket: metadata.overdue_bucket || null,
    preferred_contact_time: metadata.preferred_contact_time || null,
    detected_at: signal.detected_at instanceof Date ? signal.detected_at.toISOString() : signal.detected_at,
    acknowledged_at: signal.acknowledged_at instanceof Date ? signal.acknowledged_at.toISOString() : signal.acknowledged_at || null,
    actions: (signal.actions || []).map((action: any) => ({
      id: action.id,
      action_type: action.action_type,
      occurred_at: action.occurred_at instanceof Date ? action.occurred_at.toISOString() : action.occurred_at,
      next_follow_up_at: action.next_follow_up_at instanceof Date ? action.next_follow_up_at.toISOString() : action.next_follow_up_at || null,
      actor_role: action.actor?.role || null,
      actor_display_alias: action.actor?.display_alias || 'Pendamping'
    }))
  };
}

export function toFollowUpSupportConsentDto(consent: any) {
  return {
    is_consent_enabled: Boolean(consent?.is_consent_enabled),
    consented_at: consent?.consented_at instanceof Date ? consent.consented_at.toISOString() : consent?.consented_at || null,
    revoked_at: consent?.revoked_at instanceof Date ? consent.revoked_at.toISOString() : consent?.revoked_at || null,
    updated_at: consent?.updated_at instanceof Date ? consent.updated_at.toISOString() : consent?.updated_at || null
  };
}

export function toAdminCareSignalSummaryDto(stats: {
  total_open: number;
  total_acknowledged: number;
  total_resolved: number;
  by_type: Record<string, number>;
  by_scope: Record<string, number>;
  by_priority: Record<string, number>;
}) {
  return {
    total_open: stats.total_open,
    total_acknowledged: stats.total_acknowledged,
    total_resolved: stats.total_resolved,
    by_type: stats.by_type,
    by_scope: stats.by_scope,
    by_priority: stats.by_priority
  };
}
