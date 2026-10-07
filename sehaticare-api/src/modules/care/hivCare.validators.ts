import { z } from 'zod';

export const enrollmentCreateSchema = z.object({
  patient_public_id: z.string().min(1, 'Patient identifier is required'),
  facility_id: z.string().uuid('Invalid facility ID format').optional().nullable()
});

export const enrollmentTransferSchema = z.object({
  facility_id: z.string().uuid('Invalid facility ID format'),
  transfer_reason: z.string().max(255).optional().nullable()
});

export const enrollmentEndSchema = z.object({
  end_reason: z.string().min(1, 'End reason is required').max(255)
});

export const enrollmentListQuerySchema = z.object({
  status: z.enum(['ALL', 'ACTIVE', 'INACTIVE', 'TRANSFERRED', 'ENDED']).optional().default('ALL'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export const viralLoadInterpretationEnum = z.enum([
  'DETECTED',
  'NOT_DETECTED',
  'BELOW_QUANTIFICATION',
  'UNKNOWN'
]);

export const doctorMonitoringCreateSchema = z.object({
  recorded_at: z
    .string()
    .datetime({ message: 'Invalid ISO datetime format for recorded_at' })
    .or(z.date())
    .transform((val) => (typeof val === 'string' ? new Date(val) : val))
    .refine((d) => !isNaN(d.getTime()), { message: 'Invalid datetime' }),
  weight_kg: z
    .number({ invalid_type_error: 'Weight must be a number' })
    .positive('Weight must be positive')
    .max(500, 'Weight out of reasonable range')
    .optional()
    .nullable(),
  cd4_count_cells_mm3: z
    .number({ invalid_type_error: 'CD4 count must be an integer' })
    .int('CD4 count must be an integer')
    .nonnegative('CD4 count cannot be negative')
    .max(100000, 'CD4 count out of reasonable range')
    .optional()
    .nullable(),
  viral_load_copies_ml: z
    .number({ invalid_type_error: 'Viral load must be an integer' })
    .int('Viral load must be an integer')
    .nonnegative('Viral load cannot be negative')
    .max(100000000, 'Viral load out of reasonable range')
    .optional()
    .nullable(),
  viral_load_interpretation: viralLoadInterpretationEnum.optional().nullable(),
  tb_screening_result: z.string().max(100).trim().optional().nullable(),
  general_condition: z.string().max(255).trim().optional().nullable(),
  clinical_note_private: z.string().max(2000).trim().optional().nullable()
});

export const doctorMonitoringUpdateSchema = z.object({
  recorded_at: z
    .string()
    .datetime({ message: 'Invalid ISO datetime format for recorded_at' })
    .or(z.date())
    .transform((val) => (typeof val === 'string' ? new Date(val) : val))
    .refine((d) => !isNaN(d.getTime()), { message: 'Invalid datetime' })
    .optional(),
  weight_kg: z
    .number({ invalid_type_error: 'Weight must be a number' })
    .positive('Weight must be positive')
    .max(500, 'Weight out of reasonable range')
    .optional()
    .nullable(),
  cd4_count_cells_mm3: z
    .number({ invalid_type_error: 'CD4 count must be an integer' })
    .int('CD4 count must be an integer')
    .nonnegative('CD4 count cannot be negative')
    .max(100000, 'CD4 count out of reasonable range')
    .optional()
    .nullable(),
  viral_load_copies_ml: z
    .number({ invalid_type_error: 'Viral load must be an integer' })
    .int('Viral load must be an integer')
    .nonnegative('Viral load cannot be negative')
    .max(100000000, 'Viral load out of reasonable range')
    .optional()
    .nullable(),
  viral_load_interpretation: viralLoadInterpretationEnum.optional().nullable(),
  tb_screening_result: z.string().max(100).trim().optional().nullable(),
  general_condition: z.string().max(255).trim().optional().nullable(),
  clinical_note_private: z.string().max(2000).trim().optional().nullable()
});

export const patientSelfReportCreateSchema = z.object({
  recorded_at: z
    .string()
    .datetime({ message: 'Invalid ISO datetime format for recorded_at' })
    .or(z.date())
    .transform((val) => (typeof val === 'string' ? new Date(val) : val))
    .refine((d) => !isNaN(d.getTime()), { message: 'Invalid datetime' }),
  weight_kg: z
    .number({ invalid_type_error: 'Weight must be a number' })
    .positive('Weight must be positive')
    .max(500, 'Weight out of reasonable range')
    .optional()
    .nullable(),
  general_condition: z.string().max(255).trim().optional().nullable(),
  patient_note: z.string().max(1000).trim().optional().nullable()
});

export const monitoringListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  include_archived: z
    .string()
    .optional()
    .transform((val) => val === 'true')
});
