import { doctor_verification_status, user_role } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { recordAuditLog } from '../../utils/audit';
import { buildPagination } from '../../utils/pagination';
import { audit } from '../../utils/auditEvents';

export async function upsertDoctorProfile(adminId: string, payload: { user_id: string; verification_status: doctor_verification_status; puskesmas_name?: string; str_number?: string }) {
  const user = await prisma.users.findUnique({ where: { id: payload.user_id } });
  if (!user) throw new Error('User not found');

  await prisma.users.update({ where: { id: user.id }, data: { role: 'DOKTER' } });

  const profile = await prisma.doctor_profiles.upsert({
    where: { user_id: payload.user_id },
    update: {
      verification_status: payload.verification_status,
      verified_at: new Date(),
      verified_by: adminId,
      puskesmas_name: payload.puskesmas_name,
      str_number: payload.str_number
    },
    create: {
      user_id: payload.user_id,
      verification_status: payload.verification_status,
      verified_at: payload.verification_status === 'VERIFIED' ? new Date() : null,
      verified_by: adminId,
      puskesmas_name: payload.puskesmas_name,
      str_number: payload.str_number,
      updated_at: new Date()
    }
  });

  await recordAuditLog(prisma, {
    actorUserId: adminId,
    action: 'DOCTOR_VERIFICATION',
    entityType: 'doctor_profile',
    entityId: profile.user_id,
    meta: { verification_status: payload.verification_status },
    ipAddress: null,
    userAgent: null
  });

  return profile;
}

export async function listAuditLogs(query: { page?: number | string; pageSize?: number | string }) {
  const { skip, take, page, pageSize } = buildPagination(query);
  const [items, total] = await Promise.all([
    prisma.audit_logs.findMany({ skip, take, orderBy: { created_at: 'desc' } }),
    prisma.audit_logs.count()
  ]);
  return { items, total, page, pageSize };
}

export async function listAuditEvents(query: {
  consultationId?: string;
  actorRole?: string;
  action?: string;
  limit?: number | string;
}) {
  const parsedLimit = Number(query.limit);
  const safeLimit = Number.isFinite(parsedLimit) ? parsedLimit : 50;
  const limit = Math.min(100, Math.max(1, safeLimit));
  return prisma.audit_events.findMany({
    where: {
      consultation_id: query.consultationId,
      actor_role: query.actorRole as user_role | undefined,
      action: query.action
    },
    orderBy: { created_at: 'desc' },
    take: limit
  });
}

export async function forceCloseConsultation(adminId: string, consultationId: string) {
  return prisma.$transaction(async (tx) => {
    const consultation = await tx.consultations.findUnique({ where: { id: consultationId } });
    if (!consultation) return null;

    if (consultation.status !== 'SELESAI') {
      await tx.consultations.update({
        where: { id: consultationId },
        data: {
          status: 'SELESAI'
        }
      });

      await recordAuditLog(tx, {
        actorUserId: adminId,
        action: 'FORCE_CLOSE',
        entityType: 'consultation',
        entityId: consultationId,
        meta: { reason: 'FORCE_CLOSE_ADMIN' },
        ipAddress: null,
        userAgent: null
      });
      await audit.log(tx, {
        actorUserId: adminId,
        actorRole: 'ADMIN',
        action: 'FORCE_CLOSED',
        consultationId,
        meta: { reason: 'FORCE_CLOSE_ADMIN' }
      });
    }

    return tx.consultations.findUnique({
      where: { id: consultationId },
      select: {
        id: true,
        status: true,
        closed_at: true,
        closed_by: true,
        closedReason: true,
        updated_at: true
      }
    });
  });
}
