import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../db/prisma';
import { recordAuditLog } from '../../utils/audit';
import { generateLoginId, generatePublicId, generateRecoveryCode, normalizeLoginId } from './identity';
import { POLICY_VERSION } from './account.validators';

const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.5YxZkYQpJwZ0fE5xQWQ9tTQO0oYdI0C';
const ALIAS_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export type AnonymousCredentials = { public_id: string; login_id: string; alias: string; recovery_code: string };

function profileSelect() {
  return {
    public_id: true, login_id: true, display_alias: true, full_name: true, role: true,
    account_mode: true, avatar_key: true, preferred_language: true, timezone: true,
    accessibility_preferences: true, notification_preferences: true, recovery_enabled: true,
    created_at: true
  } as const;
}

export async function registerAnonymous(alias: string): Promise<never>;
export async function registerAnonymous(alias: string, password: string): Promise<AnonymousCredentials>;
export async function registerAnonymous(alias: string, password?: string) {
  if (!password) throw new Error('Password required');
  const passwordHash = await bcrypt.hash(password, 12);
  const recoveryCode = generateRecoveryCode();
  const recoveryHash = await bcrypt.hash(recoveryCode, 12);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const publicId = generatePublicId();
    const loginId = generateLoginId();
    try {
      await prisma.$transaction(async (tx) => {
        const user = await tx.users.create({
          data: {
            id: randomUUID(), public_id: publicId, login_id: loginId, display_alias: alias,
            full_name: alias, role: 'PASIEN', account_mode: 'ANONYMOUS', password_hash: passwordHash,
            recovery_code_hash: recoveryHash, recovery_enabled: true, credentials_shown_at: new Date(),
            last_alias_changed_at: new Date(), updated_at: new Date()
          }
        });
        await tx.account_consents.createMany({ data: [
          { id: randomUUID(), user_id: user.id, consent_type: 'TERMS', policy_version: POLICY_VERSION, source: 'ANONYMOUS_REGISTRATION' },
          { id: randomUUID(), user_id: user.id, consent_type: 'PRIVACY', policy_version: POLICY_VERSION, source: 'ANONYMOUS_REGISTRATION' }
        ] });
        await recordAuditLog(tx, { actorUserId: user.id, action: 'ANONYMOUS_ACCOUNT_CREATED', entityType: 'user', entityId: user.id, meta: { account_mode: 'ANONYMOUS', policy_version: POLICY_VERSION } });
      });
      return { public_id: publicId, login_id: loginId, alias, recovery_code: recoveryCode };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') continue;
      throw error;
    }
  }
  throw new Error('Unable to create account');
}

export async function findAnonymousForLogin(loginId: string) {
  return prisma.users.findUnique({ where: { login_id: normalizeLoginId(loginId) } });
}

export async function recoverAnonymous(loginId: string, recoveryCode: string, newPassword: string) {
  const user = await findAnonymousForLogin(loginId);
  const valid = await bcrypt.compare(recoveryCode.trim().toUpperCase(), user?.recovery_code_hash ?? DUMMY_HASH);
  if (!user || user.account_mode !== 'ANONYMOUS' || !user.is_active || !user.recovery_enabled || !valid) {
    throw new Error('Unable to recover account');
  }
  const nextCode = generateRecoveryCode();
  const [passwordHash, nextHash] = await Promise.all([bcrypt.hash(newPassword, 12), bcrypt.hash(nextCode, 12)]);
  await prisma.$transaction(async (tx) => {
    const changed = await tx.users.updateMany({
      where: { id: user.id, recovery_code_hash: user.recovery_code_hash, session_version: user.session_version },
      data: { password_hash: passwordHash, recovery_code_hash: nextHash, session_version: { increment: 1 }, updated_at: new Date() }
    });
    if (changed.count !== 1) throw new Error('Unable to recover account');
    await tx.refresh_tokens.updateMany({ where: { user_id: user.id, revoked_at: null }, data: { revoked_at: new Date() } });
    await recordAuditLog(tx, { actorUserId: user.id, action: 'ACCOUNT_RECOVERED', entityType: 'user', entityId: user.id, meta: { sessions_revoked: true } });
  });
  return { recovery_code: nextCode };
}

export async function getAccountProfile(userId: string) {
  return prisma.users.findUnique({ where: { id: userId }, select: profileSelect() });
}

