import { randomUUID } from 'node:crypto';
import { prisma } from '../../db/prisma';
import { recordAuditLog } from '../../utils/audit';
import { hasDoctorPatientRelationship } from './hivCare.service';
import { computeOverdueBucket } from './careSignals.presenter';

export class CareSignalError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'CareSignalError';
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function resolveUser(identifier: string) {
  if (!identifier) return null;
  const isUuid = UUID_REGEX.test(identifier);
  return prisma.users.findFirst({
    where: isUuid ? { id: identifier } : { public_id: identifier },
    select: {
      id: true,
      public_id: true,
      display_alias: true,
      role: true,
      is_active: true
    }
  });
}

export async function resolveCareSignal(identifier: string) {
  if (!identifier) return null;
  const isUuid = UUID_REGEX.test(identifier);
  return prisma.care_signals.findFirst({
    where: isUuid ? { id: identifier } : { public_id: identifier },
    include: {
      patient: {
        select: {
          id: true,
          public_id: true,
          display_alias: true
        }
      },
      actions: {
        orderBy: { occurred_at: 'desc' },
        include: {
          actor: {
            select: {
              id: true,
              public_id: true,
              display_alias: true,
              role: true
            }
          }
        }
      }
    }
  });
}

// ==========================================
// DETERMINISTIC SIGNAL SYNCHRONIZATION
// ==========================================

export async function syncSevereSideEffectSignal(sideEffectId: string) {
  const sideEffect = await prisma.art_side_effect_entries.findUnique({
    where: { id: sideEffectId }
  });

  if (!sideEffect) return null;

  const isSevereAndActive =
    sideEffect.severity === 'SEVERE' &&
    sideEffect.status === 'ACTIVE' &&
    sideEffect.archived_at === null;

  // Find existing open or acknowledged signal for this source
  const existingSignal = await prisma.care_signals.findFirst({
    where: {
      source_type: 'SIDE_EFFECT',
      source_id: sideEffect.id,
      status: { in: ['OPEN', 'ACKNOWLEDGED'] }
    }
  });

  if (isSevereAndActive) {
    if (!existingSignal) {
      // Create new deterministic clinical care signal
      // PRIVACY: Do NOT copy symptom_name, notes, or free-text into the care_signals record!
      const newSignal = await prisma.care_signals.create({
        data: {
          id: randomUUID(),
          patient_id: sideEffect.patient_user_id,
          signal_type: 'SEVERE_SIDE_EFFECT_REPORTED',
          signal_scope: 'CLINICAL',
          priority: 'PRIORITY',
          status: 'OPEN',
          source_type: 'SIDE_EFFECT',
          source_id: sideEffect.id,
          detected_at: sideEffect.occurred_at || new Date(),
          metadata: {
            source_entry_public_id: sideEffect.public_id
          }
        }
      });

      await recordAuditLog(prisma, {
        actorUserId: sideEffect.patient_user_id,
        action: 'CARE_SIGNAL_CREATED',
        entityType: 'care_signal',
        entityId: newSignal.id,
        meta: {
          public_id: newSignal.public_id,
          signal_type: newSignal.signal_type,
          signal_scope: newSignal.signal_scope,
          priority: newSignal.priority
        }
      });

      return newSignal;
    }
    return existingSignal;
  } else {
    // If side effect is no longer severe or resolved, auto-resolve open signal
    if (existingSignal) {
      const now = new Date();
      const updated = await prisma.care_signals.update({
        where: { id: existingSignal.id },
        data: {
          status: 'RESOLVED',
          resolved_at: now,
          updated_at: now
        }
      });

      await prisma.care_signal_actions.create({
        data: {
          id: randomUUID(),
          care_signal_id: existingSignal.id,
          actor_user_id: sideEffect.patient_user_id,
          action_type: 'RESOLVED',
          occurred_at: now
        }
      });

      await recordAuditLog(prisma, {
        actorUserId: sideEffect.patient_user_id,
        action: 'CARE_SIGNAL_RESOLVED',
        entityType: 'care_signal',
        entityId: updated.id,
        meta: {
          public_id: updated.public_id,
          signal_type: updated.signal_type,
          resolution_reason: 'SOURCE_RESOLVED'
        }
      });

      return updated;
    }
  }

  return null;
}

