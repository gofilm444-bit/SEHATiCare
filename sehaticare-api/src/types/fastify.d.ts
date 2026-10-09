import 'fastify';
import '@fastify/jwt';

export type AppUserRole = 'PASIEN' | 'DOKTER' | 'ADMIN' | 'AI' | 'COUNSELOR' | 'COMPLAINT_OFFICER' | 'SUPERVISOR';
export type JwtTokenUse = 'ACCESS' | 'REFRESH' | 'PRIVACY_REAUTH';

export type JwtUserPayload = {
  userId: string;
  role: AppUserRole;
  sessionVersion: number;
  sessionId: string;
  tokenUse: JwtTokenUse;
  purpose?: string;
  nonce?: string;
};

export type ReauthProofPayload = {
  userId: string;
  role: AppUserRole;
  sessionVersion: number;
  sessionId: string;
  tokenUse: 'PRIVACY_REAUTH';
  nonce: string;
};

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtUserPayload;
    user: JwtUserPayload;
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtUserPayload;
  }
}

