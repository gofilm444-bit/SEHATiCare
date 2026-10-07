import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../../db/prisma';
import { authGuard } from '../../middlewares/auth';
import {
  doctorMonitoringCreateSchema,
  doctorMonitoringUpdateSchema,
  enrollmentCreateSchema,
  enrollmentEndSchema,
  enrollmentListQuerySchema,
  enrollmentTransferSchema,
  monitoringListQuerySchema,
  patientSelfReportCreateSchema
} from './hivCare.validators';
import {
  archiveDoctorMonitoringEntry,
  createCareEnrollment,
  createDoctorMonitoringEntry,
  createPatientSelfReportEntry,
  endCareEnrollment,
  getDoctorCareSummary,
  getPatientCareSummary,
  hasDoctorPatientRelationship,
  HivCareError,
  listCareEnrollments,
  listDoctorMonitoringEntries,
  listPatientMonitoringEntries,
  resolveMonitoringEntry,
  resolveUser,
  transferCareEnrollment,
  updateDoctorMonitoringEntry
} from './hivCare.service';
import {
  toAdminEnrollmentDto,
  toDoctorMonitoringDto,
  toPatientCareDto,
  toPatientMonitoringDto
} from './hivCare.presenter';

function setPrivateCacheHeaders(reply: FastifyReply) {
  reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  reply.header('Pragma', 'no-cache');
}

function adminOnly(req: FastifyRequest, reply: FastifyReply): boolean {
  if (req.user?.role !== 'ADMIN') {
    void reply.code(403).send({ message: 'Akses ditolak. Memerlukan hak akses Admin.' });
    return false;
  }
  return true;
}

function patientOnly(req: FastifyRequest, reply: FastifyReply): boolean {
  if (req.user?.role !== 'PASIEN') {
    void reply.code(403).send({ message: 'Akses khusus pasien.' });
    return false;
  }
  return true;
}

async function requireVerifiedDoctor(req: FastifyRequest, reply: FastifyReply) {
  if (req.user?.role !== 'DOKTER') {
    void reply.code(403).send({ message: 'Akses khusus dokter.' });
    return null;
  }
  const profile = await prisma.doctor_profiles.findUnique({
    where: { user_id: req.user.userId }
  });
  if (!profile || profile.verification_status !== 'VERIFIED') {
    void reply.code(403).send({ message: 'Profil dokter belum terverifikasi.' });
    return null;
  }
  return profile;
}

