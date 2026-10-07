import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const updated = await prisma.$executeRaw`UPDATE "users" SET "public_id" = 'usr_' || replace(gen_random_uuid()::text, '-', '') WHERE "public_id" IS NULL`;
  const missing = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM "users" WHERE "public_id" IS NULL`;
  if (Number(missing[0]?.count ?? 0) !== 0) throw new Error('Public ID backfill incomplete');
  console.log(`Anonymous identity backfill complete; rows updated: ${updated}`);
}

main().finally(() => prisma.$disconnect());
