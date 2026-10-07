import { randomUUID } from 'node:crypto';
import { consultation_topic, Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { recordAuditLog } from '../../utils/audit';
import {
  getActiveCompanionForPatient,
  isVerifiedCompanionProfile,
} from './companionAssignments.service';
import { createNeutralNotification, safeEvent } from './stage4.shared';

type PrismaTx = PrismaClient | Prisma.TransactionClient;

export const OPEN_CONVERSATION_STATUSES = [
  'ASSIGNED',
  'ACTIVE',
  'WAITING_USER',
  'WAITING_COUNSELOR'
] as const;

export class CompanionRoutingError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'CompanionRoutingError';
    this.statusCode = statusCode;
  }
}

export interface RouteCompanionConversationInput {
  patientUserId: string;
  initialMessage: string;
  subject?: string | null;
  topic?: consultation_topic;
  priority?: number;
  submissionKey?: string;
  allowReuseExisting?: boolean;
}

export interface RouteCompanionConversationResult {
  conversation: any;
  isReused: boolean;
  routedToCompanion: boolean;
  companion: any | null;
  fallbackReason: string | null;
}

export async function findActiveCompanionConversation(
  patientUserId: string,
  tx: PrismaTx = prisma
) {
  return tx.service_conversations.findFirst({
    where: {
      user_id: patientUserId,
      service_intent: 'COMPANION_SUPPORT',
      status: { in: ['ASSIGNED', 'ACTIVE', 'WAITING_USER', 'WAITING_COUNSELOR', 'QUEUED'] }
    },
    include: {
      messages: { orderBy: [{ created_at: 'asc' }, { id: 'asc' }] },
      preference: true,
      assignments: { where: { status: 'ACTIVE' }, include: { counselor: true } }
    }
  });
}

