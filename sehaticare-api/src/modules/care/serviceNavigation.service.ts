import { randomUUID } from 'node:crypto';
import { prisma } from '../../db/prisma';
import { recordAuditLog } from '../../utils/audit';
import { hasDoctorPatientRelationship } from './hivCare.service';

export class ServiceNavigationError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'ServiceNavigationError';
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function resolveUser(identifier: string) {
  if (!identifier) return null;
  const isUuid = UUID_REGEX.test(identifier);
  return prisma.users.findFirst({
    where: isUuid ? { id: identifier } : { public_id: identifier },
    select: {
      id: true,
      public_id: true,
      display_alias: true,
      role: true,
      is_active: true
    }
  });
}

export async function resolveFacility(identifier: string) {
  if (!identifier) return null;
  const isUuid = UUID_REGEX.test(identifier);
  return prisma.health_facilities.findFirst({
    where: isUuid ? { id: identifier } : { id: identifier },
    include: {
      regions: true,
      facility_services: {
        where: { verified: true, is_active: true }
      }
    }
  });
}

export async function resolveReferral(identifier: string) {
  if (!identifier) return null;
  const isUuid = UUID_REGEX.test(identifier);
  return prisma.care_referrals.findFirst({
    where: isUuid ? { id: identifier } : { public_id: identifier },
    include: {
      patient: {
        select: { id: true, public_id: true, display_alias: true }
      },
      source_facility: true,
      source_doctor: {
        select: { id: true, public_id: true, display_alias: true, role: true }
      },
      target_facility: true,
      target_doctor: {
        select: { id: true, public_id: true, display_alias: true, role: true }
      },
      consent: true,
      companion_share: true,
      events: {
        orderBy: { occurred_at: 'desc' },
        include: {
          actor: {
            select: { id: true, public_id: true, display_alias: true, role: true }
          }
        }
      }
    }
  });
}

// ==========================================
// PUBLIC SERVICE FACILITY DIRECTORY
// ==========================================

export async function getPublicServiceFacilities(query: {
  region_id?: string;
  facility_type?: 'PUSKESMAS' | 'RUMAH_SAKIT' | 'KLINIK';
  service_type?: any;
  q?: string;
  limit?: number;
  offset?: number;
}) {
  const where: any = {
    is_active: true,
    verification_status: 'VERIFIED'
  };

  if (query.region_id) {
    where.region_id = query.region_id;
  }

  if (query.facility_type) {
    where.facility_type = query.facility_type;
  }

  if (query.q) {
    where.OR = [
      { name: { contains: query.q, mode: 'insensitive' } },
      { address: { contains: query.q, mode: 'insensitive' } },
      { district_name: { contains: query.q, mode: 'insensitive' } }
    ];
  }

  if (query.service_type) {
    where.facility_services = {
      some: {
        service: query.service_type,
        verified: true,
        is_active: true
      }
    };
  }

  const [facilities, total] = await Promise.all([
    prisma.health_facilities.findMany({
      where,
      orderBy: { name: 'asc' },
      take: query.limit ?? 20,
      skip: query.offset ?? 0,
      include: {
        regions: true,
        facility_services: {
          where: { verified: true, is_active: true }
        }
      }
    }),
    prisma.health_facilities.count({ where })
  ]);

  return { facilities, total };
}

export async function getPublicServiceFacilityById(facilityIdentifier: string) {
  const facility = await resolveFacility(facilityIdentifier);
  if (!facility || !facility.is_active || facility.verification_status !== 'VERIFIED') {
    throw new ServiceNavigationError('Fasilitas kesehatan tidak ditemukan atau belum terverifikasi', 404);
  }
  return facility;
}

// ==========================================
// DOCTOR FACILITY AFFILIATION & ELIGIBILITY
// ==========================================

export async function getEligibleTargetClinicians(facilityId: string) {
  // Query doctors affiliated with target facility
  // 1. Through doctor_facility_affiliations table
  // 2. Verified doctor profile & active account
  const affiliations = await prisma.doctor_facility_affiliations.findMany({
    where: {
      facility_id: facilityId,
      is_active: true,
      doctor: {
        is_active: true,
        role: 'DOKTER'
      }
    },
    include: {
      doctor: {
        select: {
          id: true,
          public_id: true,
          display_alias: true,
          doctor_profiles_doctor_profiles_user_idTousers: {
            select: {
              verification_status: true,
              puskesmas_name: true
            }
          }
        }
      }
    }
  });

  return affiliations
    .filter((a) => a.doctor.doctor_profiles_doctor_profiles_user_idTousers?.verification_status === 'VERIFIED')
    .map((a) => ({
      id: a.doctor.id,
      public_id: a.doctor.public_id,
      display_alias: a.doctor.display_alias || 'Dokter Spesialis/Umum',
      facility_name: a.doctor.doctor_profiles_doctor_profiles_user_idTousers?.puskesmas_name || null
    }));
}

export const REFERRAL_TYPE_TO_SERVICE_TYPES: Record<string, string[]> = {
  CLINICAL_FOLLOW_UP: ['CLINICAL_CONSULTATION'],
  CONTINUITY_OF_CARE: ['ART_CONTINUITY', 'ARV_SERVICE'],
  LAB_MONITORING: ['LAB_MONITORING', 'LABORATORY'],
  MEDICATION_CONTINUITY: ['ART_CONTINUITY', 'ARV_SERVICE'],
  COUNSELING: ['COUNSELING', 'PSYCHOLOGY'],
  GENERAL_REFERRAL: ['REFERRAL_INTAKE', 'CLINICAL_CONSULTATION']
};

export async function isDoctorAffiliatedWithFacility(
  doctorUserId: string,
  facilityId: string,
  tx: any = prisma
): Promise<boolean> {
  // 1. Verify target facility is active and verified
  const facility = await tx.health_facilities.findUnique({
    where: { id: facilityId },
    select: { id: true, is_active: true, verification_status: true, name: true }
  });
  if (!facility || !facility.is_active || facility.verification_status !== 'VERIFIED') {
    return false;
  }

  // 2. Verify doctor user is active and role is DOKTER
  const doctor = await tx.users.findUnique({
    where: { id: doctorUserId },
    select: { id: true, is_active: true, role: true }
  });
  if (!doctor || !doctor.is_active || doctor.role !== 'DOKTER') {
    return false;
  }

  // 3. Verify affiliation in doctor_facility_affiliations
  const affiliation = await tx.doctor_facility_affiliations.findFirst({
    where: {
      doctor_user_id: doctorUserId,
      facility_id: facilityId,
      is_active: true
    }
  });
  return Boolean(affiliation);
}

