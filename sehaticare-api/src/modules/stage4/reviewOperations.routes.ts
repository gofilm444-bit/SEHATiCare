import { randomUUID } from 'node:crypto';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/prisma';
import { authGuard } from '../../middlewares/auth';
import { accessAudit, safeEvent } from './stage4.shared';

const reason = z.string().trim().min(8).max(500).refine((value) => !/[<>\u0000-\u001f]/.test(value), 'Unsafe reason');
const assignSchema = z.object({ reviewer_public_id: z.string().regex(/^usr_[a-f0-9]{32}$/).optional(), reason }).strict();
const actionSchema = z.object({ action: z.enum(['RESOLVE', 'REJECT', 'RESTRICT_CONVERSATION', 'REDACT_MESSAGE']), reason }).strict();

function reviewer(req: FastifyRequest, reply: FastifyReply) {
  if (!req.user || !['ADMIN', 'SUPERVISOR'].includes(req.user.role)) { void reply.code(403).send({ message: 'Forbidden' }); return false; }
  return true;
}

const reportInclude = {
  reporter: { select: { public_id: true, display_alias: true } },
  conversation: { select: { public_id: true, status: true, priority: true, created_at: true, retention_status: true } },
  message: { select: { public_id: true, kind: true, status: true, created_at: true } }
} as const;

function reportDto(item: any, detail = false) {
  return {
    public_id: item.public_id, status: item.status, reason: item.reason,
    description: detail ? item.description : undefined, created_at: item.created_at,
    assigned: Boolean(item.assigned_reviewer), reviewed_at: item.reviewed_at, resolution: item.resolution,
    conversation: item.conversation,
    reported_message: item.message,
    reporter_alias: item.reporter?.display_alias ?? 'Pengguna'
  };
}

