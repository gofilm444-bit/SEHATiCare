import { FastifyInstance } from 'fastify';
import { authGuard } from '../../middlewares/auth';
import { prisma } from '../../db/prisma';
import { isPrismaConnectionError } from '../../db/prismaErrors';
import { ensureDoctorVerified } from '../consultations/consultations.guards';
import { getDoctorConsultationDetail, listDoctorActive, listDoctorHistory, listDoctorQueue } from '../consultations/consultations.service';
import { toSafeDoctorConsultationResponse } from '../consultations/consultations.presenter';
import { standardErrorResponses } from '../../schemas/errorResponse';

export default async function doctorRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/queue',
    {
      preHandler: [authGuard],
      schema: {
        tags: ['Doctor'],
        security: [{ bearerAuth: [] }],
        description: 'Queue of unassigned consultations with status MENUNGGU_DOKTER or AI_AKTIF.',
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
                    closeRequested: { type: 'boolean' },
                    closeRequestedAt: { type: ['string', 'null'], format: 'date-time' },
                    red_flag: { type: 'boolean' },
                    red_flag_reason: { type: ['string', 'null'] },
                    priority: { type: 'number' },
                    last_message_at: { type: 'string', format: 'date-time' },
                    patient: {
                      anyOf: [
                        { type: 'null' },
                        {
                          type: 'object',
                          properties: { full_name: { type: ['string', 'null'] } }
                        }
                      ]
                    }
                  },
                  required: [
                    'id',
                    'status',
                    'initial_complaint',
                    'opened_at',
                    'created_at',
                    'updated_at',
                    'closeRequested',
                    'closeRequestedAt',
                    'red_flag',
                    'red_flag_reason',
                    'priority',
                    'last_message_at'
                  ]
                }
              }
            },
            required: ['items']
          }
        }
      }
    },
    async (request, reply) => {
      if (request.user!.role !== 'DOKTER') {
        return reply.status(403).send({ message: 'Only doctors can view queue' });
      }

      const profile = await prisma.doctor_profiles.findUnique({ where: { user_id: request.user!.userId } });
      try {
        ensureDoctorVerified(profile);
      } catch (err) {
        if (isPrismaConnectionError(err)) throw err;
        return reply.status(403).send({ message: (err as Error).message });
      }

      const items = await listDoctorQueue();
      return reply.send({ items: items.map(toSafeDoctorConsultationResponse) });
    }
  );

  fastify.get(
    '/active',
    {
      preHandler: [authGuard],
      schema: {
        tags: ['Doctor'],
        security: [{ bearerAuth: [] }],
        description: 'List active consultations handled by the current doctor.',
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
                    patient: {
                      anyOf: [
                        { type: 'null' },
                        {
                          type: 'object',
                          properties: { full_name: { type: ['string', 'null'] } }
                        }
                      ]
                    }
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
      if (request.user!.role !== 'DOKTER') {
        return reply.status(403).send({ message: 'Only doctors can view active consultations' });
      }

      const profile = await prisma.doctor_profiles.findUnique({ where: { user_id: request.user!.userId } });
      try {
        ensureDoctorVerified(profile);
      } catch (err) {
        if (isPrismaConnectionError(err)) throw err;
        return reply.status(403).send({ message: (err as Error).message });
      }

      const items = await listDoctorActive(request.user!.userId);
      return reply.send({ items: items.map(toSafeDoctorConsultationResponse) });
    }
  );

  fastify.get(
    '/consultations/:id',
    {
      preHandler: [authGuard],
      schema: {
        tags: ['Doctor'],
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
              closeRequested: { type: 'boolean' },
              closeRequestedAt: { type: ['string', 'null'], format: 'date-time' },
              consent_at: { type: ['string', 'null'], format: 'date-time' },
              consent_version: { type: ['string', 'null'] },
              red_flag: { type: 'boolean' },
              red_flag_reason: { type: ['string', 'null'] },
              priority: { type: 'number' },
              patient: {
                anyOf: [
                  { type: 'null' },
                  {
                    type: 'object',
                    properties: { full_name: { type: ['string', 'null'] } }
                  }
                ]
              }
            },
            required: [
              'id',
              'status',
              'initial_complaint',
              'opened_at',
              'created_at',
              'updated_at',
              'closeRequested',
              'closeRequestedAt',
              'consent_at',
              'consent_version',
              'red_flag',
              'red_flag_reason',
              'priority'
            ]
          }
        }
      }
    },
    async (request, reply) => {
      if (request.user!.role !== 'DOKTER') {
        return reply.status(403).send({ message: 'Only doctors can view consultation' });
      }

      const profile = await prisma.doctor_profiles.findUnique({ where: { user_id: request.user!.userId } });
      try {
        ensureDoctorVerified(profile);
      } catch (err) {
        if (isPrismaConnectionError(err)) throw err;
        return reply.status(403).send({ message: (err as Error).message });
      }

      const { id } = request.params as { id: string };
      const consultation = await getDoctorConsultationDetail(id, request.user!.userId);
      if (!consultation) return reply.status(404).send({ message: 'Consultation not found' });
      return reply.send(toSafeDoctorConsultationResponse(consultation));
    }
  );

  fastify.get(
    '/history',
    {
      preHandler: [authGuard],
      schema: {
        tags: ['Doctor'],
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
                    patient: {
                      anyOf: [
                        { type: 'null' },
                        {
                          type: 'object',
                          properties: { full_name: { type: ['string', 'null'] } }
                        }
                      ]
                    }
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
      if (request.user!.role !== 'DOKTER') {
        return reply.status(403).send({ message: 'Only doctors can view history' });
      }

      const profile = await prisma.doctor_profiles.findUnique({ where: { user_id: request.user!.userId } });
      try {
        ensureDoctorVerified(profile);
      } catch (err) {
        if (isPrismaConnectionError(err)) throw err;
        return reply.status(403).send({ message: (err as Error).message });
      }

      const items = await listDoctorHistory(request.user!.userId);
      return reply.send({ items: items.map(toSafeDoctorConsultationResponse) });
    }
  );
}
