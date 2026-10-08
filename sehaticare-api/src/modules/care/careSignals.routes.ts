import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../db/prisma';
import { authGuard } from '../../middlewares/auth';
import { isVerifiedCompanionProfile } from '../stage4/companionAssignments.service';
import {
  CareSignalError,
  getPatientCareSignals,
  requestPatientClinicalContact,
  requestPatientCompanionSupport,
  getPatientFollowUpSupportConsent,
  updatePatientFollowUpSupportConsent,
  getDoctorCareSignals,
  getDoctorPatientCareSignals,
  updateDoctorSignalStatus,
  recordDoctorSignalAction,
  getCompanionFollowUpSignals,
  getCompanionPatientFollowUpSignals,
  recordCompanionSignalAction,
  getAdminCareSignalsSummary
} from './careSignals.service';
import {
  requestClinicalContactSchema,
  requestCompanionSupportSchema,
  updateFollowUpConsentSchema,
  doctorSignalStatusUpdateSchema,
  doctorSignalActionSchema,
  companionSignalActionSchema,
  signalListQuerySchema
} from './careSignals.validators';
import {
  toPatientCareSignalDto,
  toDoctorCareSignalDto,
  toCompanionCareSignalDto,
  toFollowUpSupportConsentDto,
  toAdminCareSignalSummaryDto
} from './careSignals.presenter';

function setPrivateNoStoreHeaders(reply: FastifyReply) {
  reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  reply.header('Pragma', 'no-cache');
  reply.header('Expires', '0');
}

