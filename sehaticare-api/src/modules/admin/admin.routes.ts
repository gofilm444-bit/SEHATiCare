import { FastifyInstance } from 'fastify';
import { authGuard } from '../../middlewares/auth';
import { forceCloseConsultation, listAuditEvents, listAuditLogs, upsertDoctorProfile } from './admin.service';
import { isPrismaConnectionError } from '../../db/prismaErrors';

export default async function adminRoutes(fastify: FastifyInstance) {
  fastify.post('/doctors', { preHandler: [authGuard] }, async (request, reply) => {
    if (request.user!.role !== 'ADMIN') return reply.status(403).send({ message: 'Forbidden' });
    const body = request.body as { user_id?: string; verification_status?: 'PENDING' | 'VERIFIED' | 'REJECTED'; puskesmas_name?: string; str_number?: string };
    if (!body.user_id || !body.verification_status) {
      return reply.status(400).send({ message: 'user_id and verification_status are required' });
    }

    try {
      const profile = await upsertDoctorProfile(request.user!.userId, {
        user_id: body.user_id,
        verification_status: body.verification_status,
        puskesmas_name: body.puskesmas_name,
        str_number: body.str_number
      });
      return reply.send(profile);
    } catch (err) {
      if (isPrismaConnectionError(err)) throw err;
      return reply.status(400).send({ message: (err as Error).message });
    }
  });

  fastify.get('/audit-logs', { preHandler: [authGuard] }, async (request, reply) => {
    if (request.user!.role !== 'ADMIN') return reply.status(403).send({ message: 'Forbidden' });
    const result = await listAuditLogs(request.query as Record<string, unknown>);
    return reply.send(result);
  });

  fastify.get(
    '/audit',
    {
      preHandler: [authGuard],
      schema: {
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            consultationId: { type: 'string' },
            actorRole: { type: 'string' },
            action: { type: 'string' },
            limit: { type: 'number' }
          }
        }
      }
    },
    async (request, reply) => {
      if (request.user!.role !== 'ADMIN') return reply.status(403).send({ message: 'Forbidden' });
      const result = await listAuditEvents(request.query as Record<string, string>);
      return reply.send({ items: result });
    }
  );

  fastify.post(
    '/consultations/:id/force-close',
    {
      preHandler: [authGuard],
      schema: {
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              status: { type: 'string' },
              closed_at: { type: ['string', 'null'], format: 'date-time' },
              closed_by: { type: ['string', 'null'] },
              closedReason: { type: ['string', 'null'] },
              updated_at: { type: 'string', format: 'date-time' }
            },
            required: ['id', 'status', 'closed_at', 'closed_by', 'closedReason', 'updated_at']
          }
        }
      }
    },
    async (request, reply) => {
      if (request.user!.role !== 'ADMIN') return reply.status(403).send({ message: 'Forbidden' });
      const { id } = request.params as { id: string };
      const result = await forceCloseConsultation(request.user!.userId, id);
      if (!result) return reply.status(404).send({ message: 'Consultation not found' });
      return reply.send(result);
    }
  );
}
