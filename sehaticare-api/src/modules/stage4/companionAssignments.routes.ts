import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../../db/prisma';
import { authGuard } from '../../middlewares/auth';
import { accessAudit } from './stage4.shared';
import {
  assignmentCreateSchema,
  assignmentEndSchema,
  assignmentListQuerySchema,
  assignmentReassignSchema
} from './companionAssignments.validators';
import {
  assignCompanionToPatient,
  endCompanionAssignment,
  getActiveCompanionForPatient,
  isVerifiedCompanionProfile,
  reassignCompanion,
  resolveUser
} from './companionAssignments.service';

function adminOnly(req: FastifyRequest, reply: FastifyReply): boolean {
  if (req.user?.role !== 'ADMIN') {
    void reply.code(403).send({ message: 'Akses ditolak. Memerlukan hak akses Admin.' });
    return false;
  }
  return true;
}

async function requireCompanion(req: FastifyRequest, reply: FastifyReply) {
  if (!req.user || !['COUNSELOR', 'DOKTER'].includes(req.user.role)) {
    void reply.code(403).send({ message: 'Akses ditolak' });
    return null;
  }
  const user = await prisma.users.findUnique({
    where: { id: req.user.userId },
    include: { counselor_profile: true }
  });
  if (!isVerifiedCompanionProfile(user)) {
    void reply.code(403).send({ message: 'Peran pendamping belum aktif atau tidak terverifikasi' });
    return null;
  }
  return user;
}

