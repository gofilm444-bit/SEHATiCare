import 'fastify';
import '@fastify/jwt';

type AppUserRole = 'PASIEN' | 'DOKTER' | 'ADMIN' | 'AI' | 'COUNSELOR' | 'COMPLAINT_OFFICER' | 'SUPERVISOR';
type JwtUserPayload = { userId: string; role: AppUserRole; sessionVersion: number; sessionId?: string; purpose?: string; nonce?: string };

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