export default async function reviewOperationsRoutes(app: FastifyInstance) {
  app.get('/admin/conversation-reports', { preHandler: [authGuard] }, async (req, reply) => {
    if (!reviewer(req, reply)) return;
    const query = z.object({ status: z.enum(['SUBMITTED', 'IN_REVIEW', 'RESOLVED', 'REJECTED']).optional() }).parse(req.query);
    const items = await prisma.conversation_reports.findMany({ where: query.status ? { status: query.status } : undefined, include: reportInclude, orderBy: { created_at: 'asc' }, take: 100 });
    await accessAudit({ actorId: req.user!.userId, actorRole: req.user!.role, resourceType: 'CONVERSATION_REPORT_QUEUE', resourcePublicId: query.status ?? 'ALL', action: 'LIST', correlationId: req.id });
    return { items: items.map((item) => reportDto(item)) };
  });

  app.get('/admin/conversation-reports/:publicId', { preHandler: [authGuard] }, async (req, reply) => {
    if (!reviewer(req, reply)) return;
    const item = await prisma.conversation_reports.findUnique({ where: { public_id: (req.params as { publicId: string }).publicId }, include: reportInclude });
    if (!item) return reply.code(404).send({ message: 'Laporan tidak ditemukan' });
    await accessAudit({ actorId: req.user!.userId, actorRole: req.user!.role, resourceType: 'CONVERSATION_REPORT', resourcePublicId: item.public_id, action: 'READ', correlationId: req.id });
    return { report: reportDto(item, true) };
  });

  app.post('/admin/conversation-reports/:publicId/context', { preHandler: [authGuard] }, async (req, reply) => {
    if (!reviewer(req, reply)) return;
    const body = z.object({ reason }).strict().parse(req.body);
    const item = await prisma.conversation_reports.findUnique({ where: { public_id: (req.params as { publicId: string }).publicId }, include: { conversation: { include: { messages: { orderBy: { created_at: 'asc' }, select: { public_id: true, sender_role: true, kind: true, content: true, status: true, created_at: true } } } } } });
    if (!item) return reply.code(404).send({ message: 'Laporan tidak ditemukan' });
    if (item.assigned_reviewer && item.assigned_reviewer !== req.user!.userId && req.user!.role !== 'ADMIN') return reply.code(403).send({ message: 'Laporan ditugaskan kepada reviewer lain' });
    await accessAudit({ actorId: req.user!.userId, actorRole: req.user!.role, resourceType: 'CONVERSATION_REPORT_CONTEXT', resourcePublicId: item.public_id, action: 'READ', reason: body.reason, correlationId: req.id });
    return { conversation_public_id: item.conversation.public_id, messages: item.conversation.messages.map((message) => ({ ...message, content: message.status === 'REDACTED' ? null : message.content })) };
  });

  app.post('/admin/conversation-reports/:publicId/assign', { preHandler: [authGuard] }, async (req, reply) => {
    if (!reviewer(req, reply)) return;
    const body = assignSchema.parse(req.body);
    const reviewerUser = body.reviewer_public_id ? await prisma.users.findFirst({ where: { public_id: body.reviewer_public_id, role: { in: ['ADMIN', 'SUPERVISOR'] }, is_active: true }, select: { id: true } }) : { id: req.user!.userId };
    if (!reviewerUser) return reply.code(400).send({ message: 'Reviewer tidak tersedia' });
    const item = await prisma.conversation_reports.findUnique({ where: { public_id: (req.params as { publicId: string }).publicId } });
    if (!item) return reply.code(404).send({ message: 'Laporan tidak ditemukan' });
    const changed = await prisma.conversation_reports.updateMany({ where: { id: item.id, status: { in: ['SUBMITTED', 'IN_REVIEW'] }, OR: [{ assigned_reviewer: null }, { assigned_reviewer: reviewerUser.id }] }, data: { assigned_reviewer: reviewerUser.id, status: 'IN_REVIEW' } });
    if (!changed.count) return reply.code(409).send({ message: 'Laporan telah diambil reviewer lain atau sudah final' });
    await accessAudit({ actorId: req.user!.userId, actorRole: req.user!.role, resourceType: 'CONVERSATION_REPORT', resourcePublicId: item.public_id, action: 'ASSIGN_REVIEWER', reason: body.reason, correlationId: req.id });
    return { public_id: item.public_id, status: 'IN_REVIEW' };
  });

  app.post('/admin/conversation-reports/:publicId/action', { preHandler: [authGuard] }, async (req, reply) => {
    if (!reviewer(req, reply)) return;
    const body = actionSchema.parse(req.body);
    const item = await prisma.conversation_reports.findUnique({ where: { public_id: (req.params as { publicId: string }).publicId }, include: { conversation: true, message: true } });
    if (!item) return reply.code(404).send({ message: 'Laporan tidak ditemukan' });
    if (item.assigned_reviewer !== req.user!.userId && req.user!.role !== 'ADMIN') return reply.code(403).send({ message: 'Ambil laporan sebelum menyelesaikan review' });
    if (!['SUBMITTED', 'IN_REVIEW'].includes(item.status)) return reply.code(409).send({ message: 'Laporan sudah final' });
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      if (body.action === 'RESTRICT_CONVERSATION') await tx.service_conversations.update({ where: { id: item.conversation_id }, data: { retention_status: 'RESTRICTED', restricted_at: now, updated_at: now } });
      if (body.action === 'REDACT_MESSAGE') {
        if (!item.message_id) throw Object.assign(new Error('Laporan tidak menunjuk pesan'), { statusCode: 409 });
        await tx.service_messages.update({ where: { id: item.message_id }, data: { content: null, status: 'REDACTED', redacted_at: now, redaction_reason: body.reason, updated_at: now } });
        if (item.message?.voice_note_id) await tx.conversation_voice_notes.update({ where: { id: item.message.voice_note_id }, data: { deleted_at: now } });
      }
      const status = body.action === 'REJECT' ? 'REJECTED' : 'RESOLVED';
      await tx.conversation_reports.update({ where: { id: item.id }, data: { status, assigned_reviewer: item.assigned_reviewer ?? req.user!.userId, reviewed_at: now, resolution: `${body.action}: ${body.reason}` } });
      await tx.conversation_events.create({ data: { id: randomUUID(), conversation_id: item.conversation_id, event_type: `REPORT_${body.action}`, actor_user_id: req.user!.userId, safe_metadata: { report_public_id: item.public_id } } });
    });
    await accessAudit({ actorId: req.user!.userId, actorRole: req.user!.role, resourceType: 'CONVERSATION_REPORT', resourcePublicId: item.public_id, action: body.action, reason: body.reason, correlationId: req.id });
    await safeEvent('conversation', item.conversation_id, 'REPORT_REVIEWED', req.user!.userId, { action: body.action });
    return { public_id: item.public_id, status: body.action === 'REJECT' ? 'REJECTED' : 'RESOLVED' };
  });

  app.get('/admin/complaint-officers', { preHandler: [authGuard] }, async (req, reply) => {
    if (!reviewer(req, reply)) return;
    const items = await prisma.users.findMany({ where: { role: 'COMPLAINT_OFFICER', is_active: true }, select: { public_id: true, full_name: true }, orderBy: { full_name: 'asc' } });
    return { items };
  });
}
