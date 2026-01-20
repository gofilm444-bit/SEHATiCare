import { FastifyInstance } from 'fastify';
import { authGuard } from '../../middlewares/auth';
import { loginSchema, otpRequestSchema, otpVerifySchema } from './auth.validators';
import { getCurrentUser, loginWithPassword, requestOtp, verifyOtp } from './auth.service';
import { isPrismaConnectionError } from '../../db/prismaErrors';

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/otp/request',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '10 minutes',
          keyGenerator: (req) => {
            const body = req.body as { phone_e164?: string } | undefined;
            return body?.phone_e164 ?? req.ip ?? 'anonymous';
          }
        }
      },
      schema: {
        tags: ['Auth'],
        body: {
          type: 'object',
          properties: {
            phone_e164: { type: 'string' },
            email: { type: 'string', format: 'email' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              expires_at: { type: 'string', format: 'date-time' },
              dev_otp: { type: 'string' }
            },
            required: ['success', 'expires_at']
          }
        }
      }
    },
    async (request, reply) => {
      const body = otpRequestSchema.parse(request.body);
      const result = await requestOtp(fastify, body, {
        ip: request.ip,
        userAgent: request.headers['user-agent'] as string | undefined
      });
      return reply.send({ success: true, expires_at: result.expiresAt, dev_otp: result.dev_otp });
    }
  );

  fastify.post(
    '/otp/verify',
    {
      schema: {
        tags: ['Auth'],
        body: {
          type: 'object',
          properties: {
            phone_e164: { type: 'string' },
            email: { type: 'string', format: 'email' },
            otp: { type: 'string' }
          },
          required: ['otp']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              access_token: { type: 'string' },
              refresh_token: { type: 'string' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  role: { type: 'string' },
                  full_name: { type: 'string' }
                },
                required: ['id', 'role', 'full_name']
              }
            },
            required: ['access_token', 'refresh_token', 'user']
          }
        }
      }
    },
    async (request, reply) => {
      const body = otpVerifySchema.parse(request.body);
      try {
        const result = await verifyOtp(fastify, { phone_e164: body.phone_e164, email: body.email }, body.otp);
        return reply.send({
          access_token: result.accessToken,
          refresh_token: result.refreshToken,
          user: { id: result.user.id, role: result.user.role, full_name: result.user.full_name }
        });
      } catch (err) {
        if (isPrismaConnectionError(err)) throw err;
        return reply.status(400).send({ message: (err as Error).message });
      }
    }
  );

  fastify.get(
    '/me',
    {
      preHandler: [authGuard],
      schema: {
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              role: { type: 'string' },
              full_name: { type: 'string' },
              phone_e164: { type: 'string' },
              email: { type: 'string' },
              doctor_profile: { type: 'object', nullable: true }
            },
            required: ['id', 'role', 'full_name']
          }
        }
      }
    },
    async (request, reply) => {
      const user = await getCurrentUser(request.user!.userId);
      if (!user) return reply.status(404).send({ message: 'User not found' });
      return reply.send({
        id: user.id,
        role: user.role,
        full_name: user.full_name,
        phone_e164: user.phone_e164,
        email: user.email,
        doctor_profile: user.doctor_profiles_doctor_profiles_user_idTousers
      });
    }
  );

  fastify.post(
    '/login',
    {
      schema: {
        tags: ['Auth'],
        body: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' }
          },
          required: ['email', 'password']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              access_token: { type: 'string' },
              refresh_token: { type: 'string' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  role: { type: 'string' },
                  email: { type: 'string' },
                  full_name: { type: 'string' }
                },
                required: ['id', 'role', 'email', 'full_name']
              }
            },
            required: ['access_token', 'user']
          }
        }
      }
    },
    async (request, reply) => {
      const body = loginSchema.parse(request.body);
      try {
        const result = await loginWithPassword(fastify, body.email, body.password);
        return reply.send({
          access_token: result.accessToken,
          refresh_token: result.refreshToken,
          user: {
            id: result.user.id,
            role: result.user.role,
            email: result.user.email,
            full_name: result.user.full_name
          }
        });
      } catch (err) {
        if (isPrismaConnectionError(err)) throw err;
        return reply.status(401).send({ message: (err as Error).message });
      }
    }
  );
}