export async function routeCompanionConversation(
  input: RouteCompanionConversationInput,
  tx: PrismaTx = prisma
): Promise<RouteCompanionConversationResult> {
  const {
    patientUserId,
    initialMessage,
    subject,
    topic = 'OTHER',
    priority = 0,
    submissionKey,
    allowReuseExisting = true
  } = input;

  const key = submissionKey ?? `comp_${randomUUID().replace(/-/g, '')}`;

  // 1. Check idempotency by submission_key
  const existingByKey = await tx.consultation_preferences.findUnique({
    where: { submission_key: key },
    include: { conversation: true }
  });
  if (existingByKey) {
    if (existingByKey.conversation.user_id !== patientUserId) {
      throw new CompanionRoutingError('Konflik request penugasan', 409);
    }
    return {
      conversation: existingByKey.conversation,
      isReused: true,
      routedToCompanion: Boolean(existingByKey.conversation.assigned_counselor_id),
      companion: null,
      fallbackReason: null
    };
  }

  // 2. Fetch active longitudinal assignment
  const activeAssignment = await getActiveCompanionForPatient(patientUserId, tx);

  // 3. Check for existing open companion conversation if reuse is allowed
  if (allowReuseExisting) {
    const existingOpen = await findActiveCompanionConversation(patientUserId, tx);
    if (existingOpen) {
      // If patient has an active companion and conversation is assigned to this companion
      if (
        activeAssignment &&
        existingOpen.assigned_counselor_id === activeAssignment.companion_user_id
      ) {
        return {
          conversation: existingOpen,
          isReused: true,
          routedToCompanion: true,
          companion: activeAssignment.companion,
          fallbackReason: null
        };
      }
      // If patient has no active companion and an open conversation is already queued
      if (!activeAssignment && existingOpen.status === 'QUEUED') {
        return {
          conversation: existingOpen,
          isReused: true,
          routedToCompanion: false,
          companion: null,
          fallbackReason: 'NO_ACTIVE_COMPANION'
        };
      }
    }
  }

  // 4. Validate active conversations limit
  const openCount = await tx.service_conversations.count({
    where: {
      user_id: patientUserId,
      status: { in: ['QUEUED', 'ASSIGNED', 'ACTIVE', 'WAITING_USER', 'WAITING_COUNSELOR', 'ESCALATED'] }
    }
  });
  if (openCount >= 2) {
    throw new CompanionRoutingError('Selesaikan sesi aktif sebelum membuat sesi baru', 409);
  }

  // 5. Evaluate companion eligibility
  let isEligible = false;
  let companionUser: any = null;
  let fallbackReason: string | null = null;

  if (activeAssignment) {
    companionUser = await tx.users.findUnique({
      where: { id: activeAssignment.companion_user_id },
      include: {
        counselor_profile: true,
        counselor_application: { select: { status: true } }
      }
    });

    if (!companionUser || !companionUser.is_active || companionUser.role !== 'COUNSELOR') {
      fallbackReason = 'COMPANION_USER_INACTIVE';
    } else if (!isVerifiedCompanionProfile(companionUser)) {
      fallbackReason = 'COMPANION_NOT_VERIFIED_OR_ROLE_MISMATCH';
    } else if (companionUser.counselor_application?.status !== 'ACTIVE') {
      fallbackReason = 'APPLICATION_NOT_ACTIVE';
    } else {
      // Check block
      const blocked = await tx.conversation_blocks.findFirst({
        where: {
          user_id: patientUserId,
          counselor_id: companionUser.id,
          is_active: true
        }
      });
      if (blocked) {
        fallbackReason = 'COMPANION_BLOCKED';
      } else {
        // Check capacity
        const workload = await tx.service_conversations.count({
          where: {
            assigned_counselor_id: companionUser.id,
            status: { in: [...OPEN_CONVERSATION_STATUSES] }
          }
        });
        const maxConversations = companionUser.counselor_profile.max_active_conversations ?? 10;
        if (workload >= maxConversations) {
          fallbackReason = 'COMPANION_CAPACITY_FULL';
        } else {
          isEligible = true;
        }
      }
    }
  } else {
    fallbackReason = 'NO_ACTIVE_COMPANION';
  }

  const now = new Date();
  const convId = randomUUID();
  const convSubject = subject?.trim() || 'Pendampingan Berkelanjutan';

  // 6. Branch: Eligible active companion -> ASSIGNED with source LONGITUDINAL
  if (isEligible && companionUser) {
    const createdConv = await tx.service_conversations.create({
      data: {
        id: convId,
        user_id: patientUserId,
        service_type: 'COUNSELOR',
        service_intent: 'COMPANION_SUPPORT',
        status: 'ASSIGNED',
        priority,
        subject: convSubject,
        assigned_counselor_id: companionUser.id,
        assigned_at: now,
        created_by: patientUserId,
        updated_at: now
      }
    });

    await tx.service_messages.create({
      data: {
        id: randomUUID(),
        conversation_id: convId,
        sender_user_id: patientUserId,
        sender_role: 'PASIEN',
        content: initialMessage.trim(),
        idempotency_key: `initial_${key}`,
        updated_at: now
      }
    });

    await tx.consultation_preferences.create({
      data: {
        id: randomUUID(),
        conversation_id: convId,
        topic,
        assignment_mode: 'SELECTED',
        selected_counselor_id: companionUser.id,
        submission_key: key,
        updated_at: now
      }
    });

    await tx.counselor_assignments.create({
      data: {
        id: randomUUID(),
        conversation_id: convId,
        counselor_id: companionUser.id,
        assigned_by: patientUserId,
        source: 'LONGITUDINAL',
        status: 'ACTIVE',
        assigned_at: now
      }
    });

    await safeEvent('conversation', convId, 'ASSIGNED', patientUserId, {
      source: 'LONGITUDINAL',
      routing: 'COMPANION_LONGITUDINAL'
    });

    await recordAuditLog(tx, {
      actorUserId: patientUserId,
      action: 'COMPANION_CONVERSATION_ROUTED',
      entityType: 'service_conversation',
      entityId: convId,
      meta: {
        conversation_public_id: createdConv.public_id,
        companion_user_id: companionUser.id,
        source: 'LONGITUDINAL'
      }
    });

    await createNeutralNotification(
      companionUser.id,
      `svc-assigned:${createdConv.public_id}`,
      'NEW_MESSAGE',
      createdConv.public_id,
      'Anda memiliki pesan baru.'
    );

    return {
      conversation: createdConv,
      isReused: false,
      routedToCompanion: true,
      companion: companionUser,
      fallbackReason: null
    };
  }

  // 7. Branch: Not eligible / No active companion -> QUEUED fallback
  const queuedConv = await tx.service_conversations.create({
    data: {
      id: convId,
      user_id: patientUserId,
      service_type: 'COUNSELOR',
      service_intent: 'COMPANION_SUPPORT',
      status: 'QUEUED',
      priority,
      subject: convSubject,
      assigned_counselor_id: null,
      assigned_at: null,
      created_by: patientUserId,
      updated_at: now
    }
  });

  await tx.service_messages.create({
    data: {
      id: randomUUID(),
      conversation_id: convId,
      sender_user_id: patientUserId,
      sender_role: 'PASIEN',
      content: initialMessage.trim(),
      idempotency_key: `initial_${key}`,
      updated_at: now
    }
  });

  await tx.consultation_preferences.create({
    data: {
      id: randomUUID(),
      conversation_id: convId,
      topic,
      assignment_mode: 'GENERAL_QUEUE',
      fallback_notice: 'Dialihkan ke antrean pendampingan',
      submission_key: key,
      updated_at: now
    }
  });

  await safeEvent('conversation', convId, 'CONVERSATION_QUEUED', patientUserId, {
    fallback: true,
    reason: fallbackReason
  });

  await recordAuditLog(tx, {
    actorUserId: patientUserId,
    action: 'COMPANION_CONVERSATION_QUEUE_FALLBACK',
    entityType: 'service_conversation',
    entityId: convId,
    meta: {
      conversation_public_id: queuedConv.public_id,
      fallback_reason: fallbackReason
    }
  });

  return {
    conversation: queuedConv,
    isReused: false,
    routedToCompanion: false,
    companion: null,
    fallbackReason
  };
}
