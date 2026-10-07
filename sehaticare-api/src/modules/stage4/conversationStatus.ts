import type { service_conversation_status } from '@prisma/client';

export const runtimeConversationStatuses: service_conversation_status[] = [
  'QUEUED', 'ASSIGNED', 'ACTIVE', 'WAITING_USER', 'WAITING_COUNSELOR', 'ESCALATED', 'CLOSED', 'CANCELLED'
];

const allowed: Record<service_conversation_status, ReadonlySet<service_conversation_status>> = {
  DRAFT: new Set(['QUEUED', 'CANCELLED']),
  QUEUED: new Set(['ASSIGNED', 'ESCALATED', 'CANCELLED', 'CLOSED']),
  ASSIGNED: new Set(['ACTIVE', 'WAITING_USER', 'WAITING_COUNSELOR', 'QUEUED', 'CLOSED', 'CANCELLED', 'ESCALATED']),
  ACTIVE: new Set(['WAITING_USER', 'WAITING_COUNSELOR', 'QUEUED', 'CLOSED', 'CANCELLED', 'ESCALATED', 'ASSIGNED']),
  WAITING_USER: new Set(['ACTIVE', 'WAITING_COUNSELOR', 'QUEUED', 'CLOSED', 'CANCELLED', 'ESCALATED', 'ASSIGNED']),
  WAITING_COUNSELOR: new Set(['ACTIVE', 'WAITING_USER', 'QUEUED', 'CLOSED', 'CANCELLED', 'ESCALATED', 'ASSIGNED']),
  ESCALATED: new Set(['ASSIGNED', 'ACTIVE', 'QUEUED', 'CLOSED', 'CANCELLED']),
  CLOSED: new Set(),
  CANCELLED: new Set()
};

export function canTransitionConversation(from: service_conversation_status, to: service_conversation_status) {
  return from === to || allowed[from].has(to);
}

export function assertConversationTransition(from: service_conversation_status, to: service_conversation_status) {
  if (!canTransitionConversation(from, to)) {
    throw Object.assign(new Error(`Invalid conversation status transition: ${from} -> ${to}`), { statusCode: 409 });
  }
}