export default async function companionAssignmentsRoutes(app: FastifyInstance) {
  // ==========================================
  // ADMIN ENDPOINTS
  // ==========================================

  app.get('/admin/companion-assignments', { preHandler: [authGuard] }, async (req, reply) => {
    if (!adminOnly(req, reply)) return;
    const query = assignmentListQuerySchema.parse(req.query);

    const where: any = {};
    if (query.status && query.status !== 'ALL') {
      where.status = query.status;
    }
    if (query.facility_id) {
      where.facility_id = query.facility_id;
    }
    if (query.companion_id) {
      const companion = await resolveUser(query.companion_id);
      if (companion) where.companion_user_id = companion.id;
    }
    if (query.patient_id) {
      const patient = await resolveUser(query.patient_id);
      if (patient) where.patient_user_id = patient.id;
    }

    const items = await prisma.patient_companion_assignments.findMany({
      where,
      orderBy: [{ status: 'asc' }, { started_at: 'desc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: {
        patient: { select: { id: true, public_id: true, display_alias: true } },
        companion: {
          select: {
            id: true,
            public_id: true,
            counselor_profile: { select: { professional_name: true, service_role: true } }
          }
        },
        facility: { select: { id: true, name: true } }
      }
    });

    const total = await prisma.patient_companion_assignments.count({ where });

    return {
      items: items.map((row) => ({
        id: row.id,
        status: row.status,
        patient: {
          id: row.patient.id,
          public_id: row.patient.public_id,
          display_alias: row.patient.display_alias || 'Pasien Anonim'
        },
        companion: {
          id: row.companion.id,
          public_id: row.companion.public_id,
          professional_name: row.companion.counselor_profile?.professional_name || 'Pendamping',
          service_role: 'COMPANION'
        },
        facility: row.facility ? { id: row.facility.id, name: row.facility.name } : null,
        started_at: row.started_at.toISOString(),
        ended_at: row.ended_at ? row.ended_at.toISOString() : null,
        end_reason: row.end_reason,
        notes: row.notes,
        created_at: row.created_at.toISOString()
      })),
      total,
      page: query.page,
      limit: query.limit
    };
  });

  app.get('/admin/companion-assignments/candidates', { preHandler: [authGuard] }, async (req, reply) => {
    if (!adminOnly(req, reply)) return;

    const [patients, companions, facilities] = await Promise.all([
      prisma.users.findMany({
        where: { role: 'PASIEN', is_active: true },
        select: { id: true, public_id: true, display_alias: true },
        orderBy: { created_at: 'desc' },
        take: 200
      }),
      prisma.users.findMany({
        where: {
          role: 'COUNSELOR',
          is_active: true,
          counselor_profile: {
            service_role: 'COMPANION',
            verification_status: 'VERIFIED',
            permission_enabled: true,
            is_active: true,
            verified_at: { not: null }
          }
        },
        select: {
          id: true,
          public_id: true,
          counselor_profile: {
            select: { professional_name: true, facility_id: true }
          }
        },
        orderBy: { created_at: 'desc' }
      }),
      prisma.health_facilities.findMany({
        where: { is_active: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' }
      })
    ]);

    return {
      patients: patients.map((p) => ({
        id: p.id,
        public_id: p.public_id,
        display_alias: p.display_alias || 'Pasien Anonim'
      })),
      companions: companions.map((c) => ({
        id: c.id,
        public_id: c.public_id,
        professional_name: c.counselor_profile?.professional_name || 'Pendamping',
        facility_id: c.counselor_profile?.facility_id ?? null
      })),
      facilities
    };
  });

  app.post('/admin/companion-assignments', { preHandler: [authGuard] }, async (req, reply) => {
    if (!adminOnly(req, reply)) return;
    const body = assignmentCreateSchema.parse(req.body);

    try {
      const created = await assignCompanionToPatient({
        patientIdentifier: body.patient_id,
        companionIdentifier: body.companion_id,
        facilityId: body.facility_id,
        assignedByUserId: req.user!.userId,
        notes: body.notes
      });

      return reply.code(201).send({
        id: created.id,
        status: created.status,
        patient: {
          id: created.patient.id,
          public_id: created.patient.public_id,
          display_alias: created.patient.display_alias || 'Pasien Anonim'
        },
        companion: {
          id: created.companion.id,
          public_id: created.companion.public_id,
          professional_name: created.companion.counselor_profile?.professional_name || 'Pendamping',
          service_role: 'COMPANION'
        },
        facility: created.facility ? { id: created.facility.id, name: created.facility.name } : null,
        started_at: created.started_at.toISOString(),
        notes: created.notes
      });
    } catch (err: any) {
      const status = err.statusCode || 400;
      return reply.code(status).send({ message: err.message || 'Gagal menetapkan pendamping' });
    }
  });

  app.put('/admin/companion-assignments/:id/reassign', { preHandler: [authGuard] }, async (req, reply) => {
    if (!adminOnly(req, reply)) return;
    const assignmentId = (req.params as { id: string }).id;
    const body = assignmentReassignSchema.parse(req.body);

    try {
      const reassigned = await reassignCompanion({
        assignmentId,
        newCompanionIdentifier: body.companion_id,
        facilityId: body.facility_id,
        assignedByUserId: req.user!.userId,
        reason: body.reason,
        notes: body.notes
      });

      return reply.code(200).send({
        id: reassigned.id,
        status: reassigned.status,
        patient: {
          id: reassigned.patient.id,
          public_id: reassigned.patient.public_id,
          display_alias: reassigned.patient.display_alias || 'Pasien Anonim'
        },
        companion: {
          id: reassigned.companion.id,
          public_id: reassigned.companion.public_id,
          professional_name: reassigned.companion.counselor_profile?.professional_name || 'Pendamping',
          service_role: 'COMPANION'
        },
        facility: reassigned.facility ? { id: reassigned.facility.id, name: reassigned.facility.name } : null,
        started_at: reassigned.started_at.toISOString(),
        notes: reassigned.notes
      });
    } catch (err: any) {
      const status = err.statusCode || 400;
      return reply.code(status).send({ message: err.message || 'Gagal mengalihkan pendamping' });
    }
  });

  app.put('/admin/companion-assignments/:id/end', { preHandler: [authGuard] }, async (req, reply) => {
    if (!adminOnly(req, reply)) return;
    const assignmentId = (req.params as { id: string }).id;
    const body = assignmentEndSchema.parse(req.body);

    try {
      const ended = await endCompanionAssignment({
        assignmentId,
        actorUserId: req.user!.userId,
        reason: body.reason
      });

      return reply.code(200).send({
        id: ended.id,
        status: ended.status,
        patient: {
          id: ended.patient.id,
          public_id: ended.patient.public_id,
          display_alias: ended.patient.display_alias || 'Pasien Anonim'
        },
        companion: {
          id: ended.companion.id,
          public_id: ended.companion.public_id,
          professional_name: ended.companion.counselor_profile?.professional_name || 'Pendamping',
          service_role: 'COMPANION'
        },
        facility: ended.facility ? { id: ended.facility.id, name: ended.facility.name } : null,
        started_at: ended.started_at.toISOString(),
        ended_at: ended.ended_at ? ended.ended_at.toISOString() : null,
        end_reason: ended.end_reason
      });
    } catch (err: any) {
      const status = err.statusCode || 400;
      return reply.code(status).send({ message: err.message || 'Gagal mengakhiri penugasan pendamping' });
    }
  });

  // ==========================================
  // COMPANION ENDPOINTS (SCOPED ACCESS & IDOR)
  // ==========================================

  app.get('/companion/patients', { preHandler: [authGuard] }, async (req, reply) => {
    const companion = await requireCompanion(req, reply);
    if (!companion) return;

    const query = req.query as { include_ended?: string };
    const includeEnded = query?.include_ended === 'true';

    const where: any = {
      companion_user_id: companion.id,
      status: includeEnded ? { in: ['ACTIVE', 'ENDED'] } : 'ACTIVE'
    };

    const assignments = await prisma.patient_companion_assignments.findMany({
      where,
      orderBy: [{ status: 'asc' }, { started_at: 'desc' }],
      include: {
        patient: { select: { id: true, public_id: true, display_alias: true } },
        facility: { select: { id: true, name: true } }
      }
    });

    return {
      items: assignments.map((row) => ({
        assignment_id: row.id,
        patient_public_id: row.patient.public_id,
        display_alias: row.patient.display_alias || 'Pasien Dampingan',
        status: row.status,
        started_at: row.started_at.toISOString(),
        ended_at: row.ended_at ? row.ended_at.toISOString() : null,
        facility: row.facility ? { id: row.facility.id, name: row.facility.name } : null,
        notes: row.notes
      }))
    };
  });

  app.get('/companion/patients/:publicId', { preHandler: [authGuard] }, async (req, reply) => {
    const companion = await requireCompanion(req, reply);
    if (!companion) return;

    const publicId = (req.params as { publicId: string }).publicId;
    const patient = await prisma.users.findUnique({
      where: { public_id: publicId },
      select: { id: true, public_id: true, display_alias: true, is_active: true }
    });

    if (!patient) {
      return reply.code(404).send({ message: 'Pasien dampingan tidak ditemukan' });
    }

    // IDOR check: Is this patient actively assigned to THIS companion?
    const assignment = await prisma.patient_companion_assignments.findFirst({
      where: {
        companion_user_id: companion.id,
        patient_user_id: patient.id,
        status: 'ACTIVE'
      },
      include: { facility: { select: { id: true, name: true } } }
    });

    if (!assignment) {
      return reply.code(403).send({ message: 'Anda tidak memiliki penugasan aktif untuk pasien ini' });
    }

    // Record sensitive access audit
    await accessAudit({
      actorId: companion.id,
      actorRole: 'COUNSELOR',
      resourceType: 'companion_patient_roster',
      resourcePublicId: patient.public_id,
      action: 'VIEW_ASSIGNED_PATIENT',
      correlationId: req.id
    });

    return {
      assignment_id: assignment.id,
      patient_public_id: patient.public_id,
      display_alias: patient.display_alias || 'Pasien Dampingan',
      status: assignment.status,
      started_at: assignment.started_at.toISOString(),
      facility: assignment.facility ? { id: assignment.facility.id, name: assignment.facility.name } : null,
      notes: assignment.notes
    };
  });

  // ==========================================
  // PATIENT ENDPOINT
  // ==========================================

  app.get('/patient/companion', { preHandler: [authGuard] }, async (req, reply) => {
    if (req.user?.role !== 'PASIEN') {
      return reply.code(403).send({ message: 'Akses ditolak' });
    }

    const assignment = await getActiveCompanionForPatient(req.user.userId);

    if (!assignment) {
      return {
        assigned: false,
        companion: null,
        started_at: null
      };
    }

    return {
      assigned: true,
      assignment_id: assignment.id,
      companion: {
        public_id: assignment.companion.public_id,
        professional_name: assignment.companion.counselor_profile?.professional_name || 'Pendamping',
        service_role: 'COMPANION',
        facility: assignment.facility ? { id: assignment.facility.id, name: assignment.facility.name } : null
      },
      started_at: assignment.started_at.toISOString()
    };
  });
}
