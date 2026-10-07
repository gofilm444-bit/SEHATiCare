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
    prisma.audit_logs.findMany({
      skip,
      take,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        actor_user_id: true,
        action: true,
        entity_type: true,
        entity_id: true,
        meta: true,
        created_at: true
      }
    }),
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
    take: limit,
    select: {
      id: true,
      created_at: true,
      actor_user_id: true,
      actor_role: true,
      action: true,
      consultation_id: true,
      meta_json: true
    }
  });
}

export async function listUsers(query: { page?: number | string; pageSize?: number | string; search?: string }) {
  const { skip, take, page, pageSize } = buildPagination(query);
  const search = typeof query.search === 'string' ? query.search.trim().slice(0, 64) : '';
  const where = search ? { OR: [
    { public_id: { contains: search, mode: 'insensitive' as const } },
    { display_alias: { contains: search, mode: 'insensitive' as const } }
  ] } : {};
  const [items, total] = await Promise.all([
    prisma.users.findMany({ where, skip, take, orderBy: { created_at: 'desc' }, select: {
      public_id: true, display_alias: true, full_name: true, account_mode: true, role: true, is_active: true, created_at: true
    } }),
    prisma.users.count({ where })
  ]);
  return { items: items.map(({ full_name, ...item }) => ({ ...item, display_alias: item.display_alias ?? (item.account_mode === 'LEGACY' ? full_name : 'Pengguna') })), total, page, pageSize };
}

export async function setUserStatus(adminId: string, publicId: string, isActive: boolean) {
  const target = await prisma.users.findUnique({ where: { public_id: publicId }, select: { id: true, public_id: true, is_active: true } });
  if (!target) return null;
  if (target.id === adminId && !isActive) throw new Error('Admin cannot deactivate own account');
  return prisma.$transaction(async (tx) => {
    const user = await tx.users.update({ where: { id: target.id }, data: { is_active: isActive, session_version: isActive ? undefined : { increment: 1 }, updated_at: new Date() }, select: { public_id: true, is_active: true } });
    if (!isActive) await tx.refresh_tokens.updateMany({ where: { user_id: target.id, revoked_at: null }, data: { revoked_at: new Date() } });
    await recordAuditLog(tx, { actorUserId: adminId, action: isActive ? 'ACCOUNT_ACTIVATED' : 'ACCOUNT_DEACTIVATED', entityType: 'user', entityId: target.id, meta: { public_id: target.public_id } });
    return user;
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
