import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { recordAuditLog } from '../../utils/audit';
import { accessAudit } from '../stage4/stage4.shared';

type PrismaTx = PrismaClient | Prisma.TransactionClient;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class HivCareError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'HivCareError';
    this.statusCode = statusCode;
  }
}

export async function resolveUser(identifier: string, tx: PrismaTx = prisma) {
  const isUuid = UUID_REGEX.test(identifier);
  return tx.users.findFirst({
    where: isUuid ? { id: identifier } : { public_id: identifier }
  });
}

export async function resolveEnrollment(identifier: string, tx: PrismaTx = prisma) {
  const isUuid = UUID_REGEX.test(identifier);
  return tx.hiv_care_enrollments.findFirst({
    where: isUuid ? { id: identifier } : { public_id: identifier },
    include: {
      patient: true,
      facility: true
    }
  });
}

export async function resolveMonitoringEntry(identifier: string, tx: PrismaTx = prisma) {
  const isUuid = UUID_REGEX.test(identifier);
  return tx.hiv_monitoring_entries.findFirst({
    where: isUuid ? { id: identifier } : { public_id: identifier },
    include: {
      enrollment: true,
      patient: true
    }
  });
}

export async function hasDoctorPatientRelationship(
  doctorUserId: string,
  patientUserId: string,
  tx: PrismaTx = prisma
): Promise<boolean> {
  const consultation = await tx.consultations.findFirst({
    where: {
      assignedDoctorId: doctorUserId,
      patient_id: patientUserId
    },
    select: { id: true }
  });
  if (consultation) return true;

  const schedule = await tx.control_schedules.findFirst({
    where: {
      worker_id: doctorUserId,
      user_id: patientUserId
    },
    select: { id: true }
  });
  if (schedule) return true;

  return false;
}

export async function getActiveEnrollmentForPatient(
  patientUserId: string,
  tx: PrismaTx = prisma
) {
  return tx.hiv_care_enrollments.findFirst({
    where: {
      patient_user_id: patientUserId,
      status: 'ACTIVE'
    },
    include: {
      facility: true
    }
  });
}

// ==========================================
// CARE ENROLLMENT LIFECYCLE (ADMIN)
// ==========================================

export async function createCareEnrollment(input: {
  patientIdentifier: string;
  facilityId?: string | null;
  actorUserId: string;
  correlationId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const patient = await resolveUser(input.patientIdentifier, tx);
    if (!patient) {
      throw new HivCareError('Pasien tidak ditemukan', 404);
    }
    if (patient.role !== 'PASIEN') {
      throw new HivCareError('Care enrollment hanya dapat dibuat untuk pengguna dengan peran PASIEN', 400);
    }
    if (!patient.is_active) {
      throw new HivCareError('Akun pasien tidak aktif', 400);
    }

    if (input.facilityId) {
      const facility = await tx.health_facilities.findUnique({
        where: { id: input.facilityId }
      });
      if (!facility || !facility.is_active) {
        throw new HivCareError('Fasilitas kesehatan tidak valid atau tidak aktif', 400);
      }
    }

    const existingActive = await tx.hiv_care_enrollments.findFirst({
      where: {
        patient_user_id: patient.id,
        status: 'ACTIVE'
      }
    });

    if (existingActive) {
      throw new HivCareError('Pasien sudah memiliki Care Enrollment yang aktif', 409);
    }

    const enrollmentId = randomUUID();
    const enrollment = await tx.hiv_care_enrollments.create({
      data: {
        id: enrollmentId,
        patient_user_id: patient.id,
        facility_id: input.facilityId ?? null,
        status: 'ACTIVE',
        created_by_user_id: input.actorUserId
      },
      include: {
        patient: { select: { public_id: true, display_alias: true } },
        facility: { select: { id: true, name: true, facility_type: true } }
      }
    });

    await recordAuditLog(tx, {
      actorUserId: input.actorUserId,
      action: 'CARE_ENROLLMENT_CREATE',
      entityType: 'hiv_care_enrollments',
      entityId: enrollment.id,
      meta: {
        enrollment_public_id: enrollment.public_id,
        patient_public_id: patient.public_id,
        facility_id: input.facilityId ?? null
      }
    });

    await accessAudit({
      actorId: input.actorUserId,
      actorRole: 'ADMIN',
      resourceType: 'CARE_ENROLLMENT',
      resourcePublicId: enrollment.public_id,
      action: 'CARE_ENROLLMENT_CREATE',
      correlationId: input.correlationId,
      safeMetadata: {
        enrollment_public_id: enrollment.public_id,
        patient_public_id: patient.public_id,
        facility_id: input.facilityId ?? null
      }
    });

    return enrollment;
  });
}

