import { FastifyInstance } from 'fastify';
import { authGuard } from '../../middlewares/auth';
import { prisma } from '../../db/prisma';
import { ensureConsultationAccess, ensureNotClosed } from '../consultations/consultations.guards';
import {
  commitUpload,
  createUploadSession,
  createVoiceNoteDownloadUrl,
  getVoiceNote
} from './voiceNotes.service';
import { validateAudio } from './voiceNotes.policy';
import { sensitiveRateLimits } from '../../config/rateLimits';
import { isPrismaConnectionError } from '../../db/prismaErrors';
import { toSafeVoiceNoteDownloadResponse, toSafeVoiceNoteResponse } from './voiceNotes.presenter';

export default async function voiceNotesRoutes(fastify: FastifyInstance) {
  fastify.post('/consultations/:id/voice-notes/upload-url', {
    preHandler: [authGuard],
    config: { rateLimit: sensitiveRateLimits.voiceUploadUrl }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { content_type?: string; file_size_bytes?: number };
    if (!body.content_type || typeof body.file_size_bytes !== 'number') {
      return reply.status(400).send({ message: 'content_type and file_size_bytes are required' });
    }
    try {
      validateAudio(body.content_type, body.file_size_bytes);
    } catch (err) {
      return reply.status(400).send({ message: (err as Error).message });
    }

    const consultation = await prisma.consultations.findUnique({
      where: { id },
      select: { id: true, patient_id: true, assignedDoctorId: true, status: true }
    });
    if (!consultation) return reply.status(404).send({ message: 'Not found' });
    try {
      ensureConsultationAccess(consultation, request.user!);
      ensureNotClosed(consultation.status);
    } catch (err) {
      return reply.status(403).send({ message: (err as Error).message });
    }

    if (request.user!.role === 'DOKTER' && consultation.assignedDoctorId !== request.user!.userId) {
      return reply.status(403).send({ message: 'Doctor must join before uploading voice notes' });
    }

    const result = await createUploadSession({
      consultationId: id,
      requestedBy: request.user!.userId,
      contentType: body.content_type,
      fileSizeBytes: body.file_size_bytes
    });
    return reply.send({ upload_url: result.uploadUrl, upload_session_id: result.session.id, expires_at: result.session.expires_at });
  });

  fastify.post('/consultations/:id/voice-notes/commit', {
    preHandler: [authGuard],
    config: { rateLimit: sensitiveRateLimits.voiceCommit }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { upload_session_id?: string; content_type?: string; file_size_bytes?: number };
    if (!body.upload_session_id || !body.content_type || typeof body.file_size_bytes !== 'number') {
      return reply.status(400).send({ message: 'upload_session_id, content_type, file_size_bytes are required' });
    }

    const consultation = await prisma.consultations.findUnique({
      where: { id },
      select: { id: true, patient_id: true, assignedDoctorId: true, status: true }
    });
    if (!consultation) return reply.status(404).send({ message: 'Not found' });
    try {
      ensureConsultationAccess(consultation, request.user!);
      ensureNotClosed(consultation.status);
    } catch (err) {
      return reply.status(403).send({ message: (err as Error).message });
    }

    if (request.user!.role === 'DOKTER' && consultation.assignedDoctorId !== request.user!.userId) {
      return reply.status(403).send({ message: 'Doctor must join before committing voice notes' });
    }

    try {
      const result = await commitUpload({
        consultationId: id,
        uploadSessionId: body.upload_session_id,
        actorId: request.user!.userId,
        actorRole: request.user!.role,
        contentType: body.content_type,
        fileSizeBytes: body.file_size_bytes
      });
      return reply.send(toSafeVoiceNoteResponse(result.voiceNote, result.messageId));
    } catch (err) {
      if (isPrismaConnectionError(err)) throw err;
      return reply.status(400).send({ message: (err as Error).message });
    }
  });

  fastify.get('/voice-notes/:voiceNoteId', {
    preHandler: [authGuard],
    config: { rateLimit: sensitiveRateLimits.voiceDownload }
  }, async (request, reply) => {
    const { voiceNoteId } = request.params as { voiceNoteId: string };
    const voiceNote = await getVoiceNote(voiceNoteId);
    if (!voiceNote) return reply.status(404).send({ message: 'Not found' });
    const consultation = await prisma.consultations.findUnique({
      where: { id: voiceNote.consultation_id },
      select: { id: true, patient_id: true, assignedDoctorId: true, status: true }
    });
    if (!consultation) return reply.status(404).send({ message: 'Consultation not found' });
    try {
      ensureConsultationAccess(consultation, request.user!);
    } catch {
      return reply.status(404).send({ message: 'Not found' });
    }
    try {
      const downloadUrl = await createVoiceNoteDownloadUrl(voiceNote.storage_key);
      return reply.send(toSafeVoiceNoteDownloadResponse(voiceNote, downloadUrl));
    } catch (error) {
      if (isPrismaConnectionError(error)) throw error;
      return reply.status(404).send({ message: 'Voice note file not found' });
    }
  });
}
