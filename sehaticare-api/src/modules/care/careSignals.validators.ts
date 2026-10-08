import { z } from 'zod';

export const requestClinicalContactSchema = z
  .object({
    category: z
      .enum(['GENERAL_HEALTH_SUPPORT', 'MEDICATION_QUESTION', 'FOLLOW_UP_HELP', 'OTHER'])
      .optional()
      .default('GENERAL_HEALTH_SUPPORT'),
    preferred_contact_time: z
      .enum(['MORNING', 'AFTERNOON', 'EVENING', 'ANYTIME'])
      .optional()
      .default('ANYTIME')
  })
  .strict();

export const requestCompanionSupportSchema = z
  .object({
    preferred_contact_time: z
      .enum(['MORNING', 'AFTERNOON', 'EVENING', 'ANYTIME'])
      .optional()
      .default('ANYTIME')
  })
  .strict();

export const updateFollowUpConsentSchema = z
  .object({
    is_consent_enabled: z.boolean()
  })
  .strict();

export const doctorSignalStatusUpdateSchema = z
  .object({
    status: z.enum(['ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'])
  })
  .strict();

export const doctorSignalActionSchema = z
  .object({
    action_type: z.enum([
      'ACKNOWLEDGED',
      'CONTACT_ATTEMPTED',
      'CONTACTED',
      'FOLLOW_UP_SCHEDULED',
      'ESCALATED_TO_CLINICAL',
      'RESOLVED',
      'DISMISSED'
    ]),
    next_follow_up_at: z.string().datetime().nullable().optional()
  })
  .strict();

export const companionSignalActionSchema = z
  .object({
    action_type: z.enum([
      'ACKNOWLEDGED',
      'CONTACT_ATTEMPTED',
      'CONTACTED',
      'FOLLOW_UP_SCHEDULED',
      'ESCALATED_TO_CLINICAL'
    ]),
    next_follow_up_at: z.string().datetime().nullable().optional()
  })
  .strict();

export const signalListQuerySchema = z
  .object({
    status: z.enum(['ALL', 'OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED']).optional().default('OPEN'),
    scope: z.enum(['ALL', 'CLINICAL', 'SUPPORT']).optional(),
    limit: z.coerce.number().min(1).max(100).optional().default(20),
    offset: z.coerce.number().min(0).optional().default(0)
  })
  .strict();
