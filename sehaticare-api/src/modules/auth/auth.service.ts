import { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../db/prisma';
import { env } from '../../config/env';
import { generateOtp, hashToken, hashWithSalt, verifyHash } from '../../utils/crypto';
import bcrypt from 'bcryptjs';

const OTP_WINDOW_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

type Contact = { phone_e164?: string; email?: string };

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
    ...(process.env.NODE_ENV !== 'production' ? { dev_otp: otp } : {})
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

  const payload = { userId: user.id, role: user.role };
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
  if (!user || !user.password_hash) {
    throw new Error('Invalid credentials');
  }
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new Error('Invalid credentials');
  }
  if (!user.is_active) {
    throw new Error('User inactive');
  }

  const payload = { userId: user.id, role: user.role };
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

  return {
    accessToken,
    refreshToken,
    user
  };
}