export async function syncControlScheduleSignal(scheduleId: string, now: Date = new Date()) {
  const schedule = await prisma.control_schedules.findUnique({
    where: { id: scheduleId }
  });

  if (!schedule) return null;

  const isOverdue =
    ['SCHEDULED', 'CONFIRMED'].includes(schedule.status) &&
    schedule.starts_at.getTime() < now.getTime();

  const existingSignal = await prisma.care_signals.findFirst({
    where: {
      source_type: 'CONTROL_SCHEDULE',
      source_id: schedule.id,
      status: { in: ['OPEN', 'ACKNOWLEDGED'] }
    }
  });

  if (isOverdue) {
    const bucketInfo = computeOverdueBucket(schedule.starts_at, now);

    if (existingSignal) {
      // Update metadata with latest overdue bucket if changed
      const currentMeta = (existingSignal.metadata || {}) as Record<string, any>;
      if (currentMeta.overdue_bucket !== bucketInfo.bucket) {
        await prisma.care_signals.update({
          where: { id: existingSignal.id },
          data: {
            metadata: {
              ...currentMeta,
              overdue_bucket: bucketInfo.bucket,
              overdue_days: bucketInfo.days_overdue
            },
            updated_at: now
          }
        });
      }
      return existingSignal;
    }

    const newSignal = await prisma.care_signals.create({
      data: {
        id: randomUUID(),
        patient_id: schedule.user_id,
        signal_type: 'FOLLOW_UP_OVERDUE',
        signal_scope: 'SUPPORT',
        priority: 'ATTENTION',
        status: 'OPEN',
        source_type: 'CONTROL_SCHEDULE',
        source_id: schedule.id,
        detected_at: schedule.starts_at,
        metadata: {
          schedule_public_id: schedule.public_id,
          overdue_bucket: bucketInfo.bucket,
          overdue_days: bucketInfo.days_overdue
        }
      }
    });

    await recordAuditLog(prisma, {
      actorUserId: schedule.user_id,
      action: 'CARE_SIGNAL_CREATED',
      entityType: 'care_signal',
      entityId: newSignal.id,
      meta: {
        public_id: newSignal.public_id,
        signal_type: newSignal.signal_type,
        signal_scope: newSignal.signal_scope,
        priority: newSignal.priority
      }
    });

    return newSignal;
  } else {
    // If schedule completed, cancelled, rescheduled, or in the future: auto-resolve
    if (existingSignal) {
      const updated = await prisma.care_signals.update({
        where: { id: existingSignal.id },
        data: {
          status: 'RESOLVED',
          resolved_at: now,
          updated_at: now
        }
      });

      await prisma.care_signal_actions.create({
        data: {
          id: randomUUID(),
          care_signal_id: existingSignal.id,
          actor_user_id: schedule.user_id,
          action_type: 'RESOLVED',
          occurred_at: now
        }
      });

      await recordAuditLog(prisma, {
        actorUserId: schedule.user_id,
        action: 'CARE_SIGNAL_RESOLVED',
        entityType: 'care_signal',
        entityId: updated.id,
        meta: {
          public_id: updated.public_id,
          signal_type: updated.signal_type,
          resolution_reason: 'SCHEDULE_FINALIZED_OR_UPDATED'
        }
      });

      return updated;
    }
  }

  return null;
}

export async function syncRefillStockSignal(patientUserId: string) {
  // Query latest stock
  const latestStock = await prisma.art_medication_stocks.findFirst({
    where: { patient_user_id: patientUserId },
    orderBy: { recorded_at: 'desc' }
  });

  const estimatedDays =
    latestStock?.estimated_days_remaining !== null && latestStock?.estimated_days_remaining !== undefined
      ? Number(latestStock.estimated_days_remaining)
      : null;

  // Trigger only when estimated days <= 0 (NEEDS_ATTENTION)
  // Do NOT escalate DUE_SOON automatically!
  const isNeedsAttention = estimatedDays !== null && estimatedDays <= 0;

  const existingSignal = await prisma.care_signals.findFirst({
    where: {
      patient_id: patientUserId,
      signal_type: 'REFILL_NEEDS_ATTENTION',
      status: { in: ['OPEN', 'ACKNOWLEDGED'] }
    }
  });

  if (isNeedsAttention) {
    if (!existingSignal) {
      const newSignal = await prisma.care_signals.create({
        data: {
          id: randomUUID(),
          patient_id: patientUserId,
          signal_type: 'REFILL_NEEDS_ATTENTION',
          signal_scope: 'SUPPORT',
          priority: 'ATTENTION',
          status: 'OPEN',
          source_type: 'REFILL_STOCK',
          source_id: latestStock?.id || null,
          detected_at: latestStock?.recorded_at || new Date(),
          metadata: {
            refill_status: 'NEEDS_ATTENTION'
          }
        }
      });

      await recordAuditLog(prisma, {
        actorUserId: patientUserId,
        action: 'CARE_SIGNAL_CREATED',
        entityType: 'care_signal',
        entityId: newSignal.id,
        meta: {
          public_id: newSignal.public_id,
          signal_type: newSignal.signal_type,
          signal_scope: newSignal.signal_scope,
          priority: newSignal.priority
        }
      });

      return newSignal;
    }
    return existingSignal;
  } else {
    // If latest patient-reported stock state moves away from NEEDS_ATTENTION: auto-resolve
    if (existingSignal) {
      const now = new Date();
      const updated = await prisma.care_signals.update({
        where: { id: existingSignal.id },
        data: {
          status: 'RESOLVED',
          resolved_at: now,
          updated_at: now
        }
      });

      await prisma.care_signal_actions.create({
        data: {
          id: randomUUID(),
          care_signal_id: existingSignal.id,
          actor_user_id: patientUserId,
          action_type: 'RESOLVED',
          occurred_at: now
        }
      });

      await recordAuditLog(prisma, {
        actorUserId: patientUserId,
        action: 'CARE_SIGNAL_RESOLVED',
        entityType: 'care_signal',
        entityId: updated.id,
        meta: {
          public_id: updated.public_id,
          signal_type: updated.signal_type,
          resolution_reason: 'STOCK_RESTOCKED_OR_STABLE'
        }
      });

      return updated;
    }
  }

  return null;
}

