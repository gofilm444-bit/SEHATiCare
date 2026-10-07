import crypto from 'crypto';
import { user_role } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { ensureConsultationAccess, ensureNotClosed } from '../consultations/consultations.guards';
import {
  assertStorageReady,
  generateDownloadUrl,
  generateUploadUrl,
  getObjectMetadata,
  getObjectPrefix,
  removeStoredObject
} from './storage.service';
import { env } from '../../config/env';
import {
  assertUploadSessionValid,
  createVoiceNoteStorageKey,
  validateAudio,
  validateAudioSignature,
  validateUploadedObject
} from './voiceNotes.policy';

const VOICE_NOTE_PLACEHOLDER = '[VOICE_NOTE]';

export async function createUploadSession(params: {
  consultationId: string;
  requestedBy: string;
  contentType: string;
  fileSizeBytes: number;
}) {
  const normalizedType = validateAudio(params.contentType, params.fileSizeBytes);
  await assertStorageReady();
  const key = createVoiceNoteStorageKey();
  const uploadUrl = await generateUploadUrl(key, normalizedType);
  const expiresAt = new Date(Date.now() + env.STORAGE_SIGNED_URL_TTL_SECONDS * 1000);

  const session = await prisma.voice_note_upload_sessions.create({
    data: {
      id: crypto.randomUUID(),
      consultation_id: params.consultationId,
      requested_by: params.requestedBy,
      storage_provider: 'minio',
      storage_key: key,
      upload_url: null,
      content_type: normalizedType,
      file_size_bytes: params.fileSizeBytes,
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
  const normalizedType = validateAudio(params.contentType, params.fileSizeBytes);
  const session = await prisma.voice_note_upload_sessions.findUnique({
    where: { id: params.uploadSessionId },
    select: {
      id: true,
      consultation_id: true,
      requested_by: true,
      storage_provider: true,
      storage_key: true,
      expires_at: true,
      committed_at: true,
      content_type: true,
      file_size_bytes: true
    }
  });
  assertUploadSessionValid(session, {
    consultationId: params.consultationId,
    actorId: params.actorId
  });

  let objectMetadata: { size: number; contentType: string | null } | null = null;
  try {
    objectMetadata = await getObjectMetadata(session.storage_key);
  } catch {
    throw new Error('Uploaded object not found');
  }
  try {
    validateUploadedObject({
      requestedContentType: normalizedType,
      requestedFileSizeBytes: params.fileSizeBytes,
      sessionContentType: session.content_type,
      sessionFileSizeBytes: session.file_size_bytes,
      object: objectMetadata
    });
    const prefix = await getObjectPrefix(session.storage_key);
    validateAudioSignature(normalizedType, prefix);
  } catch (error) {
    await removeStoredObject(session.storage_key).catch(() => undefined);
    throw error;
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const currentSession = await tx.voice_note_upload_sessions.findUnique({
      where: { id: params.uploadSessionId },
      select: {
        consultation_id: true,
        requested_by: true,
        committed_at: true,
        expires_at: true,
        content_type: true,
        file_size_bytes: true
      }
    });
    assertUploadSessionValid(currentSession, {
      consultationId: params.consultationId,
      actorId: params.actorId
    });

    const consultation = await tx.consultations.findUnique({
      where: { id: params.consultationId },
      select: { patient_id: true, assignedDoctorId: true, status: true }
    });
    if (!consultation) throw new Error('Consultation not found');
    ensureNotClosed(consultation.status);
    ensureConsultationAccess(consultation, { userId: params.actorId, role: params.actorRole });

    const markedCommitted = await tx.voice_note_upload_sessions.updateMany({
      where: {
        id: params.uploadSessionId,
        consultation_id: params.consultationId,
        requested_by: params.actorId,
        committed_at: null,
        expires_at: { gte: new Date() }
      },
      data: { committed_at: new Date() }
    });
    if (markedCommitted.count !== 1) throw new Error('Upload session already committed or expired');

    const voiceNote = await tx.voice_notes.create({
      data: {
        id: crypto.randomUUID(),
        consultation_id: params.consultationId,
        uploaded_by: params.actorId,
        storage_provider: session.storage_provider,
        storage_key: session.storage_key,
        content_type: normalizedType,
        file_size_bytes: params.fileSizeBytes,
        updated_at: new Date()
      }
    });

    const senderRole = params.actorRole === 'PASIEN' ? 'PASIEN' : 'DOKTER';
    const message = await tx.chat_messages.create({
      data: {
        id: crypto.randomUUID(),
        consultation_id: params.consultationId,
        sender_role: senderRole,
        sender_user_id: params.actorId,
        content: VOICE_NOTE_PLACEHOLDER,
        voice_note_id: voiceNote.id
      }
    });

    if (!consultation.assignedDoctorId && consultation.status === 'MENUNGGU_DOKTER' && senderRole === 'PASIEN') {
      await tx.consultations.update({ where: { id: params.consultationId }, data: { status: 'AI_AKTIF' } });
    }

      return { voiceNote, messageId: message.id };
    });
  } catch (error) {
    await removeStoredObject(session.storage_key).catch(() => undefined);
    throw error;
  }
}

export async function getVoiceNote(id: string) {
  return prisma.voice_notes.findFirst({
    where: { id, deleted_at: null },
    select: {
      id: true,
      consultation_id: true,
      storage_key: true,
      content_type: true,
      file_size_bytes: true,
      created_at: true
    }
  });
}

export async function createVoiceNoteDownloadUrl(storageKey: string) {
  await getObjectMetadata(storageKey);
  return generateDownloadUrl(storageKey);
}
