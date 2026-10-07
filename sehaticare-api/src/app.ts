import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
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
import accountRoutes from './modules/account/account.routes';
import publicContentRoutes from './modules/publicContent/publicContent.routes';
import contentAdminRoutes from './modules/publicContent/contentAdmin.routes';
import healthPlanningRoutes from './modules/healthPlanning/healthPlanning.routes';
import counselorRoutes from './modules/stage4/counselor.routes';
import complaintsRoutes from './modules/stage4/complaints.routes';
import governanceRoutes from './modules/stage4/governance.routes';
import counselorApplicationsRoutes from './modules/stage4/counselorApplications.routes';
import consultationCompatibilityRoutes from './modules/stage4/consultationCompatibility.routes';
import reviewOperationsRoutes from './modules/stage4/reviewOperations.routes';
import professionalRolesRoutes from './modules/stage4/professionalRoles.routes';
import companionAssignmentsRoutes from './modules/stage4/companionAssignments.routes';
import { env } from './config/env';
import { isPrismaConnectionError } from './db/prismaErrors';
import { ZodError } from 'zod';
import { toPublicErrorResponse } from './utils/errorResponse';
import { resolveCorsOrigins } from './config/security';
import { sanitizeErrorForLog } from './utils/logSanitizer';

function getErrorStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('statusCode' in error)) return undefined;
  const statusCode = error.statusCode;
  return typeof statusCode === 'number' ? statusCode : undefined;
}

function hasValidationDetails(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'validation' in error && error.validation);
}

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: 'info',
      redact: {
        censor: '[REDACTED]',
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["x-csrf-token"]',
          'res.headers["set-cookie"]',
          'req.body.password',
          'req.body.password_confirmation',
          'req.body.current_password',
          'req.body.new_password',
          'req.body.recovery_code',
          'req.body.login_id',
          'req.body.otp',
          'req.body.access_token',
          'req.body.refresh_token',
          'req.body.token',
          'req.body.email',
          'req.body.phone_e164',
          'req.body.content',
          'req.body.content_text',
          'req.body.initial_complaint',
          'req.body.initial_message',
          'req.body.subject',
          'req.body.description',
          'req.body.reason',
          'req.headers["x-tracking-secret"]',
          'req.body.response_text',
          'req.body.summary',
          'req.body.referral_note',
          'body.password',
          'body.password_confirmation',
          'body.current_password',
          'body.new_password',
          'body.recovery_code',
          'body.login_id',
          'body.otp',
          'body.access_token',
          'body.refresh_token',
          'body.token',
          'body.email',
          'body.phone_e164',
          'body.content',
          'body.content_text',
          'body.initial_complaint',
          'body.initial_message',
          'body.subject',
          'body.description',
          'body.reason',
          'body.response_text',
          'body.summary',
          'body.referral_note'
        ]
      }
    }
  });

  await app.register(cookie);

  const allowedOrigins = new Set(resolveCorsOrigins(env.NODE_ENV, env.CORS_ORIGINS));
  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error('Origin not allowed'), false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true
  });

  app.addHook('onSend', async (request, reply) => {
    reply.header('X-Correlation-ID', request.id);
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Permissions-Policy', 'camera=(), geolocation=(), microphone=(), payment=()');
    if (!request.raw.url?.startsWith('/docs')) {
      reply.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    }
    if (env.NODE_ENV === 'production' && env.ENABLE_HSTS) {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
  });

  app.setErrorHandler((error, request, reply) => {
    if (isPrismaConnectionError(error)) {
      request.log.warn({ correlationId: request.id }, 'Database is not reachable');
      return reply.code(503).send(toPublicErrorResponse('Service temporarily unavailable', request.id));
    }
    if (error instanceof ZodError || hasValidationDetails(error)) {
      return reply.code(400).send(toPublicErrorResponse('Invalid request', request.id));
    }
    const statusCode = getErrorStatusCode(error);
    if (statusCode && statusCode >= 400 && statusCode < 500) {
      const message = error instanceof Error ? error.message : 'Request failed';
      return reply.code(statusCode).send(toPublicErrorResponse(message, request.id));
    }
    request.log.error(
      { error: sanitizeErrorForLog(error), correlationId: request.id },
      'Unhandled request error'
    );
    return reply.code(500).send(toPublicErrorResponse('Internal server error', request.id));
  });

  await app.register(jwtPlugin);
  await app.register(rateLimitPlugin);
  await app.register(swaggerPlugin);

  app.register(authRoutes, { prefix: '/auth' });
  app.register(accountRoutes, { prefix: '/account' });
  app.register(publicContentRoutes, { prefix: '/public' });
  app.register(contentAdminRoutes, { prefix: '/admin/content' });
  app.register(healthPlanningRoutes);
  app.register(counselorRoutes);
  app.register(complaintsRoutes);
  app.register(governanceRoutes);
  app.register(counselorApplicationsRoutes);
  app.register(consultationCompatibilityRoutes);
  app.register(reviewOperationsRoutes);
  app.register(professionalRolesRoutes);
  app.register(companionAssignmentsRoutes);
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
