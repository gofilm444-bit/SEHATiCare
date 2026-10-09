import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../db/prisma';

export async function authGuard(request: FastifyRequest, reply: FastifyReply) {
  reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  reply.header('Pragma', 'no-cache');
  try {
    await request.jwtVerify();
    const payload = request.user;
    if (
      !payload?.userId ||
      !payload?.role ||
      payload.sessionVersion === undefined ||
      !payload.sessionId ||
      payload.tokenUse !== 'ACCESS'
    ) {
      return reply.status(401).send({ message: 'Unauthorized' });
    }
    const user = await prisma.users.findUnique({
      where: { id: payload.userId },
      select: { id: true, role: true, is_active: true, session_version: true }
    });
    if (!user?.is_active || payload.sessionVersion !== user.session_version) {
      return reply.status(401).send({ message: 'Unauthorized' });
    }
    request.user = {
      userId: user.id,
      role: user.role,
      sessionVersion: user.session_version,
      sessionId: payload.sessionId,
      tokenUse: 'ACCESS'
    };
  } catch {
    return reply.status(401).send({ message: 'Unauthorized' });
  }
}
