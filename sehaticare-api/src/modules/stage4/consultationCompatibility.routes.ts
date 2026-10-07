import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../../db/prisma';
import { authGuard } from '../../middlewares/auth';
import { accessAudit } from './stage4.shared';
import { downloadUrl } from './stage4.storage';

const legacyStatus: Record<string, string> = {
  MENUNGGU_DOKTER: 'QUEUED', AI_AKTIF: 'ACTIVE', DOKTER_AKTIF: 'ACTIVE', SELESAI: 'CLOSED'
};

function patientOnly(req: FastifyRequest, reply: FastifyReply) {
  if (req.user?.role !== 'PASIEN') { void reply.code(403).send({ message: 'Forbidden' }); return false; }
  return true;
}

export default async function consultationCompatibilityRoutes(app: FastifyInstance) {
  app.get('/consultations-unified/:publicId', { preHandler: [authGuard] }, async (req, reply) => {
    if (!patientOnly(req, reply)) return;
    const publicId = (req.params as { publicId: string }).publicId;
    if (publicId.startsWith('svc_')) {
      const item = await prisma.service_conversations.findFirst({ where: { public_id: publicId, user_id: req.user!.userId }, include: { messages: { orderBy: [{ created_at: 'asc' }, { id: 'asc' }], include: { receipts: true, voice_note: true } } } });
      if (!item) return reply.code(404).send({ message: 'Konsultasi tidak ditemukan' });
      await accessAudit({ actorId: req.user!.userId, actorRole: req.user!.role, resourceType: 'SERVICE_CONVERSATION', resourcePublicId: item.public_id, action: 'UNIFIED_READ', correlationId: req.id });
      return {
        id: item.public_id,
        title: item.subject || (item.service_intent === 'COMPANION_SUPPORT' ? 'Pendampingan Berkelanjutan' : 'Konsultasi privat'),
        service_intent: item.service_intent || 'COUNSELING',
        status: item.status,
        created_at: item.queued_at, updated_at: item.last_activity_at,
        capabilities: { reply: !['CLOSED', 'CANCELLED'].includes(item.status), voice: true, close: !['CLOSED', 'CANCELLED'].includes(item.status), report: true, reassign: Boolean(item.assigned_counselor_id) },
        messages: item.messages.map((message) => ({
          id: message.public_id, kind: message.kind, content: message.status === 'REDACTED' ? null : message.content,
          sender: message.sender_user_id === req.user!.userId ? 'YOU' : 'COUNSELOR',
          voice_note_id: message.voice_note?.public_id ?? null, created_at: message.created_at,
          delivered_at: message.receipts.find((receipt) => receipt.participant_id !== req.user!.userId)?.delivered_at ?? null,
          read_at: message.receipts.find((receipt) => receipt.participant_id !== req.user!.userId)?.read_at ?? null
        }))
      };
    }
    const item = await prisma.consultations.findFirst({ where: { id: publicId, patient_id: req.user!.userId }, include: {
      consultation_messages: { where: { deleted_at: null }, orderBy: { created_at: 'asc' }, include: { voice_notes: true } },
      chat_messages: { orderBy: { created_at: 'asc' }, include: { voice_note: true } }
    } });
    if (!item) return reply.code(404).send({ message: 'Konsultasi tidak ditemukan' });
    const messages = [
      ...item.consultation_messages.map((message) => ({ id: message.id, kind: message.type === 'VOICE_NOTE' ? 'VOICE_NOTE' : 'TEXT', content: message.content_text, sender: message.sender_user_id === req.user!.userId || message.sender === 'PASIEN' ? 'YOU' : 'COUNSELOR', voice_note_id: message.voice_notes?.id ?? null, created_at: message.created_at, delivered_at: null, read_at: null })),
      ...item.chat_messages.map((message) => ({ id: message.id, kind: message.voice_note_id ? 'VOICE_NOTE' : 'TEXT', content: message.content, sender: message.sender_user_id === req.user!.userId || message.sender_role === 'PASIEN' ? 'YOU' : 'COUNSELOR', voice_note_id: message.voice_note?.id ?? null, created_at: message.created_at, delivered_at: null, read_at: null }))
    ].sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
    await accessAudit({ actorId: req.user!.userId, actorRole: req.user!.role, resourceType: 'LEGACY_CONSULTATION', resourcePublicId: item.id, action: 'UNIFIED_READ', correlationId: req.id });
    return {
      id: item.id,
      title: item.initial_complaint,
      service_intent: 'DOCTOR_CONSULTATION',
      status: legacyStatus[item.status] ?? item.status,
      created_at: item.opened_at, updated_at: item.updated_at,
      capabilities: { reply: false, voice: messages.some((message) => Boolean(message.voice_note_id)), close: false, report: false, reassign: false },
      messages
    };
  });

  app.get('/consultations-unified/:publicId/voice-notes/:voiceId', { preHandler: [authGuard] }, async (req, reply) => {
    if (!patientOnly(req, reply)) return;
    const { publicId, voiceId } = req.params as { publicId: string; voiceId: string };
    let storageKey: string | null = null;
    if (publicId.startsWith('svc_')) {
      const voice = await prisma.conversation_voice_notes.findFirst({ where: { public_id: voiceId, conversation: { public_id: publicId, user_id: req.user!.userId }, deleted_at: null }, select: { storage_key: true } });
      storageKey = voice?.storage_key ?? null;
    } else {
      const voice = await prisma.voice_notes.findFirst({ where: { id: voiceId, consultation_id: publicId, consultations: { patient_id: req.user!.userId }, deleted_at: null }, select: { storage_key: true } });
      storageKey = voice?.storage_key ?? null;
    }
    if (!storageKey) return reply.code(404).send({ message: 'Voice note tidak ditemukan' });
    await accessAudit({ actorId: req.user!.userId, actorRole: req.user!.role, resourceType: 'CONSULTATION_VOICE', resourcePublicId: voiceId, action: 'READ', correlationId: req.id });
    return { download_url: await downloadUrl(storageKey) };
  });
}
