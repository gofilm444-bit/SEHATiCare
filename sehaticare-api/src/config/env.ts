import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load `.env` from the project root (works for both `src/` and `dist/` paths),
// regardless of where the process is started from.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envBoolean = z.preprocess((value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CORS_ORIGINS: z.string().optional(),
  ENABLE_HSTS: envBoolean.default(false),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REAUTH_SECRET: z.string().min(32).default('sehaticare_reauth_secret_2026_super_long_key_12345'),
  JWT_ACCESS_TTL_MINUTES: z.coerce.number().int().positive(),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive(),
  INTERNAL_AI_TOKEN: z.string().min(10),
  AI_PROVIDER: z.enum(['openai', 'mock']).default('mock'),
  AI_MODEL: z.string().default('gpt-4o-mini'),
  AI_ENABLED: envBoolean.default(false),
  AI_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(30),
  AI_API_KEY: z.string().optional(),
  STORAGE_ENDPOINT: z.string(),
  STORAGE_PORT: z.coerce.number().int().positive().optional(),
  STORAGE_REGION: z.string(),
  STORAGE_BUCKET: z.string(),
  STORAGE_ACCESS_KEY: z.string(),
  STORAGE_SECRET_KEY: z.string(),
  STORAGE_USE_SSL: envBoolean,
  STORAGE_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive(),
  STORAGE_PUBLIC_BASE_URL: z.string().url().optional()
  ,STAGE4_RETENTION_DAYS: z.coerce.number().int().min(30).max(3650).default(365)
  ,STAGE4_RETENTION_MODE: z.enum(['ARCHIVE','RESTRICT']).default('RESTRICT')
  ,STAGE4_LEGAL_HOLD_ENABLED: envBoolean.default(false)
  ,STATISTICS_MINIMUM_PUBLIC_COUNT: z.coerce.number().int().min(1).default(5)
});

export const env = envSchema.parse(process.env);
