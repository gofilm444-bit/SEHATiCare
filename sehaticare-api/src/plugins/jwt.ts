import fp from 'fastify-plugin';
import fjwt from '@fastify/jwt';
import { env } from '../config/env';

type JwtUserPayload = { userId: string; role: 'PASIEN' | 'DOKTER' | 'ADMIN' | 'AI' };

declare module 'fastify' {
  interface FastifyInstance {
    auth: {
      signAccessToken: (payload: JwtUserPayload) => string;
      signRefreshToken: (payload: JwtUserPayload) => string;
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
      fastify.jwt.sign(payload, {
        expiresIn: `${env.JWT_REFRESH_TTL_DAYS}d`,
        key: env.JWT_REFRESH_SECRET
      })
  });
});
