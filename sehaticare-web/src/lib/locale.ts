/**
 * Localized Language Architecture for SEHATiCare
 * 
 * Primary language is Bahasa Indonesia (`id`).
 * Local languages and regional dialects (e.g. Melayu Ternate `ms-ter`) require explicit
 * human reviewer sign-off (`humanReviewed: true`) before they can be published or exposed
 * in public language selectors. This prevents unverified machine translations or broken/empty toggles.
 */

export interface LocaleDefinition {
  code: string;
  label: string;
  nativeName: string;
  isPrimary: boolean;
  humanReviewed: boolean;
  status: 'active' | 'in_review' | 'planned';
  reviewerSignOff?: {
    reviewerName: string;
    reviewedAt: string;
    notes?: string;
  };
}

export const SUPPORTED_LOCALES: Record<string, LocaleDefinition> = {
  id: {
    code: 'id',
    label: 'Bahasa Indonesia',
    nativeName: 'Bahasa Indonesia',
    isPrimary: true,
    humanReviewed: true,
    status: 'active',
    reviewerSignOff: {
      reviewerName: 'Tim Medis & Edukasi SEHATiCare',
      reviewedAt: '2026-01-01T00:00:00Z',
      notes: 'Bahasa baku nasional terverifikasi secara penuh untuk seluruh materi edukasi dan antarmuka.'
    }
  },
  'ms-ter': {
    code: 'ms-ter',
    label: 'Melayu Ternate (Maluku Utara)',
    nativeName: 'Bahasa Melayu Ternate',
    isPrimary: false,
    humanReviewed: false,
    status: 'in_review',
    reviewerSignOff: undefined
  }
};

/**
 * Returns only locales that have passed human review and are active.
 * Only these locales may be rendered in user-facing language toggles.
 */
export function getAvailableLocales(): LocaleDefinition[] {
  return Object.values(SUPPORTED_LOCALES).filter(
    (locale) => locale.humanReviewed && locale.status === 'active'
  );
}

/**
 * Returns all registered locales including planned and in-review dialects
 * (used for audit, governance, and admin reviews).
 */
export function getAllRegisteredLocales(): LocaleDefinition[] {
  return Object.values(SUPPORTED_LOCALES);
}

/**
 * Determines whether a given locale is legally and medically eligible for public exposure.
 */
export function isLocaleEligibleForPublic(code: string): boolean {
  const locale = SUPPORTED_LOCALES[code];
  if (!locale) return false;
  return locale.humanReviewed === true && locale.status === 'active';
}

/**
 * Validates whether a proposed locale update or translation has valid human sign-off.
 */
export function validateLocaleSignOff(locale: LocaleDefinition): { valid: boolean; reason?: string } {
  if (locale.isPrimary) {
    return { valid: true };
  }
  if (!locale.humanReviewed) {
    return { valid: false, reason: 'Dialek lokal memerlukan peninjauan dan persetujuan peninjau manusia sebelum dapat dipublikasikan.' };
  }
  if (!locale.reviewerSignOff?.reviewerName || !locale.reviewerSignOff?.reviewedAt) {
    return { valid: false, reason: 'Identitas peninjau manusia dan stempel waktu persetujuan wajib dicatat.' };
  }
  return { valid: true };
}
