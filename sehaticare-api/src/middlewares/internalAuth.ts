import { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config/env';

export async function internalAuthGuard(request: FastifyRequest, reply: FastifyReply) {
  const token = request.headers['x-internal-token'] as string | undefined;
  if (!token || token !== env.INTERNAL_AI_TOKEN) {
    return reply.status(401).send({ message: 'Unauthorized internal call' });
  }
}
