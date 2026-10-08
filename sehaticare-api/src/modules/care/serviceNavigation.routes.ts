import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../db/prisma';
import { authGuard } from '../../middlewares/auth';
import { isVerifiedCompanionProfile } from '../stage4/companionAssignments.service';
import {
  getPublicServiceFacilities,
  getPublicServiceFacilityById,
  getEligibleTargetClinicians,
  createDoctorAffiliation,
  requestPatientReferral,
  getPatientReferrals,
  getPatientReferralDetail,
  updatePatientReferralConsent,
  cancelPatientReferral,
  updatePatientReferralCompanionShare,
  getDoctorPatientReferrals,
  createDoctorReferralDraft,
  reviewDoctorPatientReferral,
  updateDoctorReferralDraft,
  requestDoctorPatientReferralConsent,
  sendDoctorReferral,
  cancelDoctorReferral,
  completeReferral,
  getDoctorIncomingReferrals,
  getDoctorIncomingReferralDetail,
  acceptIncomingReferral,
  declineIncomingReferral,
  getCompanionReferrals,
  getCompanionPatientReferrals,
  recordCompanionReferralAction,
  getAdminReferralsSummary
} from './serviceNavigation.service';
import {
  serviceDirectoryQuerySchema,
  patientReferralRequestSchema,
  referralConsentUpdateSchema,
  referralCompanionShareUpdateSchema,
  doctorCreateReferralDraftSchema,
  doctorReviewReferralSchema,
  doctorUpdateReferralDraftSchema,
  doctorDeclineReferralSchema,
  companionReferralActionSchema,
  adminAffiliationCreateSchema
} from './serviceNavigation.validators';
import {
  toPublicFacilityDto,
  toPatientReferralDto,
  toDoctorOutgoingReferralDto,
  toDoctorIncomingReferralEnvelopeDto,
  toCompanionReferralDto,
  toAdminReferralSummaryDto
} from './serviceNavigation.presenter';

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