export async function createDoctorAffiliation(input: {
  doctorUserId: string;
  facilityId: string;
  isActive?: boolean;
}) {
  const doctor = await prisma.users.findUnique({
    where: { id: input.doctorUserId }
  });
  if (!doctor || doctor.role !== 'DOKTER') {
    throw new ServiceNavigationError('Pengguna bukan dokter aktif', 400);
  }

  const facility = await prisma.health_facilities.findUnique({
    where: { id: input.facilityId }
  });
  if (!facility) {
    throw new ServiceNavigationError('Fasilitas kesehatan tidak ditemukan', 404);
  }

  const now = new Date();
  return prisma.doctor_facility_affiliations.upsert({
    where: {
      doctor_user_id_facility_id: {
        doctor_user_id: input.doctorUserId,
        facility_id: input.facilityId
      }
    },
    create: {
      id: randomUUID(),
      doctor_user_id: input.doctorUserId,
      facility_id: input.facilityId,
      is_active: input.isActive ?? true,
      created_at: now,
      updated_at: now
    },
    update: {
      is_active: input.isActive ?? true,
      updated_at: now
    }
  });
}


// ==========================================
// PATIENT REFERRAL WORKFLOWS
// ==========================================

export async function requestPatientReferral(input: {
  patientUserId: string;
  targetFacilityId: string;
  referralType: 'CLINICAL_FOLLOW_UP' | 'CONTINUITY_OF_CARE' | 'LAB_MONITORING' | 'MEDICATION_CONTINUITY' | 'COUNSELING' | 'GENERAL_REFERRAL';
  schedulingPreference?: string | null;
  correlationId?: string;
}) {
  const targetFacility = await prisma.health_facilities.findUnique({
    where: { id: input.targetFacilityId }
  });

  if (!targetFacility || !targetFacility.is_active || targetFacility.verification_status !== 'VERIFIED') {
    throw new ServiceNavigationError('Fasilitas tujuan tidak valid atau belum terverifikasi', 400);
  }

  const allowedServices = REFERRAL_TYPE_TO_SERVICE_TYPES[input.referralType] || [];
  const activeService = await prisma.facility_services.findFirst({
    where: {
      facility_id: targetFacility.id,
      service: { in: allowedServices as any },
      is_active: true,
      verified: true
    }
  });

  if (!activeService) {
    throw new ServiceNavigationError('Fasilitas tujuan tidak menyediakan layanan aktif yang diminta', 400);
  }

  const now = new Date();
  const referralId = randomUUID();

  const referral = await prisma.$transaction(async (tx) => {
    const created = await tx.care_referrals.create({
      data: {
        id: referralId,
        patient_id: input.patientUserId,
        target_facility_id: input.targetFacilityId,
        initiated_by_user_id: input.patientUserId,
        initiation_type: 'PATIENT_REQUEST',
        referral_type: input.referralType,
        status: 'REQUESTED',
        scheduling_preference: input.schedulingPreference || null,
        requested_at: now
      }
    });

    // Create consent record default OFF
    await tx.care_referral_consents.create({
      data: {
        id: randomUUID(),
        referral_id: created.id,
        patient_id: input.patientUserId,
        is_consent_enabled: false
      }
    });

    // Create companion share record default OFF
    await tx.care_referral_companion_shares.create({
      data: {
        id: randomUUID(),
        referral_id: created.id,
        patient_id: input.patientUserId,
        is_enabled: false,
        share_target_facility: false
      }
    });

    // Record immutable event
    await tx.care_referral_events.create({
      data: {
        id: randomUUID(),
        referral_id: created.id,
        actor_user_id: input.patientUserId,
        event_type: 'REQUESTED',
        occurred_at: now
      }
    });

    return created;
  });

  await recordAuditLog(prisma, {
    actorUserId: input.patientUserId,
    action: 'REFERRAL_REQUESTED',
    entityType: 'care_referral',
    entityId: referral.id,
    meta: {
      public_id: referral.public_id,
      target_facility_id: input.targetFacilityId,
      referral_type: input.referralType,
      correlation_id: input.correlationId
    }
  });

  return resolveReferral(referral.id);
}

export async function getPatientReferrals(patientUserId: string) {
  return prisma.care_referrals.findMany({
    where: { patient_id: patientUserId },
    orderBy: { requested_at: 'desc' },
    include: {
      source_facility: true,
      target_facility: true,
      consent: true,
      companion_share: true
    }
  });
}

export async function getPatientReferralDetail(patientUserId: string, referralIdentifier: string) {
  const referral = await resolveReferral(referralIdentifier);
  if (!referral || referral.patient_id !== patientUserId) {
    throw new ServiceNavigationError('Rujukan tidak ditemukan', 404);
  }
  return referral;
}

export async function updatePatientReferralConsent(input: {
  patientUserId: string;
  referralIdentifier: string;
  isConsentEnabled: boolean;
  correlationId?: string;
}) {
  const referral = await resolveReferral(input.referralIdentifier);
  if (!referral || referral.patient_id !== input.patientUserId) {
    throw new ServiceNavigationError('Rujukan tidak ditemukan', 404);
  }

  // Once sent, patient consent cannot be mutated via this endpoint
  if (referral.status === 'SENT') {
    throw new ServiceNavigationError('Rujukan telah dikirim ke fasilitas tujuan dan persetujuan tidak dapat diubah', 409);
  }

  // Once accepted or completed, consent cannot be silently revoked to undo historical relationship
  if (['ACCEPTED', 'COMPLETED'].includes(referral.status)) {
    throw new ServiceNavigationError('Rujukan telah diterima oleh fasilitas tujuan dan relasi layanan telah berjalan', 409);
  }

  // Terminal states cannot have consent mutated
  if (['DECLINED', 'CANCELLED'].includes(referral.status)) {
    throw new ServiceNavigationError('Status rujukan terminal tidak dapat diubah', 409);
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const current = await tx.care_referrals.findUnique({
      where: { id: referral.id }
    });
    if (!current) throw new ServiceNavigationError('Rujukan tidak ditemukan', 404);
    if (!['REQUESTED', 'DRAFT', 'PENDING_PATIENT_CONSENT', 'CONSENTED'].includes(current.status)) {
      throw new ServiceNavigationError('Status rujukan saat ini tidak mengizinkan perubahan persetujuan', 409);
    }

    await tx.care_referral_consents.upsert({
      where: { referral_id: referral.id },
      create: {
        id: randomUUID(),
        referral_id: referral.id,
        patient_id: input.patientUserId,
        is_consent_enabled: input.isConsentEnabled,
        consented_at: input.isConsentEnabled ? now : null,
        revoked_at: !input.isConsentEnabled ? now : null
      },
      update: {
        is_consent_enabled: input.isConsentEnabled,
        consented_at: input.isConsentEnabled ? now : undefined,
        revoked_at: !input.isConsentEnabled ? now : null,
        updated_at: now
      }
    });

    let nextStatus = current.status;
    if (input.isConsentEnabled) {
      if (['PENDING_PATIENT_CONSENT', 'DRAFT'].includes(current.status)) {
        nextStatus = 'CONSENTED';
      }
    } else {
      if (current.status === 'CONSENTED') {
        nextStatus = 'PENDING_PATIENT_CONSENT';
      }
    }

    await tx.care_referrals.update({
      where: { id: referral.id },
      data: {
        status: nextStatus,
        consented_at: input.isConsentEnabled ? now : null,
        updated_at: now
      }
    });

    await tx.care_referral_events.create({
      data: {
        id: randomUUID(),
        referral_id: referral.id,
        actor_user_id: input.patientUserId,
        event_type: input.isConsentEnabled ? 'PATIENT_CONSENT_GRANTED' : 'PATIENT_CONSENT_REVOKED',
        occurred_at: now
      }
    });
  });

  await recordAuditLog(prisma, {
    actorUserId: input.patientUserId,
    action: input.isConsentEnabled ? 'REFERRAL_CONSENT_GRANTED' : 'REFERRAL_CONSENT_REVOKED',
    entityType: 'care_referral',
    entityId: referral.id,
    meta: {
      public_id: referral.public_id,
      is_consent_enabled: input.isConsentEnabled,
      correlation_id: input.correlationId
    }
  });

  return resolveReferral(referral.id);
}