export async function transferCareEnrollment(input: {
  enrollmentIdentifier: string;
  facilityId: string;
  transferReason?: string | null;
  actorUserId: string;
  correlationId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const existing = await resolveEnrollment(input.enrollmentIdentifier, tx);
    if (!existing) {
      throw new HivCareError('Care enrollment tidak ditemukan', 404);
    }
    if (existing.status !== 'ACTIVE') {
      throw new HivCareError('Hanya enrollment berstatus ACTIVE yang dapat dipindahkan fasilitasnya', 400);
    }

    const facility = await tx.health_facilities.findUnique({
      where: { id: input.facilityId }
    });
    if (!facility || !facility.is_active) {
      throw new HivCareError('Fasilitas kesehatan tujuan tidak valid atau tidak aktif', 400);
    }

    const now = new Date();
    await tx.hiv_care_enrollments.update({
      where: { id: existing.id },
      data: {
        status: 'TRANSFERRED',
        ended_at: now,
        end_reason: input.transferReason?.trim() || 'TRANSFERRED_TO_ANOTHER_FACILITY',
        updated_by_user_id: input.actorUserId,
        updated_at: now
      }
    });

    const newEnrollmentId = randomUUID();
    const newEnrollment = await tx.hiv_care_enrollments.create({
      data: {
        id: newEnrollmentId,
        patient_user_id: existing.patient_user_id,
        facility_id: facility.id,
        status: 'ACTIVE',
        enrolled_at: now,
        created_by_user_id: input.actorUserId
      },
      include: {
        patient: { select: { public_id: true, display_alias: true } },
        facility: { select: { id: true, name: true, facility_type: true } }
      }
    });

    await recordAuditLog(tx, {
      actorUserId: input.actorUserId,
      action: 'CARE_ENROLLMENT_TRANSFER',
      entityType: 'hiv_care_enrollments',
      entityId: newEnrollment.id,
      meta: {
        previous_enrollment_id: existing.id,
        new_enrollment_id: newEnrollment.id,
        patient_public_id: existing.patient.public_id,
        new_facility_id: facility.id
      }
    });

    await accessAudit({
      actorId: input.actorUserId,
      actorRole: 'ADMIN',
      resourceType: 'CARE_ENROLLMENT',
      resourcePublicId: newEnrollment.public_id,
      action: 'CARE_ENROLLMENT_TRANSFER',
      correlationId: input.correlationId,
      safeMetadata: {
        previous_enrollment_public_id: existing.public_id,
        new_enrollment_public_id: newEnrollment.public_id,
        patient_public_id: existing.patient.public_id,
        new_facility_id: facility.id
      }
    });

    return newEnrollment;
  });
}

export async function endCareEnrollment(input: {
  enrollmentIdentifier: string;
  endReason: string;
  actorUserId: string;
  correlationId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const existing = await resolveEnrollment(input.enrollmentIdentifier, tx);
    if (!existing) {
      throw new HivCareError('Care enrollment tidak ditemukan', 404);
    }
    if (existing.status !== 'ACTIVE') {
      throw new HivCareError('Hanya enrollment berstatus ACTIVE yang dapat diakhiri', 400);
    }

    const now = new Date();
    const updated = await tx.hiv_care_enrollments.update({
      where: { id: existing.id },
      data: {
        status: 'ENDED',
        ended_at: now,
        end_reason: input.endReason.trim(),
        updated_by_user_id: input.actorUserId,
        updated_at: now
      },
      include: {
        patient: { select: { public_id: true, display_alias: true } },
        facility: { select: { id: true, name: true, facility_type: true } }
      }
    });

    await recordAuditLog(tx, {
      actorUserId: input.actorUserId,
      action: 'CARE_ENROLLMENT_END',
      entityType: 'hiv_care_enrollments',
      entityId: updated.id,
      meta: {
        enrollment_id: updated.id,
        patient_public_id: existing.patient.public_id,
        end_reason: input.endReason.trim()
      }
    });

    await accessAudit({
      actorId: input.actorUserId,
      actorRole: 'ADMIN',
      resourceType: 'CARE_ENROLLMENT',
      resourcePublicId: updated.public_id,
      action: 'CARE_ENROLLMENT_END',
      correlationId: input.correlationId,
      safeMetadata: {
        enrollment_public_id: updated.public_id,
        patient_public_id: existing.patient.public_id,
        end_reason: input.endReason.trim()
      }
    });

    return updated;
  });
}

