import { Prisma, user_role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../db/prisma';
import { recordAuditLog } from '../../utils/audit';
import { buildPagination } from '../../utils/pagination';

export const MANAGED_USER_ROLES = [
  'PASIEN',
  'DOKTER',
  'ADMIN',
  'COUNSELOR',
  'COMPLAINT_OFFICER',
  'SUPERVISOR'
] as const;

export type ManagedUserRole = (typeof MANAGED_USER_ROLES)[number];

export class AccountManagementError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'AccountManagementError';
  }
}

const listSelect = {
  id: true,
  public_id: true,
  display_alias: true,
  full_name: true,
  account_mode: true,
  role: true,
  is_superadmin: true,
  is_active: true,
  created_at: true,
  updated_at: true
} as const;

async function getAdmin(actorId: string) {
  const actor = await prisma.users.findUnique({
    where: { id: actorId },
    select: { id: true, role: true, is_superadmin: true, is_active: true }
  });
  if (!actor?.is_active || actor.role !== 'ADMIN') {
    throw new AccountManagementError(403, 'Akses ditolak');
  }
  return actor;
}

async function requireSuperadmin(actorId: string) {
  const actor = await getAdmin(actorId);
  if (!actor.is_superadmin) {
    throw new AccountManagementError(403, 'Tindakan ini hanya tersedia untuk superadmin');
  }
  return actor;
}

function displayName(user: { display_alias: string | null; full_name: string; account_mode: string }) {
  return user.display_alias ?? (user.account_mode === 'LEGACY' ? user.full_name : 'Pengguna');
}

function canManageTarget(actor: { id: string; is_superadmin: boolean }, target: { id: string; role: user_role; is_superadmin: boolean }) {
  if (target.is_superadmin) return false;
  if (target.id === actor.id) return false;
  return actor.is_superadmin || target.role !== 'ADMIN';
}

export async function listManagedUsers(
  actorId: string,
  query: { page?: number | string; pageSize?: number | string; search?: string; role?: string; status?: string }
) {
  const actor = await getAdmin(actorId);
  const { skip, take, page, pageSize } = buildPagination(query);
  const search = typeof query.search === 'string' ? query.search.trim().slice(0, 64) : '';
  const role = MANAGED_USER_ROLES.includes(query.role as ManagedUserRole) ? query.role as ManagedUserRole : undefined;
  const status = query.status === 'active' ? true : query.status === 'inactive' ? false : undefined;
  const where: Prisma.usersWhereInput = {
    ...(search ? { OR: [
      { public_id: { contains: search, mode: 'insensitive' } },
      { display_alias: { contains: search, mode: 'insensitive' } },
      { full_name: { contains: search, mode: 'insensitive' } }
    ] } : {}),
    ...(role ? { role } : {}),
    ...(status === undefined ? {} : { is_active: status })
  };
  const [items, total] = await Promise.all([
    prisma.users.findMany({ where, skip, take, orderBy: { created_at: 'desc' }, select: listSelect }),
    prisma.users.count({ where })
  ]);
  return {
    items: items.map(({ id, ...user }) => ({
      ...user,
      display_alias: displayName(user),
      is_self: id === actor.id,
      can_manage: canManageTarget(actor, { id, role: user.role, is_superadmin: user.is_superadmin })
    })),
    total,
    page,
    pageSize,
    is_superadmin: actor.is_superadmin
  };
}

export async function getManagedUser(actorId: string, publicId: string) {
  const actor = await getAdmin(actorId);
  const target = await prisma.users.findUnique({
    where: { public_id: publicId },
    select: {
      id: true,
      public_id: true,
      email: true,
      display_alias: true,
      full_name: true,
      account_mode: true,
      role: true,
      is_superadmin: true,
      is_active: true,
      created_at: true,
      updated_at: true
    }
  });
  if (!target) return null;
  const { id, ...safeTarget } = target;
  return {
    ...safeTarget,
    display_alias: displayName(target),
    is_self: id === actor.id,
    can_manage: canManageTarget(actor, target)
  };
}

export async function createManagedUser(actorId: string, input: {
  email: string;
  full_name: string;
  display_alias?: string;
  role: ManagedUserRole;
  password: string;
  is_active?: boolean;
}) {
  await requireSuperadmin(actorId);
  const email = input.email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(input.password, 12);
  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.users.create({
        data: {
          id: randomUUID(),
          email,
          full_name: input.full_name.trim(),
          display_alias: input.display_alias?.trim() || null,
          account_mode: 'LEGACY',
          role: input.role,
          password_hash: passwordHash,
          is_active: input.is_active ?? true,
          updated_at: new Date()
        },
        select: listSelect
      });
      await recordAuditLog(tx, {
        actorUserId: actorId,
        action: 'ACCOUNT_CREATED_BY_SUPERADMIN',
        entityType: 'user',
        entityId: user.public_id,
        meta: { public_id: user.public_id, role: user.role }
      });
      const { id: _id, ...safeUser } = user;
      return { ...safeUser, display_alias: displayName(user) };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AccountManagementError(409, 'Email sudah digunakan oleh akun lain');
    }
    throw error;
  }
}