export async function cancelPatientReferral(input: {
  patientUserId: string;
  referralIdentifier: string;
  correlationId?: string;
}) {
  const referral = await resolveReferral(input.referralIdentifier);
  if (!referral || referral.patient_id !== input.patientUserId) {
    throw new ServiceNavigationError('Rujukan tidak ditemukan', 404);
  }

  if (['ACCEPTED', 'COMPLETED', 'DECLINED', 'CANCELLED'].includes(referral.status)) {
    throw new ServiceNavigationError('Status rujukan saat ini tidak dapat dibatalkan', 409);
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.care_referrals.update({
      where: { id: referral.id },
      data: {
        status: 'CANCELLED',
        cancelled_at: now,
        updated_at: now
      }
    });

    await tx.care_referral_events.create({
      data: {
        id: randomUUID(),
        referral_id: referral.id,
        actor_user_id: input.patientUserId,
        event_type: 'CANCELLED',
        occurred_at: now
      }
    });
  });

  await recordAuditLog(prisma, {
    actorUserId: input.patientUserId,
    action: 'REFERRAL_CANCELLED',
    entityType: 'care_referral',
    entityId: referral.id,
    meta: {
      public_id: referral.public_id,
      correlation_id: input.correlationId
    }
  });

  return resolveReferral(referral.id);
}

export async function updatePatientReferralCompanionShare(input: {
  patientUserId: string;
  referralIdentifier: string;
  isEnabled: boolean;
  shareTargetFacility?: boolean;
  correlationId?: string;
}) {
  const referral = await resolveReferral(input.referralIdentifier);
  if (!referral || referral.patient_id !== input.patientUserId) {
    throw new ServiceNavigationError('Rujukan tidak ditemukan', 404);
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.care_referral_companion_shares.upsert({
      where: { referral_id: referral.id },
      create: {
        id: randomUUID(),
        referral_id: referral.id,
        patient_id: input.patientUserId,
        is_enabled: input.isEnabled,
        share_target_facility: input.shareTargetFacility || false,
        enabled_at: input.isEnabled ? now : null,
        revoked_at: !input.isEnabled ? now : null
      },
      update: {
        is_enabled: input.isEnabled,
        share_target_facility: input.shareTargetFacility !== undefined ? input.shareTargetFacility : undefined,
        enabled_at: input.isEnabled ? now : undefined,
        revoked_at: !input.isEnabled ? now : null,
        updated_at: now
      }
    });

    await tx.care_referral_events.create({
      data: {
        id: randomUUID(),
        referral_id: referral.id,
        actor_user_id: input.patientUserId,
        event_type: input.isEnabled ? 'COMPANION_STATUS_SHARING_ENABLED' : 'COMPANION_STATUS_SHARING_DISABLED',
        occurred_at: now
      }
    });
  });

  await recordAuditLog(prisma, {
    actorUserId: input.patientUserId,
    action: input.isEnabled ? 'REFERRAL_COMPANION_SHARE_ENABLED' : 'REFERRAL_COMPANION_SHARE_DISABLED',
    entityType: 'care_referral',
    entityId: referral.id,
    meta: {
      public_id: referral.public_id,
      is_enabled: input.isEnabled,
      share_target_facility: input.shareTargetFacility,
      correlation_id: input.correlationId
    }
  });

  return resolveReferral(referral.id);
}

// ==========================================
// SOURCE DOCTOR WORKFLOWS
// ==========================================

export async function getDoctorPatientReferrals(input: {
  doctorUserId: string;
  patientIdentifier: string;
}) {
  const patient = await resolveUser(input.patientIdentifier);
  if (!patient || patient.role !== 'PASIEN') {
    throw new ServiceNavigationError('Pasien tidak ditemukan', 404);
  }

  const hasScope = await hasDoctorPatientRelationship(input.doctorUserId, patient.id);
  if (!hasScope) {
    throw new ServiceNavigationError('Tidak memiliki relasi klinis sah dengan pasien ini', 403);
  }

  return prisma.care_referrals.findMany({
    where: { patient_id: patient.id },
    orderBy: { requested_at: 'desc' },
    include: {
      patient: { select: { id: true, public_id: true, display_alias: true } },
      source_facility: true,
      source_doctor: { select: { id: true, public_id: true, display_alias: true, role: true } },
      target_facility: true,
      target_doctor: { select: { id: true, public_id: true, display_alias: true, role: true } },
      consent: true,
      events: {
        orderBy: { occurred_at: 'desc' },
        include: { actor: { select: { id: true, role: true } } }
      }
    }
  });
}