export default async function hivCareRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authGuard);
  app.addHook('onSend', async (_req, reply) => {
    setPrivateCacheHeaders(reply);
  });

  // ==========================================
  // ADMIN CARE ENROLLMENT GOVERNANCE
  // ==========================================

  app.get('/admin/care-enrollments', async (req, reply) => {
    if (!adminOnly(req, reply)) return reply;
    const query = enrollmentListQuerySchema.parse(req.query);

    const result = await listCareEnrollments({
      status: query.status,
      page: query.page,
      limit: query.limit
    });

    return reply.code(200).send({
      items: result.items.map((x) => toAdminEnrollmentDto(x as any)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages
    });
  });

  app.post('/admin/care-enrollments', async (req, reply) => {
    if (!adminOnly(req, reply)) return reply;
    const body = enrollmentCreateSchema.parse(req.body);

    try {
      const enrollment = await createCareEnrollment({
        patientIdentifier: body.patient_public_id,
        facilityId: body.facility_id,
        actorUserId: req.user!.userId,
        correlationId: req.id
      });
      return reply.code(201).send(toAdminEnrollmentDto(enrollment as any));
    } catch (err: any) {
      if (err instanceof HivCareError) {
        return reply.code(err.statusCode).send({ message: err.message });
      }
      throw err;
    }
  });

  app.put('/admin/care-enrollments/:id/transfer', async (req, reply) => {
    if (!adminOnly(req, reply)) return reply;
    const { id } = req.params as { id: string };
    const body = enrollmentTransferSchema.parse(req.body);

    try {
      const transferred = await transferCareEnrollment({
        enrollmentIdentifier: id,
        facilityId: body.facility_id,
        transferReason: body.transfer_reason,
        actorUserId: req.user!.userId,
        correlationId: req.id
      });
      return reply.code(200).send(toAdminEnrollmentDto(transferred as any));
    } catch (err: any) {
      if (err instanceof HivCareError) {
        return reply.code(err.statusCode).send({ message: err.message });
      }
      throw err;
    }
  });

  app.put('/admin/care-enrollments/:id/end', async (req, reply) => {
    if (!adminOnly(req, reply)) return reply;
    const { id } = req.params as { id: string };
    const body = enrollmentEndSchema.parse(req.body);

    try {
      const ended = await endCareEnrollment({
        enrollmentIdentifier: id,
        endReason: body.end_reason,
        actorUserId: req.user!.userId,
        correlationId: req.id
      });
      return reply.code(200).send(toAdminEnrollmentDto(ended as any));
    } catch (err: any) {
      if (err instanceof HivCareError) {
        return reply.code(err.statusCode).send({ message: err.message });
      }
      throw err;
    }
  });

  // ==========================================
  // PATIENT CARE & MONITORING
  // ==========================================

  app.get('/patient/care', async (req, reply) => {
    if (!patientOnly(req, reply)) return reply;

    const summary = await getPatientCareSummary(req.user!.userId);
    return reply.code(200).send({
      care: toPatientCareDto(summary.enrollment as any),
      latest_monitoring_date: summary.latest_monitoring_date
    });
  });

  app.get('/patient/monitoring', async (req, reply) => {
    if (!patientOnly(req, reply)) return reply;
    const query = monitoringListQuerySchema.parse(req.query);

    const result = await listPatientMonitoringEntries(req.user!.userId, {
      page: query.page,
      limit: query.limit,
      correlationId: req.id
    });

    return reply.code(200).send({
      items: result.items.map(toPatientMonitoringDto),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages
    });
  });

  app.post('/patient/monitoring', async (req, reply) => {
    if (!patientOnly(req, reply)) return reply;
    const body = patientSelfReportCreateSchema.parse(req.body);

    try {
      const entry = await createPatientSelfReportEntry({
        patientUserId: req.user!.userId,
        data: {
          recorded_at: body.recorded_at,
          weight_kg: body.weight_kg,
          general_condition: body.general_condition,
          patient_note: body.patient_note
        },
        correlationId: req.id
      });
      return reply.code(201).send(toPatientMonitoringDto(entry));
    } catch (err: any) {
      if (err instanceof HivCareError) {
        return reply.code(err.statusCode).send({ message: err.message });
      }
      throw err;
    }
  });

  // ==========================================
  // DOCTOR CARE & CLINICAL MONITORING
  // ==========================================

  app.get('/doctor/patients/:publicId/care', async (req, reply) => {
    const doctorProfile = await requireVerifiedDoctor(req, reply);
    if (!doctorProfile) return reply;

    const { publicId } = req.params as { publicId: string };
    const patient = await resolveUser(publicId);
    if (!patient || patient.role !== 'PASIEN') {
      return reply.code(404).send({ message: 'Pasien tidak ditemukan' });
    }

    const hasRel = await hasDoctorPatientRelationship(req.user!.userId, patient.id);
    if (!hasRel) {
      return reply.code(403).send({ message: 'Tidak memiliki relasi klinis sah dengan pasien ini' });
    }

    const summary = await getDoctorCareSummary(patient.id);
    return reply.code(200).send({
      patient: {
        public_id: patient.public_id,
        display_alias: patient.display_alias
      },
      care: summary?.enrollment
        ? {
            public_id: summary.enrollment.public_id,
            status: summary.enrollment.status,
            enrolled_at: summary.enrollment.enrolled_at.toISOString(),
            facility: summary.enrollment.facility
              ? {
                  id: summary.enrollment.facility.id,
                  name: summary.enrollment.facility.name
                }
              : null
          }
        : null,
      latest_monitoring_date: summary?.latest_monitoring_date ?? null
    });
  });

  app.get('/doctor/patients/:publicId/monitoring', async (req, reply) => {
    const doctorProfile = await requireVerifiedDoctor(req, reply);
    if (!doctorProfile) return reply;

    const { publicId } = req.params as { publicId: string };
    const patient = await resolveUser(publicId);
    if (!patient || patient.role !== 'PASIEN') {
      return reply.code(404).send({ message: 'Pasien tidak ditemukan' });
    }

    const hasRel = await hasDoctorPatientRelationship(req.user!.userId, patient.id);
    if (!hasRel) {
      return reply.code(403).send({ message: 'Tidak memiliki relasi klinis sah dengan pasien ini' });
    }

    const query = monitoringListQuerySchema.parse(req.query);
    const result = await listDoctorMonitoringEntries(patient.id, req.user!.userId, {
      page: query.page,
      limit: query.limit,
      includeArchived: query.include_archived,
      correlationId: req.id
    });

    return reply.code(200).send({
      items: result.items.map(toDoctorMonitoringDto),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages
    });
  });

  app.post('/doctor/patients/:publicId/monitoring', async (req, reply) => {
    const doctorProfile = await requireVerifiedDoctor(req, reply);
    if (!doctorProfile) return reply;

    const { publicId } = req.params as { publicId: string };
    const patient = await resolveUser(publicId);
    if (!patient || patient.role !== 'PASIEN') {
      return reply.code(404).send({ message: 'Pasien tidak ditemukan' });
    }

    const hasRel = await hasDoctorPatientRelationship(req.user!.userId, patient.id);
    if (!hasRel) {
      return reply.code(403).send({ message: 'Tidak memiliki relasi klinis sah dengan pasien ini' });
    }

    const body = doctorMonitoringCreateSchema.parse(req.body);

    try {
      const entry = await createDoctorMonitoringEntry({
        patientUserId: patient.id,
        doctorUserId: req.user!.userId,
        data: body,
        correlationId: req.id
      });
      return reply.code(201).send(toDoctorMonitoringDto(entry));
    } catch (err: any) {
      if (err instanceof HivCareError) {
        return reply.code(err.statusCode).send({ message: err.message });
      }
      throw err;
    }
  });

  app.put('/doctor/monitoring/:id', async (req, reply) => {
    const doctorProfile = await requireVerifiedDoctor(req, reply);
    if (!doctorProfile) return reply;

    const { id } = req.params as { id: string };
    const body = doctorMonitoringUpdateSchema.parse(req.body);

    try {
      const updated = await updateDoctorMonitoringEntry({
        monitoringIdentifier: id,
        doctorUserId: req.user!.userId,
        data: body,
        correlationId: req.id
      });
      return reply.code(200).send(toDoctorMonitoringDto(updated));
    } catch (err: any) {
      if (err instanceof HivCareError) {
        return reply.code(err.statusCode).send({ message: err.message });
      }
      throw err;
    }
  });

  app.post('/doctor/monitoring/:id/archive', async (req, reply) => {
    const doctorProfile = await requireVerifiedDoctor(req, reply);
    if (!doctorProfile) return reply;

    const { id } = req.params as { id: string };

    try {
      const archived = await archiveDoctorMonitoringEntry({
        monitoringIdentifier: id,
        doctorUserId: req.user!.userId,
        correlationId: req.id
      });
      return reply.code(200).send(toDoctorMonitoringDto(archived));
    } catch (err: any) {
      if (err instanceof HivCareError) {
        return reply.code(err.statusCode).send({ message: err.message });
      }
      throw err;
    }
  });

  // ==========================================
  // DOCTOR CONSULTATION-SCOPED MONITORING
  // ==========================================

  app.get('/doctor/consultations/:consultationId/care', async (req, reply) => {
    const doctorProfile = await requireVerifiedDoctor(req, reply);
    if (!doctorProfile) return reply;

    const { consultationId } = req.params as { consultationId: string };
    const consultation = await prisma.consultations.findFirst({
      where: { id: consultationId, assignedDoctorId: req.user!.userId }
    });
    if (!consultation) {
      return reply.code(404).send({ message: 'Konsultasi tidak ditemukan' });
    }

    const summary = await getDoctorCareSummary(consultation.patient_id);
    return reply.code(200).send({
      care: summary?.enrollment
        ? {
            public_id: summary.enrollment.public_id,
            status: summary.enrollment.status,
            enrolled_at: summary.enrollment.enrolled_at.toISOString(),
            facility: summary.enrollment.facility
              ? {
                  id: summary.enrollment.facility.id,
                  name: summary.enrollment.facility.name
                }
              : null
          }
        : null,
      latest_monitoring_date: summary?.latest_monitoring_date ?? null
    });
  });

  app.get('/doctor/consultations/:consultationId/monitoring', async (req, reply) => {
    const doctorProfile = await requireVerifiedDoctor(req, reply);
    if (!doctorProfile) return reply;

    const { consultationId } = req.params as { consultationId: string };
    const consultation = await prisma.consultations.findFirst({
      where: { id: consultationId, assignedDoctorId: req.user!.userId }
    });
    if (!consultation) {
      return reply.code(404).send({ message: 'Konsultasi tidak ditemukan' });
    }

    const query = monitoringListQuerySchema.parse(req.query);
    const result = await listDoctorMonitoringEntries(consultation.patient_id, req.user!.userId, {
      page: query.page,
      limit: query.limit,
      includeArchived: query.include_archived,
      correlationId: req.id
    });

    return reply.code(200).send({
      items: result.items.map(toDoctorMonitoringDto),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages
    });
  });

  app.post('/doctor/consultations/:consultationId/monitoring', async (req, reply) => {
    const doctorProfile = await requireVerifiedDoctor(req, reply);
    if (!doctorProfile) return reply;

    const { consultationId } = req.params as { consultationId: string };
    const consultation = await prisma.consultations.findFirst({
      where: { id: consultationId, assignedDoctorId: req.user!.userId }
    });
    if (!consultation) {
      return reply.code(404).send({ message: 'Konsultasi tidak ditemukan' });
    }

    const body = doctorMonitoringCreateSchema.parse(req.body);

    try {
      const entry = await createDoctorMonitoringEntry({
        patientUserId: consultation.patient_id,
        doctorUserId: req.user!.userId,
        data: body,
        correlationId: req.id
      });
      return reply.code(201).send(toDoctorMonitoringDto(entry));
    } catch (err: any) {
      if (err instanceof HivCareError) {
        return reply.code(err.statusCode).send({ message: err.message });
      }
      throw err;
    }
  });
}
