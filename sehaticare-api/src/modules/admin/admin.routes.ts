import { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authGuard } from '../../middlewares/auth';
import { forceCloseConsultation, listAuditEvents, listAuditLogs, upsertDoctorProfile } from './admin.service';
import { isPrismaConnectionError } from '../../db/prismaErrors';
import { toSafeDoctorProfileResponse } from './admin.presenter';
import { standardErrorResponses } from '../../schemas/errorResponse';
import {
  AccountManagementError,
  createManagedUser,
  getManagedUser,
  listManagedUsers,
  MANAGED_USER_ROLES,
  resetManagedUserPassword,
  revokeManagedUserSessions,
  setManagedUserStatus,
  updateManagedUser
} from './admin.accounts.service';

const safeText = z.string().trim().min(2).max(100).refine((value) => !/[<>\u0000-\u001f]/.test(value), 'Teks berisi karakter yang tidak didukung');
const roleSchema = z.enum(MANAGED_USER_ROLES);
const createUserSchema = z.object({
  email: z.string().trim().email().max(254),
  full_name: safeText,
  display_alias: z.string().trim().max(64).optional(),
  role: roleSchema,
  password: z.string().min(8).max(128),
  password_confirmation: z.string().min(8).max(128),
  is_active: z.boolean().optional()
}).strict().refine((body) => body.password === body.password_confirmation, { message: 'Konfirmasi kata sandi tidak cocok', path: ['password_confirmation'] });
const updateUserSchema = z.object({
  full_name: safeText.optional(),
  display_alias: z.string().trim().max(64).nullable().optional(),
  role: roleSchema.optional()
}).strict().refine((body) => Object.keys(body).length > 0, 'Tidak ada perubahan');
const passwordResetSchema = z.object({
  new_password: z.string().min(8).max(128),
  password_confirmation: z.string().min(8).max(128)
}).strict().refine((body) => body.new_password === body.password_confirmation, { message: 'Konfirmasi kata sandi tidak cocok', path: ['password_confirmation'] });
const statusSchema = z.object({ is_active: z.boolean() }).strict();

function accountError(reply: FastifyReply, error: unknown) {
  if (error instanceof z.ZodError) return reply.status(400).send({ message: error.issues[0]?.message ?? 'Data tidak valid' });
  if (error instanceof AccountManagementError) return reply.status(error.statusCode).send({ message: error.message });
  if (isPrismaConnectionError(error)) throw error;
  throw error;
}

