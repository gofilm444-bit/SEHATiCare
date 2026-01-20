import { Prisma, chat_sender_role, consultation_status, user_role } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../db/prisma';
import { recordAuditLog } from '../../utils/audit';
import { audit } from '../../utils/auditEvents';

const ACTIVE_STATUSES: consultation_status[] = ['MENUNGGU_DOKTER', 'AI_AKTIF', 'DOKTER_AKTIF'];

export async function getLatestActiveForPatient(patientId: string) {
  return prisma.consultations.findFirst({
    where: {
      patient_id: patientId,
      status: { in: ACTIVE_STATUSES }
    },
    orderBy: [
      { updated_at: 'desc' },
      { opened_at: 'desc' }
    ]
  });
}

export async function createConsultation(patientId: string, initialComplaint: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.consultations.findFirst({
      where: {
        patient_id: patientId,
        status: { in: ACTIVE_STATUSES }
      },
      orderBy: [
        { updated_at: 'desc' },
        { opened_at: 'desc' }
      ]
    });

    if (existing) {
      return existing;
    }

    const now = new Date();
    const consultation = await tx.consultations.create({
      data: {
        id: randomUUID(),
        patient_id: patientId,
        status: 'MENUNGGU_DOKTER',
        initial_complaint: initialComplaint,
        updated_at: now
      }
    });

    await tx.consultation_participants.create({
      data: {
        id: randomUUID(),
        consultation_id: consultation.id,
        user_id: patientId,
        role: 'PASIEN'
      }
    });

    return consultation;
  });
}

export function getConsultationById(id: string) {
  return prisma.consultations.findUnique({
    where: { id },
    include: {
      consultation_participants: true
    }
  });
}

export async function listConsultationsForUser(userId: string, role: user_role) {
  const where: Prisma.consultationsWhereInput =
    role === 'PASIEN'
      ? { patient_id: userId }
      : role === 'DOKTER'
        ? {
            OR: [{ assignedDoctorId: userId }, { consultation_participants: { some: { user_id: userId } } }]
          }
        : {};

  return prisma.consultations.findMany({
    where,
    orderBy: { opened_at: 'desc' }
  });
}

export function listPatientHistory(patientId: string) {
  return prisma.consultations.findMany({
    where: { patient_id: patientId },
    orderBy: { updated_at: 'desc' },
    select: {
      id: true,
      status: true,
      initial_complaint: true,
      opened_at: true,
      created_at: true,
      updated_at: true,
      assignedDoctorId: true
    }
  });
}

export function listDoctorHistory(doctorId: string) {
  return prisma.consultations.findMany({
    where: { assignedDoctorId: doctorId, status: 'SELESAI' },
    orderBy: { updated_at: 'desc' },
    select: {
      id: true,
      status: true,
      initial_complaint: true,
      opened_at: true,
      created_at: true,
      updated_at: true,
      patient: { select: { full_name: true } }
    }
  });
}

export function listDoctorActive(doctorId: string) {
  return prisma.consultations.findMany({
    where: { assignedDoctorId: doctorId, status: 'DOKTER_AKTIF' },
    orderBy: { created_at: 'asc' },
    select: {
      id: true,
      status: true,
      initial_complaint: true,
      opened_at: true,
      created_at: true,
      updated_at: true,
      patient: { select: { full_name: true } }
    }
  });
}

export function listConsultationQueue() {
  return prisma.consultations.findMany({
    where: { assignedDoctorId: null, status: { in: ['MENUNGGU_DOKTER', 'AI_AKTIF'] } },
    orderBy: { created_at: 'asc' }
  });
}

export async function listDoctorQueue() {
  const consultations = await prisma.consultations.findMany({
    where: { status: { in: ['MENUNGGU_DOKTER', 'AI_AKTIF'] }, assignedDoctorId: null },
    orderBy: [{ priority: 'desc' }, { opened_at: 'asc' }],
    select: {
      id: true,
      patient_id: true,
      status: true,
      initial_complaint: true,
      opened_at: true,
      created_at: true,
      updated_at: true,
      closeRequested: true,
      closeRequestedAt: true,
      red_flag: true,
      red_flag_reason: true,
      priority: true,
      patient: { select: { full_name: true } }
    }
  });

  if (consultations.length === 0) return [];

  const messageMax = await prisma.chat_messages.groupBy({
    by: ['consultation_id'],
    where: { consultation_id: { in: consultations.map((item) => item.id) } },
    _max: { created_at: true }
  });
  const messageMaxMap = new Map(
    messageMax.map((item) => [item.consultation_id, item._max.created_at ?? null])
  );

  return consultations.map((consultation) => ({
    ...consultation,
    last_message_at: messageMaxMap.get(consultation.id) ?? consultation.updated_at
  }));
}

export async function getDoctorConsultationDetail(consultationId: string, doctorUserId: string) {
  return prisma.consultations.findFirst({
    where: { id: consultationId, assignedDoctorId: doctorUserId },
    select: {
      id: true,
      status: true,
      initial_complaint: true,
      opened_at: true,
      created_at: true,
      updated_at: true,
      closeRequested: true,
      closeRequestedAt: true,
      consent_at: true,
      consent_version: true,
      red_flag: true,
      red_flag_reason: true,
      priority: true,
      patient: { select: { full_name: true } }
    }
  });
}

