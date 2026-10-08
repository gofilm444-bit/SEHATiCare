import { randomUUID } from 'node:crypto';
import { prisma } from '../../db/prisma';
import { recordAuditLog } from '../../utils/audit';
import { hasDoctorPatientRelationship } from './hivCare.service';
import { computeRefillStatus } from './artCare.presenter';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ArtCareError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'ArtCareError';
  }
}

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

export async function resolveArtCarePlan(identifier: string) {
  if (!identifier) return null;
  const isUuid = UUID_REGEX.test(identifier);
  return prisma.art_care_plans.findFirst({
    where: isUuid ? { id: identifier } : { public_id: identifier },
    include: {
      items: true,
      patient: { select: { id: true, public_id: true, display_alias: true } }
    }
  });
}

export async function getPatientActiveArtCarePlan(patientUserId: string) {
  return prisma.art_care_plans.findFirst({
    where: {
      patient_user_id: patientUserId,
      status: 'ACTIVE'
    },
    include: {
      prescribed_by: {
        select: {
          id: true,
          public_id: true,
          display_alias: true
        }
      },
      items: {
        where: { is_active: true },
        include: {
          reminders: {
            where: { deleted_at: null },
            include: { times: true }
          }
        }
      }
    }
  });
}

export async function getPatientArtCarePlanHistory(patientUserId: string) {
  return prisma.art_care_plans.findMany({
    where: {
      patient_user_id: patientUserId,
      status: { not: 'ACTIVE' }
    },
    orderBy: { started_at: 'desc' },
    include: {
      prescribed_by: {
        select: {
          id: true,
          public_id: true,
          display_alias: true
        }
      },
      items: true
    }
  });
}

export async function createDoctorArtCarePlan(input: {
  doctorUserId: string;
  patientUserId: string;
  data: {
    items: Array<{
      medication_name: string;
      strength?: string | null;
      dose_instructions?: string | null;
      frequency_per_day?: number;
      timing_description?: string | null;
      is_active?: boolean;
    }>;
    clinical_notes?: string | null;
    change_reason?: string | null;
    started_at?: string;
  };
  correlationId?: string;
}) {
  const hasRel = await hasDoctorPatientRelationship(input.doctorUserId, input.patientUserId);
  if (!hasRel) {
    throw new ArtCareError('Tidak memiliki relasi klinis sah dengan pasien ini', 403);
  }

  // Active HIV Care enrollment check
  const enrollment = await prisma.hiv_care_enrollments.findFirst({
    where: {
      patient_user_id: input.patientUserId,
      status: 'ACTIVE'
    }
  });

  if (!enrollment) {
    throw new ArtCareError('Pasien belum memiliki pendaftaran perawatan HIV yang aktif', 400);
  }

  const now = new Date();
  const planId = randomUUID();

  const createdPlan = await prisma.$transaction(async (tx) => {
    // Check if patient already has an active ART care plan
    const existingActive = await tx.art_care_plans.findFirst({
      where: {
        patient_user_id: input.patientUserId,
        status: 'ACTIVE'
      }
    });

    if (existingActive) {
      // Safely transition previous active plan to MODIFIED without destroying history
      await tx.art_care_plans.update({
        where: { id: existingActive.id },
        data: {
          status: 'MODIFIED',
          ended_at: now,
          change_reason: input.data.change_reason?.trim() || 'Pembaruan rejimen ART oleh dokter',
          updated_at: now
        }
      });
    }

    // Create the new active ART care plan and its items
    const newPlan = await tx.art_care_plans.create({
      data: {
        id: planId,
        patient_user_id: input.patientUserId,
        enrollment_id: enrollment.id,
        prescribed_by_doctor_id: input.doctorUserId,
        status: 'ACTIVE',
        started_at: input.data.started_at ? new Date(input.data.started_at) : now,
        clinical_notes: input.data.clinical_notes?.trim() || null,
        change_reason: input.data.change_reason?.trim() || null,
        created_at: now,
        updated_at: now,
        items: {
          create: input.data.items.map((item) => ({
            id: randomUUID(),
            medication_name: item.medication_name.trim(),
            strength: item.strength?.trim() || null,
            dose_instructions: item.dose_instructions?.trim() || null,
            frequency_per_day: item.frequency_per_day || 1,
            timing_description: item.timing_description?.trim() || null,
            is_active: item.is_active !== undefined ? item.is_active : true,
            created_at: now,
            updated_at: now
          }))
        }
      },
      include: {
        items: true,
        patient: { select: { id: true, public_id: true, display_alias: true } }
      }
    });

    return newPlan;
  });

  // Privacy-safe audit: non-sensitive metadata only (identifiers, status, items count)
  await recordAuditLog(prisma, {
    actorUserId: input.doctorUserId,
    action: 'ART_CARE_PLAN_CREATED',
    entityType: 'art_care_plan',
    entityId: createdPlan.id,
    meta: {
      plan_public_id: createdPlan.public_id,
      patient_user_id: input.patientUserId,
      items_count: input.data.items.length,
      correlation_id: input.correlationId
    }
  });

  return createdPlan;
}

