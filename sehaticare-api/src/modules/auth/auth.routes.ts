import { randomUUID } from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { authGuard } from '../../middlewares/auth';
import { anonymousLoginSchema, loginSchema, otpRequestSchema, otpVerifySchema } from './auth.validators';
import {
  getCurrentUser,
  loginAnonymous,
  loginWithPassword,
  requestOtp,
  revokeRefreshToken,
  rotateRefreshToken,
  verifyOtp,
  verifyReauthPassword
} from './auth.service';
import { audit } from '../../utils/auditEvents';
import { prisma } from '../../db/prisma';
import { anonymousRegistrationSchema, recoverySchema } from '../account/account.validators';
import { recoverAnonymous, registerAnonymous } from '../account/account.service';
import { maskLoginId } from '../account/identity';
import { isPrismaConnectionError } from '../../db/prismaErrors';
import { toSelfUserResponse } from './auth.presenter';
import { standardErrorResponses } from '../../schemas/errorResponse';
import { env } from '../../config/env';
import {
  createCsrfToken,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  getCsrfCookieOptions,
  getRefreshCookieOptions,
  isValidCsrfToken,
  REFRESH_COOKIE_NAME
} from './auth.session';
import { FastifyReply, FastifyRequest } from 'fastify';
import { sensitiveRateLimits } from '../../config/rateLimits';

const refreshCookieOptions = getRefreshCookieOptions(env.NODE_ENV, env.JWT_REFRESH_TTL_DAYS);
const csrfCookieOptions = getCsrfCookieOptions(env.NODE_ENV, env.JWT_REFRESH_TTL_DAYS);

function setSessionCookies(reply: FastifyReply, refreshToken: string) {
  reply.setCookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);
  reply.setCookie(CSRF_COOKIE_NAME, createCsrfToken(), csrfCookieOptions);
}

function clearSessionCookies(reply: FastifyReply) {
  reply.clearCookie(REFRESH_COOKIE_NAME, { path: '/auth' });
  reply.clearCookie(CSRF_COOKIE_NAME, { path: '/' });
}

