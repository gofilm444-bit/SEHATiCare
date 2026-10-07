import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Prisma, counselor_application_status } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db/prisma';
import { authGuard } from '../../middlewares/auth';
import { sensitiveRateLimits } from '../../config/rateLimits';
import { accessAudit } from './stage4.shared';
import {
  cleanupObject,
  counselorDocumentKey,
  downloadUrl,
  uploadUrl,
  verifyAttachmentObject
} from './stage4.storage';
import { isValidTimeZone } from '../healthPlanning/timezone';

const safeText = (max: number, min = 1) => z.string().trim().min(min).max(max)
  .refine((value) => !/[<>\u0000-\u001f]/.test(value), 'Unsafe text');
const documentType = z.enum(['IDENTITY', 'PROFESSIONAL_LICENSE', 'CERTIFICATE', 'FACILITY_ASSIGNMENT', 'OTHER']);
const professionalServiceRole = z.enum(['COUNSELOR', 'FACILITATOR', 'COMPANION', 'OUTREACH_WORKER', 'SUPPORT_OFFICER']);
const profileSchema = z.object({
  professional_name: safeText(100), profession: safeText(80), license_number: safeText(80).optional(),
  service_role: professionalServiceRole.default('COUNSELOR'),
  facility_id: z.string().uuid().nullable().optional(), region_id: z.string().uuid().nullable().optional(),
  competencies: z.array(safeText(60)).min(1).max(12), languages: z.array(safeText(40)).min(1).max(10),
  active_days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  opens_at: z.string().regex(/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/),
  closes_at: z.string().regex(/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/),
  timezone: safeText(80).refine(isValidTimeZone, 'Invalid timezone'),
  applicant_notes: safeText(1000).optional()
}).strict();
const registerSchema = profileSchema.extend({
  full_name: safeText(120), email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(128), password_confirmation: z.string().min(8).max(128)
}).strict().refine((value) => value.password === value.password_confirmation, { path: ['password_confirmation'], message: 'Passwords do not match' });
const uploadSchema = z.object({ document_type: documentType, content_type: z.enum(['application/pdf', 'image/png', 'image/jpeg']), file_size_bytes: z.number().int().positive().max(5 * 1024 * 1024) }).strict();
const commitSchema = uploadSchema.extend({ upload_session_id: z.string().uuid() }).strict();
const transitionSchema = z.object({
  action: z.enum(['START_REVIEW', 'REQUEST_REVISION', 'VERIFY', 'ACTIVATE', 'DEACTIVATE', 'REJECT', 'SUSPEND', 'REACTIVATE']),
  reason: safeText(500, 8).optional()
}).strict();

const selfEditable = new Set<counselor_application_status>(['DRAFT', 'REVISION_REQUIRED']);
const reasonRequired = new Set(['REQUEST_REVISION', 'DEACTIVATE', 'REJECT', 'SUSPEND']);

function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  if (req.user?.role !== 'ADMIN') { void reply.code(403).send({ message: 'Forbidden' }); return false; }
  return true;
}

async function validateReferences(input: { facility_id?: string | null; region_id?: string | null }) {
  if (input.facility_id) {
    const facility = await prisma.health_facilities.findFirst({ where: { id: input.facility_id, is_active: true, verification_status: 'VERIFIED' }, select: { id: true } });
    if (!facility) throw Object.assign(new Error('Fasilitas belum aktif atau belum terverifikasi'), { statusCode: 400 });
  }
  if (input.region_id) {
    const region = await prisma.regions.findFirst({ where: { id: input.region_id, is_active: true }, select: { id: true } });
    if (!region) throw Object.assign(new Error('Wilayah tidak tersedia'), { statusCode: 400 });
  }
}

const includeApplication = {
  user: { select: { public_id: true, full_name: true, email: true, role: true, is_active: true } },
  documents: { where: { status: 'ACTIVE' }, select: { public_id: true, document_type: true, content_type: true, file_size_bytes: true, created_at: true }, orderBy: { created_at: 'desc' as const } },
  review_events: { select: { action: true, reason: true, created_at: true }, orderBy: { created_at: 'desc' as const } },
  status_history: { select: { from_status: true, to_status: true, reason: true, created_at: true }, orderBy: { created_at: 'desc' as const } }
} satisfies Prisma.counselor_applicationsInclude;