export async function listCareEnrollments(input: {
  status?: string;
  page?: number;
  limit?: number;
}) {
  const page = input.page && input.page > 0 ? input.page : 1;
  const limit = input.limit && input.limit > 0 ? input.limit : 20;
  const skip = (page - 1) * limit;

  const where: Prisma.hiv_care_enrollmentsWhereInput = {};
  if (input.status && input.status !== 'ALL') {
    where.status = input.status as any;
  }

  const [items, total] = await Promise.all([
    prisma.hiv_care_enrollments.findMany({
      where,
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
      include: {
        patient: { select: { public_id: true, display_alias: true } },
        facility: { select: { id: true, name: true, facility_type: true } }
      }
    }),
    prisma.hiv_care_enrollments.count({ where })
  ]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

// ==========================================
// PATIENT CARE & MONITORING
// ==========================================

export async function getPatientCareSummary(patientUserId: string) {
  const activeEnrollment = await prisma.hiv_care_enrollments.findFirst({
    where: { patient_user_id: patientUserId, status: 'ACTIVE' },
    orderBy: { enrolled_at: 'desc' },
    include: { facility: true }
  });

  const latestEnrollment =
    activeEnrollment ??
    (await prisma.hiv_care_enrollments.findFirst({
      where: { patient_user_id: patientUserId },
      orderBy: { enrolled_at: 'desc' },
      include: { facility: true }
    }));

  const latestMonitoring = await prisma.hiv_monitoring_entries.findFirst({
    where: { patient_user_id: patientUserId, archived_at: null },
    orderBy: { recorded_at: 'desc' },
    select: { recorded_at: true }
  });

  return {
    enrollment: latestEnrollment,
    latest_monitoring_date: latestMonitoring?.recorded_at.toISOString() ?? null
  };
}

export async function listPatientMonitoringEntries(
  patientUserId: string,
  options: { page?: number; limit?: number; correlationId: string }
) {
  const page = options.page && options.page > 0 ? options.page : 1;
  const limit = options.limit && options.limit > 0 ? options.limit : 20;
  const skip = (page - 1) * limit;

  const where = {
    patient_user_id: patientUserId,
    archived_at: null
  };

  const [items, total] = await Promise.all([
    prisma.hiv_monitoring_entries.findMany({
      where,
      skip,
      take: limit,
      orderBy: { recorded_at: 'desc' }
    }),
    prisma.hiv_monitoring_entries.count({ where })
  ]);

  await accessAudit({
    actorId: patientUserId,
    actorRole: 'PASIEN',
    resourceType: 'HIV_MONITORING',
    resourcePublicId: patientUserId,
    action: 'HIV_MONITORING_VIEW',
    correlationId: options.correlationId,
    safeMetadata: { count: items.length }
  });

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

export async function createPatientSelfReportEntry(input: {
  patientUserId: string;
  data: {
    recorded_at: Date;
    weight_kg?: number | null;
    general_condition?: string | null;
    patient_note?: string | null;
  };
  correlationId: string;
}) {
  const activeEnrollment = await getActiveEnrollmentForPatient(input.patientUserId);
  if (!activeEnrollment) {
    throw new HivCareError(
      'Anda belum memiliki Care Enrollment aktif untuk mengisi catatan pemantauan mandiri',
      400
    );
  }

  const entryId = randomUUID();
  const entry = await prisma.hiv_monitoring_entries.create({
    data: {
      id: entryId,
      enrollment_id: activeEnrollment.id,
      patient_user_id: input.patientUserId,
      recorded_by_user_id: input.patientUserId,
      recorded_at: input.data.recorded_at,
      weight_kg: input.data.weight_kg !== undefined && input.data.weight_kg !== null ? new Prisma.Decimal(input.data.weight_kg) : null,
      general_condition: input.data.general_condition?.trim() || null,
      patient_note: input.data.patient_note?.trim() || null,
      source: 'PATIENT'
    }
  });

  await recordAuditLog(prisma, {
    actorUserId: input.patientUserId,
    action: 'HIV_MONITORING_CREATE',
    entityType: 'hiv_monitoring_entries',
    entityId: entry.id,
    meta: {
      public_id: entry.public_id,
      source: 'PATIENT'
    }
  });

  await accessAudit({
    actorId: input.patientUserId,
    actorRole: 'PASIEN',
    resourceType: 'HIV_MONITORING',
    resourcePublicId: entry.public_id,
    action: 'HIV_MONITORING_CREATE',
    correlationId: input.correlationId,
    safeMetadata: {
      public_id: entry.public_id,
      source: 'PATIENT'
    }
  });

  return entry;
}

// ==========================================
// DOCTOR CARE & CLINICAL MONITORING
// ==========================================

export async function getDoctorCareSummary(patientUserId: string) {
  const patient = await prisma.users.findUnique({
    where: { id: patientUserId },
    select: { id: true, public_id: true, display_alias: true }
  });
  if (!patient) return null;

  const activeEnrollment = await prisma.hiv_care_enrollments.findFirst({
    where: { patient_user_id: patientUserId, status: 'ACTIVE' },
    orderBy: { enrolled_at: 'desc' },
    include: { facility: true }
  });

  const latestMonitoring = await prisma.hiv_monitoring_entries.findFirst({
    where: { patient_user_id: patientUserId },
    orderBy: { recorded_at: 'desc' },
    select: { recorded_at: true }
  });

  return {
    patient,
    enrollment: activeEnrollment,
    latest_monitoring_date: latestMonitoring?.recorded_at.toISOString() ?? null
  };
}

export async function listDoctorMonitoringEntries(
  patientUserId: string,
  doctorUserId: string,
  options: { page?: number; limit?: number; includeArchived?: boolean; correlationId: string }
) {
  const page = options.page && options.page > 0 ? options.page : 1;
  const limit = options.limit && options.limit > 0 ? options.limit : 20;
  const skip = (page - 1) * limit;

  const where: Prisma.hiv_monitoring_entriesWhereInput = {
    patient_user_id: patientUserId,
    ...(options.includeArchived ? {} : { archived_at: null })
  };

  const [items, total] = await Promise.all([
    prisma.hiv_monitoring_entries.findMany({
      where,
      skip,
      take: limit,
      orderBy: { recorded_at: 'desc' }
    }),
    prisma.hiv_monitoring_entries.count({ where })
  ]);

  await accessAudit({
    actorId: doctorUserId,
    actorRole: 'DOKTER',
    resourceType: 'HIV_MONITORING',
    resourcePublicId: patientUserId,
    action: 'HIV_MONITORING_VIEW',
    correlationId: options.correlationId,
    safeMetadata: { count: items.length }
  });

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

export async function createDoctorMonitoringEntry(input: {
  patientUserId: string;
  doctorUserId: string;
  data: {
    recorded_at: Date;
    weight_kg?: number | null;
    cd4_count_cells_mm3?: number | null;
    viral_load_copies_ml?: number | null;
    viral_load_interpretation?: any;
    tb_screening_result?: string | null;
    general_condition?: string | null;
    clinical_note_private?: string | null;
  };
  correlationId: string;
}) {
  const activeEnrollment = await getActiveEnrollmentForPatient(input.patientUserId);
  if (!activeEnrollment) {
    throw new HivCareError(
      'Pasien belum memiliki Care Enrollment aktif untuk pencatatan pemantauan klinis',
      400
    );
  }

  const entryId = randomUUID();
  const entry = await prisma.hiv_monitoring_entries.create({
    data: {
      id: entryId,
      enrollment_id: activeEnrollment.id,
      patient_user_id: input.patientUserId,
      recorded_by_user_id: input.doctorUserId,
      recorded_at: input.data.recorded_at,
      weight_kg: input.data.weight_kg !== undefined && input.data.weight_kg !== null ? new Prisma.Decimal(input.data.weight_kg) : null,
      cd4_count_cells_mm3: input.data.cd4_count_cells_mm3 ?? null,
      viral_load_copies_ml: input.data.viral_load_copies_ml ?? null,
      viral_load_interpretation: input.data.viral_load_interpretation ?? null,
      tb_screening_result: input.data.tb_screening_result?.trim() || null,
      general_condition: input.data.general_condition?.trim() || null,
      clinical_note_private: input.data.clinical_note_private?.trim() || null,
      source: 'DOCTOR'
    }
  });

  await recordAuditLog(prisma, {
    actorUserId: input.doctorUserId,
    action: 'HIV_MONITORING_CREATE',
    entityType: 'hiv_monitoring_entries',
    entityId: entry.id,
    meta: {
      public_id: entry.public_id,
      source: 'DOCTOR'
    }
  });

  await accessAudit({
    actorId: input.doctorUserId,
    actorRole: 'DOKTER',
    resourceType: 'HIV_MONITORING',
    resourcePublicId: entry.public_id,
    action: 'HIV_MONITORING_CREATE',
    correlationId: input.correlationId,
    safeMetadata: {
      public_id: entry.public_id,
      source: 'DOCTOR'
    }
  });

  return entry;
}

export async function updateDoctorMonitoringEntry(input: {
  monitoringIdentifier: string;
  doctorUserId: string;
  data: {
    recorded_at?: Date;
    weight_kg?: number | null;
    cd4_count_cells_mm3?: number | null;
    viral_load_copies_ml?: number | null;
    viral_load_interpretation?: any;
    tb_screening_result?: string | null;
    general_condition?: string | null;
    clinical_note_private?: string | null;
  };
  correlationId: string;
}) {
  const entry = await resolveMonitoringEntry(input.monitoringIdentifier);
  if (!entry) {
    throw new HivCareError('Catatan pemantauan tidak ditemukan', 404);
  }
  if (entry.archived_at) {
    throw new HivCareError('Catatan pemantauan yang telah diarsipkan tidak dapat diubah', 400);
  }

  const hasRel = await hasDoctorPatientRelationship(input.doctorUserId, entry.patient_user_id);
  if (!hasRel) {
    throw new HivCareError('Tidak memiliki relasi klinis sah dengan pasien ini', 403);
  }

  const updated = await prisma.hiv_monitoring_entries.update({
    where: { id: entry.id },
    data: {
      ...(input.data.recorded_at ? { recorded_at: input.data.recorded_at } : {}),
      ...(input.data.weight_kg !== undefined ? { weight_kg: input.data.weight_kg !== null ? new Prisma.Decimal(input.data.weight_kg) : null } : {}),
      ...(input.data.cd4_count_cells_mm3 !== undefined ? { cd4_count_cells_mm3: input.data.cd4_count_cells_mm3 } : {}),
      ...(input.data.viral_load_copies_ml !== undefined ? { viral_load_copies_ml: input.data.viral_load_copies_ml } : {}),
      ...(input.data.viral_load_interpretation !== undefined ? { viral_load_interpretation: input.data.viral_load_interpretation } : {}),
      ...(input.data.tb_screening_result !== undefined ? { tb_screening_result: input.data.tb_screening_result?.trim() || null } : {}),
      ...(input.data.general_condition !== undefined ? { general_condition: input.data.general_condition?.trim() || null } : {}),
      ...(input.data.clinical_note_private !== undefined ? { clinical_note_private: input.data.clinical_note_private?.trim() || null } : {}),
      updated_at: new Date()
    }
  });

  await recordAuditLog(prisma, {
    actorUserId: input.doctorUserId,
    action: 'HIV_MONITORING_UPDATE',
    entityType: 'hiv_monitoring_entries',
    entityId: updated.id,
    meta: {
      public_id: updated.public_id,
      source: updated.source
    }
  });

  await accessAudit({
    actorId: input.doctorUserId,
    actorRole: 'DOKTER',
    resourceType: 'HIV_MONITORING',
    resourcePublicId: updated.public_id,
    action: 'HIV_MONITORING_UPDATE',
    correlationId: input.correlationId,
    safeMetadata: {
      public_id: updated.public_id
    }
  });

  return updated;
}

export async function archiveDoctorMonitoringEntry(input: {
  monitoringIdentifier: string;
  doctorUserId: string;
  correlationId: string;
}) {
  const entry = await resolveMonitoringEntry(input.monitoringIdentifier);
  if (!entry) {
    throw new HivCareError('Catatan pemantauan tidak ditemukan', 404);
  }
  if (entry.archived_at) {
    throw new HivCareError('Catatan pemantauan sudah diarsipkan sebelumnya', 400);
  }

  const hasRel = await hasDoctorPatientRelationship(input.doctorUserId, entry.patient_user_id);
  if (!hasRel) {
    throw new HivCareError('Tidak memiliki relasi klinis sah dengan pasien ini', 403);
  }

  const now = new Date();
  const archived = await prisma.hiv_monitoring_entries.update({
    where: { id: entry.id },
    data: {
      archived_at: now,
      archived_by_user_id: input.doctorUserId,
      updated_at: now
    }
  });

  await recordAuditLog(prisma, {
    actorUserId: input.doctorUserId,
    action: 'HIV_MONITORING_ARCHIVE',
    entityType: 'hiv_monitoring_entries',
    entityId: archived.id,
    meta: {
      public_id: archived.public_id
    }
  });

  await accessAudit({
    actorId: input.doctorUserId,
    actorRole: 'DOKTER',
    resourceType: 'HIV_MONITORING',
    resourcePublicId: archived.public_id,
    action: 'HIV_MONITORING_ARCHIVE',
    correlationId: input.correlationId,
    safeMetadata: {
      public_id: archived.public_id
    }
  });

  return archived;
}
