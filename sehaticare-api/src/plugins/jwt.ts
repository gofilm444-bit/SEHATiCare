import fp from 'fastify-plugin';
import fjwt from '@fastify/jwt';
import { env } from '../config/env';
import { randomUUID } from 'node:crypto';

export type JwtUserPayload = {
  userId: string;
  role: 'PASIEN' | 'DOKTER' | 'ADMIN' | 'AI' | 'COUNSELOR' | 'COMPLAINT_OFFICER' | 'SUPERVISOR';
  sessionVersion: number;
  sessionId?: string;
  purpose?: string;
  nonce?: string;
};

declare module 'fastify' {
  interface FastifyInstance {
    auth: {
      signAccessToken: (payload: JwtUserPayload) => string;
      signRefreshToken: (payload: JwtUserPayload) => string;
      verifyRefreshToken: (token: string) => JwtUserPayload;
    };
  }
}

export const jwtPlugin = fp(async (fastify) => {
  await fastify.register(fjwt, {
    secret: env.JWT_ACCESS_SECRET
  });

  fastify.decorate('auth', {
    signAccessToken: (payload: JwtUserPayload) =>
      fastify.jwt.sign(payload, { expiresIn: `${env.JWT_ACCESS_TTL_MINUTES}m` }),
    signRefreshToken: (payload: JwtUserPayload) =>
      fastify.jwt.sign({ ...payload, sessionId: randomUUID() }, {
        expiresIn: `${env.JWT_REFRESH_TTL_DAYS}d`,
        key: env.JWT_REFRESH_SECRET
      }),
    verifyRefreshToken: (token: string) =>
      fastify.jwt.verify<JwtUserPayload>(token, { key: env.JWT_REFRESH_SECRET })
  });
});
