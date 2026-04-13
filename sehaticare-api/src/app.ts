import Fastify from 'fastify';
import cors from '@fastify/cors';
import { jwtPlugin } from './plugins/jwt';
import { rateLimitPlugin } from './plugins/rateLimit';
import swaggerPlugin from './plugins/swagger';
import authRoutes from './modules/auth/auth.routes';
import educationRoutes from './modules/education/education.routes';
import consultationsRoutes from './modules/consultations/consultations.routes';
import messagesRoutes from './modules/messages/messages.routes';
import voiceNotesRoutes from './modules/voiceNotes/voiceNotes.routes';
import adminRoutes from './modules/admin/admin.routes';
import aiRoutes from './modules/consultations/ai.routes';
import doctorRoutes from './modules/doctor/doctor.routes';
import { env } from './config/env';
import { isPrismaConnectionError } from './db/prismaErrors';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: 'info',
      redact: [
        'req.headers.authorization',
        'req.headers.cookie',
        'body.content_text',
        'body.initial_complaint',
        'body.response_text',
        'body.otp'
      ]
    }
  });

  await app.register(cors, {
    origin: ['http://localhost:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
  });

  app.setErrorHandler((error, _request, reply) => {
    if (isPrismaConnectionError(error)) {
      let target: string | undefined;
      try {
        target = (error as any)?.target;
        if (!target) {
          const url = new URL(env.DATABASE_URL);
          const dbHost = url.hostname || 'localhost';
          const dbPort = url.port || '5432';
          const dbName = url.pathname?.replace(/^\//, '') || '(unknown db)';
          target = `${dbHost}:${dbPort}/${dbName}`;
        }
      } catch {
        // ignore
      }
      app.log.warn({ target }, 'Database is not reachable');
      return reply.code(503).send({
        error: 'Service Unavailable',
        message: 'Database is not reachable',
        ...(target ? { target } : {})
      });
    }
    return reply.send(error);
  });

  await app.register(jwtPlugin);
  await app.register(rateLimitPlugin);
  await app.register(swaggerPlugin);

  app.register(authRoutes, { prefix: '/auth' });
  app.register(educationRoutes, { prefix: '/education' });
  app.register(consultationsRoutes, { prefix: '/consultations' });
  app.register(doctorRoutes, { prefix: '/doctor' });
  app.register(messagesRoutes);
  app.register(voiceNotesRoutes);
  app.register(aiRoutes);
  app.register(adminRoutes, { prefix: '/admin' });

  app.get('/', async () => ({
    name: 'SEHATiCare API',
    docs: '/docs',
    health: '/health'
  }));

  app.get('/favicon.ico', async (_, reply) => reply.code(204).send());

  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
