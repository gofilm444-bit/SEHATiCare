import { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../db/prisma';
import { env } from '../../config/env';
import { generateOtp, hashToken, hashWithSalt, verifyHash } from '../../utils/crypto';
import bcrypt from 'bcryptjs';
import type { user_role } from '@prisma/client';

const OTP_WINDOW_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

type Contact = { phone_e164?: string; email?: string };

const sessionUserSelect = {
  id: true,
  role: true,
  is_superadmin: true,
  email: true,
  full_name: true,
  is_active: true,
  public_id: true,
  display_alias: true,
  account_mode: true,
  session_version: true
} as const;

async function issueSessionTokens(
  app: FastifyInstance,
  user: { id: string; role: user_role; session_version: number }
) {
  const payload = { userId: user.id, role: user.role, sessionVersion: user.session_version };
  const accessToken = app.auth.signAccessToken(payload);
  const refreshToken = app.auth.signRefreshToken(payload);
  const refreshExpiry = new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.refresh_tokens.create({
    data: {
      id: randomUUID(),
      user_id: user.id,
      token_hash: hashToken(refreshToken),
      expires_at: refreshExpiry
    }
  });
  return { accessToken, refreshToken };
}

export async function requestOtp(app: FastifyInstance, contact: Contact, meta?: { ip?: string; userAgent?: string }) {
  const otp = generateOtp();
  const { hash, salt } = hashWithSalt(otp);
  const expiresAt = new Date(Date.now() + OTP_WINDOW_MS);

  await prisma.otp_requests.create({
    data: {
      id: randomUUID(),
      phone_e164: contact.phone_e164 ?? null,
      email: contact.email ?? null,
      purpose: 'LOGIN',
      otp_hash: hash,
      otp_salt: salt,
      expires_at: expiresAt,
      ip_address: meta?.ip,
      user_agent: meta?.userAgent
    }
  });

  return {
    expiresAt,
    // Provide OTP only for local development to avoid leaking in production.
    ...(env.NODE_ENV !== 'production' ? { dev_otp: otp } : {})
  };
}

export async function verifyOtp(app: FastifyInstance, contact: Contact, otp: string) {
  const otpRequest = await prisma.otp_requests.findFirst({
    where: {
      purpose: 'LOGIN',
      phone_e164: contact.phone_e164 ?? undefined,
      email: contact.email ?? undefined
    },
    orderBy: { created_at: 'desc' }
  });

  if (!otpRequest) {
    throw new Error('OTP not requested or expired');
  }

  if (otpRequest.verified_at) {
    throw new Error('OTP already used');
  }

  if (otpRequest.attempt_count >= OTP_MAX_ATTEMPTS) {
    throw new Error('OTP attempts exceeded');
  }

  if (otpRequest.expires_at.getTime() < Date.now()) {
    throw new Error('OTP expired');
  }

  const isValid = verifyHash(otp, otpRequest.otp_salt, otpRequest.otp_hash);
  if (!isValid) {
    await prisma.otp_requests.update({
      where: { id: otpRequest.id },
      data: { attempt_count: { increment: 1 } }
    });
    throw new Error('OTP invalid');
  }

  await prisma.otp_requests.update({
    where: { id: otpRequest.id },
    data: { verified_at: new Date(), attempt_count: { increment: 1 } }
  });

  let user;
  if (contact.phone_e164) {
    user = await prisma.users.findUnique({ where: { phone_e164: contact.phone_e164 } });
  } else if (contact.email) {
    user = await prisma.users.findUnique({ where: { email: contact.email } });
  }

  if (!user) {
    user = await prisma.users.create({
      data: {
        id: randomUUID(),
        phone_e164: contact.phone_e164 ?? null,
        email: contact.email ?? null,
        full_name: contact.phone_e164 ?? contact.email ?? 'Pengguna',
        role: 'PASIEN',
        updated_at: new Date()
      }
    });
  }

  if (!user.is_active || user.account_mode !== 'LEGACY') throw new Error('Invalid credentials');
  const { accessToken, refreshToken } = await issueSessionTokens(app, user);

  return { accessToken, refreshToken, user };
}

export async function getCurrentUser(userId: string) {
  return prisma.users.findUnique({
    where: { id: userId },
    include: { doctor_profiles_doctor_profiles_user_idTousers: true }
  });
}

export async function loginWithPassword(app: FastifyInstance, email: string, password: string) {
  const user = await prisma.users.findUnique({ where: { email } });
  const hash = user?.password_hash ?? '$2b$12$C6UzMDM.H6dfI/f/IKcEe.5YxZkYQpJwZ0fE5xQWQ9tTQO0oYdI0C';
  const valid = await bcrypt.compare(password, hash);
  if (!user || user.account_mode !== 'LEGACY' || !user.password_hash || !valid || !user.is_active) throw new Error('Invalid credentials');
  const { accessToken, refreshToken } = await issueSessionTokens(app, user);

  return {
    accessToken,
    refreshToken,
    user
  };
}

export async function loginAnonymous(app: FastifyInstance, loginId: string, password: string) {
  const { normalizeLoginId } = await import('../account/identity');
  const user = await prisma.users.findUnique({ where: { login_id: normalizeLoginId(loginId) } });
  const hash = user?.password_hash ?? '$2b$12$C6UzMDM.H6dfI/f/IKcEe.5YxZkYQpJwZ0fE5xQWQ9tTQO0oYdI0C';
  const valid = await bcrypt.compare(password, hash);
  if (!user || user.account_mode !== 'ANONYMOUS' || !user.password_hash || !valid || !user.is_active) throw new Error('Invalid credentials');
  const { accessToken, refreshToken } = await issueSessionTokens(app, user);
  return { accessToken, refreshToken, user };
}

export async function rotateRefreshToken(app: FastifyInstance, refreshToken: string) {
  let payload: { userId: string; role: user_role; sessionVersion: number };
  try {
    payload = app.auth.verifyRefreshToken(refreshToken);
  } catch {
    throw new Error('Invalid session');
  }

  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refresh_tokens.findFirst({
    where: {
      user_id: payload.userId,
      token_hash: tokenHash,
      revoked_at: null,
      expires_at: { gt: new Date() }
    },
    select: { id: true }
  });
  if (!stored) throw new Error('Invalid session');

  const user = await prisma.users.findUnique({
    where: { id: payload.userId },
    select: sessionUserSelect
  });
  if (!user?.is_active) throw new Error('Invalid session');

  return prisma.$transaction(async (tx) => {
    const revoked = await tx.refresh_tokens.updateMany({
      where: { id: stored.id, revoked_at: null },
      data: { revoked_at: new Date() }
    });
    if (revoked.count !== 1) throw new Error('Invalid session');

    if (payload.sessionVersion !== user.session_version) throw new Error('Invalid session');
    const nextPayload = { userId: user.id, role: user.role, sessionVersion: user.session_version };
    const accessToken = app.auth.signAccessToken(nextPayload);
    const nextRefreshToken = app.auth.signRefreshToken(nextPayload);
    await tx.refresh_tokens.create({
      data: {
        id: randomUUID(),
        user_id: user.id,
        token_hash: hashToken(nextRefreshToken),
        expires_at: new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000)
      }
    });

    return {
      accessToken,
      refreshToken: nextRefreshToken,
      user: {
        id: user.public_id,
        role: user.role,
        is_superadmin: user.is_superadmin,
        email: user.email,
        full_name: user.display_alias ?? user.full_name,
        public_id: user.public_id,
        display_alias: user.display_alias,
        account_mode: user.account_mode
      }
    };
  });
}

export async function revokeRefreshToken(refreshToken: string) {
  await prisma.refresh_tokens.updateMany({
    where: { token_hash: hashToken(refreshToken), revoked_at: null },
    data: { revoked_at: new Date() }
  });
}
