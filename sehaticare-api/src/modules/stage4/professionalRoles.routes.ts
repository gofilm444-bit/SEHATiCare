import { randomUUID } from 'node:crypto';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/prisma';
import { authGuard } from '../../middlewares/auth';
import { recordAuditLog } from '../../utils/audit';

const safeText = (max: number, min = 1) => z.string().trim().min(min).max(max)
  .refine((value) => !/[<>\u0000-\u001f]/.test(value), 'Teks tidak valid');
const privacySafeSummary = safeText(1500, 10)
  .refine((value) => !/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(value), 'Jangan masukkan alamat email')
  .refine((value) => !/(?:\+?62|0)[\d\s-]{8,}/.test(value), 'Jangan masukkan nomor telepon');
const caseSchema = z.object({
  title: safeText(120, 3),
  summary: privacySafeSummary,
  region_id: z.string().uuid().nullable().optional()
}).strict();
const referralSchema = z.object({
  target: z.enum(['COUNSELOR', 'COMPANION', 'FACILITY']),
  note: privacySafeSummary
}).strict();

async function activeProfessional(userId: string) {
  return prisma.counselor_profiles.findUnique({
    where: { user_id: userId },
    include: { user: { select: { is_active: true, counselor_application: { select: { status: true } } } } }
  });
}

function isActive(profile: Awaited<ReturnType<typeof activeProfessional>>) {
  return Boolean(profile?.permission_enabled && profile.verification_status === 'VERIFIED' && profile.verified_at && profile.is_active && profile.user.is_active && profile.user.counselor_application?.status === 'ACTIVE');
}

async function requireProfessional(req: FastifyRequest, reply: FastifyReply, serviceRole: 'COMPANION' | 'OUTREACH_WORKER') {
  if (!req.user || !['COUNSELOR', 'DOKTER'].includes(req.user.role)) {
    void reply.code(403).send({ message: 'Akses ditolak' });
    return null;
  }
  const profile = await activeProfessional(req.user.userId);
  if (!isActive(profile) || profile?.service_role !== serviceRole) {
    void reply.code(403).send({ message: 'Peran profesional belum aktif atau tidak sesuai' });
    return null;
  }
  return profile;
}

const outreachSelect = {
  public_id: true,
  title: true,
  summary: true,
  status: true,
  referral_target: true,
  referral_note: true,
  referred_at: true,
  closed_at: true,
  created_at: true,
  updated_at: true,
  region: { select: { id: true, name: true } }
} as const;

