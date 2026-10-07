import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { recordAuditLog } from '../../utils/audit';

type PrismaTx = PrismaClient | Prisma.TransactionClient;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class CompanionAssignmentError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'CompanionAssignmentError';
    this.statusCode = statusCode;
  }
}

export async function resolveUser(identifier: string, tx: PrismaTx = prisma) {
  const isUuid = UUID_REGEX.test(identifier);
  return tx.users.findFirst({
    where: isUuid ? { id: identifier } : { public_id: identifier },
    include: {
      counselor_profile: {
        include: { facility: { select: { id: true, name: true } } }
      }
    }
  });
}

export function isVerifiedCompanionProfile(user: any): boolean {
  if (!user || user.role !== 'COUNSELOR' || !user.is_active) {
    return false;
  }
  const profile = user.counselor_profile;
  if (!profile) return false;

  return Boolean(
    profile.service_role === 'COMPANION' &&
    profile.verification_status === 'VERIFIED' &&
    profile.permission_enabled === true &&
    profile.is_active === true &&
    profile.verified_at !== null
  );
}

export async function isActiveCompanionForPatient(
  companionUserId: string,
  patientUserId: string,
  tx: PrismaTx = prisma
): Promise<boolean> {
  const assignment = await tx.patient_companion_assignments.findFirst({
    where: {
      companion_user_id: companionUserId,
      patient_user_id: patientUserId,
      status: 'ACTIVE'
    },
    select: { id: true }
  });
  return Boolean(assignment);
}

export async function getActiveCompanionAssignment(
  param1: string,
  param2?: string | PrismaTx,
  txOrUndefined?: PrismaTx
) {
  let companionUserId: string | undefined;
  let patientUserId: string;
  let tx: PrismaTx = prisma;

  if (typeof param2 === 'string') {
    companionUserId = param1;
    patientUserId = param2;
    if (txOrUndefined) tx = txOrUndefined;
  } else {
    patientUserId = param1;
    if (param2 && typeof param2 === 'object') tx = param2 as PrismaTx;
  }

  return tx.patient_companion_assignments.findFirst({
    where: {
      ...(companionUserId ? { companion_user_id: companionUserId } : {}),
      patient_user_id: patientUserId,
      status: 'ACTIVE'
    },
    include: {
      patient: {
        select: { id: true, public_id: true, display_alias: true }
      },
      companion: {
        select: {
          id: true,
          public_id: true,
          counselor_profile: { select: { professional_name: true, service_role: true } }
        }
      },
      facility: {
        select: { id: true, name: true }
      }
    }
  });
}

export async function getActiveCompanionForPatient(patientUserId: string, tx: PrismaTx = prisma) {
  return tx.patient_companion_assignments.findFirst({
    where: {
      patient_user_id: patientUserId,
      status: 'ACTIVE'
    },
    include: {
      companion: {
        select: {
          id: true,
          public_id: true,
          counselor_profile: {
            select: { professional_name: true, service_role: true }
          }
        }
      },
      facility: {
        select: { id: true, name: true }
      }
    }
  });
}

export async function assignCompanionToPatient(input: {
  patientIdentifier: string;
  companionIdentifier: string;
  facilityId?: string | null;
  assignedByUserId: string;
  notes?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const patient = await resolveUser(input.patientIdentifier, tx);
    if (!patient) {
      throw new CompanionAssignmentError('Pasien tidak ditemukan', 404);
    }
    if (patient.role !== 'PASIEN') {
      throw new CompanionAssignmentError('Pengguna yang dipilih bukan pasien', 400);
    }
    if (!patient.is_active) {
      throw new CompanionAssignmentError('Akun pasien tidak aktif', 400);
    }

    const companion = await resolveUser(input.companionIdentifier, tx);
    if (!companion) {
      throw new CompanionAssignmentError('Pendamping tidak ditemukan', 404);
    }
    if (!isVerifiedCompanionProfile(companion)) {
      throw new CompanionAssignmentError('Pendamping harus berstatus terverifikasi dengan peran COMPANION yang aktif', 400);
    }

    if (input.facilityId) {
      const facility = await tx.health_facilities.findUnique({
        where: { id: input.facilityId }
      });
      if (!facility) {
        throw new CompanionAssignmentError('Fasilitas kesehatan tidak ditemukan', 404);
      }
    }

    // Atomically end any existing active assignment for this patient
    const existingActive = await tx.patient_companion_assignments.findFirst({
      where: {
        patient_user_id: patient.id,
        status: 'ACTIVE'
      }
    });

    const now = new Date();

    if (existingActive) {
      await tx.patient_companion_assignments.update({
        where: { id: existingActive.id },
        data: {
          status: 'ENDED',
          ended_at: now,
          end_reason: 'REASSIGNED',
          updated_at: now
        }
      });

      await recordAuditLog(tx, {
        actorUserId: input.assignedByUserId,
        action: 'COMPANION_ASSIGNMENT_REASSIGN',
        entityType: 'patient_companion_assignment',
        entityId: existingActive.id,
        meta: {
          previous_assignment_id: existingActive.id,
          patient_public_id: patient.public_id,
          previous_companion_id: existingActive.companion_user_id,
          new_companion_id: companion.id,
          action: 'REASSIGNED'
        }
      });
    }

    const newAssignmentId = randomUUID();
    const created = await tx.patient_companion_assignments.create({
      data: {
        id: newAssignmentId,
        patient_user_id: patient.id,
        companion_user_id: companion.id,
        facility_id: input.facilityId ?? companion.counselor_profile?.facility_id ?? null,
        assigned_by_user_id: input.assignedByUserId,
        status: 'ACTIVE',
        started_at: now,
        notes: input.notes?.trim() || null,
        created_at: now,
        updated_at: now
      },
      include: {
        patient: { select: { id: true, public_id: true, display_alias: true } },
        companion: {
          select: {
            id: true,
            public_id: true,
            counselor_profile: { select: { professional_name: true, service_role: true } }
          }
        },
        facility: { select: { id: true, name: true } }
      }
    });

    await recordAuditLog(tx, {
      actorUserId: input.assignedByUserId,
      action: 'COMPANION_ASSIGNMENT_CREATE',
      entityType: 'patient_companion_assignment',
      entityId: created.id,
      meta: {
        assignment_id: created.id,
        patient_public_id: patient.public_id,
        companion_public_id: companion.public_id,
        facility_id: created.facility_id
      }
    });

    return created;
  });
}