export async function updateDoctorArtCarePlan(input: {
  doctorUserId: string;
  patientUserId: string;
  planIdentifier: string;
  data: {
    status?: 'ACTIVE' | 'MODIFIED' | 'DISCONTINUED' | 'COMPLETED';
    clinical_notes?: string | null;
    change_reason?: string | null;
    ended_at?: string | null;
  };
  correlationId?: string;
}) {
  const hasRel = await hasDoctorPatientRelationship(input.doctorUserId, input.patientUserId);
  if (!hasRel) {
    throw new ArtCareError('Tidak memiliki relasi klinis sah dengan pasien ini', 403);
  }

  const plan = await resolveArtCarePlan(input.planIdentifier);
  if (!plan) {
    throw new ArtCareError('Rencana perawatan ART tidak ditemukan', 404);
  }

  if (plan.patient_user_id !== input.patientUserId) {
    throw new ArtCareError('Rencana perawatan ART bukan milik pasien ini', 403);
  }

  const now = new Date();
  const updateData: any = {
    updated_at: now
  };

  if (input.data.status) {
    updateData.status = input.data.status;
    if (['MODIFIED', 'DISCONTINUED', 'COMPLETED'].includes(input.data.status) && !plan.ended_at) {
      updateData.ended_at = input.data.ended_at ? new Date(input.data.ended_at) : now;
    }
  }

  if (input.data.clinical_notes !== undefined) {
    updateData.clinical_notes = input.data.clinical_notes?.trim() || null;
  }

  if (input.data.change_reason !== undefined) {
    updateData.change_reason = input.data.change_reason?.trim() || null;
  }

  if (input.data.ended_at !== undefined) {
    updateData.ended_at = input.data.ended_at ? new Date(input.data.ended_at) : null;
  }

  const updatedPlan = await prisma.art_care_plans.update({
    where: { id: plan.id },
    data: updateData,
    include: {
      items: true,
      patient: { select: { id: true, public_id: true, display_alias: true } }
    }
  });

  await recordAuditLog(prisma, {
    actorUserId: input.doctorUserId,
    action: 'ART_CARE_PLAN_UPDATED',
    entityType: 'art_care_plan',
    entityId: updatedPlan.id,
    meta: {
      plan_public_id: updatedPlan.public_id,
      patient_user_id: input.patientUserId,
      new_status: updatedPlan.status,
      correlation_id: input.correlationId
    }
  });

  return updatedPlan;
}

