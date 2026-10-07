import { FastifyInstance } from 'fastify';
import { internalAuthGuard } from '../../middlewares/internalAuth';
import { prisma } from '../../db/prisma';
import { addAiMessage } from '../messages/messages.service';
import { ensureNotClosed } from './consultations.guards';
import { isPrismaConnectionError } from '../../db/prismaErrors';
import { toSafeMessageResponse } from './consultations.presenter';

export default async function aiRoutes(fastify: FastifyInstance) {
  fastify.post('/consultations/:id/ai/reply', { preHandler: [internalAuthGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { response_text?: string };
    if (!body.response_text) return reply.status(400).send({ message: 'response_text is required' });

    const consultation = await prisma.consultations.findUnique({ where: { id } });
    if (!consultation) return reply.status(404).send({ message: 'Not found' });

    try {
      ensureNotClosed(consultation.status);
      if (consultation.status === 'DOKTER_AKTIF' || consultation.assignedDoctorId) {
        return reply.status(403).send({ message: 'AI disabled after doctor active' });
      }
      if (consultation.status !== 'MENUNGGU_DOKTER' && consultation.status !== 'AI_AKTIF') {
        return reply.status(400).send({ message: 'Invalid consultation status' });
      }
      const message = await addAiMessage(id, body.response_text);
      return reply.send(toSafeMessageResponse(message));
    } catch (err) {
      if (isPrismaConnectionError(err)) throw err;
      return reply.status(400).send({ message: (err as Error).message });
    }
  });
}