function requireRole(req: FastifyRequest, reply: FastifyReply, allowedRoles: string[]): boolean {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    void reply.code(403).send({ message: 'Akses ditolak' });
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

export default async function careSignalsRoutes(app: FastifyInstance) {
  // ==========================================
  // PATIENT ENDPOINTS
  // ==========================================

  app.get('/patient/care-signals', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    if (!requireRole(req, reply, ['PASIEN'])) return;

    const signals = await getPatientCareSignals(req.user!.userId);
    return {
      items: signals.map(toPatientCareSignalDto)
    };
  });

  app.post('/patient/care-signals/request-clinical-contact', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    if (!requireRole(req, reply, ['PASIEN'])) return;

    const body = requestClinicalContactSchema.parse(req.body || {});
    const signal = await requestPatientClinicalContact({
      patientUserId: req.user!.userId,
      category: body.category,
      preferredContactTime: body.preferred_contact_time,
      correlationId: req.id
    });

    return reply.code(201).send(toPatientCareSignalDto(signal));
  });

  app.post('/patient/care-signals/request-companion-support', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    if (!requireRole(req, reply, ['PASIEN'])) return;

    try {
      const body = requestCompanionSupportSchema.parse(req.body || {});
      const signal = await requestPatientCompanionSupport({
        patientUserId: req.user!.userId,
        preferredContactTime: body.preferred_contact_time,
        correlationId: req.id
      });

      return reply.code(201).send(toPatientCareSignalDto(signal));
    } catch (err: any) {
      if (err instanceof CareSignalError) {
        return reply.code(err.statusCode).send({ message: err.message });
      }
      throw err;
    }
  });

  app.get('/patient/care/follow-up-support-consent', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    if (!requireRole(req, reply, ['PASIEN'])) return;

    const consent = await getPatientFollowUpSupportConsent(req.user!.userId);
    return toFollowUpSupportConsentDto(consent);
  });

  app.patch('/patient/care/follow-up-support-consent', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    if (!requireRole(req, reply, ['PASIEN'])) return;

    const body = updateFollowUpConsentSchema.parse(req.body);
    const consent = await updatePatientFollowUpSupportConsent({
      patientUserId: req.user!.userId,
      isConsentEnabled: body.is_consent_enabled,
      correlationId: req.id
    });

    return toFollowUpSupportConsentDto(consent);
  });

  // ==========================================
  // DOCTOR ENDPOINTS
  // ==========================================

  app.get('/doctor/care-signals', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    if (!requireRole(req, reply, ['DOKTER'])) return;

    const query = signalListQuerySchema.parse(req.query || {});
    const signals = await getDoctorCareSignals({
      doctorUserId: req.user!.userId,
      status: query.status,
      scope: query.scope,
      limit: query.limit,
      offset: query.offset
    });

    return {
      items: signals.map(toDoctorCareSignalDto)
    };
  });

  app.get('/doctor/patients/:patientId/care-signals', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    if (!requireRole(req, reply, ['DOKTER'])) return;

    const { patientId } = req.params as { patientId: string };
    try {
      const signals = await getDoctorPatientCareSignals({
        doctorUserId: req.user!.userId,
        patientIdentifier: patientId
      });

      return {
        items: signals.map(toDoctorCareSignalDto)
      };
    } catch (err: any) {
      if (err instanceof CareSignalError) {
        return reply.code(err.statusCode).send({ message: err.message });
      }
      throw err;
    }
  });

  app.patch('/doctor/care-signals/:signalId/status', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    if (!requireRole(req, reply, ['DOKTER'])) return;

    const { signalId } = req.params as { signalId: string };
    const body = doctorSignalStatusUpdateSchema.parse(req.body);

    try {
      const updated = await updateDoctorSignalStatus({
        doctorUserId: req.user!.userId,
        signalIdentifier: signalId,
        status: body.status,
        correlationId: req.id
      });

      return toDoctorCareSignalDto(updated);
    } catch (err: any) {
      if (err instanceof CareSignalError) {
        return reply.code(err.statusCode).send({ message: err.message });
      }
      throw err;
    }
  });

  app.post('/doctor/care-signals/:signalId/actions', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    if (!requireRole(req, reply, ['DOKTER'])) return;

    const { signalId } = req.params as { signalId: string };
    const body = doctorSignalActionSchema.parse(req.body);

    try {
      const updated = await recordDoctorSignalAction({
        doctorUserId: req.user!.userId,
        signalIdentifier: signalId,
        actionType: body.action_type,
        nextFollowUpAt: body.next_follow_up_at,
        correlationId: req.id
      });

      return toDoctorCareSignalDto(updated);
    } catch (err: any) {
      if (err instanceof CareSignalError) {
        return reply.code(err.statusCode).send({ message: err.message });
      }
      throw err;
    }
  });

  // ==========================================
  // COMPANION ENDPOINTS
  // ==========================================

  app.get('/companion/follow-up-signals', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    const companion = await requireCompanion(req, reply);
    if (!companion) return;

    const query = signalListQuerySchema.parse(req.query || {});
    const signals = await getCompanionFollowUpSignals({
      companionUserId: companion.id,
      limit: query.limit,
      offset: query.offset
    });

    return {
      items: signals.map(toCompanionCareSignalDto)
    };
  });

  app.get('/companion/patients/:patientId/follow-up-signals', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    const companion = await requireCompanion(req, reply);
    if (!companion) return;

    const { patientId } = req.params as { patientId: string };
    try {
      const signals = await getCompanionPatientFollowUpSignals({
        companionUserId: companion.id,
        patientIdentifier: patientId
      });

      return {
        items: signals.map(toCompanionCareSignalDto)
      };
    } catch (err: any) {
      if (err instanceof CareSignalError) {
        return reply.code(err.statusCode).send({ message: err.message });
      }
      throw err;
    }
  });

  app.post('/companion/care-signals/:signalId/actions', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    const companion = await requireCompanion(req, reply);
    if (!companion) return;

    const { signalId } = req.params as { signalId: string };
    const body = companionSignalActionSchema.parse(req.body);

    try {
      const updated = await recordCompanionSignalAction({
        companionUserId: companion.id,
        signalIdentifier: signalId,
        actionType: body.action_type,
        nextFollowUpAt: body.next_follow_up_at,
        correlationId: req.id
      });

      return toCompanionCareSignalDto(updated);
    } catch (err: any) {
      if (err instanceof CareSignalError) {
        return reply.code(err.statusCode).send({ message: err.message });
      }
      throw err;
    }
  });

  // ==========================================
  // ADMIN GOVERNANCE ENDPOINT
  // ==========================================

  app.get('/admin/governance/care-signals/summary', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    if (!requireRole(req, reply, ['ADMIN'])) return;

    const stats = await getAdminCareSignalsSummary();
    return toAdminCareSignalSummaryDto(stats);
  });
}
