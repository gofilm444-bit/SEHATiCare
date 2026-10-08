import { z } from 'zod';

export const allowedAutoLockMinutes = [null, 0, 1, 5, 15, 30] as const;

export const privacyPreferencesPatchSchema = z.object({
  lock_on_background: z.boolean().optional(),
  auto_lock_minutes: z.union([
    z.null(),
    z.literal(0),
    z.literal(1),
    z.literal(5),
    z.literal(15),
    z.literal(30)
  ]).optional(),
  require_reauth_to_unlock: z.boolean().optional(),
  discreet_page_titles: z.boolean().optional()
}).strict();

export type PrivacyPreferencesPatchInput = z.infer<typeof privacyPreferencesPatchSchema>;