export async function calculateAdherenceStats(patientUserId: string, days: number = 7) {
  const now = new Date();
  const pastDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const occurrences = await prisma.medication_occurrences.groupBy({
    by: ['status'],
    where: {
      user_id: patientUserId,
      scheduled_at: {
        gte: pastDate,
        lte: now
      }
    },
    _count: { _all: true }
  });

  const counts: Record<string, number> = {};
  for (const row of occurrences) {
    counts[row.status] = row._count._all;
  }

  const dosesTaken = counts.TAKEN ?? 0;
  const dosesSkipped = counts.SKIPPED ?? 0;
  const dosesMissed = counts.MISSED ?? 0;
  const dosesPending = counts.PENDING ?? 0;
  const dosesSnoozed = counts.SNOOZED ?? 0;

  // Doses completed = TAKEN
  // Doses missed/skipped = SKIPPED + MISSED
  const nonCompleted = dosesSkipped + dosesMissed;
  const denominator = dosesTaken + nonCompleted;
  const totalScheduled = denominator + dosesPending + dosesSnoozed;

  const adherencePercentage =
    denominator > 0 ? Number(((dosesTaken / denominator) * 100).toFixed(1)) : null;

  // Upcoming non-clinical control schedule
  const nextControl = await prisma.control_schedules.findFirst({
    where: {
      user_id: patientUserId,
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      starts_at: { gte: now }
    },
    orderBy: { starts_at: 'asc' },
    select: {
      starts_at: true,
      timezone: true
    }
  });

  return {
    summary_period: `${days}_DAYS`,
    doses_scheduled: totalScheduled,
    doses_taken: dosesTaken,
    doses_missed: nonCompleted,
    adherence_percentage: adherencePercentage,
    upcoming_control_schedule: nextControl
      ? {
          starts_at: nextControl.starts_at.toISOString(),
          timezone: nextControl.timezone
        }
      : null
  };
}

export async function getPatientSupportConsent(patientUserId: string) {
  const consent = await prisma.art_adherence_support_consents.findUnique({
    where: { patient_user_id: patientUserId }
  });

  return (
    consent || {
      is_consent_enabled: false,
      consented_at: null,
      revoked_at: null,
      updated_at: new Date()
    }
  );
}

export async function updatePatientSupportConsent(
  patientUserId: string,
  isConsentEnabled: boolean,
  actorUserId: string,
  correlationId?: string
) {
  const now = new Date();

  const consent = await prisma.art_adherence_support_consents.upsert({
    where: { patient_user_id: patientUserId },
    create: {
      id: randomUUID(),
      patient_user_id: patientUserId,
      is_consent_enabled: isConsentEnabled,
      consented_at: isConsentEnabled ? now : null,
      revoked_at: isConsentEnabled ? null : now,
      created_at: now,
      updated_at: now
    },
    update: {
      is_consent_enabled: isConsentEnabled,
      consented_at: isConsentEnabled ? now : undefined,
      revoked_at: isConsentEnabled ? null : now,
      updated_at: now
    }
  });

  await recordAuditLog(prisma, {
    actorUserId,
    action: isConsentEnabled
      ? 'COMPANION_SUPPORT_CONSENT_ENABLED'
      : 'COMPANION_SUPPORT_CONSENT_REVOKED',
    entityType: 'art_adherence_support_consent',
    entityId: consent.id,
    meta: {
      patient_user_id: patientUserId,
      is_consent_enabled: isConsentEnabled,
      correlation_id: correlationId
    }
  });

  return consent;
}