export default async function adminRoutes(fastify: FastifyInstance) {
  fastify.get('/users', { preHandler: [authGuard] }, async (request, reply) => {
    if (request.user!.role !== 'ADMIN') return reply.status(403).send({ message: 'Forbidden' });
    return reply.send(await listManagedUsers(request.user!.userId, request.query as Record<string, string>));
  });

  fastify.get('/users/:publicId', { preHandler: [authGuard] }, async (request, reply) => {
    if (request.user!.role !== 'ADMIN') return reply.status(403).send({ message: 'Forbidden' });
    const { publicId } = request.params as { publicId: string };
    const user = await getManagedUser(request.user!.userId, publicId);
    if (!user) return reply.status(404).send({ message: 'Akun tidak ditemukan' });
    return reply.send(user);
  });

  fastify.post('/users', { preHandler: [authGuard], config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (request, reply) => {
    if (request.user!.role !== 'ADMIN') return reply.status(403).send({ message: 'Forbidden' });
    try {
      const body = createUserSchema.parse(request.body);
      const user = await createManagedUser(request.user!.userId, body);
      return reply.status(201).send(user);
    } catch (error) {
      return accountError(reply, error);
    }
  });

  fastify.patch('/users/:publicId', { preHandler: [authGuard], config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async (request, reply) => {
    if (request.user!.role !== 'ADMIN') return reply.status(403).send({ message: 'Forbidden' });
    const { publicId } = request.params as { publicId: string };
    try {
      const user = await updateManagedUser(request.user!.userId, publicId, updateUserSchema.parse(request.body));
      if (!user) return reply.status(404).send({ message: 'Akun tidak ditemukan' });
      return reply.send(user);
    } catch (error) {
      return accountError(reply, error);
    }
  });

  fastify.put('/users/:publicId/status', { preHandler: [authGuard], config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async (request, reply) => {
    if (request.user!.role !== 'ADMIN') return reply.status(403).send({ message: 'Forbidden' });
    const { publicId } = request.params as { publicId: string };
    try {
      const body = statusSchema.parse(request.body);
      const user = await setManagedUserStatus(request.user!.userId, publicId, body.is_active);
      if (!user) return reply.status(404).send({ message: 'Akun tidak ditemukan' });
      return reply.send(user);
    } catch (error) {
      return accountError(reply, error);
    }
  });

  fastify.post('/users/:publicId/reset-password', { preHandler: [authGuard], config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (request, reply) => {
    if (request.user!.role !== 'ADMIN') return reply.status(403).send({ message: 'Forbidden' });
    const { publicId } = request.params as { publicId: string };
    try {
      const body = passwordResetSchema.parse(request.body);
      const result = await resetManagedUserPassword(request.user!.userId, publicId, body.new_password);
      if (!result) return reply.status(404).send({ message: 'Akun tidak ditemukan' });
      return reply.send(result);
    } catch (error) {
      return accountError(reply, error);
    }
  });

  fastify.post('/users/:publicId/revoke-sessions', { preHandler: [authGuard], config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async (request, reply) => {
    if (request.user!.role !== 'ADMIN') return reply.status(403).send({ message: 'Forbidden' });
    const { publicId } = request.params as { publicId: string };
    try {
      const result = await revokeManagedUserSessions(request.user!.userId, publicId);
      if (!result) return reply.status(404).send({ message: 'Akun tidak ditemukan' });
      return reply.send(result);
    } catch (error) {
      return accountError(reply, error);
    }
  });
  fastify.post('/doctors', { preHandler: [authGuard] }, async (request, reply) => {
    if (request.user!.role !== 'ADMIN') return reply.status(403).send({ message: 'Forbidden' });
    const body = request.body as { user_id?: string; verification_status?: 'PENDING' | 'VERIFIED' | 'REJECTED'; puskesmas_name?: string; str_number?: string };
    if (!body.user_id || !body.verification_status) {
      return reply.status(400).send({ message: 'user_id and verification_status are required' });
    }

    try {
      const profile = await upsertDoctorProfile(request.user!.userId, {
        user_id: body.user_id,
        verification_status: body.verification_status,
        puskesmas_name: body.puskesmas_name,
        str_number: body.str_number
      });
      return reply.send(toSafeDoctorProfileResponse(profile));
    } catch (err) {
      if (isPrismaConnectionError(err)) throw err;
      return reply.status(400).send({ message: (err as Error).message });
    }
  });

  fastify.get('/audit-logs', { preHandler: [authGuard] }, async (request, reply) => {
    if (request.user!.role !== 'ADMIN') return reply.status(403).send({ message: 'Forbidden' });
    const result = await listAuditLogs(request.query as Record<string, unknown>);
    return reply.send(result);
  });

  fastify.get(
    '/audit',
    {
      preHandler: [authGuard],
      schema: {
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            consultationId: { type: 'string' },
            actorRole: { type: 'string' },
            action: { type: 'string' },
            limit: { type: 'number' }
          }
        }
      }
    },
    async (request, reply) => {
      if (request.user!.role !== 'ADMIN') return reply.status(403).send({ message: 'Forbidden' });
      const result = await listAuditEvents(request.query as Record<string, string>);
      return reply.send({ items: result });
    }
  );

  fastify.post(
    '/consultations/:id/force-close',
    {
      preHandler: [authGuard],
      schema: {
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id']
        },
        response: {
          ...standardErrorResponses,
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              status: { type: 'string' },
              closed_at: { type: ['string', 'null'], format: 'date-time' },
              closed_by: { type: ['string', 'null'] },
              closedReason: { type: ['string', 'null'] },
              updated_at: { type: 'string', format: 'date-time' }
            },
            required: ['id', 'status', 'closed_at', 'closed_by', 'closedReason', 'updated_at']
          }
        }
      }
    },
    async (request, reply) => {
      if (request.user!.role !== 'ADMIN') return reply.status(403).send({ message: 'Forbidden' });
      const { id } = request.params as { id: string };
      const result = await forceCloseConsultation(request.user!.userId, id);
      if (!result) return reply.status(404).send({ message: 'Consultation not found' });
      return reply.send(result);
    }
  );
}
