import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

type AuditInput = {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  meta?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
};

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export async function recordAuditLog(prisma: PrismaLike, input: AuditInput) {
  await prisma.audit_logs.create({
    data: {
      id: randomUUID(),
      actor_user_id: input.actorUserId,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId,
      meta: (input.meta ?? {}) as Prisma.InputJsonValue,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null
    }
  });
}