export async function syncPatientReminderFromArtItem(input: {
  patientUserId: string;
  artItemId: string;
  displayLabel?: string;
  reminderTimes: string[];
  timezone?: string;
  notificationPrivacy?: 'NEUTRAL' | 'LABEL_IN_APP';
  isActive?: boolean;
}) {
  const item = await prisma.art_care_plan_items.findFirst({
    where: {
      id: input.artItemId,
      plan: {
        patient_user_id: input.patientUserId,
        status: 'ACTIVE'
      }
    }
  });

  if (!item) {
    throw new ArtCareError('Item rejimen ART aktif tidak ditemukan untuk pasien ini', 404);
  }

  const now = new Date();
  const label = input.displayLabel?.trim() || 'Pengingat Minum Obat';
  const tz = input.timezone || 'Asia/Jayapura';
  const privacy = input.notificationPrivacy || 'NEUTRAL';
  const active = input.isActive !== undefined ? input.isActive : true;

  // Check if reminder already linked to this item
  const existingReminder = await prisma.medication_reminders.findFirst({
    where: {
      user_id: input.patientUserId,
      art_plan_item_id: item.id,
      deleted_at: null
    },
    include: { times: true }
  });

  let reminderResult: any;

  if (existingReminder) {
    reminderResult = await prisma.$transaction(async (tx) => {
      await tx.medication_reminder_times.deleteMany({
        where: { reminder_id: existingReminder.id }
      });

      return tx.medication_reminders.update({
        where: { id: existingReminder.id },
        data: {
          display_label: label,
          is_active: active,
          timezone: tz,
          notification_privacy: privacy,
          updated_at: now,
          times: {
            create: input.reminderTimes.map((local_time) => ({
              id: randomUUID(),
              local_time
            }))
          }
        },
        include: { times: true }
      });
    });

    await recordAuditLog(prisma, {
      actorUserId: input.patientUserId,
      action: 'MEDICATION_REMINDER_UPDATED',
      entityType: 'medication_reminder',
      entityId: reminderResult.id,
      meta: { reminder_public_id: reminderResult.public_id, art_plan_item_id: item.id }
    });
  } else {
    const reminderId = randomUUID();
    const today = new Date(now.toISOString().slice(0, 10) + 'T00:00:00Z');

    reminderResult = await prisma.medication_reminders.create({
      data: {
        id: reminderId,
        user_id: input.patientUserId,
        art_plan_item_id: item.id,
        display_label: label,
        reveal_name_in_app: false,
        timezone: tz,
        recurrence: 'DAILY',
        start_date: today,
        active_days: [0, 1, 2, 3, 4, 5, 6],
        is_active: active,
        notification_privacy: privacy,
        created_by: input.patientUserId,
        created_at: now,
        updated_at: now,
        times: {
          create: input.reminderTimes.map((local_time) => ({
            id: randomUUID(),
            local_time
          }))
        }
      },
      include: { times: true }
    });

    await recordAuditLog(prisma, {
      actorUserId: input.patientUserId,
      action: 'MEDICATION_REMINDER_CREATED',
      entityType: 'medication_reminder',
      entityId: reminderResult.id,
      meta: { reminder_public_id: reminderResult.public_id, art_plan_item_id: item.id }
    });
  }

  return reminderResult;
}

export async function getCompanionAdherenceSupport(input: {
  companionUserId: string;
  patientIdentifier: string;
  days?: number;
  correlationId?: string;
}) {
  const patient = await resolveUser(input.patientIdentifier);
  if (!patient || patient.role !== 'PASIEN') {
    throw new ArtCareError('Pasien tidak ditemukan', 404);
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
    throw new ArtCareError('Anda tidak memiliki penugasan aktif untuk pasien ini', 403);
  }

  // Verify explicit patient consent
  const consent = await prisma.art_adherence_support_consents.findUnique({
    where: { patient_user_id: patient.id }
  });

  if (!consent || !consent.is_consent_enabled) {
    return {
      consent_enabled: false,
      stats: null
    };
  }

  // Calculate privacy-safe adherence metrics (neutral descriptive numbers only)
  const stats = await calculateAdherenceStats(patient.id, input.days || 7);

  await recordAuditLog(prisma, {
    actorUserId: input.companionUserId,
    action: 'COMPANION_ADHERENCE_SUMMARY_VIEWED',
    entityType: 'adherence_support_summary',
    entityId: patient.id,
    meta: {
      patient_public_id: patient.public_id,
      summary_period: stats.summary_period,
      correlation_id: input.correlationId
    }
  });

  return {
    consent_enabled: true,
    stats
  };
}

export async function getPatientSideEffects(patientUserId: string) {
  return prisma.art_side_effect_entries.findMany({
    where: {
      patient_user_id: patientUserId,
      archived_at: null
    },
    orderBy: { occurred_at: 'desc' },
    include: { care_plan: true }
  });
}

