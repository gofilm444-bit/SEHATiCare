import { z } from 'zod';

const phoneRegex = /^\+[1-9]\d{6,14}$/;

export const otpRequestSchema = z
  .object({
    phone_e164: z.string().regex(phoneRegex, 'Invalid phone').optional(),
    email: z.string().email().optional()
  })
  .refine((data) => data.phone_e164 || data.email, {
    message: 'phone_e164 or email is required'
  });

export const otpVerifySchema = z
  .object({
    phone_e164: z.string().regex(phoneRegex, 'Invalid phone').optional(),
    email: z.string().email().optional(),
    otp: z.string().min(4).max(8)
  })
  .refine((data) => data.phone_e164 || data.email, {
    message: 'phone_e164 or email is required'
  });

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export { anonymousLoginSchema } from '../account/account.validators';
