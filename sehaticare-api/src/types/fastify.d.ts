import 'fastify';
import '@fastify/jwt';

type AppUserRole = 'PASIEN' | 'DOKTER' | 'ADMIN' | 'AI';
type JwtUserPayload = { userId: string; role: AppUserRole };

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
