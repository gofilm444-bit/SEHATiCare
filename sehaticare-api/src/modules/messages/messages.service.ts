import { chat_sender_role, user_role } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../db/prisma';
import { ensureNotClosed } from '../consultations/consultations.guards';

const VOICE_NOTE_PLACEHOLDER = '[VOICE_NOTE]';

export function listMessages(consultationId: string) {
  return prisma.chat_messages.findMany({
    where: { consultation_id: consultationId },
    orderBy: { created_at: 'asc' }
  });
}

function resolveSender(role: user_role): chat_sender_role {
  if (role === 'PASIEN') return 'PASIEN';
  if (role === 'DOKTER') return 'DOKTER';
  if (role === 'AI') return 'AI';
  return 'AI';
}

export async function addTextMessage({
  consultationId,
  senderUserId,
  senderRole,
  text
}: {
  consultationId: string;
  senderUserId: string;
  senderRole: user_role;
  text: string;
}) {
  return prisma.$transaction(async (tx) => {
    const consultation = await tx.consultations.findUnique({ where: { id: consultationId } });
    if (!consultation) throw new Error('Consultation not found');
    ensureNotClosed(consultation.status);
    const sender = resolveSender(senderRole);
    const message = await tx.chat_messages.create({
      data: {
        id: randomUUID(),
        consultation_id: consultationId,
        sender_role: sender,
        sender_user_id: senderUserId,
        content: text
      }
    });

    if (!consultation.assignedDoctorId && consultation.status === 'MENUNGGU_DOKTER' && sender === 'PASIEN') {
      await tx.consultations.update({ where: { id: consultationId }, data: { status: 'AI_AKTIF' } });
    }

    return message;
  });
}

export async function addAiMessage(consultationId: string, responseText: string) {
  return prisma.$transaction(async (tx) => {
    const consultation = await tx.consultations.findUnique({ where: { id: consultationId } });
    if (!consultation) throw new Error('Consultation not found');
    ensureNotClosed(consultation.status);
    if (consultation.status === 'DOKTER_AKTIF' || consultation.assignedDoctorId) {
      throw new Error('AI disabled when doctor active');
    }
    if (consultation.status !== 'MENUNGGU_DOKTER' && consultation.status !== 'AI_AKTIF') {
      throw new Error('Invalid status for AI');
    }

    const message = await tx.chat_messages.create({
      data: {
        id: randomUUID(),
        consultation_id: consultationId,
        sender_role: 'AI',
        sender_user_id: null,
        content: responseText
      }
    });

    await tx.ai_events.create({
      data: {
        id: randomUUID(),
        consultation_id: consultationId,
        trigger: 'INTERNAL_AI_REPLY',
        request_payload: {},
        response_text: responseText
      }
    });

    return message;
  });
}

export async function addVoiceNoteMessage(params: {
  consultationId: string;
  senderUserId: string;
  senderRole: user_role;
  voiceNoteId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const consultation = await tx.consultations.findUnique({ where: { id: params.consultationId } });
    if (!consultation) throw new Error('Consultation not found');
    ensureNotClosed(consultation.status);
    const sender = resolveSender(params.senderRole);
    const message = await tx.chat_messages.create({
      data: {
        id: randomUUID(),
        consultation_id: params.consultationId,
        sender_role: sender,
        sender_user_id: params.senderUserId,
        content: VOICE_NOTE_PLACEHOLDER
      }
    });

    if (!consultation.assignedDoctorId && consultation.status === 'MENUNGGU_DOKTER' && sender === 'PASIEN') {
      await tx.consultations.update({ where: { id: params.consultationId }, data: { status: 'AI_AKTIF' } });
    }

    return message;
  });
}
