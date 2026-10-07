import { z } from 'zod';

export const assignmentStatusEnum = z.enum(['ACTIVE', 'ENDED', 'CANCELLED']);

export const assignmentCreateSchema = z.object({
  patient_id: z.string().trim().min(1, 'ID pasien wajib diisi'),
  companion_id: z.string().trim().min(1, 'ID pendamping wajib diisi'),
  facility_id: z.string().uuid('ID fasilitas tidak valid').optional().nullable(),
  notes: z.string().trim().max(500, 'Catatan maksimal 500 karakter').optional().nullable()
}).strict();

export const assignmentReassignSchema = z.object({
  companion_id: z.string().trim().min(1, 'ID pendamping baru wajib diisi'),
  facility_id: z.string().uuid('ID fasilitas tidak valid').optional().nullable(),
  reason: z.string().trim().max(500, 'Alasan maksimal 500 karakter').optional().nullable(),
  notes: z.string().trim().max(500, 'Catatan maksimal 500 karakter').optional().nullable()
}).strict();

export const assignmentEndSchema = z.object({
  reason: z.string().trim().max(500, 'Alasan maksimal 500 karakter').optional().nullable()
}).strict();

export const assignmentListQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'ENDED', 'CANCELLED', 'ALL']).optional(),
  companion_id: z.string().optional(),
  patient_id: z.string().optional(),
  facility_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});