export async function evaluateOverdueControlSchedules(now: Date = new Date()) {
  const overdueSchedules = await prisma.control_schedules.findMany({
    where: {
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      starts_at: { lt: now }
    },
    select: { id: true }
  });

  for (const s of overdueSchedules) {
    await syncControlScheduleSignal(s.id, now);
  }
}

// ==========================================
// PATIENT WORKFLOWS
// ==========================================

export async function getPatientCareSignals(patientUserId: string) {
  // Lazy evaluation: evaluate overdue control schedules for this patient
  const now = new Date();
  const schedules = await prisma.control_schedules.findMany({
    where: {
      user_id: patientUserId,
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      starts_at: { lt: now }
    },
    select: { id: true }
  });

  for (const s of schedules) {
    await syncControlScheduleSignal(s.id, now);
  }

  return prisma.care_signals.findMany({
    where: {
      patient_id: patientUserId,
      status: { in: ['OPEN', 'ACKNOWLEDGED'] }
    },
    orderBy: [
      { priority: 'desc' },
      { detected_at: 'desc' }
    ]
  });
}

export async function requestPatientClinicalContact(input: {
  patientUserId: string;
  category?: 'GENERAL_HEALTH_SUPPORT' | 'MEDICATION_QUESTION' | 'FOLLOW_UP_HELP' | 'OTHER';
  preferredContactTime?: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'ANYTIME';
  correlationId?: string;
}) {
  const existing = await prisma.care_signals.findFirst({
    where: {
      patient_id: input.patientUserId,
      signal_type: 'PATIENT_REQUESTED_CLINICAL_CONTACT',
      status: { in: ['OPEN', 'ACKNOWLEDGED'] }
    }
  });

  if (existing) {
    return existing;
  }

  const signal = await prisma.care_signals.create({
    data: {
      id: randomUUID(),
      patient_id: input.patientUserId,
      signal_type: 'PATIENT_REQUESTED_CLINICAL_CONTACT',
      signal_scope: 'CLINICAL',
      priority: 'PRIORITY',
      status: 'OPEN',
      source_type: 'PATIENT_REQUEST',
      source_id: null,
      detected_at: new Date(),
      metadata: {
        category: input.category || 'GENERAL_HEALTH_SUPPORT',
        preferred_contact_time: input.preferredContactTime || 'ANYTIME'
      }
    }
  });

  await recordAuditLog(prisma, {
    actorUserId: input.patientUserId,
    action: 'PATIENT_CLINICAL_CONTACT_REQUESTED',
    entityType: 'care_signal',
    entityId: signal.id,
    meta: {
      public_id: signal.public_id,
      category: input.category || 'GENERAL_HEALTH_SUPPORT',
      correlation_id: input.correlationId
    }
  });

  await recordAuditLog(prisma, {
    actorUserId: input.patientUserId,
    action: 'CARE_SIGNAL_CREATED',
    entityType: 'care_signal',
    entityId: signal.id,
    meta: {
      public_id: signal.public_id,
      signal_type: signal.signal_type,
      signal_scope: signal.signal_scope,
      priority: signal.priority
    }
  });

  return signal;
}