export async function createPatientSideEffect(input: {
  patientUserId: string;
  data: {
    symptom_name: string;
    severity: 'MILD' | 'MODERATE' | 'SEVERE';
    patient_note?: string | null;
    occurred_at?: string;
    art_care_plan_id?: string | null;
  };
  correlationId?: string;
}) {
  let planId: string | null = null;
  if (input.data.art_care_plan_id) {
    const isUuid = UUID_REGEX.test(input.data.art_care_plan_id);
    const plan = await prisma.art_care_plans.findFirst({
      where: isUuid
        ? { id: input.data.art_care_plan_id, patient_user_id: input.patientUserId }
        : { public_id: input.data.art_care_plan_id, patient_user_id: input.patientUserId }
    });
    if (!plan) {
      throw new ArtCareError('Rencana ART tidak ditemukan untuk pasien ini', 404);
    }
    planId = plan.id;
  }

  const id = randomUUID();
  const entry = await prisma.art_side_effect_entries.create({
    data: {
      id,
      patient_user_id: input.patientUserId,
      art_care_plan_id: planId,
      symptom_name: input.data.symptom_name,
      severity: input.data.severity,
      patient_note: input.data.patient_note || null,
      status: 'ACTIVE',
      occurred_at: input.data.occurred_at ? new Date(input.data.occurred_at) : new Date(),
      created_at: new Date(),
      updated_at: new Date()
    },
    include: { care_plan: true }
  });

  await recordAuditLog(prisma, {
    actorUserId: input.patientUserId,
    action: 'ART_SIDE_EFFECT_CREATED',
    entityType: 'art_side_effect',
    entityId: entry.id,
    meta: {
      public_id: entry.public_id,
      severity: entry.severity,
      status: entry.status,
      correlation_id: input.correlationId
    }
  });

  return entry;
}

export async function updatePatientSideEffect(input: {
  patientUserId: string;
  entryIdentifier: string;
  data: {
    symptom_name?: string;
    severity?: 'MILD' | 'MODERATE' | 'SEVERE';
    patient_note?: string | null;
    status?: 'ACTIVE' | 'RESOLVED';
    occurred_at?: string;
    resolved_at?: string | null;
  };
  correlationId?: string;
}) {
  const isUuid = UUID_REGEX.test(input.entryIdentifier);
  const entry = await prisma.art_side_effect_entries.findFirst({
    where: isUuid ? { id: input.entryIdentifier } : { public_id: input.entryIdentifier }
  });

  if (!entry || entry.patient_user_id !== input.patientUserId) {
    throw new ArtCareError('Catatan efek samping tidak ditemukan', 404);
  }

  let resolvedAt = entry.resolved_at;
  if (input.data.status === 'RESOLVED') {
    resolvedAt = input.data.resolved_at ? new Date(input.data.resolved_at) : (entry.resolved_at || new Date());
  } else if (input.data.status === 'ACTIVE') {
    resolvedAt = null;
  }

  const updated = await prisma.art_side_effect_entries.update({
    where: { id: entry.id },
    data: {
      symptom_name: input.data.symptom_name ?? undefined,
      severity: input.data.severity ?? undefined,
      patient_note: input.data.patient_note !== undefined ? input.data.patient_note : undefined,
      status: input.data.status ?? undefined,
      resolved_at: resolvedAt,
      occurred_at: input.data.occurred_at ? new Date(input.data.occurred_at) : undefined,
      updated_at: new Date()
    },
    include: { care_plan: true }
  });

  const isResolved = input.data.status === 'RESOLVED' && entry.status !== 'RESOLVED';
  await recordAuditLog(prisma, {
    actorUserId: input.patientUserId,
    action: isResolved ? 'ART_SIDE_EFFECT_RESOLVED' : 'ART_SIDE_EFFECT_UPDATED',
    entityType: 'art_side_effect',
    entityId: updated.id,
    meta: {
      public_id: updated.public_id,
      status: updated.status,
      correlation_id: input.correlationId
    }
  });

  return updated;
}

export async function getDoctorPatientSideEffects(doctorUserId: string, patientIdentifier: string) {
  const patient = await resolveUser(patientIdentifier);
  if (!patient || patient.role !== 'PASIEN') {
    throw new ArtCareError('Pasien tidak ditemukan', 404);
  }

  const hasRel = await hasDoctorPatientRelationship(doctorUserId, patient.id);
  if (!hasRel) {
    throw new ArtCareError('Tidak memiliki relasi klinis sah dengan pasien ini', 403);
  }

  return prisma.art_side_effect_entries.findMany({
    where: {
      patient_user_id: patient.id,
      archived_at: null
    },
    orderBy: { occurred_at: 'desc' },
    include: { care_plan: true }
  });
}