export async function updateAccountProfile(userId: string, payload: Record<string, unknown>) {
  const current = await prisma.users.findUnique({ where: { id: userId }, select: { display_alias: true, last_alias_changed_at: true } });
  if (!current) return null;
  const alias = payload.alias as string | undefined;
  if (alias && alias !== current.display_alias && current.last_alias_changed_at && Date.now() - current.last_alias_changed_at.getTime() < ALIAS_COOLDOWN_MS) {
    throw new Error('Alias hanya dapat diubah sekali dalam 24 jam');
  }
  const data: Prisma.usersUpdateInput = {
    ...(alias ? { display_alias: alias, full_name: alias, last_alias_changed_at: new Date() } : {}),
    ...(payload.avatar_key ? { avatar_key: payload.avatar_key as string } : {}),
    ...(payload.preferred_language ? { preferred_language: payload.preferred_language as string } : {}),
    ...(payload.timezone ? { timezone: payload.timezone as string } : {}),
    ...(payload.accessibility_preferences ? { accessibility_preferences: payload.accessibility_preferences as Prisma.InputJsonValue } : {}),
    ...(payload.notification_preferences ? { notification_preferences: payload.notification_preferences as Prisma.InputJsonValue } : {}),
    updated_at: new Date()
  };
  const updated = await prisma.users.update({ where: { id: userId }, data, select: profileSelect() });
  await recordAuditLog(prisma, { actorUserId: userId, action: 'ACCOUNT_PROFILE_UPDATED', entityType: 'user', entityId: userId, meta: { fields: Object.keys(payload) } });
  return updated;
}

async function verifyPassword(userId: string, password: string) {
  const user = await prisma.users.findUnique({ where: { id: userId } });
  const valid = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !user.password_hash || !valid) throw new Error('Invalid credentials');
  return user;
}

export async function changePassword(userId: string, current: string, next: string) {
  await verifyPassword(userId, current);
  const hash = await bcrypt.hash(next, 12);
  await revokeAllSessions(userId, 'PASSWORD_CHANGED', { password_hash: hash });
}

export async function regenerateRecoveryCode(userId: string, password: string) {
  const user = await verifyPassword(userId, password);
  if (user.account_mode !== 'ANONYMOUS') throw new Error('Recovery code is not enabled');
  const code = generateRecoveryCode();
  const hash = await bcrypt.hash(code, 12);
  await prisma.users.update({ where: { id: userId }, data: { recovery_code_hash: hash, recovery_enabled: true, updated_at: new Date() } });
  await recordAuditLog(prisma, { actorUserId: userId, action: 'RECOVERY_CODE_REGENERATED', entityType: 'user', entityId: userId });
  return { recovery_code: code };
}

export async function revokeAllSessions(userId: string, action = 'ALL_SESSIONS_REVOKED', extra: Prisma.usersUpdateInput = {}) {
  await prisma.$transaction(async (tx) => {
    await tx.users.update({ where: { id: userId }, data: { ...extra, session_version: { increment: 1 }, updated_at: new Date() } });
    await tx.refresh_tokens.updateMany({ where: { user_id: userId, revoked_at: null }, data: { revoked_at: new Date() } });
    await recordAuditLog(tx, { actorUserId: userId, action, entityType: 'user', entityId: userId, meta: { sessions_revoked: true } });
  });
}

export async function convertLegacyAccount(userId: string, currentPassword: string, alias: string, newPassword: string) {
  const user = await verifyPassword(userId, currentPassword);
  if (user.account_mode === 'ANONYMOUS') throw new Error('Account already anonymous');
  const loginId = generateLoginId();
  const recoveryCode = generateRecoveryCode();
  const recoveryHash = await bcrypt.hash(recoveryCode, 12);
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.$transaction(async (tx) => {
    await tx.users.update({ where: { id: userId }, data: { login_id: loginId, display_alias: alias, full_name: alias, account_mode: 'ANONYMOUS', password_hash: passwordHash, recovery_code_hash: recoveryHash, recovery_enabled: true, credentials_shown_at: new Date(), last_alias_changed_at: new Date(), session_version: { increment: 1 }, updated_at: new Date() } });
    await tx.account_consents.createMany({ data: [
      { id: randomUUID(), user_id: userId, consent_type: 'TERMS', policy_version: POLICY_VERSION, source: 'LEGACY_CONVERSION' },
      { id: randomUUID(), user_id: userId, consent_type: 'PRIVACY', policy_version: POLICY_VERSION, source: 'LEGACY_CONVERSION' }
    ], skipDuplicates: true });
    await tx.refresh_tokens.updateMany({ where: { user_id: userId, revoked_at: null }, data: { revoked_at: new Date() } });
    await recordAuditLog(tx, { actorUserId: userId, action: 'ACCOUNT_CONVERTED_TO_ANONYMOUS', entityType: 'user', entityId: userId, meta: { policy_version: POLICY_VERSION, legacy_contacts_retained: true } });
  });
  return { public_id: user.public_id, login_id: loginId, alias, recovery_code: recoveryCode };
}