export async function requestPatientCompanionSupport(input: {
  patientUserId: string;
  preferredContactTime?: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'ANYTIME';
  correlationId?: string;
}) {
  // Requires active companion assignment
  const assignment = await prisma.patient_companion_assignments.findFirst({
    where: {
      patient_user_id: input.patientUserId,
      status: 'ACTIVE'
    }
  });

  if (!assignment) {
    throw new CareSignalError('Anda belum memiliki pendamping aktif yang terhubung', 400);
  }

  // Requires follow-up support sharing consent defined in AG-07
  const consent = await prisma.care_follow_up_support_consents.findUnique({
    where: { patient_id: input.patientUserId }
  });

  if (!consent || !consent.is_consent_enabled) {
    throw new CareSignalError('Aktifkan izin dukungan tindak lanjut pendamping terlebih dahulu', 400);
  }

  const existing = await prisma.care_signals.findFirst({
    where: {
      patient_id: input.patientUserId,
      signal_type: 'PATIENT_REQUESTED_COMPANION_SUPPORT',
      status: { in: ['OPEN', 'ACKNOWLEDGED'] }
    }
  });

  if (existing) {
    return existing;
  }

  const signal = await prisma.care_signals.create({
    data: {
      id: randomUUID(),
      patient_id: input.patientUserId,
      signal_type: 'PATIENT_REQUESTED_COMPANION_SUPPORT',
      signal_scope: 'SUPPORT',
      priority: 'ATTENTION',
      status: 'OPEN',
      source_type: 'PATIENT_REQUEST',
      source_id: null,
      detected_at: new Date(),
      metadata: {
        preferred_contact_time: input.preferredContactTime || 'ANYTIME'
      }
    }
  });

  await recordAuditLog(prisma, {
    actorUserId: input.patientUserId,
    action: 'PATIENT_COMPANION_SUPPORT_REQUESTED',
    entityType: 'care_signal',
    entityId: signal.id,
    meta: {
      public_id: signal.public_id,
      correlation_id: input.correlationId
    }
  });

  await recordAuditLog(prisma, {
    actorUserId: input.patientUserId,
    action: 'CARE_SIGNAL_CREATED',
    entityType: 'care_signal',
    entityId: signal.id,
    meta: {
      public_id: signal.public_id,
      signal_type: signal.signal_type,
      signal_scope: signal.signal_scope,
      priority: signal.priority
    }
  });

  return signal;
}

export async function getPatientFollowUpSupportConsent(patientUserId: string) {
  const consent = await prisma.care_follow_up_support_consents.findUnique({
    where: { patient_id: patientUserId }
  });
  return consent || { is_consent_enabled: false, consented_at: null, revoked_at: null, updated_at: null };
}

export async function updatePatientFollowUpSupportConsent(input: {
  patientUserId: string;
  isConsentEnabled: boolean;
  correlationId?: string;
}) {
  const now = new Date();
  const consent = await prisma.care_follow_up_support_consents.upsert({
    where: { patient_id: input.patientUserId },
    create: {
      id: randomUUID(),
      patient_id: input.patientUserId,
      is_consent_enabled: input.isConsentEnabled,
      consented_at: input.isConsentEnabled ? now : null,
      revoked_at: !input.isConsentEnabled ? now : null,
      created_at: now,
      updated_at: now
    },
    update: {
      is_consent_enabled: input.isConsentEnabled,
      consented_at: input.isConsentEnabled ? now : undefined,
      revoked_at: !input.isConsentEnabled ? now : null,
      updated_at: now
    }
  });

  await recordAuditLog(prisma, {
    actorUserId: input.patientUserId,
    action: input.isConsentEnabled
      ? 'FOLLOW_UP_SUPPORT_CONSENT_GRANTED'
      : 'FOLLOW_UP_SUPPORT_CONSENT_REVOKED',
    entityType: 'care_follow_up_support_consent',
    entityId: consent.id,
    meta: {
      is_consent_enabled: consent.is_consent_enabled,
      correlation_id: input.correlationId
    }
  });

  return consent;
}

// ==========================================
// DOCTOR WORKFLOWS & CLINICAL QUEUES
// ==========================================

export async function getDoctorScopedPatientIds(doctorUserId: string): Promise<string[]> {
  const [consultationPatients, schedulePatients] = await Promise.all([
    prisma.consultations.findMany({
      where: { assignedDoctorId: doctorUserId },
      select: { patient_id: true }
    }),
    prisma.control_schedules.findMany({
      where: { worker_id: doctorUserId },
      select: { user_id: true }
    })
  ]);

  const set = new Set<string>();
  for (const c of consultationPatients) set.add(c.patient_id);
  for (const s of schedulePatients) set.add(s.user_id);
  return Array.from(set);
}

export async function getDoctorCareSignals(input: {
  doctorUserId: string;
  status?: 'ALL' | 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';
  scope?: 'ALL' | 'CLINICAL' | 'SUPPORT';
  limit?: number;
  offset?: number;
}) {
  const patientIds = await getDoctorScopedPatientIds(input.doctorUserId);
  if (patientIds.length === 0) {
    return [];
  }

  // Lazy evaluation: evaluate overdue control schedules for scoped patients
  const now = new Date();
  const schedules = await prisma.control_schedules.findMany({
    where: {
      user_id: { in: patientIds },
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      starts_at: { lt: now }
    },
    select: { id: true }
  });

  for (const s of schedules) {
    await syncControlScheduleSignal(s.id, now);
  }

  const where: any = {
    patient_id: { in: patientIds }
  };

  if (input.status && input.status !== 'ALL') {
    where.status = input.status;
  } else if (!input.status) {
    where.status = { in: ['OPEN', 'ACKNOWLEDGED'] };
  }

  if (input.scope && input.scope !== 'ALL') {
    where.signal_scope = input.scope;
  }

  return prisma.care_signals.findMany({
    where,
    orderBy: [
      { priority: 'desc' },
      { detected_at: 'asc' }
    ],
    take: input.limit ?? 50,
    skip: input.offset ?? 0,
    include: {
      patient: {
        select: {
          id: true,
          public_id: true,
          display_alias: true
        }
      },
      actions: {
        orderBy: { occurred_at: 'desc' },
        include: {
          actor: {
            select: {
              id: true,
              public_id: true,
              display_alias: true,
              role: true
            }
          }
        }
      }
    }
  });
}