export async function reassignCompanion(input: {
  assignmentId: string;
  newCompanionIdentifier: string;
  facilityId?: string | null;
  assignedByUserId: string;
  reason?: string | null;
  notes?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.patient_companion_assignments.findUnique({
      where: { id: input.assignmentId },
      include: { patient: true }
    });
    if (!existing) {
      throw new CompanionAssignmentError('Penugasan pendamping tidak ditemukan', 404);
    }
    if (existing.status !== 'ACTIVE') {
      throw new CompanionAssignmentError('Hanya penugasan berstatus ACTIVE yang dapat dialihkan', 400);
    }

    const newCompanion = await resolveUser(input.newCompanionIdentifier, tx);
    if (!newCompanion) {
      throw new CompanionAssignmentError('Pendamping baru tidak ditemukan', 404);
    }
    if (!isVerifiedCompanionProfile(newCompanion)) {
      throw new CompanionAssignmentError('Pendamping baru harus berstatus terverifikasi dengan peran COMPANION yang aktif', 400);
    }

    if (input.facilityId) {
      const facility = await tx.health_facilities.findUnique({
        where: { id: input.facilityId }
      });
      if (!facility) {
        throw new CompanionAssignmentError('Fasilitas kesehatan tidak ditemukan', 404);
      }
    }

    const now = new Date();

    // 1. End old assignment
    await tx.patient_companion_assignments.update({
      where: { id: existing.id },
      data: {
        status: 'ENDED',
        ended_at: now,
        end_reason: input.reason?.trim() || 'REASSIGNED',
        updated_at: now
      }
    });

    // 2. Create new assignment
    const newAssignmentId = randomUUID();
    const created = await tx.patient_companion_assignments.create({
      data: {
        id: newAssignmentId,
        patient_user_id: existing.patient_user_id,
        companion_user_id: newCompanion.id,
        facility_id: input.facilityId ?? newCompanion.counselor_profile?.facility_id ?? null,
        assigned_by_user_id: input.assignedByUserId,
        status: 'ACTIVE',
        started_at: now,
        notes: input.notes?.trim() || null,
        created_at: now,
        updated_at: now
      },
      include: {
        patient: { select: { id: true, public_id: true, display_alias: true } },
        companion: {
          select: {
            id: true,
            public_id: true,
            counselor_profile: { select: { professional_name: true, service_role: true } }
          }
        },
        facility: { select: { id: true, name: true } }
      }
    });

    await recordAuditLog(tx, {
      actorUserId: input.assignedByUserId,
      action: 'COMPANION_ASSIGNMENT_REASSIGN',
      entityType: 'patient_companion_assignment',
      entityId: created.id,
      meta: {
        previous_assignment_id: existing.id,
        new_assignment_id: created.id,
        patient_public_id: existing.patient.public_id,
        previous_companion_id: existing.companion_user_id,
        new_companion_id: newCompanion.id,
        reason: input.reason?.trim() || 'REASSIGNED'
      }
    });

    return created;
  });
}

export async function endCompanionAssignment(input: {
  assignmentId: string;
  actorUserId: string;
  reason?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.patient_companion_assignments.findUnique({
      where: { id: input.assignmentId },
      include: { patient: { select: { public_id: true } } }
    });
    if (!existing) {
      throw new CompanionAssignmentError('Penugasan pendamping tidak ditemukan', 404);
    }
    if (existing.status !== 'ACTIVE') {
      throw new CompanionAssignmentError('Penugasan ini sudah berakhir', 400);
    }

    const now = new Date();
    const updated = await tx.patient_companion_assignments.update({
      where: { id: existing.id },
      data: {
        status: 'ENDED',
        ended_at: now,
        end_reason: input.reason?.trim() || 'ENDED_BY_ADMIN',
        updated_at: now
      },
      include: {
        patient: { select: { id: true, public_id: true, display_alias: true } },
        companion: {
          select: {
            id: true,
            public_id: true,
            counselor_profile: { select: { professional_name: true, service_role: true } }
          }
        },
        facility: { select: { id: true, name: true } }
      }
    });

    await recordAuditLog(tx, {
      actorUserId: input.actorUserId,
      action: 'COMPANION_ASSIGNMENT_END',
      entityType: 'patient_companion_assignment',
      entityId: updated.id,
      meta: {
        assignment_id: updated.id,
        patient_public_id: existing.patient.public_id,
        reason: input.reason?.trim() || 'ENDED_BY_ADMIN'
      }
    });

    return updated;
  });
}
