import { randomUUID } from 'node:crypto';
import { prisma } from '../../db/prisma';

// Versioned once to avoid a stale session-scoped lock left by the pre-transaction implementation.
const LOCK_ID = 8374405;

export async function runStage4SchedulerOnce(now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const lock = await tx.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_xact_lock(${LOCK_ID}) AS locked
    `;
    if (!lock[0]?.locked) return { locked: false, escalated: 0 };

    let escalated = 0;
    const overdue = await tx.complaint_tickets.findMany({
      where: {
        resolution_due_at: { lt: now },
        status: { notIn: ['RESOLVED', 'CLOSED', 'REJECTED'] },
        escalation_level: 0
      },
      select: { id: true }
    });
    for (const ticket of overdue) {
      const result = await tx.complaint_tickets.updateMany({
        where: { id: ticket.id, escalation_level: 0 },
        data: { status: 'ESCALATED', escalation_level: 1, updated_at: now }
      });
      if (result.count) {
        escalated += 1;
        await tx.complaint_events.create({
          data: {
            id: randomUUID(),
            ticket_id: ticket.id,
            event_type: 'SLA_ESCALATED',
            safe_metadata: { level: 1 }
          }
        });
      }
    }
    return { locked: true, escalated };
  });
}

export function startStage4Scheduler() {
  const run = () => void runStage4SchedulerOnce().catch(() => undefined);
  run();
  const timer = setInterval(run, 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