export async function getPatientMedicationStocks(patientUserId: string) {
  const stocks = await prisma.art_medication_stocks.findMany({
    where: { patient_user_id: patientUserId },
    orderBy: { recorded_at: 'desc' },
    take: 20,
    include: { plan_item: true }
  });

  const setting = await prisma.art_refill_settings.findUnique({
    where: { patient_user_id: patientUserId }
  });
  const thresholdDays = setting?.refill_alert_threshold_days ?? 7;

  const now = new Date();
  const nextControl = await prisma.control_schedules.findFirst({
    where: {
      user_id: patientUserId,
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      starts_at: { gte: now }
    },
    orderBy: { starts_at: 'asc' },
    select: { starts_at: true, timezone: true }
  });

  return {
    latest_stock: stocks[0] || null,
    history: stocks,
    threshold_days: thresholdDays,
    next_control: nextControl
      ? {
          starts_at: nextControl.starts_at.toISOString(),
          timezone: nextControl.timezone
        }
      : null
  };
}

export async function recordPatientMedicationStock(input: {
  patientUserId: string;
  data: {
    art_plan_item_id?: string | null;
    quantity_remaining?: number | null;
    unit?: string | null;
    estimated_days_remaining?: number | null;
    notes?: string | null;
    recorded_at?: string;
  };
  correlationId?: string;
}) {
  let planItemId: string | null = null;
  if (input.data.art_plan_item_id) {
    const item = await prisma.art_care_plan_items.findFirst({
      where: {
        id: input.data.art_plan_item_id,
        plan: { patient_user_id: input.patientUserId }
      }
    });
    if (!item) {
      throw new ArtCareError('Item obat rencana ART tidak ditemukan untuk pasien ini', 404);
    }
    planItemId = item.id;
  }

  const id = randomUUID();
  const stock = await prisma.art_medication_stocks.create({
    data: {
      id,
      patient_user_id: input.patientUserId,
      art_plan_item_id: planItemId,
      quantity_remaining: input.data.quantity_remaining !== undefined && input.data.quantity_remaining !== null
        ? input.data.quantity_remaining
        : null,
      unit: input.data.unit ?? null,
      estimated_days_remaining: input.data.estimated_days_remaining !== undefined && input.data.estimated_days_remaining !== null
        ? input.data.estimated_days_remaining
        : null,
      notes: input.data.notes ?? null,
      recorded_at: input.data.recorded_at ? new Date(input.data.recorded_at) : new Date(),
      created_at: new Date(),
      updated_at: new Date()
    },
    include: { plan_item: true }
  });

  await recordAuditLog(prisma, {
    actorUserId: input.patientUserId,
    action: 'ART_STOCK_RECORDED',
    entityType: 'art_medication_stock',
    entityId: stock.id,
    meta: {
      public_id: stock.public_id,
      correlation_id: input.correlationId
    }
  });

  return stock;
}

export async function getPatientRefillSettings(patientUserId: string) {
  const setting = await prisma.art_refill_settings.findUnique({
    where: { patient_user_id: patientUserId }
  });
  return setting || { refill_alert_threshold_days: 7 };
}

export async function updatePatientRefillSettings(input: {
  patientUserId: string;
  thresholdDays: number;
  correlationId?: string;
}) {
  const setting = await prisma.art_refill_settings.upsert({
    where: { patient_user_id: input.patientUserId },
    create: {
      id: randomUUID(),
      patient_user_id: input.patientUserId,
      refill_alert_threshold_days: input.thresholdDays,
      created_at: new Date(),
      updated_at: new Date()
    },
    update: {
      refill_alert_threshold_days: input.thresholdDays,
      updated_at: new Date()
    }
  });

  await recordAuditLog(prisma, {
    actorUserId: input.patientUserId,
    action: 'ART_REFILL_SETTING_UPDATED',
    entityType: 'art_refill_setting',
    entityId: setting.id,
    meta: {
      refill_alert_threshold_days: setting.refill_alert_threshold_days,
      correlation_id: input.correlationId
    }
  });

  return setting;
}

export async function getPatientRefillSupportConsent(patientUserId: string) {
  const consent = await prisma.art_refill_support_consents.findUnique({
    where: { patient_user_id: patientUserId }
  });
  return consent || { is_consent_enabled: false };
}