export function listMessagesForConsultation(consultationId: string, after?: Date | null) {
  return prisma.chat_messages.findMany({
    where: {
      consultation_id: consultationId,
      ...(after ? { created_at: { gt: after } } : {})
    },
    orderBy: { created_at: 'asc' }
  });
}

export function createMessageForConsultation(
  consultationId: string,
  senderRole: chat_sender_role,
  senderUserId: string | null,
  content: string
) {
  return prisma.chat_messages.create({
    data: {
      id: randomUUID(),
      consultation_id: consultationId,
      sender_role: senderRole,
      sender_user_id: senderUserId,
      content
    }
  });
}

export async function joinConsultation(consultationId: string, doctorId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const consultation = await tx.consultations.findUnique({
      where: { id: consultationId },
      include: { consultation_participants: true }
    });
    if (!consultation) throw new Error('Consultation not found');
    if (consultation.status === 'SELESAI') throw new Error('Consultation already closed');

    const update = await tx.consultations.updateMany({
      where: {
        id: consultationId,
        assignedDoctorId: null,
        status: { in: ['MENUNGGU_DOKTER', 'AI_AKTIF'] }
      },
      data: {
        assignedDoctorId: doctorId,
        doctor_joined_at: new Date(),
        status: 'DOKTER_AKTIF'
      }
    });

    if (update.count === 0) {
      throw new Error('Consultation already taken');
    }

    await tx.consultation_participants.upsert({
      where: { consultation_id_user_id: { consultation_id: consultationId, user_id: doctorId } },
      update: { left_at: null, role: 'DOKTER' },
      create: { id: randomUUID(), consultation_id: consultationId, user_id: doctorId, role: 'DOKTER' }
    });

    await recordAuditLog(tx, {
      actorUserId: doctorId,
      action: 'CONSULTATION_JOIN',
      entityType: 'consultation',
      entityId: consultationId,
      meta: {},
      ipAddress: null,
      userAgent: null
    });

    return tx.consultations.findUnique({ where: { id: consultationId } });
  });

  return result;
}

export async function claimConsultation(consultationId: string, doctorId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.consultations.updateMany({
      where: { id: consultationId, assignedDoctorId: null, status: { in: ['MENUNGGU_DOKTER', 'AI_AKTIF'] } },
      data: { assignedDoctorId: doctorId, doctor_joined_at: new Date(), status: 'DOKTER_AKTIF' }
    });
    if (updated.count === 0) return null;

    await tx.consultation_participants.upsert({
      where: { consultation_id_user_id: { consultation_id: consultationId, user_id: doctorId } },
      update: { left_at: null, role: 'DOKTER' },
      create: { id: randomUUID(), consultation_id: consultationId, user_id: doctorId, role: 'DOKTER' }
    });

    await recordAuditLog(tx, {
      actorUserId: doctorId,
      action: 'CONSULTATION_CLAIM',
      entityType: 'consultation',
      entityId: consultationId,
      meta: {},
      ipAddress: null,
      userAgent: null
    });
    await audit.log(tx, {
      actorUserId: doctorId,
      actorRole: 'DOKTER',
      action: 'DOCTOR_CLAIMED',
      consultationId,
      meta: {}
    });

    return tx.consultations.findUnique({ where: { id: consultationId } });
  });

  return result;
}

export async function closeConsultation(consultationId: string, doctorId: string) {
  return prisma.$transaction(async (tx) => {
    const consultation = await tx.consultations.findUnique({ where: { id: consultationId } });
    if (!consultation) throw new Error('Consultation not found');
    if (consultation.status === 'SELESAI') throw new Error('Consultation already closed');
    if (consultation.assignedDoctorId !== doctorId) throw new Error('Forbidden');
    if (consultation.status !== 'DOKTER_AKTIF') throw new Error('Consultation not active');

    const updated = await tx.consultations.update({
      where: { id: consultationId },
      data: {
        status: 'SELESAI',
        closed_at: new Date(),
        closed_by: doctorId
      }
    });

    await recordAuditLog(tx, {
      actorUserId: doctorId,
      action: 'CONSULTATION_CLOSED',
      entityType: 'consultation',
      entityId: consultationId,
      meta: {},
      ipAddress: null,
      userAgent: null
    });

    return updated;
  });
}

export async function finishConsultation(consultationId: string, doctorId: string) {
  return prisma.$transaction(async (tx) => {
    const consultation = await tx.consultations.findUnique({ where: { id: consultationId } });
    if (!consultation) throw new Error('Consultation not found');
    if (consultation.assignedDoctorId !== doctorId) throw new Error('Forbidden');
    if (consultation.status === 'SELESAI') return consultation;
    if (consultation.status !== 'DOKTER_AKTIF') throw new Error('Consultation not active');

    const updated = await tx.consultations.update({
      where: { id: consultationId },
      data: {
        status: 'SELESAI',
        closed_at: new Date(),
        closed_by: doctorId
      }
    });

    await recordAuditLog(tx, {
      actorUserId: doctorId,
      action: 'CONSULTATION_FINISHED',
      entityType: 'consultation',
      entityId: consultationId,
      meta: {},
      ipAddress: null,
      userAgent: null
    });
    await audit.log(tx, {
      actorUserId: doctorId,
      actorRole: 'DOKTER',
      action: 'FINISHED',
      consultationId,
      meta: {}
    });

    return updated;
  });
}