export async function getDoctorPatientCareSignals(input: {
  doctorUserId: string;
  patientIdentifier: string;
}) {
  const patient = await resolveUser(input.patientIdentifier);
  if (!patient || patient.role !== 'PASIEN') {
    throw new CareSignalError('Pasien tidak ditemukan', 404);
  }

  const hasRel = await hasDoctorPatientRelationship(input.doctorUserId, patient.id);
  if (!hasRel) {
    throw new CareSignalError('Tidak memiliki relasi klinis sah dengan pasien ini', 403);
  }

  const now = new Date();
  const schedules = await prisma.control_schedules.findMany({
    where: {
      user_id: patient.id,
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      starts_at: { lt: now }
    },
    select: { id: true }
  });

  for (const s of schedules) {
    await syncControlScheduleSignal(s.id, now);
  }

  return prisma.care_signals.findMany({
    where: { patient_id: patient.id },
    orderBy: [
      { priority: 'desc' },
      { detected_at: 'asc' }
    ],
    include: {
      patient: {
        select: {
          id: true,
          public_id: true,
          display_alias: true
        }
      },
      actions: {
        orderBy: { occurred_at: 'desc' },
        include: {
          actor: {
            select: {
              id: true,
              public_id: true,
              display_alias: true,
              role: true
            }
          }
        }
      }
    }
  });
}

export async function updateDoctorSignalStatus(input: {
  doctorUserId: string;
  signalIdentifier: string;
  status: 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';
  correlationId?: string;
}) {
  const signal = await resolveCareSignal(input.signalIdentifier);
  if (!signal) {
    throw new CareSignalError('Sinyal tindak lanjut tidak ditemukan', 404);
  }

  const hasRel = await hasDoctorPatientRelationship(input.doctorUserId, signal.patient_id);
  if (!hasRel) {
    throw new CareSignalError('Tidak memiliki otorisasi klinis untuk pasien ini', 403);
  }

  // Allowed transitions:
  // OPEN -> ACKNOWLEDGED
  // OPEN -> RESOLVED
  // OPEN -> DISMISSED
  // ACKNOWLEDGED -> RESOLVED
  // ACKNOWLEDGED -> DISMISSED
  if (['RESOLVED', 'DISMISSED'].includes(signal.status)) {
    throw new CareSignalError('Sinyal sudah berstatus final dan tidak dapat diubah', 409);
  }

  if (signal.status === input.status) {
    return signal;
  }

  const now = new Date();
  const updateData: any = {
    status: input.status,
    updated_at: now
  };

  if (input.status === 'ACKNOWLEDGED') {
    updateData.acknowledged_at = now;
    updateData.acknowledged_by = input.doctorUserId;
  } else if (input.status === 'RESOLVED') {
    updateData.resolved_at = now;
    updateData.resolved_by = input.doctorUserId;
  } else if (input.status === 'DISMISSED') {
    updateData.dismissed_at = now;
    updateData.dismissed_by = input.doctorUserId;
  }

  const updated = await prisma.care_signals.update({
    where: { id: signal.id },
    data: updateData,
    include: {
      patient: { select: { id: true, public_id: true, display_alias: true } },
      actions: {
        orderBy: { occurred_at: 'desc' },
        include: {
          actor: { select: { id: true, public_id: true, display_alias: true, role: true } }
        }
      }
    }
  });

  await prisma.care_signal_actions.create({
    data: {
      id: randomUUID(),
      care_signal_id: signal.id,
      actor_user_id: input.doctorUserId,
      action_type: input.status,
      occurred_at: now
    }
  });

  let auditAction = 'CARE_SIGNAL_ACKNOWLEDGED';
  if (input.status === 'RESOLVED') auditAction = 'CARE_SIGNAL_RESOLVED';
  else if (input.status === 'DISMISSED') auditAction = 'CARE_SIGNAL_DISMISSED';

  await recordAuditLog(prisma, {
    actorUserId: input.doctorUserId,
    action: auditAction,
    entityType: 'care_signal',
    entityId: signal.id,
    meta: {
      public_id: signal.public_id,
      from_status: signal.status,
      to_status: input.status,
      correlation_id: input.correlationId
    }
  });

  return updated;
}