export async function createDoctorReferralDraft(input: {
  doctorUserId: string;
  patientIdentifier: string;
  targetFacilityId: string;
  targetDoctorId?: string | null;
  referralType: 'CLINICAL_FOLLOW_UP' | 'CONTINUITY_OF_CARE' | 'LAB_MONITORING' | 'MEDICATION_CONTINUITY' | 'COUNSELING' | 'GENERAL_REFERRAL';
  schedulingPreference?: string | null;
  correlationId?: string;
}) {
  const patient = await resolveUser(input.patientIdentifier);
  if (!patient || patient.role !== 'PASIEN') {
    throw new ServiceNavigationError('Pasien tidak ditemukan', 404);
  }

  const hasScope = await hasDoctorPatientRelationship(input.doctorUserId, patient.id);
  if (!hasScope) {
    throw new ServiceNavigationError('Tidak memiliki relasi klinis sah dengan pasien ini', 403);
  }

  const targetFacility = await prisma.health_facilities.findUnique({
    where: { id: input.targetFacilityId }
  });
  if (!targetFacility || !targetFacility.is_active || targetFacility.verification_status !== 'VERIFIED') {
    throw new ServiceNavigationError('Fasilitas tujuan tidak valid atau belum terverifikasi', 400);
  }

  if (input.targetDoctorId) {
    const isAffiliated = await isDoctorAffiliatedWithFacility(input.targetDoctorId, input.targetFacilityId);
    if (!isAffiliated) {
      throw new ServiceNavigationError('Dokter tujuan tidak terafiliasi aktif dengan fasilitas tujuan', 400);
    }
  }

  // Find source doctor's facility if any
  const sourceAffiliation = await prisma.doctor_facility_affiliations.findFirst({
    where: { doctor_user_id: input.doctorUserId, is_active: true }
  });

  const now = new Date();
  const referralId = randomUUID();

  const referral = await prisma.$transaction(async (tx) => {
    const created = await tx.care_referrals.create({
      data: {
        id: referralId,
        patient_id: patient.id,
        source_facility_id: sourceAffiliation?.facility_id || null,
        source_doctor_id: input.doctorUserId,
        target_facility_id: input.targetFacilityId,
        target_doctor_id: input.targetDoctorId || null,
        initiated_by_user_id: input.doctorUserId,
        initiation_type: 'DOCTOR_INITIATED',
        referral_type: input.referralType,
        status: 'DRAFT',
        scheduling_preference: input.schedulingPreference || null,
        requested_at: now
      }
    });

    await tx.care_referral_consents.create({
      data: {
        id: randomUUID(),
        referral_id: created.id,
        patient_id: patient.id,
        is_consent_enabled: false
      }
    });

    await tx.care_referral_companion_shares.create({
      data: {
        id: randomUUID(),
        referral_id: created.id,
        patient_id: patient.id,
        is_enabled: false,
        share_target_facility: false
      }
    });

    await tx.care_referral_events.create({
      data: {
        id: randomUUID(),
        referral_id: created.id,
        actor_user_id: input.doctorUserId,
        event_type: 'DRAFTED',
        occurred_at: now
      }
    });

    return created;
  });

  await recordAuditLog(prisma, {
    actorUserId: input.doctorUserId,
    action: 'REFERRAL_DRAFTED',
    entityType: 'care_referral',
    entityId: referral.id,
    meta: {
      public_id: referral.public_id,
      patient_id: patient.id,
      target_facility_id: input.targetFacilityId,
      correlation_id: input.correlationId
    }
  });

  return resolveReferral(referral.id);
}

export async function reviewDoctorPatientReferral(input: {
  doctorUserId: string;
  referralIdentifier: string;
  targetFacilityId?: string;
  targetDoctorId?: string | null;
  referralType?: 'CLINICAL_FOLLOW_UP' | 'CONTINUITY_OF_CARE' | 'LAB_MONITORING' | 'MEDICATION_CONTINUITY' | 'COUNSELING' | 'GENERAL_REFERRAL';
  schedulingPreference?: string | null;
  correlationId?: string;
}) {
  const referral = await resolveReferral(input.referralIdentifier);
  if (!referral) {
    throw new ServiceNavigationError('Rujukan tidak ditemukan', 404);
  }

  // Doctor may review the patient request only if verifyDoctorPatientScope succeeds!
  const hasScope = await hasDoctorPatientRelationship(input.doctorUserId, referral.patient_id);
  if (!hasScope) {
    throw new ServiceNavigationError('Tidak memiliki relasi klinis sah dengan pasien ini', 403);
  }

  // Status check: must be REQUESTED or DRAFT
  if (!['REQUESTED', 'DRAFT'].includes(referral.status)) {
    throw new ServiceNavigationError('Rujukan sudah diproses dan tidak dapat ditinjau ulang', 409);
  }

  const targetFacilityId = input.targetFacilityId || referral.target_facility_id;
  const targetFacility = await prisma.health_facilities.findUnique({
    where: { id: targetFacilityId }
  });
  if (!targetFacility || !targetFacility.is_active || targetFacility.verification_status !== 'VERIFIED') {
    throw new ServiceNavigationError('Fasilitas tujuan tidak valid atau belum terverifikasi', 400);
  }

  const referralType = input.referralType || referral.referral_type;

  if (input.targetDoctorId) {
    const isAffiliated = await isDoctorAffiliatedWithFacility(input.targetDoctorId, targetFacilityId);
    if (!isAffiliated) {
      throw new ServiceNavigationError('Dokter tujuan tidak terafiliasi aktif dengan fasilitas tujuan', 400);
    }
  }

  const sourceAffiliation = await prisma.doctor_facility_affiliations.findFirst({
    where: { doctor_user_id: input.doctorUserId, is_active: true }
  });

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.care_referrals.update({
      where: { id: referral.id },
      data: {
        source_doctor_id: input.doctorUserId,
        source_facility_id: sourceAffiliation?.facility_id || referral.source_facility_id,
        target_facility_id: targetFacilityId,
        target_doctor_id: input.targetDoctorId !== undefined ? input.targetDoctorId : referral.target_doctor_id,
        referral_type: referralType,
        scheduling_preference: input.schedulingPreference !== undefined ? input.schedulingPreference : referral.scheduling_preference,
        status: 'DRAFT',
        updated_at: now
      }
    });

    await tx.care_referral_events.create({
      data: {
        id: randomUUID(),
        referral_id: referral.id,
        actor_user_id: input.doctorUserId,
        event_type: 'DRAFTED',
        occurred_at: now
      }
    });

    return row;
  });

  await recordAuditLog(prisma, {
    actorUserId: input.doctorUserId,
    action: 'REFERRAL_DRAFTED',
    entityType: 'care_referral',
    entityId: referral.id,
    meta: {
      public_id: referral.public_id,
      patient_id: referral.patient_id,
      target_facility_id: targetFacilityId,
      correlation_id: input.correlationId
    }
  });

  return resolveReferral(updated.id);
}

