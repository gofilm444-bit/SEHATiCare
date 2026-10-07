import { z } from 'zod';

export const artCareItemSchema = z.object({
  medication_name: z.string().trim().min(1, 'Nama obat/rejimen wajib diisi').max(200),
  strength: z.string().trim().max(100).optional().nullable(),
  dose_instructions: z.string().trim().max(255).optional().nullable(),
  frequency_per_day: z.number().int().min(1).max(6).default(1),
  timing_description: z.string().trim().max(100).optional().nullable(),
  is_active: z.boolean().default(true)
});

export const doctorArtCarePlanCreateSchema = z.object({
  items: z.array(artCareItemSchema).min(1, 'Minimal satu obat/rejimen diperlukan'),
  clinical_notes: z.string().trim().max(1000).optional().nullable(),
  change_reason: z.string().trim().max(255).optional().nullable(),
  started_at: z.string().datetime().optional()
});

export const doctorArtCarePlanUpdateSchema = z.object({
  status: z.enum(['ACTIVE', 'MODIFIED', 'DISCONTINUED', 'COMPLETED']).optional(),
  clinical_notes: z.string().trim().max(1000).optional().nullable(),
  change_reason: z.string().trim().max(255).optional().nullable(),
  ended_at: z.string().datetime().optional().nullable()
});

export const patientConsentUpdateSchema = z.object({
  is_consent_enabled: z.boolean()
});

export const patientReminderSyncSchema = z.object({
  art_item_id: z.string().uuid(),
  display_label: z.string().trim().min(1).max(100).default('Pengingat Minum Obat'),
  reminder_times: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format waktu harus HH:mm')).min(1),
  timezone: z.string().trim().default('Asia/Jayapura'),
  notification_privacy: z.enum(['NEUTRAL', 'LABEL_IN_APP']).default('NEUTRAL'),
  is_active: z.boolean().default(true)
});

export const adherenceQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7)
});
