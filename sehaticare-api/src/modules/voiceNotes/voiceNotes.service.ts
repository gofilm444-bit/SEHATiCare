import crypto from 'crypto';
import { user_role } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { ensureNotClosed } from '../consultations/consultations.guards';
import { generateDownloadUrl, generateUploadUrl, getStorageKey } from './storage.service';
import { env } from '../../config/env';

const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg'];
const MAX_AUDIO_SIZE_BYTES = 10 * 1024 * 1024;
const VOICE_NOTE_PLACEHOLDER = '[VOICE_NOTE]';

export function validateAudio(contentType: string, fileSizeBytes: number) {
  const normalizedType = contentType.split(';')[0]?.trim().toLowerCase();
  if (!normalizedType || !ALLOWED_AUDIO_TYPES.includes(normalizedType)) {
    throw new Error('Unsupported audio type');
  }
  if (fileSizeBytes > MAX_AUDIO_SIZE_BYTES) {
    throw new Error('File too large');
  }
}

export async function createUploadSession(params: {
  consultationId: string;
  requestedBy: string;
  contentType: string;
  fileSizeBytes: number;
}) {
  validateAudio(params.contentType, params.fileSizeBytes);
  const key = getStorageKey(params.consultationId, crypto.randomUUID());
  const uploadUrl = await generateUploadUrl(key, params.contentType);
  const expiresAt = new Date(Date.now() + env.STORAGE_SIGNED_URL_TTL_SECONDS * 1000);

  const session = await prisma.voice_note_upload_sessions.create({
    data: {
      id: crypto.randomUUID(),
      consultation_id: params.consultationId,
      requested_by: params.requestedBy,
      storage_provider: 'minio',
      storage_key: key,
      upload_url: uploadUrl,
      expires_at: expiresAt
    }
  });

  return { session, uploadUrl };
}

export async function commitUpload(params: {
  consultationId: string;
  uploadSessionId: string;
  actorId: string;
  actorRole: user_role;
  contentType: string;
  fileSizeBytes: number;
}) {
  validateAudio(params.contentType, params.fileSizeBytes);
  return prisma.$transaction(async (tx) => {
    const session = await tx.voice_note_upload_sessions.findUnique({ where: { id: params.uploadSessionId } });
    if (!session || session.consultation_id !== params.consultationId) throw new Error('Upload session invalid');
    if (session.committed_at) throw new Error('Upload session already committed');
    if (session.expires_at.getTime() < Date.now()) throw new Error('Upload session expired');

    const consultation = await tx.consultations.findUnique({ where: { id: params.consultationId } });
    if (!consultation) throw new Error('Consultation not found');
    ensureNotClosed(consultation.status);

    const voiceNote = await tx.voice_notes.create({
      data: {
        id: crypto.randomUUID(),
        consultation_id: params.consultationId,
        uploaded_by: params.actorId,
        storage_provider: session.storage_provider,
        storage_key: session.storage_key,
        content_type: params.contentType,
        file_size_bytes: params.fileSizeBytes,
        updated_at: new Date()
      }
    });

    await tx.voice_note_upload_sessions.update({
      where: { id: session.id },
      data: { committed_at: new Date() }
    });

    const senderRole = params.actorRole === 'PASIEN' ? 'PASIEN' : 'DOKTER';
    await tx.chat_messages.create({
      data: {
        id: crypto.randomUUID(),
        consultation_id: params.consultationId,
        sender_role: senderRole,
        sender_user_id: params.actorId,
        content: VOICE_NOTE_PLACEHOLDER
      }
    });

    if (!consultation.assignedDoctorId && consultation.status === 'MENUNGGU_DOKTER' && senderRole === 'PASIEN') {
      await tx.consultations.update({ where: { id: params.consultationId }, data: { status: 'AI_AKTIF' } });
    }

    return voiceNote;
  });
}

export async function getVoiceNoteWithUrl(id: string) {
  const voiceNote = await prisma.voice_notes.findUnique({ where: { id } });
  if (!voiceNote) return null;
  const downloadUrl = await generateDownloadUrl(voiceNote.storage_key);
  return { voiceNote, downloadUrl };
}