function dto(application: any, admin = false) {
  return {
    public_id: application.public_id, status: application.status, service_role: application.service_role,
    professional_name: application.professional_name, profession: application.profession,
    license_number: application.license_number, facility_id: application.facility_id, region_id: application.region_id,
    competencies: application.competencies, languages: application.languages, active_days: application.active_days,
    opens_at: application.opens_at, closes_at: application.closes_at, timezone: application.timezone,
    max_active_conversations: application.max_active_conversations, applicant_notes: application.applicant_notes,
    revision_notes: application.revision_notes, rejection_reason: application.rejection_reason,
    submitted_at: application.submitted_at, verified_at: application.verified_at, activated_at: application.activated_at,
    documents: application.documents ?? [], review_history: application.review_events ?? [], status_history: application.status_history ?? [],
    ...(admin ? { applicant: application.user } : {})
  };
}

async function currentApplication(userId: string) {
  return prisma.counselor_applications.findUnique({ where: { user_id: userId }, include: includeApplication });
}

async function recordTransition(tx: Prisma.TransactionClient, application: { id: string; status: counselor_application_status }, actorId: string, next: counselor_application_status, action: string, reason?: string) {
  await tx.counselor_status_history.create({ data: { id: randomUUID(), application_id: application.id, changed_by: actorId, from_status: application.status, to_status: next, reason: reason ?? null } });
  await tx.counselor_review_events.create({ data: { id: randomUUID(), application_id: application.id, actor_user_id: actorId, action, reason: reason ?? null } });
}

