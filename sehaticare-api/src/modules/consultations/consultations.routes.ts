import { FastifyInstance } from 'fastify';
import { authGuard } from '../../middlewares/auth';
import {
  closeConsultation,
  finishConsultation,
  getLatestActiveForPatient,
  joinConsultation,
  claimConsultation,
  listConsultationQueue,
  listConsultationsForUser,
  listPatientHistory
} from './consultations.service';
import { ensureConsultationAccess, ensureDoctorVerified, ensureNotClosed } from './consultations.guards';
import { prisma } from '../../db/prisma';
import { isPrismaConnectionError } from '../../db/prismaErrors';
import { env } from '../../config/env';
import { audit } from '../../utils/auditEvents';
import {
  consultationPublicSelect,
  toSafeConsultationResponse,
  toSafeDoctorConsultationResponse
} from './consultations.presenter';
import { standardErrorResponses } from '../../schemas/errorResponse';

export default async function consultationsRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/',
    {
      preHandler: [authGuard],
      schema: {
        tags: ['Consultations'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            initial_complaint: { type: 'string' }
          },
          required: ['initial_complaint']
        }
      }
    },
    async (request, reply) => {
      if (request.user!.role !== 'PASIEN') {
        return reply.status(403).send({ message: 'Only patients can create consultations' });
      }
      return reply.status(410).send({
        message: 'Pembuatan konsultasi lama telah ditutup. Gunakan alur Curhat Ke Konselor terbaru.',
        replacement_endpoint: '/counselor-conversations'
      });
    }
  );

  fastify.get(
    '/',
    {
      preHandler: [authGuard],
      schema: {
        tags: ['Consultations'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            scope: { type: 'string', enum: ['mine', 'queue'] }
          }
        }
      }
    },
    async (request, reply) => {
      const { scope } = request.query as { scope?: string };
      if (scope === 'queue') {
        if (request.user!.role !== 'DOKTER') {
          return reply.status(403).send({ message: 'Only verified doctors can view queue' });
        }
        const profile = await prisma.doctor_profiles.findUnique({ where: { user_id: request.user!.userId } });
        try {
          ensureDoctorVerified(profile);
        } catch (err) {
          if (isPrismaConnectionError(err)) throw err;
          return reply.status(403).send({ message: (err as Error).message });
        }
        const consultations = await listConsultationQueue();
        return reply.send({ items: consultations.map(toSafeDoctorConsultationResponse) });
      }

      if (request.user!.role !== 'PASIEN' && request.user!.role !== 'DOKTER') {
        return reply.status(403).send({ message: 'Forbidden' });
      }
      const consultations = await listConsultationsForUser(request.user!.userId, request.user!.role);
      return reply.send({ items: consultations.map(toSafeConsultationResponse) });
    }
  );

  fastify.get(
    '/active',
    {
      preHandler: [authGuard],
      schema: {
        tags: ['Consultations'],
        security: [{ bearerAuth: [] }],
        response: {
          ...standardErrorResponses,
          200: {
            type: 'object',
            properties: {
              active: {
                anyOf: [
                  { type: 'null' },
                  {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      status: { type: 'string' },
                      initial_complaint: { type: 'string' },
                      created_at: { type: 'string', format: 'date-time' },
                      updated_at: { type: 'string', format: 'date-time' }
                    },
                    required: ['id', 'status', 'initial_complaint', 'created_at', 'updated_at']
                  }
                ]
              }
            },
            required: ['active']
          }
        }
      }
    },
    async (request, reply) => {
      if (request.user!.role !== 'PASIEN') {
        return reply.status(403).send({ message: 'Only patients can view active consultation' });
      }
      const active = await getLatestActiveForPatient(request.user!.userId);
      return reply.send({ active: active ? toSafeConsultationResponse(active) : null });
    }
  );

  fastify.get(
    '/history',
    {
      preHandler: [authGuard],
      schema: {
        tags: ['Consultations'],
        security: [{ bearerAuth: [] }],
        response: {
          ...standardErrorResponses,
          200: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    status: { type: 'string' },
                    initial_complaint: { type: 'string' },
                    opened_at: { type: 'string', format: 'date-time' },
                    created_at: { type: 'string', format: 'date-time' },
                    updated_at: { type: 'string', format: 'date-time' },
                    assignedDoctorId: { type: ['string', 'null'] }
                  },
                  required: ['id', 'status', 'initial_complaint', 'opened_at', 'created_at', 'updated_at']
                }
              }
            },
            required: ['items']
          }
        }
      }
    },
    async (request, reply) => {
      if (request.user!.role !== 'PASIEN') {
        return reply.status(403).send({ message: 'Only patients can view history' });
      }
      const items = await listPatientHistory(request.user!.userId);
      return reply.send({ items: items.map(toSafeConsultationResponse) });
    }
  );

  fastify.get(
    '/:id',
    {
      preHandler: [authGuard],
      schema: {
        tags: ['Consultations'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id']
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const consultation = await prisma.consultations.findUnique({
        where: { id },
        select: {
          ...consultationPublicSelect,
          patient_id: true,
          assignedDoctorId: true
        }
      });
      if (!consultation) return reply.status(404).send({ message: 'Not found' });
      try {
        ensureConsultationAccess(consultation, request.user!);
      } catch {
        return reply.status(403).send({ message: 'Forbidden' });
      }
      const aiEnabled =
        env.AI_ENABLED &&
        Boolean(consultation.consent_at) &&
        !consultation.red_flag &&
        !consultation.assignedDoctorId &&
        (consultation.status === 'MENUNGGU_DOKTER' || consultation.status === 'AI_AKTIF');
      return reply.send({ ...toSafeConsultationResponse(consultation), ai_enabled: aiEnabled });
    }
  );

  fastify.post(
    '/:id/consent',
    {
      preHandler: [authGuard],
      schema: {
        tags: ['Consultations'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id']
        },
        body: {
          type: 'object',
          properties: { consent: { type: 'boolean' } },
          required: ['consent']
        },
        response: {
          ...standardErrorResponses,
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              consent_at: { type: ['string', 'null'], format: 'date-time' },
              consent_version: { type: ['string', 'null'] }
            },
            required: ['id', 'consent_at', 'consent_version']
          }
        }
      }
    },
    async (request, reply) => {
      if (request.user!.role !== 'PASIEN') {
        return reply.status(403).send({ message: 'Only patients can provide consent' });
      }
      const { id } = request.params as { id: string };
      const body = request.body as { consent?: boolean };
      if (!body.consent) {
        return reply.status(400).send({ message: 'consent must be true' });
      }

      const consultation = await prisma.consultations.findUnique({
        where: { id },
        select: { id: true, patient_id: true, consent_at: true, consent_version: true }
      });
      if (!consultation || consultation.patient_id !== request.user!.userId) {
        return reply.status(404).send({ message: 'Consultation not found' });
      }
      if (consultation.consent_at) {
        return reply.send({
          id: consultation.id,
          consent_at: consultation.consent_at,
          consent_version: consultation.consent_version
        });
      }

      const updated = await prisma.consultations.update({
        where: { id },
        data: { consent_at: new Date(), consent_version: 'v1' },
        select: { id: true, consent_at: true, consent_version: true }
      });

      await audit.log(prisma, {
        actorUserId: request.user!.userId,
        actorRole: 'PASIEN',
        action: 'CONSENT_GIVEN',
        consultationId: id,
        meta: { consent_version: updated.consent_version }
      });

      return reply.send(updated);
    }
  );

  fastify.post(
    '/:id/request-close',
    {
      preHandler: [authGuard],
      schema: {
        tags: ['Consultations'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id']
        },
        response: {
          ...standardErrorResponses,
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              closeRequested: { type: 'boolean' },
              closeRequestedAt: { type: ['string', 'null'], format: 'date-time' }
            },
            required: ['id', 'closeRequested', 'closeRequestedAt']
          }
        }
      }
    },
    async (request, reply) => {
      if (request.user!.role !== 'PASIEN') {
        return reply.status(403).send({ message: 'Only patients can request close' });
      }
      const { id } = request.params as { id: string };
      const consultation = await prisma.consultations.findUnique({
        where: { id },
        select: { id: true, patient_id: true, status: true, closeRequested: true, closeRequestedAt: true }
      });
      if (!consultation || consultation.patient_id !== request.user!.userId) {
        return reply.status(404).send({ message: 'Consultation not found' });
      }
      if (consultation.status === 'SELESAI') {
        return reply.status(409).send({ message: 'Consultation already closed' });
      }
      if (consultation.closeRequested) {
        return reply.send({
          id: consultation.id,
          closeRequested: consultation.closeRequested,
          closeRequestedAt: consultation.closeRequestedAt
        });
      }

      const updated = await prisma.consultations.update({
        where: { id },
        data: {
          closeRequested: true,
          closeRequestedAt: new Date(),
          closeRequestedById: request.user!.userId
        },
        select: { id: true, closeRequested: true, closeRequestedAt: true }
      });
      await audit.log(prisma, {
        actorUserId: request.user!.userId,
        actorRole: 'PASIEN',
        action: 'CLOSE_REQUESTED',
        consultationId: id,
        meta: {}
      });

      return reply.send(updated);
    }
  );

  fastify.post(
    '/:id/finish',
    {
      preHandler: [authGuard],
      schema: {
        tags: ['Consultations'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id']
        },
        response: {
          ...standardErrorResponses,
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              status: { type: 'string' },
              initial_complaint: { type: 'string' },
              opened_at: { type: 'string', format: 'date-time' },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
              closed_at: { type: ['string', 'null'], format: 'date-time' },
              closed_by: { type: ['string', 'null'] }
            },
            required: ['id', 'status', 'initial_complaint', 'opened_at', 'created_at', 'updated_at']
          }
        }
      }
    },
    async (request, reply) => {
      if (request.user!.role !== 'DOKTER') return reply.status(403).send({ message: 'Only doctors can finish' });
      const { id } = request.params as { id: string };
      try {
        const updated = await finishConsultation(id, request.user!.userId);
        return reply.send(toSafeConsultationResponse(updated));
      } catch (err) {
        if (isPrismaConnectionError(err)) throw err;
        const message = (err as Error).message;
        const status = message === 'Forbidden' ? 403 : 400;
        return reply.status(status).send({ message });
      }
    }
  );

  fastify.post(
    '/:id/claim',
    {
      preHandler: [authGuard],
      schema: {
        tags: ['Consultations'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id']
        }
      }
    },
    async (request, reply) => {
      if (request.user!.role !== 'DOKTER') return reply.status(403).send({ message: 'Only doctors can claim' });
      const profile = await prisma.doctor_profiles.findUnique({ where: { user_id: request.user!.userId } });
      try {
        ensureDoctorVerified(profile);
      } catch (err) {
        return reply.status(403).send({ message: (err as Error).message });
      }
      const { id } = request.params as { id: string };
      const claimed = await claimConsultation(id, request.user!.userId);
      if (!claimed) return reply.status(409).send({ message: 'Sudah diambil dokter lain' });
      return reply.send(toSafeConsultationResponse(claimed));
    }
  );

  fastify.post(
    '/:id/join',
    {
      preHandler: [authGuard],
      schema: {
        tags: ['Consultations'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id']
        }
      }
    },
    async (request, reply) => {
      if (request.user!.role !== 'DOKTER') return reply.status(403).send({ message: 'Only doctors can join' });
      const profile = await prisma.doctor_profiles.findUnique({ where: { user_id: request.user!.userId } });
      try {
        ensureDoctorVerified(profile);
      } catch (err) {
        if (isPrismaConnectionError(err)) throw err;
        return reply.status(403).send({ message: (err as Error).message });
      }
      const { id } = request.params as { id: string };
      try {
        const result = await joinConsultation(id, request.user!.userId);
        if (!result) return reply.status(404).send({ message: 'Consultation not found' });
        return reply.send(toSafeConsultationResponse(result));
      } catch (err) {
        if (isPrismaConnectionError(err)) throw err;
        const message = (err as Error).message;
        const status = message === 'Forbidden' ? 403 : 400;
        return reply.status(status).send({ message });
      }
    }
  );

  fastify.post(
    '/:id/close',
    {
      preHandler: [authGuard],
      schema: {
        tags: ['Consultations'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id']
        }
      }
    },
    async (request, reply) => {
      if (request.user!.role !== 'DOKTER') return reply.status(403).send({ message: 'Only doctors can close' });
      const { id } = request.params as { id: string };
      try {
        const consultation = await prisma.consultations.findUnique({ where: { id } });
        if (!consultation) return reply.status(404).send({ message: 'Not found' });
        ensureNotClosed(consultation.status);
        if (consultation.assignedDoctorId !== request.user!.userId) {
          return reply.status(403).send({ message: 'Only assigned doctor can close' });
        }
        const updated = await closeConsultation(id, request.user!.userId);
        return reply.send(toSafeConsultationResponse(updated));
      } catch (err) {
        if (isPrismaConnectionError(err)) throw err;
        const message = (err as Error).message;
        const status = message === 'Forbidden' ? 403 : 400;
        return reply.status(status).send({ message });
      }
    }
  );
}
