import { Prisma, PrismaClient, user_role } from '@prisma/client';
import { randomUUID } from 'node:crypto';

type AuditEventInput = {
  actorUserId?: string | null;
  actorRole?: user_role | null;
  action: string;
  consultationId?: string | null;
  meta?: Prisma.InputJsonValue;
};

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export const audit = {
  log: async (prisma: PrismaLike, input: AuditEventInput) => {
    await prisma.audit_events.create({
      data: {
        id: randomUUID(),
        actor_user_id: input.actorUserId ?? null,
        actor_role: input.actorRole ?? null,
        action: input.action,
        consultation_id: input.consultationId ?? null,
        meta_json: (input.meta ?? {}) as Prisma.InputJsonValue
      }
    });
  }
};