export default async function professionalRolesRoutes(app: FastifyInstance) {
  app.get('/professional/assignments', { preHandler: [authGuard] }, async (req, reply) => {
    if (!await requireProfessional(req, reply, 'COMPANION')) return;
    const items = await prisma.service_conversations.findMany({
      where: { assigned_counselor_id: req.user!.userId, status: { in: ['ASSIGNED', 'ACTIVE', 'WAITING_USER', 'WAITING_COUNSELOR', 'ESCALATED'] } },
      orderBy: [{ priority: 'desc' }, { last_activity_at: 'desc' }],
      select: {
        public_id: true,
        status: true,
        priority: true,
        subject: true,
        service_intent: true,
        assigned_at: true,
        last_activity_at: true,
        assignments: {
          where: { counselor_id: req.user!.userId, status: 'ACTIVE' },
          select: { source: true },
          take: 1
        }
      }
    });
    return {
      items: items.map((x) => ({
        public_id: x.public_id,
        status: x.status,
        priority: x.priority,
        subject: x.subject,
        service_intent: x.service_intent,
        assigned_at: x.assigned_at,
        last_activity_at: x.last_activity_at,
        assignment_source: x.assignments[0]?.source ?? 'MANUAL',
        is_longitudinal: x.assignments[0]?.source === 'LONGITUDINAL'
      }))
    };
  });

  app.get('/outreach/cases', { preHandler: [authGuard] }, async (req, reply) => {
    if (!await requireProfessional(req, reply, 'OUTREACH_WORKER')) return;
    const query = z.object({ status: z.enum(['OPEN', 'REFERRED', 'CLOSED']).optional() }).strict().parse(req.query);
    const items = await prisma.professional_outreach_cases.findMany({
      where: { created_by: req.user!.userId, ...(query.status ? { status: query.status } : {}) },
      orderBy: { updated_at: 'desc' },
      take: 100,
      select: outreachSelect
    });
    return { items };
  });

  app.post('/outreach/cases', { preHandler: [authGuard], config: { rateLimit: { max: 30, timeWindow: '10 minutes' } } }, async (req, reply) => {
    if (!await requireProfessional(req, reply, 'OUTREACH_WORKER')) return;
    const body = caseSchema.parse(req.body);
    if (body.region_id) {
      const region = await prisma.regions.findFirst({ where: { id: body.region_id, is_active: true }, select: { id: true } });
      if (!region) return reply.code(400).send({ message: 'Wilayah tidak tersedia' });
    }
    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.professional_outreach_cases.create({
        data: { id: randomUUID(), created_by: req.user!.userId, title: body.title, summary: body.summary, region_id: body.region_id ?? null, updated_at: new Date() }
      });
      await recordAuditLog(tx, { actorUserId: req.user!.userId, action: 'OUTREACH_CASE_CREATED', entityType: 'outreach_case', entityId: created.id, meta: { public_id: created.public_id } });
      return tx.professional_outreach_cases.findUniqueOrThrow({ where: { id: created.id }, select: outreachSelect });
    });
    return reply.code(201).send(item);
  });

  app.post('/outreach/cases/:publicId/refer', { preHandler: [authGuard] }, async (req, reply) => {
    if (!await requireProfessional(req, reply, 'OUTREACH_WORKER')) return;
    const body = referralSchema.parse(req.body);
    const publicId = (req.params as { publicId: string }).publicId;
    const existing = await prisma.professional_outreach_cases.findFirst({ where: { public_id: publicId, created_by: req.user!.userId } });
    if (!existing) return reply.code(404).send({ message: 'Catatan penjangkauan tidak ditemukan' });
    if (existing.status !== 'OPEN') return reply.code(409).send({ message: 'Catatan ini sudah dirujuk atau ditutup' });
    const item = await prisma.$transaction(async (tx) => {
      const changed = await tx.professional_outreach_cases.updateMany({ where: { id: existing.id, status: 'OPEN' }, data: { status: 'REFERRED', referral_target: body.target, referral_note: body.note, referred_at: new Date(), updated_at: new Date() } });
      if (!changed.count) return null;
      await recordAuditLog(tx, { actorUserId: req.user!.userId, action: 'OUTREACH_CASE_REFERRED', entityType: 'outreach_case', entityId: existing.id, meta: { public_id: publicId, target: body.target } });
      return tx.professional_outreach_cases.findUnique({ where: { id: existing.id }, select: outreachSelect });
    });
    if (!item) return reply.code(409).send({ message: 'Status catatan berubah. Muat ulang halaman.' });
    return item;
  });

  app.post('/outreach/cases/:publicId/close', { preHandler: [authGuard] }, async (req, reply) => {
    if (!await requireProfessional(req, reply, 'OUTREACH_WORKER')) return;
    const publicId = (req.params as { publicId: string }).publicId;
    const existing = await prisma.professional_outreach_cases.findFirst({ where: { public_id: publicId, created_by: req.user!.userId } });
    if (!existing) return reply.code(404).send({ message: 'Catatan penjangkauan tidak ditemukan' });
    if (existing.status === 'CLOSED') return { public_id: publicId, status: 'CLOSED' };
    await prisma.$transaction(async (tx) => {
      await tx.professional_outreach_cases.update({ where: { id: existing.id }, data: { status: 'CLOSED', closed_at: new Date(), updated_at: new Date() } });
      await recordAuditLog(tx, { actorUserId: req.user!.userId, action: 'OUTREACH_CASE_CLOSED', entityType: 'outreach_case', entityId: existing.id, meta: { public_id: publicId } });
    });
    return { public_id: publicId, status: 'CLOSED' };
  });

  app.get('/admin/professional/companions', { preHandler: [authGuard] }, async (req, reply) => {
    if (req.user?.role !== 'ADMIN') return reply.code(403).send({ message: 'Akses ditolak' });
    const items = await prisma.counselor_profiles.findMany({
      where: { service_role: 'COMPANION', permission_enabled: true, verification_status: 'VERIFIED', verified_at: { not: null }, is_active: true, user: { is_active: true } },
      orderBy: { professional_name: 'asc' },
      select: { professional_name: true, max_active_conversations: true, user: { select: { public_id: true } } }
    });
    return { items: items.map((item) => ({ public_id: item.user.public_id, professional_name: item.professional_name, max_active_assignments: item.max_active_conversations })) };
  });
}