export async function updateDoctorReferralDraft(input: {
  doctorUserId: string;
  referralIdentifier: string;
  targetFacilityId?: string;
  targetDoctorId?: string | null;
  referralType?: 'CLINICAL_FOLLOW_UP' | 'CONTINUITY_OF_CARE' | 'LAB_MONITORING' | 'MEDICATION_CONTINUITY' | 'COUNSELING' | 'GENERAL_REFERRAL';
  schedulingPreference?: string | null;
  correlationId?: string;
}) {
  const referral = await resolveReferral(input.referralIdentifier);
  if (!referral) {
    throw new ServiceNavigationError('Rujukan tidak ditemukan', 404);
  }

  // Doctor authorization: must satisfy verifyDoctorPatientScope
  const hasScope = await hasDoctorPatientRelationship(input.doctorUserId, referral.patient_id);
  if (!hasScope) {
    throw new ServiceNavigationError('Tidak memiliki relasi klinis sah dengan pasien ini', 403);
  }

  if (referral.source_doctor_id && referral.source_doctor_id !== input.doctorUserId) {
    throw new ServiceNavigationError('Tidak memiliki wewenang mengubah draf rujukan ini', 403);
  }

  if (!['DRAFT', 'REQUESTED', 'PENDING_PATIENT_CONSENT'].includes(referral.status)) {
    throw new ServiceNavigationError('Rujukan sudah diproses dan draf tidak dapat diubah', 409);
  }

  const targetFacilityId = input.targetFacilityId || referral.target_facility_id;
  const targetFacility = await prisma.health_facilities.findUnique({
    where: { id: targetFacilityId }
  });
  if (!targetFacility || !targetFacility.is_active || targetFacility.verification_status !== 'VERIFIED') {
    throw new ServiceNavigationError('Fasilitas tujuan tidak valid atau belum terverifikasi', 400);
  }

  const referralType = input.referralType || referral.referral_type;

  if (input.targetDoctorId) {
    const isAffiliated = await isDoctorAffiliatedWithFacility(input.targetDoctorId, targetFacilityId);
    if (!isAffiliated) {
      throw new ServiceNavigationError('Dokter tujuan tidak terafiliasi aktif dengan fasilitas tujuan', 400);
    }
  }

  const sourceAffiliation = await prisma.doctor_facility_affiliations.findFirst({
    where: { doctor_user_id: input.doctorUserId, is_active: true }
  });

  const now = new Date();
  const nextStatus = referral.status === 'REQUESTED' ? 'DRAFT' : referral.status;
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.care_referrals.update({
      where: { id: referral.id },
      data: {
        source_doctor_id: input.doctorUserId,
        source_facility_id: sourceAffiliation?.facility_id || referral.source_facility_id,
        target_facility_id: targetFacilityId,
        target_doctor_id: input.targetDoctorId !== undefined ? input.targetDoctorId : referral.target_doctor_id,
        referral_type: referralType,
        scheduling_preference: input.schedulingPreference !== undefined ? input.schedulingPreference : referral.scheduling_preference,
        status: nextStatus,
        updated_at: now
      }
    });

    if (referral.status === 'REQUESTED') {
      await tx.care_referral_events.create({
        data: {
          id: randomUUID(),
          referral_id: referral.id,
          actor_user_id: input.doctorUserId,
          event_type: 'DRAFTED',
          occurred_at: now
        }
      });
    }

    if (input.targetDoctorId && input.targetDoctorId !== referral.target_doctor_id) {
      await tx.care_referral_events.create({
        data: {
          id: randomUUID(),
          referral_id: referral.id,
          actor_user_id: input.doctorUserId,
          event_type: 'RECEIVING_DOCTOR_ASSIGNED',
          occurred_at: now
        }
      });
    }

    return row;
  });

  return resolveReferral(updated.id);
}

export async function requestDoctorPatientReferralConsent(input: {
  doctorUserId: string;
  referralIdentifier: string;
  correlationId?: string;
}) {
  const referral = await resolveReferral(input.referralIdentifier);
  if (!referral) {
    throw new ServiceNavigationError('Rujukan tidak ditemukan', 404);
  }

  const hasScope = await hasDoctorPatientRelationship(input.doctorUserId, referral.patient_id);
  if (!hasScope) {
    throw new ServiceNavigationError('Tidak memiliki relasi klinis sah dengan pasien ini', 403);
  }

  if (referral.source_doctor_id && referral.source_doctor_id !== input.doctorUserId) {
    throw new ServiceNavigationError('Tidak memiliki wewenang untuk rujukan ini', 403);
  }

  if (!['DRAFT', 'REQUESTED'].includes(referral.status)) {
    throw new ServiceNavigationError('Rujukan sudah dalam proses persetujuan atau telah dikirim', 409);
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.care_referrals.update({
      where: { id: referral.id },
      data: {
        source_doctor_id: input.doctorUserId,
        status: 'PENDING_PATIENT_CONSENT',
        updated_at: now
      }
    });

    await tx.care_referral_events.create({
      data: {
        id: randomUUID(),
        referral_id: referral.id,
        actor_user_id: input.doctorUserId,
        event_type: 'PATIENT_CONSENT_REQUESTED',
        occurred_at: now
      }
    });
  });

  await recordAuditLog(prisma, {
    actorUserId: input.doctorUserId,
    action: 'REFERRAL_CONSENT_REQUESTED',
    entityType: 'care_referral',
    entityId: referral.id,
    meta: {
      public_id: referral.public_id,
      correlation_id: input.correlationId
    }
  });

  return resolveReferral(referral.id);
}