export default async function serviceNavigationRoutes(app: FastifyInstance) {
  // ==========================================
  // PUBLIC SERVICE FACILITY DIRECTORY
  // ==========================================

  app.get('/public/service-facilities', async (req) => {
    const query = serviceDirectoryQuerySchema.parse(req.query || {});
    const { facilities, total } = await getPublicServiceFacilities(query);
    return {
      items: facilities.map(toPublicFacilityDto),
      total
    };
  });

  app.get('/public/service-facilities/:facilityId', async (req) => {
    const { facilityId } = req.params as { facilityId: string };
    const facility = await getPublicServiceFacilityById(facilityId);
    return toPublicFacilityDto(facility);
  });

  // ==========================================
  // PATIENT REFERRAL WORKFLOWS
  // ==========================================

  app.get('/patient/referrals', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    if (!requireRole(req, reply, ['PASIEN'])) return;

    const referrals = await getPatientReferrals(req.user!.userId);
    return {
      items: referrals.map(toPatientReferralDto)
    };
  });

  app.get('/patient/referrals/:referralId', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    if (!requireRole(req, reply, ['PASIEN'])) return;

    const { referralId } = req.params as { referralId: string };
    const referral = await getPatientReferralDetail(req.user!.userId, referralId);
    return toPatientReferralDto(referral);
  });

  app.post('/patient/referrals/request', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    if (!requireRole(req, reply, ['PASIEN'])) return;

    const body = patientReferralRequestSchema.parse(req.body || {});
    const referral = await requestPatientReferral({
      patientUserId: req.user!.userId,
      targetFacilityId: body.target_facility_id,
      referralType: body.referral_type,
      schedulingPreference: body.scheduling_preference,
      correlationId: req.id
    });

    return reply.code(201).send(toPatientReferralDto(referral));
  });

  app.patch('/patient/referrals/:referralId/consent', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    if (!requireRole(req, reply, ['PASIEN'])) return;

    const { referralId } = req.params as { referralId: string };
    const body = referralConsentUpdateSchema.parse(req.body || {});
    const referral = await updatePatientReferralConsent({
      patientUserId: req.user!.userId,
      referralIdentifier: referralId,
      isConsentEnabled: body.is_consent_enabled,
      correlationId: req.id
    });

    return toPatientReferralDto(referral);
  });

  app.post('/patient/referrals/:referralId/cancel', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    if (!requireRole(req, reply, ['PASIEN'])) return;

    const { referralId } = req.params as { referralId: string };
    const referral = await cancelPatientReferral({
      patientUserId: req.user!.userId,
      referralIdentifier: referralId,
      correlationId: req.id
    });

    return toPatientReferralDto(referral);
  });

  app.get('/patient/referrals/:referralId/companion-share', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    if (!requireRole(req, reply, ['PASIEN'])) return;

    const { referralId } = req.params as { referralId: string };
    const referral = await getPatientReferralDetail(req.user!.userId, referralId);
    return {
      is_enabled: Boolean(referral.companion_share?.is_enabled),
      share_target_facility: Boolean(referral.companion_share?.share_target_facility)
    };
  });

  app.patch('/patient/referrals/:referralId/companion-share', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    if (!requireRole(req, reply, ['PASIEN'])) return;

    const { referralId } = req.params as { referralId: string };
    const body = referralCompanionShareUpdateSchema.parse(req.body || {});
    const referral = await updatePatientReferralCompanionShare({
      patientUserId: req.user!.userId,
      referralIdentifier: referralId,
      isEnabled: body.is_enabled,
      shareTargetFacility: body.share_target_facility,
      correlationId: req.id
    });

    return toPatientReferralDto(referral);
  });

  // ==========================================
  // DOCTOR WORKFLOWS — SOURCE DOCTOR
  // ==========================================

  app.get('/doctor/patients/:patientId/referrals', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    if (!requireRole(req, reply, ['DOKTER'])) return;

    const { patientId } = req.params as { patientId: string };
    const referrals = await getDoctorPatientReferrals({
      doctorUserId: req.user!.userId,
      patientIdentifier: patientId
    });

    return {
      items: referrals.map(toDoctorOutgoingReferralDto)
    };
  });

  app.post('/doctor/patients/:patientId/referrals', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    if (!requireRole(req, reply, ['DOKTER'])) return;

    const { patientId } = req.params as { patientId: string };
    const body = doctorCreateReferralDraftSchema.parse(req.body || {});
    const referral = await createDoctorReferralDraft({
      doctorUserId: req.user!.userId,
      patientIdentifier: patientId,
      targetFacilityId: body.target_facility_id,
      targetDoctorId: body.target_doctor_id,
      referralType: body.referral_type,
      schedulingPreference: body.scheduling_preference,
      correlationId: req.id
    });

    return reply.code(201).send(toDoctorOutgoingReferralDto(referral));
  });

  app.patch('/doctor/referrals/:referralId', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    if (!requireRole(req, reply, ['DOKTER'])) return;

    const { referralId } = req.params as { referralId: string };
    const body = doctorUpdateReferralDraftSchema.parse(req.body || {});
    const referral = await updateDoctorReferralDraft({
      doctorUserId: req.user!.userId,
      referralIdentifier: referralId,
      targetFacilityId: body.target_facility_id,
      targetDoctorId: body.target_doctor_id,
      referralType: body.referral_type,
      schedulingPreference: body.scheduling_preference,
      correlationId: req.id
    });

    return toDoctorOutgoingReferralDto(referral);
  });

  app.post('/doctor/referrals/:referralId/review', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    if (!requireRole(req, reply, ['DOKTER'])) return;

    const { referralId } = req.params as { referralId: string };
    const body = doctorReviewReferralSchema.parse(req.body || {});
    const referral = await reviewDoctorPatientReferral({
      doctorUserId: req.user!.userId,
      referralIdentifier: referralId,
      targetFacilityId: body.target_facility_id,
      targetDoctorId: body.target_doctor_id,
      referralType: body.referral_type,
      schedulingPreference: body.scheduling_preference,
      correlationId: req.id
    });

    return toDoctorOutgoingReferralDto(referral);
  });

  app.post('/doctor/referrals/:referralId/request-consent', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    if (!requireRole(req, reply, ['DOKTER'])) return;

    const { referralId } = req.params as { referralId: string };
    const referral = await requestDoctorPatientReferralConsent({
      doctorUserId: req.user!.userId,
      referralIdentifier: referralId,
      correlationId: req.id
    });

    return toDoctorOutgoingReferralDto(referral);
  });

  app.post('/doctor/referrals/:referralId/send', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    if (!requireRole(req, reply, ['DOKTER'])) return;

    const { referralId } = req.params as { referralId: string };
    const referral = await sendDoctorReferral({
      doctorUserId: req.user!.userId,
      referralIdentifier: referralId,
      correlationId: req.id
    });

    return toDoctorOutgoingReferralDto(referral);
  });

  app.post('/doctor/referrals/:referralId/cancel', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    if (!requireRole(req, reply, ['DOKTER'])) return;

    const { referralId } = req.params as { referralId: string };
    const referral = await cancelDoctorReferral({
      doctorUserId: req.user!.userId,
      referralIdentifier: referralId,
      correlationId: req.id
    });

    return toDoctorOutgoingReferralDto(referral);
  });

  app.post('/doctor/referrals/:referralId/complete', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    if (!requireRole(req, reply, ['DOKTER'])) return;

    const { referralId } = req.params as { referralId: string };
    const referral = await completeReferral({
      doctorUserId: req.user!.userId,
      referralIdentifier: referralId,
      correlationId: req.id
    });

    return toDoctorOutgoingReferralDto(referral);
  });

  app.get('/doctor/referral-destinations/:facilityId/clinicians', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    if (!requireRole(req, reply, ['DOKTER'])) return;

    const { facilityId } = req.params as { facilityId: string };
    const clinicians = await getEligibleTargetClinicians(facilityId);
    return { items: clinicians };
  });

  // ==========================================
  // DOCTOR WORKFLOWS — RECEIVING DOCTOR
  // ==========================================

  app.get('/doctor/incoming-referrals', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    if (!requireRole(req, reply, ['DOKTER'])) return;

    const referrals = await getDoctorIncomingReferrals(req.user!.userId);
    return {
      items: referrals.map(toDoctorIncomingReferralEnvelopeDto)
    };
  });

  app.get('/doctor/incoming-referrals/:referralId', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    if (!requireRole(req, reply, ['DOKTER'])) return;

    const { referralId } = req.params as { referralId: string };
    const referral = await getDoctorIncomingReferralDetail(req.user!.userId, referralId);
    return toDoctorIncomingReferralEnvelopeDto(referral);
  });

  app.post('/doctor/incoming-referrals/:referralId/accept', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    if (!requireRole(req, reply, ['DOKTER'])) return;

    const { referralId } = req.params as { referralId: string };
    const referral = await acceptIncomingReferral({
      doctorUserId: req.user!.userId,
      referralIdentifier: referralId,
      correlationId: req.id
    });

    return toDoctorOutgoingReferralDto(referral);
  });

  app.post('/doctor/incoming-referrals/:referralId/decline', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    if (!requireRole(req, reply, ['DOKTER'])) return;

    const { referralId } = req.params as { referralId: string };
    const body = doctorDeclineReferralSchema.parse(req.body || {});
    const referral = await declineIncomingReferral({
      doctorUserId: req.user!.userId,
      referralIdentifier: referralId,
      reason: body.reason,
      correlationId: req.id
    });

    return toDoctorOutgoingReferralDto(referral);
  });

  // ==========================================
  // COMPANION WORKFLOWS & REFERRAL SUPPORT
  // ==========================================

  app.get('/companion/referral-support', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    const companion = await requireCompanion(req, reply);
    if (!companion) return;

    const referrals = await getCompanionReferrals(companion.id);
    return {
      items: referrals.map(toCompanionReferralDto)
    };
  });

  app.get('/companion/patients/:patientId/referral-support', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    const companion = await requireCompanion(req, reply);
    if (!companion) return;

    const { patientId } = req.params as { patientId: string };
    const referrals = await getCompanionPatientReferrals({
      companionUserId: companion.id,
      patientIdentifier: patientId
    });

    return {
      items: referrals.map(toCompanionReferralDto)
    };
  });

  app.post('/companion/referrals/:referralId/actions', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    const companion = await requireCompanion(req, reply);
    if (!companion) return;

    const { referralId } = req.params as { referralId: string };
    const body = companionReferralActionSchema.parse(req.body || {});
    const referral = await recordCompanionReferralAction({
      companionUserId: companion.id,
      referralIdentifier: referralId,
      actionType: body.action_type,
      correlationId: req.id
    });

    return toCompanionReferralDto(referral);
  });

  // ==========================================
  // ADMIN & GOVERNANCE ENDPOINTS
  // ==========================================

  app.get('/admin/governance/referrals/summary', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    if (!requireRole(req, reply, ['ADMIN'])) return;

    const summary = await getAdminReferralsSummary();
    return toAdminReferralSummaryDto(summary);
  });

  app.post('/admin/facilities/:facilityId/affiliations', { preHandler: [authGuard] }, async (req, reply) => {
    setPrivateNoStoreHeaders(reply);
    if (!requireRole(req, reply, ['ADMIN'])) return;

    const { facilityId } = req.params as { facilityId: string };
    const body = adminAffiliationCreateSchema.parse({
      ...((req.body as any) || {}),
      facility_id: facilityId
    });

    const affiliation = await createDoctorAffiliation({
      doctorUserId: body.doctor_user_id,
      facilityId: body.facility_id,
      isActive: body.is_active
    });

    return reply.code(201).send({
      id: affiliation.id,
      doctor_user_id: affiliation.doctor_user_id,
      facility_id: affiliation.facility_id,
      is_active: affiliation.is_active
    });
  });
}
