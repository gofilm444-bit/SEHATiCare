import { prisma } from '../src/db/prisma';
import { recordAuditLog } from '../src/utils/audit';

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error('Gunakan: npm run admin:promote-superadmin -- <email-admin>');
  }

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.users.findUnique({
      where: { email },
      select: { id: true, public_id: true, role: true, is_active: true, is_superadmin: true }
    });
    if (!user || user.role !== 'ADMIN' || !user.is_active) {
      throw new Error('Target harus merupakan akun ADMIN aktif');
    }
    if (user.is_superadmin) return { public_id: user.public_id, changed: false };

    await tx.users.update({
      where: { id: user.id },
      data: { is_superadmin: true, session_version: { increment: 1 }, updated_at: new Date() }
    });
    await tx.refresh_tokens.updateMany({
      where: { user_id: user.id, revoked_at: null },
      data: { revoked_at: new Date() }
    });
    await recordAuditLog(tx, {
      actorUserId: user.id,
      action: 'SUPERADMIN_BOOTSTRAPPED',
      entityType: 'user',
      entityId: user.id,
      meta: { public_id: user.public_id, mechanism: 'CONTROLLED_LOCAL_BOOTSTRAP' }
    });
    return { public_id: user.public_id, changed: true };
  });

  console.log(result.changed ? `Superadmin diaktifkan untuk ${result.public_id}` : `Akun ${result.public_id} sudah superadmin`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Promosi superadmin gagal');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