export async function updatePatientRefillSupportConsent(input: {
  patientUserId: string;
  isConsentEnabled: boolean;
  correlationId?: string;
}) {
  const now = new Date();
  const consent = await prisma.art_refill_support_consents.upsert({
    where: { patient_user_id: input.patientUserId },
    create: {
      id: randomUUID(),
      patient_user_id: input.patientUserId,
      is_consent_enabled: input.isConsentEnabled,
      consented_at: input.isConsentEnabled ? now : null,
      revoked_at: !input.isConsentEnabled ? now : null,
      created_at: now,
      updated_at: now
    },
    update: {
      is_consent_enabled: input.isConsentEnabled,
      consented_at: input.isConsentEnabled ? now : undefined,
      revoked_at: !input.isConsentEnabled ? now : undefined,
      updated_at: now
    }
  });

  await recordAuditLog(prisma, {
    actorUserId: input.patientUserId,
    action: input.isConsentEnabled
      ? 'ART_REFILL_SUPPORT_CONSENT_GRANTED'
      : 'ART_REFILL_SUPPORT_CONSENT_REVOKED',
    entityType: 'art_refill_support_consent',
    entityId: consent.id,
    meta: {
      is_consent_enabled: consent.is_consent_enabled,
      correlation_id: input.correlationId
    }
  });

  return consent;
}

export async function getCompanionRefillSupport(input: {
  companionUserId: string;
  patientIdentifier: string;
  correlationId?: string;
}) {
  const patient = await resolveUser(input.patientIdentifier);
  if (!patient || patient.role !== 'PASIEN') {
    throw new ArtCareError('Pasien tidak ditemukan', 404);
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
    throw new ArtCareError('Anda tidak memiliki penugasan aktif untuk pasien ini', 403);
  }

  // Verify explicit patient consent for refill support
  const consent = await prisma.art_refill_support_consents.findUnique({
    where: { patient_user_id: patient.id }
  });

  if (!consent || !consent.is_consent_enabled) {
    return {
      consent_enabled: false,
      refill_data: null
    };
  }

  const latestStock = await prisma.art_medication_stocks.findFirst({
    where: { patient_user_id: patient.id },
    orderBy: { recorded_at: 'desc' }
  });

  const setting = await prisma.art_refill_settings.findUnique({
    where: { patient_user_id: patient.id }
  });
  const thresholdDays = setting?.refill_alert_threshold_days ?? 7;

  const now = new Date();
  const nextControl = await prisma.control_schedules.findFirst({
    where: {
      user_id: patient.id,
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      starts_at: { gte: now }
    },
    orderBy: { starts_at: 'asc' },
    select: { starts_at: true, timezone: true }
  });

  const estimatedDays = latestStock?.estimated_days_remaining !== null && latestStock?.estimated_days_remaining !== undefined
    ? Number(latestStock.estimated_days_remaining)
    : null;

  const derived = computeRefillStatus(estimatedDays, thresholdDays);

  await recordAuditLog(prisma, {
    actorUserId: input.companionUserId,
    action: 'ART_REFILL_SUPPORT_VIEWED',
    entityType: 'refill_support_summary',
    entityId: patient.id,
    meta: {
      patient_public_id: patient.public_id,
      correlation_id: input.correlationId
    }
  });

  return {
    consent_enabled: true,
    refill_data: {
      status: derived.status,
      coarse_bucket: derived.coarse_bucket,
      coarse_bucket_label: derived.coarse_bucket_label,
      next_control_schedule: nextControl
        ? {
            starts_at: nextControl.starts_at.toISOString(),
            timezone: nextControl.timezone
          }
        : null
    }
  };
}

export async function getDoctorPatientStockSummary(doctorUserId: string, patientIdentifier: string) {
  const patient = await resolveUser(patientIdentifier);
  if (!patient || patient.role !== 'PASIEN') {
    throw new ArtCareError('Pasien tidak ditemukan', 404);
  }

  const hasRel = await hasDoctorPatientRelationship(doctorUserId, patient.id);
  if (!hasRel) {
    throw new ArtCareError('Tidak memiliki relasi klinis sah dengan pasien ini', 403);
  }

  return getPatientMedicationStocks(patient.id);
}