export default async function counselorApplicationsRoutes(app: FastifyInstance) {
  app.post('/counselor-applications/register', { config: { rateLimit: sensitiveRateLimits.anonymousRegister } }, async (req, reply) => {
    const body = registerSchema.parse(req.body);
    await validateReferences(body);
    const exists = await prisma.users.findUnique({ where: { email: body.email }, select: { id: true } });
    if (exists) return reply.code(409).send({ message: 'Akun sudah ada. Silakan masuk lalu pilih Ajukan sebagai Konselor.' });
    const hash = await bcrypt.hash(body.password, 12);
    const now = new Date();
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.users.create({ data: { id: randomUUID(), email: body.email, full_name: body.full_name, password_hash: hash, account_mode: 'LEGACY', role: 'COUNSELOR', is_active: true, updated_at: now } });
      const application = await tx.counselor_applications.create({ data: {
        id: randomUUID(), user_id: user.id, status: 'DRAFT', professional_name: body.professional_name, service_role: body.service_role,
        profession: body.profession, license_number: body.license_number ?? null, facility_id: body.facility_id ?? null,
        region_id: body.region_id ?? null, competencies: body.competencies, languages: body.languages,
        active_days: body.active_days, opens_at: body.opens_at, closes_at: body.closes_at,
        timezone: body.timezone,
        applicant_notes: body.applicant_notes ?? null, updated_at: now
      }, include: includeApplication });
      await tx.counselor_status_history.create({ data: { id: randomUUID(), application_id: application.id, changed_by: user.id, to_status: 'DRAFT', reason: 'APPLICATION_CREATED' } });
      return application;
    });
    return reply.code(201).send({ application: dto(created), message: 'Akun dan draf pengajuan dibuat. Masuk untuk mengunggah dokumen dan mengirim pengajuan.' });
  });

  app.get('/counselor-applications/me', { preHandler: [authGuard] }, async (req, reply) => {
    if (!['DOKTER', 'COUNSELOR'].includes(req.user!.role)) return reply.code(403).send({ message: 'Role ini tidak dapat mengajukan sebagai konselor' });
    const item = await currentApplication(req.user!.userId);
    return { application: item ? dto(item) : null };
  });

  app.put('/counselor-applications/me', { preHandler: [authGuard] }, async (req, reply) => {
    if (!['DOKTER', 'COUNSELOR'].includes(req.user!.role)) return reply.code(403).send({ message: 'Role ini tidak dapat mengajukan sebagai konselor' });
    const body = profileSchema.parse(req.body);
    await validateReferences(body);
    const existing = await prisma.counselor_applications.findUnique({ where: { user_id: req.user!.userId } });
    if (existing && !selfEditable.has(existing.status)) return reply.code(409).send({ message: 'Pengajuan sedang ditinjau dan tidak dapat diubah' });
    const now = new Date();
    const item = await prisma.counselor_applications.upsert({ where: { user_id: req.user!.userId }, update: {
      ...body, service_role: body.service_role, license_number: body.license_number ?? null, facility_id: body.facility_id ?? null, region_id: body.region_id ?? null,
      revision_notes: null, rejection_reason: null, updated_at: now
    }, create: { id: randomUUID(), user_id: req.user!.userId, ...body, service_role: body.service_role, license_number: body.license_number ?? null, facility_id: body.facility_id ?? null, region_id: body.region_id ?? null, updated_at: now }, include: includeApplication });
    if (!existing) await prisma.counselor_status_history.create({ data: { id: randomUUID(), application_id: item.id, changed_by: req.user!.userId, to_status: 'DRAFT', reason: 'APPLICATION_CREATED' } });
    return { application: dto(item) };
  });

  app.post('/counselor-applications/me/submit', { preHandler: [authGuard] }, async (req, reply) => {
    const application = await prisma.counselor_applications.findUnique({ where: { user_id: req.user!.userId }, include: { documents: { where: { status: 'ACTIVE' }, select: { id: true } } } });
    if (!application) return reply.code(404).send({ message: 'Lengkapi profil pengajuan terlebih dahulu' });
    if (!selfEditable.has(application.status)) return reply.code(409).send({ message: 'Status pengajuan tidak dapat dikirim' });
    if (!application.documents.length) return reply.code(400).send({ message: 'Unggah minimal satu dokumen pendukung sebelum mengirim pengajuan' });
    const now = new Date();
    const changed = await prisma.$transaction(async (tx) => {
      const updated = await tx.counselor_applications.updateMany({ where: { id: application.id, status: application.status }, data: { status: 'SUBMITTED', submitted_at: now, revision_notes: null, updated_at: now } });
      if (!updated.count) return false;
      await recordTransition(tx, application, req.user!.userId, 'SUBMITTED', 'SUBMITTED');
      return true;
    });
    if (!changed) return reply.code(409).send({ message: 'Status pengajuan berubah. Muat ulang halaman.' });
    return { status: 'SUBMITTED' };
  });

  app.post('/counselor-applications/me/documents/upload-url', { preHandler: [authGuard] }, async (req, reply) => {
    const body = uploadSchema.parse(req.body);
    const application = await prisma.counselor_applications.findUnique({ where: { user_id: req.user!.userId } });
    if (!application || !selfEditable.has(application.status)) return reply.code(409).send({ message: 'Dokumen tidak dapat diubah pada status ini' });
    const key = counselorDocumentKey();
    const session = await prisma.counselor_document_upload_sessions.create({ data: { id: randomUUID(), application_id: application.id, requested_by: req.user!.userId, document_type: body.document_type, storage_key: key, content_type: body.content_type, file_size_bytes: body.file_size_bytes, expires_at: new Date(Date.now() + 15 * 60_000) } });
    try { return { upload_session_id: session.id, upload_url: await uploadUrl(key, body.content_type), expires_at: session.expires_at }; }
    catch (error) { await prisma.counselor_document_upload_sessions.delete({ where: { id: session.id } }).catch(() => undefined); throw error; }
  });

  app.post('/counselor-applications/me/documents/commit', { preHandler: [authGuard] }, async (req, reply) => {
    const body = commitSchema.parse(req.body);
    const session = await prisma.counselor_document_upload_sessions.findUnique({ where: { id: body.upload_session_id }, include: { application: true } });
    if (!session || session.requested_by !== req.user!.userId || session.application.user_id !== req.user!.userId) return reply.code(404).send({ message: 'Sesi upload tidak ditemukan' });
    if (session.committed_at || session.expires_at < new Date() || !selfEditable.has(session.application.status)) return reply.code(409).send({ message: 'Sesi upload tidak berlaku' });
    if (session.document_type !== body.document_type || session.content_type !== body.content_type || session.file_size_bytes !== body.file_size_bytes) { await cleanupObject(session.storage_key); return reply.code(400).send({ message: 'Metadata dokumen tidak sesuai' }); }
    try { await verifyAttachmentObject(session.storage_key, body.content_type, body.file_size_bytes); }
    catch { await cleanupObject(session.storage_key); return reply.code(400).send({ message: 'Isi dokumen tidak sesuai dengan tipe berkas' }); }
    const document = await prisma.$transaction(async (tx) => {
      const locked = await tx.counselor_document_upload_sessions.updateMany({ where: { id: session.id, committed_at: null }, data: { committed_at: new Date() } });
      if (!locked.count) return null;
      return tx.counselor_documents.create({ data: { id: randomUUID(), application_id: session.application_id, uploaded_by: req.user!.userId, document_type: body.document_type, storage_key: session.storage_key, content_type: body.content_type, file_size_bytes: body.file_size_bytes } });
    });
    if (!document) return reply.code(409).send({ message: 'Dokumen sudah diproses' });
    return reply.code(201).send({ public_id: document.public_id, document_type: document.document_type });
  });

  app.get('/counselor-documents/:publicId', { preHandler: [authGuard] }, async (req, reply) => {
    const document = await prisma.counselor_documents.findUnique({ where: { public_id: (req.params as { publicId: string }).publicId }, include: { application: { select: { user_id: true, public_id: true } } } });
    const allowed = document && (document.application.user_id === req.user!.userId || req.user!.role === 'ADMIN');
    if (!allowed || !document) return reply.code(404).send({ message: 'Dokumen tidak ditemukan' });
    await accessAudit({ actorId: req.user!.userId, actorRole: req.user!.role, resourceType: 'COUNSELOR_DOCUMENT', resourcePublicId: document.public_id, action: 'READ', correlationId: req.id });
    return { download_url: await downloadUrl(document.storage_key) };
  });

  app.get('/admin/counselor-applications', { preHandler: [authGuard] }, async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const query = z.object({ status: z.nativeEnum(counselor_application_status).optional() }).parse(req.query);
    const items = await prisma.counselor_applications.findMany({ where: query.status ? { status: query.status } : undefined, include: includeApplication, orderBy: [{ submitted_at: 'asc' }, { created_at: 'asc' }], take: 100 });
    return { items: items.map((item) => dto(item, true)) };
  });

  app.get('/admin/counselor-applications/:publicId', { preHandler: [authGuard] }, async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const item = await prisma.counselor_applications.findUnique({ where: { public_id: (req.params as { publicId: string }).publicId }, include: includeApplication });
    if (!item) return reply.code(404).send({ message: 'Pengajuan tidak ditemukan' });
    await accessAudit({ actorId: req.user!.userId, actorRole: req.user!.role, resourceType: 'COUNSELOR_APPLICATION', resourcePublicId: item.public_id, action: 'READ', correlationId: req.id });
    return { application: dto(item, true) };
  });

  app.post('/admin/counselor-applications/:publicId/transition', { preHandler: [authGuard] }, async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const parsed = transitionSchema.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const message = issue?.path[0] === 'reason'
        ? 'Catatan atau alasan harus berisi minimal 8 dan maksimal 500 karakter'
        : 'Tindakan review tidak dikenali';
      return reply.code(400).send({ message });
    }
    const body = parsed.data;
    if (reasonRequired.has(body.action) && !body.reason) return reply.code(400).send({ message: 'Alasan wajib diisi' });
    const item = await prisma.counselor_applications.findUnique({ where: { public_id: (req.params as { publicId: string }).publicId }, include: { user: { include: { doctor_profiles_doctor_profiles_user_idTousers: true } } } });
    if (!item) return reply.code(404).send({ message: 'Pengajuan tidak ditemukan' });
    const transitions: Record<string, { from: counselor_application_status[]; to: counselor_application_status }> = {
      START_REVIEW: { from: ['SUBMITTED'], to: 'UNDER_REVIEW' }, REQUEST_REVISION: { from: ['SUBMITTED', 'UNDER_REVIEW'], to: 'REVISION_REQUIRED' },
      VERIFY: { from: ['SUBMITTED', 'UNDER_REVIEW'], to: 'VERIFIED' }, ACTIVATE: { from: ['VERIFIED', 'INACTIVE'], to: 'ACTIVE' },
      DEACTIVATE: { from: ['ACTIVE'], to: 'INACTIVE' }, REJECT: { from: ['SUBMITTED', 'UNDER_REVIEW'], to: 'REJECTED' },
      SUSPEND: { from: ['ACTIVE', 'VERIFIED', 'INACTIVE'], to: 'SUSPENDED' }, REACTIVATE: { from: ['SUSPENDED'], to: 'ACTIVE' }
    };
    const rule = transitions[body.action];
    if (!rule.from.includes(item.status)) return reply.code(409).send({ message: `Transisi ${body.action} tidak valid dari ${item.status}` });
    if (['ACTIVATE', 'REACTIVATE'].includes(body.action) && !item.verified_at) return reply.code(409).send({ message: 'Pengajuan harus diverifikasi sebelum aktivasi' });
    if (['ACTIVATE', 'REACTIVATE'].includes(body.action) && item.user.role === 'DOKTER' && item.user.doctor_profiles_doctor_profiles_user_idTousers?.verification_status !== 'VERIFIED') return reply.code(409).send({ message: 'Profil dokter harus terverifikasi sebelum akses konselor diaktifkan' });
    await validateReferences(item);
    const now = new Date();
    const changed = await prisma.$transaction(async (tx) => {
      const updated = await tx.counselor_applications.updateMany({ where: { id: item.id, status: item.status }, data: {
        status: rule.to, reviewed_at: now, updated_at: now,
        ...(body.action === 'REQUEST_REVISION' ? { revision_notes: body.reason } : {}),
        ...(body.action === 'REJECT' ? { rejection_reason: body.reason } : {}),
        ...(body.action === 'VERIFY' ? { verified_at: now } : {}),
        ...(['ACTIVATE', 'REACTIVATE'].includes(body.action) ? { activated_at: now } : {})
      } });
      if (!updated.count) return false;
      await recordTransition(tx, item, req.user!.userId, rule.to, body.action, body.reason);
      if (['VERIFY', 'ACTIVATE', 'REACTIVATE', 'DEACTIVATE', 'SUSPEND'].includes(body.action)) {
        const verified = ['VERIFY', 'ACTIVATE', 'REACTIVATE'].includes(body.action);
        const active = ['ACTIVATE', 'REACTIVATE'].includes(body.action);
        await tx.counselor_profiles.upsert({ where: { user_id: item.user_id }, update: {
          professional_name: item.professional_name, profession: item.profession, service_role: item.service_role, facility_id: item.facility_id,
          region_id: item.region_id, competencies: item.competencies, languages: item.languages, active_days: item.active_days,
          opens_at: item.opens_at, closes_at: item.closes_at, timezone: item.timezone,
          max_active_conversations: item.max_active_conversations, verification_status: verified ? 'VERIFIED' : undefined,
          verified_at: verified ? (item.verified_at ?? now) : undefined, verified_by: verified ? req.user!.userId : undefined,
          permission_enabled: active, is_active: active, is_available: active, updated_at: now
        }, create: {
          user_id: item.user_id, professional_name: item.professional_name, profession: item.profession, service_role: item.service_role,
          facility_id: item.facility_id, region_id: item.region_id, competencies: item.competencies,
          languages: item.languages, active_days: item.active_days, opens_at: item.opens_at, closes_at: item.closes_at,
          timezone: item.timezone, max_active_conversations: item.max_active_conversations,
          verification_status: verified ? 'VERIFIED' : 'PENDING', verified_at: verified ? now : null,
          verified_by: verified ? req.user!.userId : null, permission_enabled: active, is_active: active,
          is_available: active, updated_at: now
        } });
      }
      return true;
    });
    if (!changed) return reply.code(409).send({ message: 'Status pengajuan berubah. Muat ulang halaman.' });
    await accessAudit({ actorId: req.user!.userId, actorRole: req.user!.role, resourceType: 'COUNSELOR_APPLICATION', resourcePublicId: item.public_id, action: body.action, reason: body.reason, correlationId: req.id });
    return { public_id: item.public_id, status: rule.to };
  });
}
