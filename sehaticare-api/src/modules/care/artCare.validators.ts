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

export const patientSideEffectCreateSchema = z.object({
  symptom_name: z.string().trim().min(1, 'Nama keluhan wajib diisi').max(200),
  severity: z.enum(['MILD', 'MODERATE', 'SEVERE']),
  patient_note: z.string().trim().max(1000).optional().nullable(),
  occurred_at: z.string().datetime().optional(),
  art_care_plan_id: z.string().optional().nullable()
});

export const patientSideEffectUpdateSchema = z.object({
  symptom_name: z.string().trim().min(1).max(200).optional(),
  severity: z.enum(['MILD', 'MODERATE', 'SEVERE']).optional(),
  patient_note: z.string().trim().max(1000).optional().nullable(),
  status: z.enum(['ACTIVE', 'RESOLVED']).optional(),
  occurred_at: z.string().datetime().optional(),
  resolved_at: z.string().datetime().optional().nullable()
});

export const patientMedicationStockCreateSchema = z.object({
  art_plan_item_id: z.string().optional().nullable(),
  quantity_remaining: z.number().min(0, 'Jumlah obat tidak boleh negatif').max(9999.99).optional().nullable(),
  unit: z.string().trim().max(50).optional().nullable(),
  estimated_days_remaining: z.number().int().min(0, 'Estimasi hari tersisa tidak boleh negatif').max(365).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  recorded_at: z.string().datetime().optional()
}).refine(
  (data) => (data.quantity_remaining !== undefined && data.quantity_remaining !== null) || (data.estimated_days_remaining !== undefined && data.estimated_days_remaining !== null),
  { message: 'Minimal masukkan jumlah persediaan atau estimasi hari tersisa.' }
);

export const patientRefillSettingsUpdateSchema = z.object({
  refill_alert_threshold_days: z.number().int().min(1, 'Ambang batas minimal 1 hari').max(30, 'Ambang batas maksimal 30 hari')
});

export const patientRefillSupportConsentUpdateSchema = z.object({
  is_consent_enabled: z.boolean()
});