export async function sendDoctorReferral(input: {
  doctorUserId: string;
  referralIdentifier: string;
  correlationId?: string;
}) {
  const referral = await resolveReferral(input.referralIdentifier);
  if (!referral) {
    throw new ServiceNavigationError('Rujukan tidak ditemukan', 404);
  }

  // Verify clinical scope with patient
  const hasScope = await hasDoctorPatientRelationship(input.doctorUserId, referral.patient_id);
  if (!hasScope) {
    throw new ServiceNavigationError('Tidak memiliki relasi klinis sah dengan pasien ini', 403);
  }

  if (referral.source_doctor_id && referral.source_doctor_id !== input.doctorUserId) {
    throw new ServiceNavigationError('Tidak memiliki wewenang untuk rujukan ini', 403);
  }

  // PRIVACY BOUNDARY: Named receiving doctor is REQUIRED!
  if (!referral.target_doctor_id) {
    throw new ServiceNavigationError('Dokter penerima di fasilitas tujuan harus ditentukan sebelum rujukan dikirim', 400);
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    // 1. Fetch fresh record inside tx to protect against concurrent revocation
    const current = await tx.care_referrals.findUnique({
      where: { id: referral.id },
      include: {
        consent: true,
        target_facility: true
      }
    });

    if (!current) throw new ServiceNavigationError('Rujukan tidak ditemukan', 404);

    // PRIVACY BOUNDARY: Patient consent is REQUIRED before sending!
    if (!current.consent?.is_consent_enabled) {
      throw new ServiceNavigationError('Persetujuan pasien diperlukan sebelum rujukan dapat dikirim', 400);
    }

    if (current.status !== 'CONSENTED') {
      throw new ServiceNavigationError('Rujukan harus disetujui pasien (status CONSENTED) sebelum dapat dikirim', 409);
    }

    if (!current.target_doctor_id) {
      throw new ServiceNavigationError('Dokter penerima di fasilitas tujuan harus ditentukan sebelum rujukan dikirim', 400);
    }

    // 2. Revalidate target doctor eligibility immediately before SEND
    const isAffiliated = await isDoctorAffiliatedWithFacility(current.target_doctor_id, current.target_facility_id, tx);
    if (!isAffiliated) {
      throw new ServiceNavigationError('Dokter penerima tidak terafiliasi aktif dengan fasilitas tujuan', 400);
    }

    // 3. Conditional update
    const updateResult = await tx.care_referrals.updateMany({
      where: {
        id: referral.id,
        status: 'CONSENTED'
      },
      data: {
        status: 'SENT',
        sent_at: now,
        updated_at: now
      }
    });

    if (updateResult.count === 0) {
      throw new ServiceNavigationError('Rujukan gagal dikirim karena status atau persetujuan telah berubah', 409);
    }

    await tx.care_referral_events.create({
      data: {
        id: randomUUID(),
        referral_id: referral.id,
        actor_user_id: input.doctorUserId,
        event_type: 'SENT',
        occurred_at: now
      }
    });
  });

  await recordAuditLog(prisma, {
    actorUserId: input.doctorUserId,
    action: 'REFERRAL_SENT',
    entityType: 'care_referral',
    entityId: referral.id,
    meta: {
      public_id: referral.public_id,
      target_doctor_id: referral.target_doctor_id,
      target_facility_id: referral.target_facility_id,
      correlation_id: input.correlationId
    }
  });

  return resolveReferral(referral.id);
}

export async function cancelDoctorReferral(input: {
  doctorUserId: string;
  referralIdentifier: string;
  correlationId?: string;
}) {
  const referral = await resolveReferral(input.referralIdentifier);
  if (!referral) {
    throw new ServiceNavigationError('Rujukan tidak ditemukan', 404);
  }

  const hasScope = await hasDoctorPatientRelationship(input.doctorUserId, referral.patient_id);
  if (!hasScope) {
    throw new ServiceNavigationError('Tidak memiliki relasi klinis sah dengan pasien ini', 403);
  }

  if (referral.source_doctor_id && referral.source_doctor_id !== input.doctorUserId) {
    throw new ServiceNavigationError('Tidak memiliki wewenang membatalkan rujukan ini', 403);
  }

  if (['ACCEPTED', 'COMPLETED', 'DECLINED', 'CANCELLED'].includes(referral.status)) {
    throw new ServiceNavigationError('Status rujukan saat ini tidak dapat dibatalkan', 409);
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.care_referrals.update({
      where: { id: referral.id },
      data: {
        status: 'CANCELLED',
        cancelled_at: now,
        updated_at: now
      }
    });

    await tx.care_referral_events.create({
      data: {
        id: randomUUID(),
        referral_id: referral.id,
        actor_user_id: input.doctorUserId,
        event_type: 'CANCELLED',
        occurred_at: now
      }
    });
  });

  await recordAuditLog(prisma, {
    actorUserId: input.doctorUserId,
    action: 'REFERRAL_CANCELLED',
    entityType: 'care_referral',
    entityId: referral.id,
    meta: {
      public_id: referral.public_id,
      correlation_id: input.correlationId
    }
  });

  return resolveReferral(referral.id);
}

export async function completeReferral(input: {
  doctorUserId: string;
  referralIdentifier: string;
  correlationId?: string;
}) {
  const referral = await resolveReferral(input.referralIdentifier);
  if (!referral) {
    throw new ServiceNavigationError('Rujukan tidak ditemukan', 404);
  }

  const isSourceDoctor = referral.source_doctor_id === input.doctorUserId;
  const isTargetDoctor = referral.target_doctor_id === input.doctorUserId;
  if (!isSourceDoctor && !isTargetDoctor) {
    throw new ServiceNavigationError('Hanya dokter perujuk atau dokter penerima yang dapat menyelesaikan rujukan', 403);
  }

  if (referral.status !== 'ACCEPTED') {
    throw new ServiceNavigationError('Hanya rujukan berstatus ACCEPTED yang dapat diselesaikan', 409);
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.care_referrals.update({
      where: { id: referral.id },
      data: {
        status: 'COMPLETED',
        completed_at: now,
        updated_at: now
      }
    });

    await tx.care_referral_events.create({
      data: {
        id: randomUUID(),
        referral_id: referral.id,
        actor_user_id: input.doctorUserId,
        event_type: 'COMPLETED',
        occurred_at: now
      }
    });
  });

  await recordAuditLog(prisma, {
    actorUserId: input.doctorUserId,
    action: 'REFERRAL_COMPLETED',
    entityType: 'care_referral',
    entityId: referral.id,
    meta: {
      public_id: referral.public_id,
      correlation_id: input.correlationId
    }
  });

  return resolveReferral(referral.id);
}

// ==========================================
// RECEIVING DOCTOR WORKFLOWS
// ==========================================

export async function getDoctorIncomingReferrals(doctorUserId: string) {
  // PRIVACY BOUNDARY:
  // ONLY returns referrals where target_doctor_id = doctorUserId, status = SENT, and patient consent is ENABLED!
  // Other doctors at the same facility MUST NOT see these referrals!
  return prisma.care_referrals.findMany({
    where: {
      target_doctor_id: doctorUserId,
      status: 'SENT',
      consent: {
        is_consent_enabled: true
      }
    },
    orderBy: { sent_at: 'desc' },
    include: {
      patient: { select: { id: true, public_id: true, display_alias: true } },
      source_facility: true,
      target_facility: true
    }
  });
}

export async function getDoctorIncomingReferralDetail(doctorUserId: string, referralIdentifier: string) {
  const referral = await resolveReferral(referralIdentifier);
  if (!referral) {
    throw new ServiceNavigationError('Rujukan tidak ditemukan', 404);
  }

  if (referral.target_doctor_id !== doctorUserId) {
    throw new ServiceNavigationError('Tidak memiliki otorisasi untuk rujukan masuk ini', 403);
  }

  if (!referral.consent?.is_consent_enabled) {
    throw new ServiceNavigationError('Persetujuan pasien tidak aktif untuk rujukan ini', 403);
  }

  return referral;
}

