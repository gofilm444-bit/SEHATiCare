import { FastifyInstance } from 'fastify';
import { consultation_status } from '@prisma/client';
import { authGuard } from '../../middlewares/auth';
import { prisma } from '../../db/prisma';
import { ensureConsultationAccess, ensureNotClosed } from '../consultations/consultations.guards';
import { createMessageForConsultation, listMessagesForConsultation } from '../consultations/consultations.service';
import {
  buildPrompt,
  generateReply,
  getAiTypingState,
  getFallbackReply,
  persistAIMessage,
  recordAiTrigger,
  shouldRespond
} from '../consultations/aiResponder.service';
import { audit } from '../../utils/auditEvents';
import { toSafeMessageResponse } from '../consultations/consultations.presenter';
import { standardErrorResponses } from '../../schemas/errorResponse';
import { sanitizeErrorForLog } from '../../utils/logSanitizer';

const RED_FLAG_KEYWORDS = [
  'ingin bunuh diri',
  'pengen mati',
  'mengakhiri hidup',
  'menyakiti diri',
  'overdosis',
  'bunuh diri'
];

const detectRedFlag = (text: string) => {
  const normalized = text.toLowerCase();
  return RED_FLAG_KEYWORDS.filter((keyword) => normalized.includes(keyword));
};

const triggerAiResponder = async (params: {
  consultationId: string;
  consultation: {
    id: string;
    status: consultation_status;
    assignedDoctorId: string | null;
    initial_complaint: string;
    consent_at?: Date | null;
    red_flag?: boolean | null;
  };
  messageId: string;
  lastUserMessageAt: Date;
  log: FastifyInstance['log'];
}) => {
  const shouldReply = await shouldRespond(
    {
      id: params.consultation.id,
      status: params.consultation.status,
      assignedDoctorId: params.consultation.assignedDoctorId,
      consent_at: params.consultation.consent_at ?? null,
      red_flag: params.consultation.red_flag ?? false
    },
    params.lastUserMessageAt
  );
  if (!shouldReply.shouldRespond) {
    if (shouldReply.reason === 'REDFLAG') {
      await audit.log(prisma, {
        actorUserId: null,
        actorRole: 'AI',
        action: 'AI_SKIPPED_REDFLAG',
        consultationId: params.consultationId,
        meta: { reason: shouldReply.reason }
      });
    } else if (shouldReply.reason === 'DOCTOR_ASSIGNED' || shouldReply.reason === 'NO_CONSENT') {
      await audit.log(prisma, {
        actorUserId: null,
        actorRole: 'AI',
        action: 'AI_SKIPPED',
        consultationId: params.consultationId,
        meta: { reason: shouldReply.reason }
      });
    }
    return;
  }

  try {
    await recordAiTrigger(params.consultationId, params.messageId, params.lastUserMessageAt);
    const prompt = await buildPrompt(params.consultationId, params.consultation.initial_complaint);
    const replyText = await generateReply(prompt);
    await persistAIMessage(params.consultationId, replyText);
    params.log.info({ consultationId: params.consultationId }, 'AI responder replied');
  } catch (err) {
    params.log.warn(
      { error: sanitizeErrorForLog(err), consultationId: params.consultationId },
      'AI responder failed'
    );
    try {
      await persistAIMessage(params.consultationId, getFallbackReply());
    } catch (fallbackErr) {
      params.log.warn(
        { error: sanitizeErrorForLog(fallbackErr), consultationId: params.consultationId },
        'AI fallback reply failed'
      );
    }
  }
};

