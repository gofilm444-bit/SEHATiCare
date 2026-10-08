import { z } from 'zod';

export const serviceDirectoryQuerySchema = z
  .object({
    region_id: z.string().uuid().optional(),
    service_type: z
      .enum([
        'COUNSELING',
        'HIV_TESTING',
        'ARV_SERVICE',
        'PSYCHOLOGY',
        'LABORATORY',
        'PHARMACY',
        'DISABILITY_ACCESS',
        'OTHER',
        'CLINICAL_CONSULTATION',
        'ART_CONTINUITY',
        'LAB_MONITORING',
        'REFERRAL_INTAKE'
      ])
      .optional(),
    facility_type: z.enum(['PUSKESMAS', 'RUMAH_SAKIT', 'KLINIK']).optional(),
    q: z.string().max(100).optional(),
    limit: z.coerce.number().min(1).max(100).optional().default(20),
    offset: z.coerce.number().min(0).optional().default(0)
  })
  .strict();

export const patientReferralRequestSchema = z
  .object({
    target_facility_id: z.string().uuid(),
    referral_type: z
      .enum([
        'CLINICAL_FOLLOW_UP',
        'CONTINUITY_OF_CARE',
        'LAB_MONITORING',
        'MEDICATION_CONTINUITY',
        'COUNSELING',
        'GENERAL_REFERRAL'
      ])
      .optional()
      .default('GENERAL_REFERRAL'),
    scheduling_preference: z.string().max(100).optional().nullable()
  })
  .strict();

export const referralConsentUpdateSchema = z
  .object({
    is_consent_enabled: z.boolean()
  })
  .strict();

export const referralCompanionShareUpdateSchema = z
  .object({
    is_enabled: z.boolean(),
    share_target_facility: z.boolean().optional().default(false)
  })
  .strict();

export const doctorCreateReferralDraftSchema = z
  .object({
    target_facility_id: z.string().uuid(),
    target_doctor_id: z.string().uuid().optional().nullable(),
    referral_type: z.enum([
      'CLINICAL_FOLLOW_UP',
      'CONTINUITY_OF_CARE',
      'LAB_MONITORING',
      'MEDICATION_CONTINUITY',
      'COUNSELING',
      'GENERAL_REFERRAL'
    ]),
    scheduling_preference: z.string().max(100).optional().nullable()
  })
  .strict();

export const doctorUpdateReferralDraftSchema = z
  .object({
    target_facility_id: z.string().uuid().optional(),
    target_doctor_id: z.string().uuid().optional().nullable(),
    referral_type: z
      .enum([
        'CLINICAL_FOLLOW_UP',
        'CONTINUITY_OF_CARE',
        'LAB_MONITORING',
        'MEDICATION_CONTINUITY',
        'COUNSELING',
        'GENERAL_REFERRAL'
      ])
      .optional(),
    scheduling_preference: z.string().max(100).optional().nullable()
  })
  .strict();

export const doctorReviewReferralSchema = doctorUpdateReferralDraftSchema;

export const doctorDeclineReferralSchema = z
  .object({
    reason: z.enum([
      'SERVICE_NOT_AVAILABLE',
      'CAPACITY_UNAVAILABLE',
      'WRONG_SERVICE',
      'NEEDS_DIFFERENT_FACILITY',
      'OTHER_OPERATIONAL'
    ])
  })
  .strict();

export const companionReferralActionSchema = z
  .object({
    action_type: z.enum(['ACKNOWLEDGED', 'CONTACT_ATTEMPTED', 'CONTACTED'])
  })
  .strict();

export const adminAffiliationCreateSchema = z
  .object({
    doctor_user_id: z.string().uuid(),
    facility_id: z.string().uuid(),
    is_active: z.boolean().optional().default(true)
  })
  .strict();
