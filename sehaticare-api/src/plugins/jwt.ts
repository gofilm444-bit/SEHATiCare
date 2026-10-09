import fp from 'fastify-plugin';
import fjwt from '@fastify/jwt';
import { env } from '../config/env';
import { randomUUID } from 'node:crypto';

export type JwtUserPayload = {
  userId: string;
  role: 'PASIEN' | 'DOKTER' | 'ADMIN' | 'AI' | 'COUNSELOR' | 'COMPLAINT_OFFICER' | 'SUPERVISOR';
  sessionVersion: number;
  sessionId: string;
  tokenUse: 'ACCESS' | 'REFRESH' | 'PRIVACY_REAUTH';
  purpose?: string;
  nonce?: string;
};

export type ReauthProofPayload = {
  userId: string;
  role: 'PASIEN' | 'DOKTER' | 'ADMIN' | 'AI' | 'COUNSELOR' | 'COMPLAINT_OFFICER' | 'SUPERVISOR';
  sessionVersion: number;
  sessionId: string;
  tokenUse: 'PRIVACY_REAUTH';
  nonce: string;
};

export type SignTokenInput = {
  userId: string;
  role: 'PASIEN' | 'DOKTER' | 'ADMIN' | 'AI' | 'COUNSELOR' | 'COMPLAINT_OFFICER' | 'SUPERVISOR';
  sessionVersion: number;
  sessionId?: string;
  tokenUse?: 'ACCESS' | 'REFRESH' | 'PRIVACY_REAUTH';
};

declare module 'fastify' {
  interface FastifyInstance {
    auth: {
      signAccessToken: (payload: SignTokenInput) => string;
      signRefreshToken: (payload: SignTokenInput) => string;
      verifyRefreshToken: (token: string) => JwtUserPayload;
      signReauthProof: (payload: {
        userId: string;
        role: 'PASIEN' | 'DOKTER' | 'ADMIN' | 'AI' | 'COUNSELOR' | 'COMPLAINT_OFFICER' | 'SUPERVISOR';
        sessionVersion: number;
        sessionId: string;
        nonce?: string;
      }) => string;
      verifyReauthProof: (token: string) => ReauthProofPayload;
    };
  }
}

export const jwtPlugin = fp(async (fastify) => {
  await fastify.register(fjwt, {
    secret: env.JWT_ACCESS_SECRET
  });

  fastify.decorate('auth', {
    signAccessToken: (payload: SignTokenInput) => {
      const sessionId = payload.sessionId ?? randomUUID();
      return fastify.jwt.sign(
        {
          userId: payload.userId,
          role: payload.role,
          sessionVersion: payload.sessionVersion,
          sessionId,
          tokenUse: payload.tokenUse ?? 'ACCESS'
        },
        { expiresIn: `${env.JWT_ACCESS_TTL_MINUTES}m` }
      );
    },
    signRefreshToken: (payload: SignTokenInput) => {
      const sessionId = payload.sessionId ?? randomUUID();
      return fastify.jwt.sign(
        {
          userId: payload.userId,
          role: payload.role,
          sessionVersion: payload.sessionVersion,
          sessionId,
          tokenUse: payload.tokenUse ?? 'REFRESH'
        },
        {
          expiresIn: `${env.JWT_REFRESH_TTL_DAYS}d`,
          key: env.JWT_REFRESH_SECRET
        }
      );
    },
    verifyRefreshToken: (token: string): JwtUserPayload => {
      const decoded = fastify.jwt.verify<JwtUserPayload>(token, { key: env.JWT_REFRESH_SECRET });
      if (!decoded || decoded.tokenUse !== 'REFRESH' || !decoded.userId || !decoded.sessionId) {
        throw new Error('Invalid refresh token');
      }
      return decoded;
    },
    signReauthProof: (payload: {
      userId: string;
      role: 'PASIEN' | 'DOKTER' | 'ADMIN' | 'AI' | 'COUNSELOR' | 'COMPLAINT_OFFICER' | 'SUPERVISOR';
      sessionVersion: number;
      sessionId: string;
      nonce?: string;
    }) => {
      return fastify.jwt.sign(
        {
          userId: payload.userId,
          role: payload.role,
          sessionVersion: payload.sessionVersion,
          sessionId: payload.sessionId,
          tokenUse: 'PRIVACY_REAUTH',
          nonce: payload.nonce ?? randomUUID()
        },
        {
          expiresIn: '5m',
          key: env.JWT_REAUTH_SECRET
        }
      );
    },
    verifyReauthProof: (token: string): ReauthProofPayload => {
      const decoded = fastify.jwt.verify<ReauthProofPayload>(token, { key: env.JWT_REAUTH_SECRET });
      if (!decoded || decoded.tokenUse !== 'PRIVACY_REAUTH' || !decoded.userId || !decoded.sessionId) {
        throw new Error('Invalid reauth proof token');
      }
      return decoded;
    }
  });
});