export async function recordDoctorSignalAction(input: {
  doctorUserId: string;
  signalIdentifier: string;
  actionType:
    | 'ACKNOWLEDGED'
    | 'CONTACT_ATTEMPTED'
    | 'CONTACTED'
    | 'FOLLOW_UP_SCHEDULED'
    | 'ESCALATED_TO_CLINICAL'
    | 'RESOLVED'
    | 'DISMISSED';
  nextFollowUpAt?: string | null;
  correlationId?: string;
}) {
  const signal = await resolveCareSignal(input.signalIdentifier);
  if (!signal) {
    throw new CareSignalError('Sinyal tindak lanjut tidak ditemukan', 404);
  }

  const hasRel = await hasDoctorPatientRelationship(input.doctorUserId, signal.patient_id);
  if (!hasRel) {
    throw new CareSignalError('Tidak memiliki otorisasi klinis untuk pasien ini', 403);
  }

  const now = new Date();
  const nextFollowUpDate = input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : null;

  const action = await prisma.care_signal_actions.create({
    data: {
      id: randomUUID(),
      care_signal_id: signal.id,
      actor_user_id: input.doctorUserId,
      action_type: input.actionType,
      occurred_at: now,
      next_follow_up_at: nextFollowUpDate
    }
  });

  // State synchronization based on action
  let newStatus = signal.status;
  const updateData: any = { updated_at: now };

  if (input.actionType === 'RESOLVED' && signal.status !== 'RESOLVED') {
    newStatus = 'RESOLVED';
    updateData.status = 'RESOLVED';
    updateData.resolved_at = now;
    updateData.resolved_by = input.doctorUserId;
  } else if (input.actionType === 'DISMISSED' && signal.status !== 'DISMISSED') {
    newStatus = 'DISMISSED';
    updateData.status = 'DISMISSED';
    updateData.dismissed_at = now;
    updateData.dismissed_by = input.doctorUserId;
  } else if (input.actionType === 'ACKNOWLEDGED' && signal.status === 'OPEN') {
    newStatus = 'ACKNOWLEDGED';
    updateData.status = 'ACKNOWLEDGED';
    updateData.acknowledged_at = now;
    updateData.acknowledged_by = input.doctorUserId;
  }

  if (newStatus !== signal.status) {
    await prisma.care_signals.update({
      where: { id: signal.id },
      data: updateData
    });
  }

  let auditEvent = 'CARE_FOLLOW_UP_CONTACT_ATTEMPTED';
  if (input.actionType === 'CONTACTED') auditEvent = 'CARE_FOLLOW_UP_CONTACTED';
  else if (input.actionType === 'FOLLOW_UP_SCHEDULED') auditEvent = 'CARE_FOLLOW_UP_SCHEDULED';
  else if (input.actionType === 'ESCALATED_TO_CLINICAL') auditEvent = 'CARE_ESCALATED_TO_CLINICAL';
  else if (input.actionType === 'ACKNOWLEDGED') auditEvent = 'CARE_SIGNAL_ACKNOWLEDGED';
  else if (input.actionType === 'RESOLVED') auditEvent = 'CARE_SIGNAL_RESOLVED';
  else if (input.actionType === 'DISMISSED') auditEvent = 'CARE_SIGNAL_DISMISSED';

  await recordAuditLog(prisma, {
    actorUserId: input.doctorUserId,
    action: auditEvent,
    entityType: 'care_signal',
    entityId: signal.id,
    meta: {
      public_id: signal.public_id,
      action_id: action.id,
      action_type: input.actionType,
      correlation_id: input.correlationId
    }
  });

  return resolveCareSignal(signal.id);
}

// ==========================================
// COMPANION WORKFLOWS & SUPPORT QUEUES
// ==========================================

