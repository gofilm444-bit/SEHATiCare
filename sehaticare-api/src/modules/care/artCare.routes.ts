import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../../db/prisma';
import { authGuard } from '../../middlewares/auth';
import {
  adherenceQuerySchema,
  doctorArtCarePlanCreateSchema,
  doctorArtCarePlanUpdateSchema,
  patientConsentUpdateSchema,
  patientReminderSyncSchema
} from './artCare.validators';
import {
  toCompanionAdherenceSupportDto,
  toDoctorArtCarePlanDto,
  toPatientArtCarePlanDto,
  toPatientConsentDto
} from './artCare.presenter';
import {
  ArtCareError,
  calculateAdherenceStats,
  createDoctorArtCarePlan,
  getCompanionAdherenceSupport,
  getPatientActiveArtCarePlan,
  getPatientArtCarePlanHistory,
  getPatientSupportConsent,
  resolveArtCarePlan,
  resolveUser,
  syncPatientReminderFromArtItem,
  updateDoctorArtCarePlan,
  updatePatientSupportConsent
} from './artCare.service';
import { hasDoctorPatientRelationship } from './hivCare.service';
import { isVerifiedCompanionProfile } from '../stage4/companionAssignments.service';

function setPrivateCacheHeaders(reply: FastifyReply) {
  reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  reply.header('Pragma', 'no-cache');
}

function patientOnly(req: FastifyRequest, reply: FastifyReply): boolean {
  if (req.user?.role !== 'PASIEN') {
    void reply.code(403).send({ message: 'Akses khusus pasien.' });
    return false;
  }
  return true;
}