export async function acceptIncomingReferral(input: {
  doctorUserId: string;
  referralIdentifier: string;
  correlationId?: string;
}) {
  const referral = await resolveReferral(input.referralIdentifier);
  if (!referral) {
    throw new ServiceNavigationError('Rujukan tidak ditemukan', 404);
  }

  if (referral.target_doctor_id !== input.doctorUserId) {
    throw new ServiceNavigationError('Tidak memiliki otorisasi untuk menerima rujukan ini', 403);
  }

  if (!referral.consent?.is_consent_enabled) {
    throw new ServiceNavigationError('Persetujuan pasien tidak aktif untuk rujukan ini', 403);
  }

  // Concurrency guard: Only SENT referrals can be accepted
  if (referral.status !== 'SENT') {
    throw new ServiceNavigationError('Rujukan sudah diproses atau status tidak valid untuk diterima', 409);
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // 1. Re-fetch fresh state inside tx to ensure status and consent are strictly valid
    const current = await tx.care_referrals.findUnique({
      where: { id: referral.id },
      include: { consent: true }
    });

    if (!current || current.status !== 'SENT') {
      throw new ServiceNavigationError('Rujukan sudah diproses atau status tidak valid untuk diterima', 409);
    }

    if (!current.consent?.is_consent_enabled) {
      throw new ServiceNavigationError('Persetujuan pasien tidak aktif untuk rujukan ini', 403);
    }

    // 2. Re-verify destination doctor eligibility immediately before ACCEPT
    const isAffiliated = await isDoctorAffiliatedWithFacility(input.doctorUserId, current.target_facility_id, tx);
    if (!isAffiliated) {
      throw new ServiceNavigationError('Dokter penerima tidak terafiliasi aktif dengan fasilitas tujuan saat menerima rujukan', 400);
    }

    // 3. Conditional update: ensures only one concurrent request can successfully accept
    const updateResult = await tx.care_referrals.updateMany({
      where: {
        id: referral.id,
        status: 'SENT',
        target_doctor_id: input.doctorUserId
      },
      data: {
        status: 'ACCEPTED',
        accepted_at: now,
        updated_at: now
      }
    });

    if (updateResult.count === 0) {
      throw new ServiceNavigationError('Rujukan sudah diproses atau status tidak valid untuk diterima', 409);
    }

    // 4. Establish legitimate clinical relationship through current architecture!
    // Creates an active consultation with destination doctor
    await tx.consultations.create({
      data: {
        id: randomUUID(),
        patient_id: current.patient_id,
        assignedDoctorId: input.doctorUserId,
        status: 'DOKTER_AKTIF',
        initial_complaint: `Rujukan Masuk: ${current.referral_type}`,
        opened_at: now,
        doctor_joined_at: now,
        updated_at: now
      }
    });

    // 5. Record immutable event
    await tx.care_referral_events.create({
      data: {
        id: randomUUID(),
        referral_id: referral.id,
        actor_user_id: input.doctorUserId,
        event_type: 'ACCEPTED',
        occurred_at: now
      }
    });
  });

  await recordAuditLog(prisma, {
    actorUserId: input.doctorUserId,
    action: 'REFERRAL_ACCEPTED',
    entityType: 'care_referral',
    entityId: referral.id,
    meta: {
      public_id: referral.public_id,
      patient_id: referral.patient_id,
      target_doctor_id: input.doctorUserId,
      correlation_id: input.correlationId
    }
  });

  return resolveReferral(referral.id);
}

export async function declineIncomingReferral(input: {
  doctorUserId: string;
  referralIdentifier: string;
  reason: 'SERVICE_NOT_AVAILABLE' | 'CAPACITY_UNAVAILABLE' | 'WRONG_SERVICE' | 'NEEDS_DIFFERENT_FACILITY' | 'OTHER_OPERATIONAL';
  correlationId?: string;
}) {
  const referral = await resolveReferral(input.referralIdentifier);
  if (!referral) {
    throw new ServiceNavigationError('Rujukan tidak ditemukan', 404);
  }

  if (referral.target_doctor_id !== input.doctorUserId) {
    throw new ServiceNavigationError('Tidak memiliki otorisasi untuk rujukan masuk ini', 403);
  }

  if (referral.status !== 'SENT') {
    throw new ServiceNavigationError('Rujukan sudah diproses atau status tidak valid untuk ditolak', 409);
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.care_referrals.update({
      where: { id: referral.id },
      data: {
        status: 'DECLINED',
        declined_at: now,
        decline_reason: input.reason,
        updated_at: now
      }
    });

    await tx.care_referral_events.create({
      data: {
        id: randomUUID(),
        referral_id: referral.id,
        actor_user_id: input.doctorUserId,
        event_type: 'DECLINED',
        safe_reason_code: input.reason,
        occurred_at: now
      }
    });
  });

  await recordAuditLog(prisma, {
    actorUserId: input.doctorUserId,
    action: 'REFERRAL_DECLINED',
    entityType: 'care_referral',
    entityId: referral.id,
    meta: {
      public_id: referral.public_id,
      reason: input.reason,
      correlation_id: input.correlationId
    }
  });

  return resolveReferral(referral.id);
}

// ==========================================
// COMPANION WORKFLOWS & REFERRAL SUPPORT
// ==========================================

export async function getCompanionReferrals(companionUserId: string) {
  // Requires:
  // 1. Active longitudinal assignment (patient_companion_assignments)
  // 2. Per-referral companion sharing enabled (care_referral_companion_shares.is_enabled = true)
  const assignments = await prisma.patient_companion_assignments.findMany({
    where: { companion_user_id: companionUserId, status: 'ACTIVE' },
    select: { patient_user_id: true }
  });

  if (assignments.length === 0) return [];
  const patientIds = assignments.map((a) => a.patient_user_id);

  return prisma.care_referrals.findMany({
    where: {
      patient_id: { in: patientIds },
      companion_share: {
        is_enabled: true
      }
    },
    orderBy: { requested_at: 'desc' },
    include: {
      patient: { select: { id: true, public_id: true, display_alias: true } },
      target_facility: { select: { name: true } },
      companion_share: true,
      events: {
        orderBy: { occurred_at: 'desc' }
      }
    }
  });
}

export async function getCompanionPatientReferrals(input: {
  companionUserId: string;
  patientIdentifier: string;
}) {
  const patient = await resolveUser(input.patientIdentifier);
  if (!patient || patient.role !== 'PASIEN') {
    throw new ServiceNavigationError('Pasien tidak ditemukan', 404);
  }

  const assignment = await prisma.patient_companion_assignments.findFirst({
    where: { companion_user_id: input.companionUserId, patient_user_id: patient.id, status: 'ACTIVE' }
  });
  if (!assignment) {
    throw new ServiceNavigationError('Anda tidak memiliki penugasan aktif untuk pasien ini', 403);
  }

  return prisma.care_referrals.findMany({
    where: {
      patient_id: patient.id,
      companion_share: {
        is_enabled: true
      }
    },
    orderBy: { requested_at: 'desc' },
    include: {
      patient: { select: { id: true, public_id: true, display_alias: true } },
      target_facility: { select: { name: true } },
      companion_share: true,
      events: {
        orderBy: { occurred_at: 'desc' }
      }
    }
  });
}