export async function getCompanionFollowUpSignals(input: {
  companionUserId: string;
  limit?: number;
  offset?: number;
}) {
  // Find active companion assignments
  const activeAssignments = await prisma.patient_companion_assignments.findMany({
    where: {
      companion_user_id: input.companionUserId,
      status: 'ACTIVE'
    },
    select: { patient_user_id: true }
  });

  if (activeAssignments.length === 0) {
    return [];
  }

  const patientIds = activeAssignments.map((a) => a.patient_user_id);

  // Lazy evaluation: evaluate overdue control schedules for assigned patients
  const now = new Date();
  const schedules = await prisma.control_schedules.findMany({
    where: {
      user_id: { in: patientIds },
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      starts_at: { lt: now }
    },
    select: { id: true }
  });

  for (const s of schedules) {
    await syncControlScheduleSignal(s.id, now);
  }

  // Get consent states for these patients
  const [followUpConsents, refillConsents] = await Promise.all([
    prisma.care_follow_up_support_consents.findMany({
      where: {
        patient_id: { in: patientIds },
        is_consent_enabled: true
      },
      select: { patient_id: true }
    }),
    prisma.art_refill_support_consents.findMany({
      where: {
        patient_user_id: { in: patientIds },
        is_consent_enabled: true
      },
      select: { patient_user_id: true }
    })
  ]);

  const followUpConsentPatientIds = new Set(followUpConsents.map((c) => c.patient_id));
  const refillConsentPatientIds = new Set(refillConsents.map((c) => c.patient_user_id));

  // Build condition for support-safe signals allowed per patient consent
  // 1. FOLLOW_UP_OVERDUE or PATIENT_REQUESTED_COMPANION_SUPPORT: allowed if follow-up consent enabled
  // 2. REFILL_NEEDS_ATTENTION: allowed if refill consent enabled
  // Strictly EXCLUDE SEVERE_SIDE_EFFECT_REPORTED and PATIENT_REQUESTED_CLINICAL_CONTACT!
  const permittedQueries = [];

  if (followUpConsentPatientIds.size > 0) {
    permittedQueries.push({
      patient_id: { in: Array.from(followUpConsentPatientIds) },
      signal_type: { in: ['FOLLOW_UP_OVERDUE', 'PATIENT_REQUESTED_COMPANION_SUPPORT'] as any }
    });
  }

  if (refillConsentPatientIds.size > 0) {
    permittedQueries.push({
      patient_id: { in: Array.from(refillConsentPatientIds) },
      signal_type: 'REFILL_NEEDS_ATTENTION' as any
    });
  }

  if (permittedQueries.length === 0) {
    return [];
  }

  return prisma.care_signals.findMany({
    where: {
      status: { in: ['OPEN', 'ACKNOWLEDGED'] },
      OR: permittedQueries
    },
    orderBy: [
      { priority: 'desc' },
      { detected_at: 'asc' }
    ],
    take: input.limit ?? 50,
    skip: input.offset ?? 0,
    include: {
      patient: {
        select: {
          id: true,
          public_id: true,
          display_alias: true
        }
      },
      actions: {
        orderBy: { occurred_at: 'desc' },
        include: {
          actor: {
            select: {
              id: true,
              public_id: true,
              display_alias: true,
              role: true
            }
          }
        }
      }
    }
  });
}

export async function getCompanionPatientFollowUpSignals(input: {
  companionUserId: string;
  patientIdentifier: string;
}) {
  const patient = await resolveUser(input.patientIdentifier);
  if (!patient || patient.role !== 'PASIEN') {
    throw new CareSignalError('Pasien tidak ditemukan', 404);
  }

  // Verify active longitudinal companion assignment
  const assignment = await prisma.patient_companion_assignments.findFirst({
    where: {
      companion_user_id: input.companionUserId,
      patient_user_id: patient.id,
      status: 'ACTIVE'
    }
  });

  if (!assignment) {
    throw new CareSignalError('Anda tidak memiliki penugasan aktif untuk pasien ini', 403);
  }

  const [followUpConsent, refillConsent] = await Promise.all([
    prisma.care_follow_up_support_consents.findUnique({
      where: { patient_id: patient.id }
    }),
    prisma.art_refill_support_consents.findUnique({
      where: { patient_user_id: patient.id }
    })
  ]);

  const followUpEnabled = Boolean(followUpConsent?.is_consent_enabled);
  const refillEnabled = Boolean(refillConsent?.is_consent_enabled);

  const allowedTypes: string[] = [];
  if (followUpEnabled) {
    allowedTypes.push('FOLLOW_UP_OVERDUE', 'PATIENT_REQUESTED_COMPANION_SUPPORT');
  }
  if (refillEnabled) {
    allowedTypes.push('REFILL_NEEDS_ATTENTION');
  }

  if (allowedTypes.length === 0) {
    return [];
  }

  return prisma.care_signals.findMany({
    where: {
      patient_id: patient.id,
      status: { in: ['OPEN', 'ACKNOWLEDGED'] },
      signal_type: { in: allowedTypes as any }
    },
    orderBy: [
      { priority: 'desc' },
      { detected_at: 'asc' }
    ],
    include: {
      patient: {
        select: {
          id: true,
          public_id: true,
          display_alias: true
        }
      },
      actions: {
        orderBy: { occurred_at: 'desc' },
        include: {
          actor: {
            select: {
              id: true,
              public_id: true,
              display_alias: true,
              role: true
            }
          }
        }
      }
    }
  });
}

