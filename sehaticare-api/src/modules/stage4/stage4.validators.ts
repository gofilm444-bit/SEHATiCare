import { z } from 'zod';
import { isValidTimeZone } from '../healthPlanning/timezone';

const clean = (max: number, min = 1) => z.string().trim().min(min).max(max)
  .refine((value) => !/[<>\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value), 'Unsafe text')
  .refine((value) => !/javascript\s*:/i.test(value), 'Unsafe URL');
export const publicId = (prefix: string) => z.string().regex(new RegExp(`^${prefix}_[a-f0-9]{32}$`));
export const idempotencyKey = z.string().trim().regex(/^[A-Za-z0-9_-]{8,80}$/);
export const pageSchema = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(20), status: z.string().max(30).optional(), since: z.coerce.date().optional(), cursor: z.string().max(40).optional() });
export const consultationTopicSchema = z.enum(['HEALTH_CONCERN','SERVICE_INFORMATION','EMOTIONAL_SUPPORT','MEDICATION_OR_THERAPY','SERVICE_ACCESS','OTHER']);
export const assignmentModeSchema = z.enum(['RECOMMENDED','SELECTED','FASTEST','GENERAL_QUEUE']);
export const counselorProfileSchema = z.object({
  user_public_id: publicId('usr'),
  permission_enabled: z.boolean(),
  verification_status: z.enum(['PENDING','VERIFIED','REJECTED']),
  professional_name: clean(100),
  profession: clean(80),
  service_role: z.enum(['COUNSELOR','FACILITATOR','COMPANION','OUTREACH_WORKER','SUPPORT_OFFICER']).default('COUNSELOR'),
  facility_id: z.string().uuid().nullable().optional(),
  region_id: z.string().uuid().nullable().optional(),
  competencies: z.array(consultationTopicSchema.or(z.literal('GENERAL'))).min(1).max(12),
  languages: z.array(clean(40)).min(1).max(10),
  active_days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  opens_at: z.string().regex(/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/),
  closes_at: z.string().regex(/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/),
  timezone: clean(80).refine(isValidTimeZone, 'Invalid timezone'),
  is_available: z.boolean(),
  max_active_conversations: z.number().int().min(1).max(100),
  is_active: z.boolean()
}).strict();
export const counselorSearchSchema = z.object({
  topic: consultationTopicSchema,
  region_id: z.string().uuid().optional(),
  facility_id: z.string().uuid().optional(),
  profession: clean(80).optional(),
  language: clean(80).optional(),
  available_now: z.coerce.boolean().optional()
}).strict();
export const conversationCreateSchema = z.object({
  service_type: z.literal('COUNSELOR').default('COUNSELOR'),
  service_intent: z.enum(['COUNSELING', 'COMPANION_SUPPORT']).default('COUNSELING'),
  subject: clean(120).optional(),
  initial_message: clean(2000),
  priority: z.number().int().min(0).max(3).default(0),
  topic: consultationTopicSchema.default('OTHER'),
  assignment_mode: assignmentModeSchema.default('GENERAL_QUEUE'),
  region_id: z.string().uuid().optional(),
  facility_id: z.string().uuid().optional(),
  counselor_public_id: publicId('usr').optional(),
  allow_previous_counselor: z.boolean().default(false),
  submission_key: idempotencyKey.optional(),
  user_id: z.unknown().optional()
}).strict().superRefine((value, ctx) => {
  if (value.assignment_mode === 'SELECTED' && !value.counselor_public_id && value.service_intent !== 'COMPANION_SUPPORT') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['counselor_public_id'], message: 'Counselor required' });
  }
});
export const messageSchema = z.object({ content: clean(2000), idempotency_key: idempotencyKey, sender_id: z.unknown().optional(), user_id: z.unknown().optional() }).strict();
export const closeSchema = z.object({ reason: clean(300).optional() }).strict();
export const reportSchema = z.object({ message_public_id: publicId('msg').optional(), reason: z.enum(['SPAM','HARASSMENT','THREAT','INAPPROPRIATE_CONTENT','PRIVACY_VIOLATION','OTHER']), description: clean(500).optional() }).strict();
export const blockSchema = z.object({ reason: clean(300).optional() }).strict();
export const assignSchema = z.object({ counselor_public_id: publicId('usr').optional(), reason: clean(300).optional() }).strict();
export const escalateSchema = z.object({ reason: clean(500) }).strict();
export const voiceUploadSchema = z.object({ content_type: z.string().max(80), file_size_bytes: z.number().int().positive(), duration_seconds: z.number().int().min(1).max(120) }).strict();
export const voiceCommitSchema = voiceUploadSchema.extend({ upload_session_id: z.string().uuid(), idempotency_key: idempotencyKey });

export const complaintCreateSchema = z.object({ category: z.enum(['SERVICE','ACCESS','PRIVACY','APPLICATION','FACILITY','OTHER']), subject: clean(140), description: clean(5000), priority: z.number().int().min(0).max(3).default(0), facility_id: z.string().uuid().optional(), privacy_level: z.enum(['ANONYMOUS','PRIVATE']).default('ANONYMOUS'), consent: z.literal(true), submission_key: idempotencyKey, name: z.unknown().optional(), email: z.unknown().optional(), phone: z.unknown().optional(), user_id: z.unknown().optional() }).strict();
export const complaintMessageSchema = z.object({ content: clean(3000), idempotency_key: idempotencyKey, type: z.literal('PUBLIC_REPLY').optional(), user_id: z.unknown().optional() }).strict();
export const officerReplySchema = z.object({ content: clean(3000), idempotency_key: idempotencyKey }).strict();
export const officerAssignSchema = z.object({ officer_public_id: publicId('usr').optional(), reason: clean(300).optional() }).strict();
export const attachmentUploadSchema = z.object({ content_type: z.enum(['application/pdf','image/png','image/jpeg']), file_size_bytes: z.number().int().positive().max(5 * 1024 * 1024) }).strict();
export const attachmentCommitSchema = attachmentUploadSchema.extend({ upload_session_id: z.string().uuid() });
export const trackingSecretSchema = z.string().regex(/^TRK-[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}$/);
export const settingsSchema = z.object({ timezone: z.string().refine(isValidTimeZone), active_days: z.array(z.number().int().min(0).max(6)).min(1).max(7), opens_at: z.string().regex(/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/), closes_at: z.string().regex(/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/) });