function adminOnly(req: FastifyRequest, reply: FastifyReply): boolean {
  if (req.user?.role !== 'ADMIN') {
    void reply.code(403).send({ message: 'Akses ditolak. Memerlukan hak akses Admin.' });
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

async function requireCompanion(req: FastifyRequest, reply: FastifyReply) {
  if (!req.user || !['COUNSELOR', 'DOKTER'].includes(req.user.role)) {
    void reply.code(403).send({ message: 'Akses ditolak.' });
    return null;
  }
  const user = await prisma.users.findUnique({
    where: { id: req.user.userId },
    include: { counselor_profile: true }
  });
  if (!isVerifiedCompanionProfile(user)) {
    void reply.code(403).send({ message: 'Peran pendamping belum aktif atau tidak terverifikasi.' });
    return null;
  }
  return user;
}

export default async function artCareRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authGuard);
  app.addHook('onSend', async (_req, reply) => {
    setPrivateCacheHeaders(reply);
  });

  // ==========================================
  // PATIENT ART CARE & ADHERENCE
  // ==========================================

  app.get('/patient/art-care', async (req, reply) => {
    if (!patientOnly(req, reply)) return reply;

    const activePlan = await getPatientActiveArtCarePlan(req.user!.userId);
    return reply.code(200).send({
      plan: toPatientArtCarePlanDto(activePlan)
    });
  });

  app.get('/patient/art-care/history', async (req, reply) => {
    if (!patientOnly(req, reply)) return reply;

    const pastPlans = await getPatientArtCarePlanHistory(req.user!.userId);
    return reply.code(200).send({
      items: pastPlans.map(toPatientArtCarePlanDto)
    });
  });

  app.get('/patient/art-care/adherence', async (req, reply) => {
    if (!patientOnly(req, reply)) return reply;

    const query = adherenceQuerySchema.parse(req.query);
    const stats = await calculateAdherenceStats(req.user!.userId, query.days);

    return reply.code(200).send({
      summary: stats,
      disclaimer: 'Catatan kepatuhan dihitung secara matematis berdasarkan rekaman pengingat obat di aplikasi.'
    });
  });

  app.get('/patient/art-care/support-consent', async (req, reply) => {
    if (!patientOnly(req, reply)) return reply;

    const consent = await getPatientSupportConsent(req.user!.userId);
    return reply.code(200).send(toPatientConsentDto(consent));
  });

  app.patch('/patient/art-care/support-consent', async (req, reply) => {
    if (!patientOnly(req, reply)) return reply;

    const body = patientConsentUpdateSchema.parse(req.body);
    const consent = await updatePatientSupportConsent(
      req.user!.userId,
      body.is_consent_enabled,
      req.user!.userId,
      req.id
    );

    return reply.code(200).send(toPatientConsentDto(consent));
  });

  app.post('/patient/art-care/reminders', async (req, reply) => {
    if (!patientOnly(req, reply)) return reply;

    const body = patientReminderSyncSchema.parse(req.body);

    try {
      const reminder = await syncPatientReminderFromArtItem({
        patientUserId: req.user!.userId,
        artItemId: body.art_item_id,
        displayLabel: body.display_label,
        reminderTimes: body.reminder_times,
        timezone: body.timezone,
        notificationPrivacy: body.notification_privacy,
        isActive: body.is_active
      });

      return reply.code(201).send({
        public_id: reminder.public_id,
        display_label: reminder.display_label,
        is_active: reminder.is_active,
        times: reminder.times.map((t: any) => t.local_time)
      });
    } catch (err: any) {
      if (err instanceof ArtCareError) {
        return reply.code(err.statusCode).send({ message: err.message });
      }
      throw err;
    }
  });

  // ==========================================
  // DOCTOR ART CARE & REGIMEN MANAGEMENT
  // ==========================================

  app.get('/doctor/patients/:patientId/art-care', async (req, reply) => {
    const doctorProfile = await requireVerifiedDoctor(req, reply);
    if (!doctorProfile) return reply;

    const { patientId } = req.params as { patientId: string };
    const patient = await resolveUser(patientId);
    if (!patient || patient.role !== 'PASIEN') {
      return reply.code(404).send({ message: 'Pasien tidak ditemukan' });
    }

    const hasRel = await hasDoctorPatientRelationship(req.user!.userId, patient.id);
    if (!hasRel) {
      return reply.code(403).send({ message: 'Tidak memiliki relasi klinis sah dengan pasien ini' });
    }

    const [activePlan, history] = await Promise.all([
      getPatientActiveArtCarePlan(patient.id),
      getPatientArtCarePlanHistory(patient.id)
    ]);

    return reply.code(200).send({
      patient: {
        public_id: patient.public_id,
        display_alias: patient.display_alias
      },
      active_plan: toDoctorArtCarePlanDto(activePlan),
      history: history.map(toDoctorArtCarePlanDto)
    });
  });

  app.post('/doctor/patients/:patientId/art-care', async (req, reply) => {
    const doctorProfile = await requireVerifiedDoctor(req, reply);
    if (!doctorProfile) return reply;

    const { patientId } = req.params as { patientId: string };
    const patient = await resolveUser(patientId);
    if (!patient || patient.role !== 'PASIEN') {
      return reply.code(404).send({ message: 'Pasien tidak ditemukan' });
    }

    const hasRel = await hasDoctorPatientRelationship(req.user!.userId, patient.id);
    if (!hasRel) {
      return reply.code(403).send({ message: 'Tidak memiliki relasi klinis sah dengan pasien ini' });
    }

    const body = doctorArtCarePlanCreateSchema.parse(req.body);

    try {
      const plan = await createDoctorArtCarePlan({
        doctorUserId: req.user!.userId,
        patientUserId: patient.id,
        data: body,
        correlationId: req.id
      });

      return reply.code(201).send(toDoctorArtCarePlanDto(plan));
    } catch (err: any) {
      if (err instanceof ArtCareError) {
        return reply.code(err.statusCode).send({ message: err.message });
      }
      throw err;
    }
  });

  app.patch('/doctor/patients/:patientId/art-care/:planId', async (req, reply) => {
    const doctorProfile = await requireVerifiedDoctor(req, reply);
    if (!doctorProfile) return reply;

    const { patientId, planId } = req.params as { patientId: string; planId: string };
    const patient = await resolveUser(patientId);
    if (!patient || patient.role !== 'PASIEN') {
      return reply.code(404).send({ message: 'Pasien tidak ditemukan' });
    }

    const hasRel = await hasDoctorPatientRelationship(req.user!.userId, patient.id);
    if (!hasRel) {
      return reply.code(403).send({ message: 'Tidak memiliki relasi klinis sah dengan pasien ini' });
    }

    const body = doctorArtCarePlanUpdateSchema.parse(req.body);

    try {
      const updated = await updateDoctorArtCarePlan({
        doctorUserId: req.user!.userId,
        patientUserId: patient.id,
        planIdentifier: planId,
        data: body,
        correlationId: req.id
      });

      return reply.code(200).send(toDoctorArtCarePlanDto(updated));
    } catch (err: any) {
      if (err instanceof ArtCareError) {
        return reply.code(err.statusCode).send({ message: err.message });
      }
      throw err;
    }
  });

  app.get('/doctor/patients/:patientId/art-care/adherence', async (req, reply) => {
    const doctorProfile = await requireVerifiedDoctor(req, reply);
    if (!doctorProfile) return reply;

    const { patientId } = req.params as { patientId: string };
    const patient = await resolveUser(patientId);
    if (!patient || patient.role !== 'PASIEN') {
      return reply.code(404).send({ message: 'Pasien tidak ditemukan' });
    }

    const hasRel = await hasDoctorPatientRelationship(req.user!.userId, patient.id);
    if (!hasRel) {
      return reply.code(403).send({ message: 'Tidak memiliki relasi klinis sah dengan pasien ini' });
    }

    const query = adherenceQuerySchema.parse(req.query);
    const stats = await calculateAdherenceStats(patient.id, query.days);

    return reply.code(200).send({
      patient: {
        public_id: patient.public_id,
        display_alias: patient.display_alias
      },
      summary: stats
    });
  });

  // ==========================================
  // COMPANION PRIVACY-SAFE ADHERENCE SUPPORT
  // ==========================================

  app.get('/companion/patients/:patientId/adherence-support', async (req, reply) => {
    const companion = await requireCompanion(req, reply);
    if (!companion) return reply;

    const { patientId } = req.params as { patientId: string };
    const query = adherenceQuerySchema.parse(req.query);

    try {
      const result = await getCompanionAdherenceSupport({
        companionUserId: companion.id,
        patientIdentifier: patientId,
        days: query.days,
        correlationId: req.id
      });

      return reply.code(200).send(
        toCompanionAdherenceSupportDto(result.consent_enabled, result.stats)
      );
    } catch (err: any) {
      if (err instanceof ArtCareError) {
        return reply.code(err.statusCode).send({ message: err.message });
      }
      throw err;
    }
  });

  // ==========================================
  // ADMIN GOVERNANCE ONLY (NO CLINICAL ACCESS)
  // ==========================================

  app.get('/admin/art-care-plans', async (req, reply) => {
    if (!adminOnly(req, reply)) return reply;

    const [totalPlans, activePlans, modifiedPlans, discontinuedPlans] = await Promise.all([
      prisma.art_care_plans.count(),
      prisma.art_care_plans.count({ where: { status: 'ACTIVE' } }),
      prisma.art_care_plans.count({ where: { status: 'MODIFIED' } }),
      prisma.art_care_plans.count({ where: { status: 'DISCONTINUED' } })
    ]);

    // Admin receives ONLY high-level governance metadata, NEVER clinical regimens/details
    return reply.code(200).send({
      total_plans: totalPlans,
      active_plans: activePlans,
      modified_plans: modifiedPlans,
      discontinued_plans: discontinuedPlans
    });
  });
}
