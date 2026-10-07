import { z } from 'zod';

export const POLICY_VERSION = '2026-08-05-v1';
export const MIN_PASSWORD_LENGTH = 8;
const alias = z.string().trim().min(2).max(40).regex(/^[\p{L}\p{N} ._-]+$/u)
  .refine((v) => !/@|https?:|www\.|\+?\d[\d\s-]{6,}/i.test(v), 'Alias tidak boleh berisi data kontak')
  .refine((v) => !/\b(?:admin|dokter|psikolog|konselor|petugas|sehaticare)\b/i.test(v), 'Alias tidak boleh menyamar sebagai petugas resmi');
const password = z.string().min(MIN_PASSWORD_LENGTH).max(128)
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Kata sandi harus memuat huruf dan angka');

const anonymousRegistrationBase = z.object({
  alias,
  password,
  password_confirmation: z.string(),
  accept_terms: z.literal(true),
  accept_privacy: z.literal(true),
  policy_version: z.literal(POLICY_VERSION),
  website: z.string().max(0).optional().default('')
});
export const anonymousRegistrationSchema = anonymousRegistrationBase.refine((v) => v.password === v.password_confirmation, { path: ['password_confirmation'], message: 'Konfirmasi tidak cocok' });

export const anonymousLoginSchema = z.object({
  login_id: z.string().trim().min(8).max(32),
  password: z.string().min(1).max(128)
});

export const recoverySchema = z.object({
  login_id: z.string().trim().min(8).max(32),
  recovery_code: z.string().trim().min(15).max(40),
  new_password: password,
  password_confirmation: z.string()
}).refine((v) => v.new_password === v.password_confirmation, { path: ['password_confirmation'], message: 'Konfirmasi tidak cocok' });

export const profileSchema = z.object({
  alias: alias.optional(),
  avatar_key: z.enum(['avatar-leaf', 'avatar-sun', 'avatar-wave', 'avatar-star']).optional(),
  preferred_language: z.enum(['id']).optional(),
  timezone: z.enum(['Asia/Jayapura', 'Asia/Makassar', 'Asia/Jakarta']).optional(),
  accessibility_preferences: z.object({ text_to_speech: z.boolean().optional(), high_contrast: z.boolean().optional(), large_text: z.boolean().optional() }).strict().optional(),
  notification_preferences: z.object({ in_app: z.boolean().optional(), neutral_copy: z.boolean().optional() }).strict().optional()
}).strict();

export const passwordChangeSchema = z.object({ current_password: z.string().min(1).max(128), new_password: password, password_confirmation: z.string() })
  .refine((v) => v.new_password === v.password_confirmation, { path: ['password_confirmation'], message: 'Konfirmasi tidak cocok' });
export const passwordConfirmSchema = z.object({ password: z.string().min(1).max(128) });
export const conversionSchema = anonymousRegistrationBase.omit({ website: true }).extend({ current_password: z.string().min(1).max(128) })
  .refine((v) => v.password === v.password_confirmation, { path: ['password_confirmation'], message: 'Konfirmasi tidak cocok' });