export async function recordCompanionSignalAction(input: {
  companionUserId: string;
  signalIdentifier: string;
  actionType:
    | 'ACKNOWLEDGED'
    | 'CONTACT_ATTEMPTED'
    | 'CONTACTED'
    | 'FOLLOW_UP_SCHEDULED'
    | 'ESCALATED_TO_CLINICAL';
  nextFollowUpAt?: string | null;
  correlationId?: string;
}) {
  const signal = await resolveCareSignal(input.signalIdentifier);
  if (!signal) {
    throw new CareSignalError('Sinyal tindak lanjut tidak ditemukan', 404);
  }

  // Companion must NEVER receive or act on clinical signals like SEVERE_SIDE_EFFECT_REPORTED
  // or PATIENT_REQUESTED_CLINICAL_CONTACT
  if (
    signal.signal_type === 'SEVERE_SIDE_EFFECT_REPORTED' ||
    signal.signal_type === 'PATIENT_REQUESTED_CLINICAL_CONTACT'
  ) {
    throw new CareSignalError('Sinyal tindak lanjut tidak ditemukan', 404);
  }

  // Verify active longitudinal companion assignment
  const assignment = await prisma.patient_companion_assignments.findFirst({
    where: {
      companion_user_id: input.companionUserId,
      patient_user_id: signal.patient_id,
      status: 'ACTIVE'
    }
  });

  if (!assignment) {
    throw new CareSignalError('Anda tidak memiliki penugasan aktif untuk pasien ini', 403);
  }

  // Verify consent for the signal type
  if (
    signal.signal_type === 'FOLLOW_UP_OVERDUE' ||
    signal.signal_type === 'PATIENT_REQUESTED_COMPANION_SUPPORT'
  ) {
    const consent = await prisma.care_follow_up_support_consents.findUnique({
      where: { patient_id: signal.patient_id }
    });
    if (!consent || !consent.is_consent_enabled) {
      throw new CareSignalError('Izin dukungan tindak lanjut tidak aktif untuk pasien ini', 403);
    }
  } else if (signal.signal_type === 'REFILL_NEEDS_ATTENTION') {
    const consent = await prisma.art_refill_support_consents.findUnique({
      where: { patient_user_id: signal.patient_id }
    });
    if (!consent || !consent.is_consent_enabled) {
      throw new CareSignalError('Izin dukungan persediaan tidak aktif untuk pasien ini', 403);
    }
  }

  // Companion cannot resolve or dismiss clinical signals
  if ((input.actionType as any) === 'RESOLVED' || (input.actionType as any) === 'DISMISSED') {
    throw new CareSignalError('Pendamping tidak memiliki wewenang menyelesaikan sinyal klinis', 403);
  }

  const now = new Date();
  const nextFollowUpDate = input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : null;

  const action = await prisma.care_signal_actions.create({
    data: {
      id: randomUUID(),
      care_signal_id: signal.id,
      actor_user_id: input.companionUserId,
      action_type: input.actionType,
      occurred_at: now,
      next_follow_up_at: nextFollowUpDate
    }
  });

  const updateData: any = { updated_at: now };

  if (input.actionType === 'ACKNOWLEDGED' && signal.status === 'OPEN') {
    updateData.status = 'ACKNOWLEDGED';
    updateData.acknowledged_at = now;
    updateData.acknowledged_by = input.companionUserId;
  }

  if (input.actionType === 'ESCALATED_TO_CLINICAL') {
    // Escalate to clinical scope and raise priority to PRIORITY
    updateData.signal_scope = 'CLINICAL';
    updateData.priority = 'PRIORITY';
  }

  await prisma.care_signals.update({
    where: { id: signal.id },
    data: updateData
  });

  let auditEvent = 'CARE_FOLLOW_UP_CONTACT_ATTEMPTED';
  if (input.actionType === 'CONTACTED') auditEvent = 'CARE_FOLLOW_UP_CONTACTED';
  else if (input.actionType === 'FOLLOW_UP_SCHEDULED') auditEvent = 'CARE_FOLLOW_UP_SCHEDULED';
  else if (input.actionType === 'ESCALATED_TO_CLINICAL') auditEvent = 'CARE_ESCALATED_TO_CLINICAL';
  else if (input.actionType === 'ACKNOWLEDGED') auditEvent = 'CARE_SIGNAL_ACKNOWLEDGED';

  await recordAuditLog(prisma, {
    actorUserId: input.companionUserId,
    action: auditEvent,
    entityType: 'care_signal',
    entityId: signal.id,
    meta: {
      public_id: signal.public_id,
      action_id: action.id,
      action_type: input.actionType,
      correlation_id: input.correlationId
    }
  });

  return resolveCareSignal(signal.id);
}

// ==========================================
// ADMIN GOVERNANCE SUMMARY (AGGREGATE ONLY)
// ==========================================

export async function getAdminCareSignalsSummary() {
  const [openCount, ackCount, resolvedCount, allSignals] = await Promise.all([
    prisma.care_signals.count({ where: { status: 'OPEN' } }),
    prisma.care_signals.count({ where: { status: 'ACKNOWLEDGED' } }),
    prisma.care_signals.count({ where: { status: 'RESOLVED' } }),
    prisma.care_signals.findMany({
      where: { status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
      select: {
        signal_type: true,
        signal_scope: true,
        priority: true
      }
    })
  ]);

  const byType: Record<string, number> = {};
  const byScope: Record<string, number> = {};
  const byPriority: Record<string, number> = {};

  for (const s of allSignals) {
    byType[s.signal_type] = (byType[s.signal_type] || 0) + 1;
    byScope[s.signal_scope] = (byScope[s.signal_scope] || 0) + 1;
    byPriority[s.priority] = (byPriority[s.priority] || 0) + 1;
  }

  return {
    total_open: openCount,
    total_acknowledged: ackCount,
    total_resolved: resolvedCount,
    by_type: byType,
    by_scope: byScope,
    by_priority: byPriority
  };
}