function hasValidCsrf(request: FastifyRequest) {
  const header = request.headers[CSRF_HEADER_NAME];
  return isValidCsrfToken(
    typeof header === 'string' ? header : undefined,
    request.cookies[CSRF_COOKIE_NAME]
  );
}

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/anonymous/register', {
    config: { rateLimit: sensitiveRateLimits.anonymousRegister },
    schema: { tags: ['Auth'], body: { type: 'object', additionalProperties: false, required: ['alias', 'password', 'password_confirmation', 'accept_terms', 'accept_privacy', 'policy_version'], properties: {
      alias: { type: 'string' }, password: { type: 'string', minLength: 8, maxLength: 128 }, password_confirmation: { type: 'string', minLength: 8, maxLength: 128 },
      accept_terms: { type: 'boolean' }, accept_privacy: { type: 'boolean' }, policy_version: { type: 'string' }, website: { type: 'string' }
    } } }
  }, async (request, reply) => {
    const body = anonymousRegistrationSchema.parse(request.body);
    const credentials = await registerAnonymous(body.alias, body.password);
    return reply.status(201).send(credentials);
  });

  fastify.post('/anonymous/login', {
    config: { rateLimit: { ...sensitiveRateLimits.login, keyGenerator: (request) => {
      const body = request.body as { login_id?: string } | undefined;
      return `${request.ip}:${maskLoginId(body?.login_id ?? '')}`;
    } } },
    schema: { tags: ['Auth'], body: { type: 'object', additionalProperties: false, required: ['login_id', 'password'], properties: { login_id: { type: 'string' }, password: { type: 'string' } } } }
  }, async (request, reply) => {
    const body = anonymousLoginSchema.parse(request.body);
    try {
      const result = await loginAnonymous(fastify, body.login_id, body.password);
      setSessionCookies(reply, result.refreshToken);
      return reply.send({ access_token: result.accessToken, user: { id: result.user.public_id, public_id: result.user.public_id, role: result.user.role, is_superadmin: result.user.is_superadmin, email: null, full_name: result.user.display_alias ?? result.user.full_name, display_alias: result.user.display_alias, account_mode: result.user.account_mode } });
    } catch (error) {
      if (isPrismaConnectionError(error)) throw error;
      return reply.status(401).send({ message: 'Invalid credentials' });
    }
  });

  fastify.post('/anonymous/recover', {
    config: { rateLimit: { ...sensitiveRateLimits.anonymousRecover, keyGenerator: (request) => {
      const body = request.body as { login_id?: string } | undefined;
      return `${request.ip}:${maskLoginId(body?.login_id ?? '')}`;
    } } },
    schema: { tags: ['Auth'], body: { type: 'object', additionalProperties: false, required: ['login_id', 'recovery_code', 'new_password', 'password_confirmation'], properties: { login_id: { type: 'string' }, recovery_code: { type: 'string' }, new_password: { type: 'string' }, password_confirmation: { type: 'string' } } } }
  }, async (request, reply) => {
    const body = recoverySchema.parse(request.body);
    try {
      const result = await recoverAnonymous(body.login_id, body.recovery_code, body.new_password);
      clearSessionCookies(reply);
      return reply.send(result);
    } catch (error) {
      if (isPrismaConnectionError(error)) throw error;
      return reply.status(400).send({ message: 'Unable to recover account' });
    }
  });
  fastify.post(
    '/otp/request',
    {
      config: {
        rateLimit: {
          ...sensitiveRateLimits.otpRequest,
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
          ...standardErrorResponses,
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
      config: { rateLimit: sensitiveRateLimits.otpVerify },
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
          ...standardErrorResponses,
          200: {
            type: 'object',
            properties: {
              access_token: { type: 'string' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  role: { type: 'string' },
                  is_superadmin: { type: 'boolean' },
                  full_name: { type: 'string' },
                  email: { type: ['string', 'null'] }
                },
                required: ['id', 'role', 'full_name']
              }
            },
            required: ['access_token', 'user']
          }
        }
      }
    },
    async (request, reply) => {
      const body = otpVerifySchema.parse(request.body);
      try {
        const result = await verifyOtp(fastify, { phone_e164: body.phone_e164, email: body.email }, body.otp);
        setSessionCookies(reply, result.refreshToken);
        return reply.send({
          access_token: result.accessToken,
          user: {
            id: result.user.public_id,
            public_id: result.user.public_id,
            role: result.user.role,
            is_superadmin: result.user.is_superadmin,
            full_name: result.user.full_name,
            email: result.user.email
          }
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
          ...standardErrorResponses,
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              role: { type: 'string' },
              is_superadmin: { type: 'boolean' },
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
      return reply.send(toSelfUserResponse(user));
    }
  );

  fastify.post(
    '/login',
    {
      config: {
        rateLimit: {
          ...sensitiveRateLimits.login,
          keyGenerator: (request) => {
            const body = request.body as { email?: string } | undefined;
            return `${request.ip}:${body?.email?.trim().toLowerCase() ?? 'unknown'}`;
          }
        }
      },
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
          ...standardErrorResponses,
          200: {
            type: 'object',
            properties: {
              access_token: { type: 'string' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  role: { type: 'string' },
                  is_superadmin: { type: 'boolean' },
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
        setSessionCookies(reply, result.refreshToken);
        return reply.send({
          access_token: result.accessToken,
          user: {
            id: result.user.public_id,
            public_id: result.user.public_id,
            role: result.user.role,
            is_superadmin: result.user.is_superadmin,
            email: result.user.email,
            full_name: result.user.display_alias ?? result.user.full_name,
            display_alias: result.user.display_alias,
            account_mode: result.user.account_mode
          }
        });
      } catch (err) {
        if (isPrismaConnectionError(err)) throw err;
        return reply.status(401).send({ message: (err as Error).message });
      }
    }
  );

  fastify.post(
    '/refresh',
    {
      config: { rateLimit: sensitiveRateLimits.refresh },
      schema: {
        tags: ['Auth'],
        response: {
          ...standardErrorResponses,
          200: {
            type: 'object',
            properties: {
              access_token: { type: 'string' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  role: { type: 'string' },
                  is_superadmin: { type: 'boolean' },
                  email: { type: ['string', 'null'] },
                  full_name: { type: 'string' }
                },
                required: ['id', 'role', 'full_name']
              }
            },
            required: ['access_token', 'user']
          }
        }
      }
    },
    async (request, reply) => {
      const refreshToken = request.cookies[REFRESH_COOKIE_NAME];
      if (!refreshToken) return reply.status(401).send({ message: 'Invalid session' });
      if (!hasValidCsrf(request)) return reply.status(403).send({ message: 'Forbidden' });
      try {
        const result = await rotateRefreshToken(fastify, refreshToken);
        setSessionCookies(reply, result.refreshToken);
        return reply.send({ access_token: result.accessToken, user: result.user });
      } catch (error) {
        if (isPrismaConnectionError(error)) throw error;
        clearSessionCookies(reply);
        return reply.status(401).send({ message: 'Invalid session' });
      }
    }
  );

  fastify.post(
    '/logout',
    { config: { rateLimit: sensitiveRateLimits.logout } },
    async (request, reply) => {
      if (!hasValidCsrf(request)) return reply.status(403).send({ message: 'Forbidden' });
      const refreshToken = request.cookies[REFRESH_COOKIE_NAME];
      if (refreshToken) await revokeRefreshToken(refreshToken);
      clearSessionCookies(reply);
      return reply.status(204).send();
    }
  );

  fastify.post(
    '/re-authenticate',
    {
      preHandler: [authGuard],
      config: {
        rateLimit: {
          ...sensitiveRateLimits.reauth,
          keyGenerator: (request) => `${request.ip}:${request.user?.userId ?? 'anon'}`
        }
      },
      schema: {
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: { password: { type: 'string', minLength: 1 } },
          required: ['password'],
          additionalProperties: false
        },
        response: {
          ...standardErrorResponses,
          200: {
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              reauthenticated_at: { type: 'string', format: 'date-time' },
              expires_in_seconds: { type: 'number' },
              proof_token: { type: 'string' }
            },
            required: ['ok', 'reauthenticated_at', 'expires_in_seconds', 'proof_token']
          }
        }
      }
    },
    async (request, reply) => {
      const body = request.body as { password?: string } | undefined;
      if (!body?.password || typeof body.password !== 'string') {
        return reply.status(400).send({ message: 'Password is required' });
      }
      const isValid = await verifyReauthPassword(request.user!.userId, body.password);
      if (!isValid) {
        await audit.log(prisma, {
          actorUserId: request.user!.userId,
          actorRole: request.user!.role,
          action: 'PRIVACY_REAUTH_FAILED'
        });
        return reply.status(401).send({ message: 'Kata sandi tidak valid' });
      }
      const now = new Date();
      await audit.log(prisma, {
        actorUserId: request.user!.userId,
        actorRole: request.user!.role,
        action: 'PRIVACY_REAUTH_SUCCESS'
      });
      const proofToken = fastify.jwt.sign(
        {
          purpose: 'PRIVACY_REAUTH',
          userId: request.user!.userId,
          role: request.user!.role,
          sessionVersion: request.user!.sessionVersion,
          nonce: randomUUID()
        },
        { expiresIn: '5m' }
      );
      return reply.send({
        ok: true,
        reauthenticated_at: now.toISOString(),
        expires_in_seconds: 300,
        proof_token: proofToken
      });
    }
  );

  fastify.post(
    '/verify-reauth',
    {
      preHandler: [authGuard],
      schema: {
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: { proof_token: { type: 'string', minLength: 1 } },
          required: ['proof_token'],
          additionalProperties: false
        },
        response: {
          ...standardErrorResponses,
          200: {
            type: 'object',
            properties: { valid: { type: 'boolean' } },
            required: ['valid']
          }
        }
      }
    },
    async (request, reply) => {
      const body = request.body as { proof_token?: string };
      try {
        const decoded = fastify.jwt.verify<{
          purpose?: string;
          userId?: string;
          sessionVersion?: number;
        }>(body.proof_token!);
        if (
          decoded.purpose !== 'PRIVACY_REAUTH' ||
          decoded.userId !== request.user!.userId ||
          decoded.sessionVersion !== request.user!.sessionVersion
        ) {
          return reply.status(403).send({ message: 'Bukti verifikasi tidak cocok dengan sesi aktif' });
        }
        return reply.send({ valid: true });
      } catch {
        return reply.status(401).send({ message: 'Bukti verifikasi telah kedaluwarsa atau tidak valid' });
      }
    }
  );
}
