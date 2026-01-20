import { FastifyReply, FastifyRequest } from 'fastify';

export async function authGuard(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    const payload = request.user;
    if (!payload?.userId || !payload?.role) {
      return reply.status(401).send({ message: 'Invalid token payload' });
    }
    request.user = { userId: payload.userId, role: payload.role };
  } catch {
    return reply.status(401).send({ message: 'Unauthorized' });
  }
}