export async function updateManagedUser(actorId: string, publicId: string, input: {
  full_name?: string;
  display_alias?: string | null;
  role?: ManagedUserRole;
}) {
  const actor = await getAdmin(actorId);
  const target = await prisma.users.findUnique({
    where: { public_id: publicId },
    select: { id: true, public_id: true, role: true, is_superadmin: true }
  });
  if (!target) return null;
  if (!canManageTarget(actor, target)) throw new AccountManagementError(403, 'Akun ini tidak dapat diubah');
  const roleChanged = input.role !== undefined && input.role !== target.role;
  if (roleChanged && !actor.is_superadmin) {
    throw new AccountManagementError(403, 'Perubahan role hanya tersedia untuk superadmin');
  }
  return prisma.$transaction(async (tx) => {
    const user = await tx.users.update({
      where: { id: target.id },
      data: {
        ...(input.full_name !== undefined ? { full_name: input.full_name.trim() } : {}),
        ...(input.display_alias !== undefined ? { display_alias: input.display_alias?.trim() || null } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(roleChanged ? { session_version: { increment: 1 } } : {}),
        updated_at: new Date()
      },
      select: listSelect
    });
    if (roleChanged) {
      await tx.refresh_tokens.updateMany({ where: { user_id: target.id, revoked_at: null }, data: { revoked_at: new Date() } });
      if (target.role === 'COUNSELOR') {
        await tx.counselor_profiles.updateMany({
          where: { user_id: target.id },
          data: { permission_enabled: false, is_available: false, is_active: false, updated_at: new Date() }
        });
      }
    }
    await recordAuditLog(tx, {
      actorUserId: actorId,
      action: roleChanged ? 'ACCOUNT_ROLE_CHANGED' : 'ACCOUNT_PROFILE_UPDATED_BY_ADMIN',
      entityType: 'user',
      entityId: target.public_id,
      meta: roleChanged ? { previous_role: target.role, role: input.role } : { public_id: target.public_id }
    });
    const { id: _id, ...safeUser } = user;
    return { ...safeUser, display_alias: displayName(user) };
  });
}

export async function setManagedUserStatus(actorId: string, publicId: string, isActive: boolean) {
  const actor = await getAdmin(actorId);
  const target = await prisma.users.findUnique({
    where: { public_id: publicId },
    select: { id: true, public_id: true, role: true, is_superadmin: true, is_active: true }
  });
  if (!target) return null;
  if (!canManageTarget(actor, target)) throw new AccountManagementError(403, 'Akun ini tidak dapat dinonaktifkan atau diaktifkan');
  if (target.is_active === isActive) return { public_id: target.public_id, is_active: target.is_active };
  return prisma.$transaction(async (tx) => {
    const user = await tx.users.update({
      where: { id: target.id },
      data: { is_active: isActive, session_version: { increment: 1 }, updated_at: new Date() },
      select: { public_id: true, is_active: true }
    });
    await tx.refresh_tokens.updateMany({ where: { user_id: target.id, revoked_at: null }, data: { revoked_at: new Date() } });
    if (!isActive) {
      await tx.counselor_profiles.updateMany({
        where: { user_id: target.id },
        data: { permission_enabled: false, is_available: false, updated_at: new Date() }
      });
    }
    await recordAuditLog(tx, {
      actorUserId: actorId,
      action: isActive ? 'ACCOUNT_ACTIVATED' : 'ACCOUNT_DEACTIVATED',
      entityType: 'user',
      entityId: target.public_id,
      meta: { public_id: target.public_id }
    });
    return user;
  });
}

export async function resetManagedUserPassword(actorId: string, publicId: string, newPassword: string) {
  await requireSuperadmin(actorId);
  const target = await prisma.users.findUnique({
    where: { public_id: publicId },
    select: { id: true, public_id: true, account_mode: true, is_superadmin: true }
  });
  if (!target) return null;
  if (target.is_superadmin) throw new AccountManagementError(403, 'Kata sandi superadmin hanya dapat diubah dari profilnya sendiri');
  if (target.account_mode !== 'LEGACY') throw new AccountManagementError(400, 'Akun anonim menggunakan pemulihan akun anonim');
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.$transaction(async (tx) => {
    await tx.users.update({ where: { id: target.id }, data: { password_hash: passwordHash, session_version: { increment: 1 }, updated_at: new Date() } });
    await tx.refresh_tokens.updateMany({ where: { user_id: target.id, revoked_at: null }, data: { revoked_at: new Date() } });
    await recordAuditLog(tx, {
      actorUserId: actorId,
      action: 'PASSWORD_RESET_BY_SUPERADMIN',
      entityType: 'user',
      entityId: target.public_id,
      meta: { public_id: target.public_id }
    });
  });
  return { success: true };
}

export async function revokeManagedUserSessions(actorId: string, publicId: string) {
  const actor = await getAdmin(actorId);
  const target = await prisma.users.findUnique({
    where: { public_id: publicId },
    select: { id: true, public_id: true, role: true, is_superadmin: true }
  });
  if (!target) return null;
  if (!canManageTarget(actor, target)) throw new AccountManagementError(403, 'Sesi akun ini tidak dapat dicabut');
  await prisma.$transaction(async (tx) => {
    await tx.users.update({ where: { id: target.id }, data: { session_version: { increment: 1 }, updated_at: new Date() } });
    await tx.refresh_tokens.updateMany({ where: { user_id: target.id, revoked_at: null }, data: { revoked_at: new Date() } });
    await recordAuditLog(tx, {
      actorUserId: actorId,
      action: 'SESSIONS_REVOKED_BY_ADMIN',
      entityType: 'user',
      entityId: target.public_id,
      meta: { public_id: target.public_id }
    });
  });
  return { success: true };
}