export async function recordCompanionReferralAction(input: {
  companionUserId: string;
  referralIdentifier: string;
  actionType: 'ACKNOWLEDGED' | 'CONTACT_ATTEMPTED' | 'CONTACTED';
  correlationId?: string;
}) {
  const referral = await resolveReferral(input.referralIdentifier);
  if (!referral) {
    throw new ServiceNavigationError('Rujukan tidak ditemukan', 404);
  }

  const assignment = await prisma.patient_companion_assignments.findFirst({
    where: { companion_user_id: input.companionUserId, patient_user_id: referral.patient_id, status: 'ACTIVE' }
  });
  if (!assignment) {
    throw new ServiceNavigationError('Anda tidak memiliki penugasan aktif untuk pasien ini', 403);
  }

  if (!referral.companion_share?.is_enabled) {
    throw new ServiceNavigationError('Izin berbagi dukungan rujukan tidak aktif untuk rujukan ini', 403);
  }

  const now = new Date();
  let eventType: 'SUPPORT_CONTACT_ATTEMPTED' | 'SUPPORT_CONTACTED' = 'SUPPORT_CONTACT_ATTEMPTED';
  if (input.actionType === 'CONTACTED') eventType = 'SUPPORT_CONTACTED';

  await prisma.care_referral_events.create({
    data: {
      id: randomUUID(),
      referral_id: referral.id,
      actor_user_id: input.companionUserId,
      event_type: eventType,
      occurred_at: now
    }
  });

  await recordAuditLog(prisma, {
    actorUserId: input.companionUserId,
    action: eventType === 'SUPPORT_CONTACTED' ? 'REFERRAL_SUPPORT_CONTACTED' : 'REFERRAL_SUPPORT_CONTACT_ATTEMPTED',
    entityType: 'care_referral',
    entityId: referral.id,
    meta: {
      public_id: referral.public_id,
      action_type: input.actionType,
      correlation_id: input.correlationId
    }
  });

  return resolveReferral(referral.id);
}

// ==========================================
// CARE SIGNAL ESCALATION INTEGRATION
// ==========================================

export async function createReferralFromCareSignalEscalation(input: {
  actorUserId: string;
  careSignalId: string;
  targetFacilityId?: string;
  correlationId?: string;
}) {
  const signal = await prisma.care_signals.findUnique({
    where: { id: input.careSignalId }
  });
  if (!signal) return null;

  // Deduplication check: Is there already an active referral for this care signal?
  const existingActive = await prisma.care_referrals.findFirst({
    where: {
      source_care_signal_id: signal.id,
      status: {
        notIn: ['DECLINED', 'CANCELLED', 'COMPLETED']
      }
    }
  });
  if (existingActive) {
    return existingActive;
  }

  // Find a verified target facility (default to existing or first verified puskesmas)
  let targetFacilityId = input.targetFacilityId;
  if (!targetFacilityId) {
    const defaultFacility = await prisma.health_facilities.findFirst({
      where: { is_active: true, verification_status: 'VERIFIED' },
      select: { id: true }
    });
    targetFacilityId = defaultFacility?.id;
  }
  if (!targetFacilityId) return null;

  const now = new Date();
  const referralId = randomUUID();

  const referral = await prisma.$transaction(async (tx) => {
    const existingInTx = await tx.care_referrals.findFirst({
      where: {
        source_care_signal_id: signal.id,
        status: {
          notIn: ['DECLINED', 'CANCELLED', 'COMPLETED']
        }
      }
    });
    if (existingInTx) {
      return existingInTx;
    }

    const created = await tx.care_referrals.create({
      data: {
        id: referralId,
        patient_id: signal.patient_id,
        target_facility_id: targetFacilityId!,
        initiated_by_user_id: input.actorUserId,
        initiation_type: 'CARE_SIGNAL_ESCALATION',
        referral_type: 'CLINICAL_FOLLOW_UP',
        status: 'REQUESTED',
        source_care_signal_id: signal.id,
        requested_at: now
      }
    });

    await tx.care_referral_consents.create({
      data: {
        id: randomUUID(),
        referral_id: created.id,
        patient_id: signal.patient_id,
        is_consent_enabled: false
      }
    });

    await tx.care_referral_companion_shares.create({
      data: {
        id: randomUUID(),
        referral_id: created.id,
        patient_id: signal.patient_id,
        is_enabled: false,
        share_target_facility: false
      }
    });

    await tx.care_referral_events.create({
      data: {
        id: randomUUID(),
        referral_id: created.id,
        actor_user_id: input.actorUserId,
        event_type: 'REQUESTED',
        occurred_at: now
      }
    });

    return created;
  });

  await recordAuditLog(prisma, {
    actorUserId: input.actorUserId,
    action: 'REFERRAL_REQUESTED',
    entityType: 'care_referral',
    entityId: referral.id,
    meta: {
      public_id: referral.public_id,
      care_signal_id: signal.id,
      initiation_type: 'CARE_SIGNAL_ESCALATION',
      correlation_id: input.correlationId
    }
  });

  return referral;
}

// ==========================================
// ADMIN GOVERNANCE SUMMARY
// ==========================================

export async function getAdminReferralsSummary() {
  const [totalRequested, totalSent, totalAccepted, totalDeclined, totalCompleted, allReferrals] = await Promise.all([
    prisma.care_referrals.count({ where: { status: 'REQUESTED' } }),
    prisma.care_referrals.count({ where: { status: 'SENT' } }),
    prisma.care_referrals.count({ where: { status: 'ACCEPTED' } }),
    prisma.care_referrals.count({ where: { status: 'DECLINED' } }),
    prisma.care_referrals.count({ where: { status: 'COMPLETED' } }),
    prisma.care_referrals.findMany({
      select: {
        referral_type: true,
        target_facility_id: true
      }
    })
  ]);

  const byType: Record<string, number> = {};
  const byFacility: Record<string, number> = {};

  for (const r of allReferrals) {
    byType[r.referral_type] = (byType[r.referral_type] || 0) + 1;
    byFacility[r.target_facility_id] = (byFacility[r.target_facility_id] || 0) + 1;
  }

  return {
    total_requested: totalRequested,
    total_sent: totalSent,
    total_accepted: totalAccepted,
    total_declined: totalDeclined,
    total_completed: totalCompleted,
    by_type: byType,
    by_facility: byFacility
  };
}