export default async function messagesRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/consultations/:id/messages',
    {
      logLevel: 'silent',
      preHandler: [authGuard],
      schema: {
        tags: ['Messages'],
        security: [{ bearerAuth: [] }],
        description:
          'List chat messages. AI responder aktif hanya saat status konsultasi MENUNGGU_DOKTER atau AI_AKTIF dan tidak menggantikan dokter.',
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id']
        },
        querystring: {
          type: 'object',
          properties: {
            after: { type: 'string', format: 'date-time' }
          }
        },
        response: {
          ...standardErrorResponses,
          200: {
            type: 'object',
            properties: {
              messages: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    sender_role: { type: 'string', enum: ['PASIEN', 'DOKTER', 'AI'] },
                    content: { type: 'string' },
                    created_at: { type: 'string', format: 'date-time' },
                    voice_note_id: { type: ['string', 'null'] }
                  },
                  required: ['id', 'sender_role', 'content', 'created_at']
                }
              },
              ai_typing: { type: 'boolean' }
            },
            required: ['messages', 'ai_typing']
          }
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { after } = request.query as { after?: string };
      let afterDate: Date | null = null;
      if (after) {
        const parsed = new Date(after);
        if (!Number.isFinite(parsed.getTime())) {
          return reply.status(400).send({ message: 'Invalid after' });
        }
        afterDate = parsed;
      }
      const consultation = await prisma.consultations.findUnique({
        where: { id },
        select: {
          id: true,
          patient_id: true,
          assignedDoctorId: true,
          status: true,
          consent_at: true,
          red_flag: true
        }
      });
      if (!consultation) return reply.status(404).send({ message: 'Not found' });
      if (request.user!.role !== 'PASIEN' && request.user!.role !== 'DOKTER') {
        return reply.status(403).send({ message: 'Forbidden' });
      }
      try {
        ensureConsultationAccess(consultation, request.user!);
      } catch {
        return reply.status(404).send({ message: 'Consultation not found' });
      }
      const messages = await listMessagesForConsultation(id, afterDate);
      const aiTyping = await getAiTypingState(consultation);
      return reply.send({ messages: messages.map(toSafeMessageResponse), ai_typing: aiTyping });
    }
  );

  fastify.post(
    '/consultations/:id/messages',
    {
      preHandler: [authGuard],
      schema: {
        tags: ['Messages'],
        security: [{ bearerAuth: [] }],
        description:
          'Create a chat message. Pesan pasien bisa memicu AI responder saat status MENUNGGU_DOKTER/AI_AKTIF.',
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id']
        },
        body: {
          type: 'object',
          properties: { content: { type: 'string', minLength: 1, maxLength: 2000 } },
          required: ['content']
        },
        response: {
          ...standardErrorResponses,
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              sender_role: { type: 'string', enum: ['PASIEN', 'DOKTER', 'AI'] },
              content: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' },
              voice_note_id: { type: ['string', 'null'] },
              red_flag_triggered: { type: 'boolean' }
            },
            required: ['id', 'sender_role', 'content', 'created_at']
          }
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { content?: string };
      const trimmed = body.content?.trim() ?? '';
      if (!trimmed || trimmed.length === 0 || trimmed.length > 2000) {
        return reply.status(400).send({ message: 'content must be between 1 and 2000 characters' });
      }

      const consultation = await prisma.consultations.findUnique({
        where: { id },
        select: {
          id: true,
          patient_id: true,
          assignedDoctorId: true,
          status: true,
          initial_complaint: true,
          consent_at: true,
          red_flag: true,
          priority: true,
          red_flag_reason: true
        }
      });
      if (!consultation) return reply.status(404).send({ message: 'Not found' });
      try {
        ensureNotClosed(consultation.status);
      } catch (err) {
        return reply.status(403).send({ message: (err as Error).message });
      }

      if (request.user!.role !== 'PASIEN' && request.user!.role !== 'DOKTER') {
        return reply.status(403).send({ message: 'Forbidden' });
      }
      try {
        ensureConsultationAccess(consultation, request.user!);
      } catch {
        return reply.status(404).send({ message: 'Consultation not found' });
      }

      const senderRole = request.user!.role === 'DOKTER' ? 'DOKTER' : 'PASIEN';
      if (senderRole === 'PASIEN' && !consultation.consent_at) {
        return reply.status(409).send({ message: 'Consent diperlukan sebelum mulai chat' });
      }

      const created = await createMessageForConsultation(id, senderRole, request.user!.userId, trimmed);
      let updatedStatus = consultation.status;
      let redFlagTriggered = false;

      if (senderRole === 'PASIEN') {
        const matched = detectRedFlag(trimmed);
        if (matched.length > 0) {
          redFlagTriggered = true;
          const nextStatus = consultation.assignedDoctorId ? 'DOKTER_AKTIF' : 'MENUNGGU_DOKTER';
          if (
            !consultation.red_flag ||
            consultation.priority !== 10 ||
            consultation.red_flag_reason !== 'SELF_HARM_KEYWORDS' ||
            (consultation.assignedDoctorId
              ? consultation.status !== 'DOKTER_AKTIF'
              : consultation.status !== 'MENUNGGU_DOKTER')
          ) {
            await prisma.consultations.update({
              where: { id },
              data: {
                red_flag: true,
                red_flag_reason: 'SELF_HARM_KEYWORDS',
                priority: 10,
                status: nextStatus
              }
            });
          }
          updatedStatus = nextStatus;
          await audit.log(prisma, {
            actorUserId: null,
            actorRole: 'AI',
            action: 'RED_FLAG_DETECTED',
            consultationId: id,
            meta: { match_count: matched.length, messageId: created.id }
          });
          await audit.log(prisma, {
            actorUserId: null,
            actorRole: 'AI',
            action: 'AI_SKIPPED_REDFLAG',
            consultationId: id,
            meta: { reason: 'REDFLAG', messageId: created.id }
          });
        } else if (!consultation.assignedDoctorId && consultation.status === 'MENUNGGU_DOKTER') {
          await prisma.consultations.update({ where: { id }, data: { status: 'AI_AKTIF' } });
          updatedStatus = 'AI_AKTIF';
        }
      }

      if (senderRole === 'PASIEN' && !redFlagTriggered) {
        const aiConsultation = {
          ...consultation,
          status: updatedStatus,
          consent_at: consultation.consent_at,
          red_flag: consultation.red_flag
        };
        void triggerAiResponder({
          consultationId: id,
          consultation: aiConsultation,
          messageId: created.id,
          lastUserMessageAt: created.created_at,
          log: fastify.log
        });
      }
      return reply.send({ ...toSafeMessageResponse(created), red_flag_triggered: redFlagTriggered });
    }
  );
}
