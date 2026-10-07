import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../db/prisma';

export async function authGuard(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    const payload = request.user;
    if (!payload?.userId || !payload?.role) {
      return reply.status(401).send({ message: 'Invalid token payload' });
    }
    const user = await prisma.users.findUnique({
      where: { id: payload.userId },
      select: { id: true, role: true, is_active: true, session_version: true }
    });
    if (!user?.is_active || payload.sessionVersion !== user.session_version) return reply.status(401).send({ message: 'Unauthorized' });
    request.user = { userId: user.id, role: user.role, sessionVersion: user.session_version };
  } catch {
    return reply.status(401).send({ message: 'Unauthorized' });
  }
}
