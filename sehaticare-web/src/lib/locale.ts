/**
 * Localized Language Architecture for SEHATiCare
 * 
 * Medical content governance principles:
 * 1. Primary system language is Bahasa Indonesia (`id`). It is technically operational
 *    without requiring a fabricated clinical reviewer identity.
 * 2. Clinical review is scoped per-article via CMS editorial workflows, NOT via a blanket
 *    certification stamped onto an entire natural language.
 * 3. Regional languages and dialects (e.g. Melayu Ternate `ms-ter`) require genuine
 *    human linguistic verification before they can be activated in user-facing language toggles.
 * 4. Fabricated reviewer names, synthetic approval dates, and placeholder credentials
 *    are strictly prohibited.
 */

export interface LocaleDefinition {
  code: string;
  label: string;
  nativeName: string;
  isPrimary: boolean;
  status: 'active' | 'in_review' | 'planned';
  /** Technical availability in the web application */
  isTechnicallyAvailable: boolean;
  /** Human linguistic review status for dialect translations */
  humanLinguisticallyReviewed: boolean;
  /** Clinical review is conducted per-article, not by blanket locale certification */
  clinicalReviewScope: 'per_article';
  /** Genuine human translator/reviewer sign-off (undefined if not yet reviewed or not applicable) */
  humanReviewerSignOff?: {
    reviewerName: string;
    organization?: string;
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
    status: 'active',
    isTechnicallyAvailable: true,
    humanLinguisticallyReviewed: true,
    clinicalReviewScope: 'per_article',
    humanReviewerSignOff: undefined // System default: no fabricated signoff metadata
  },
  'ms-ter': {
    code: 'ms-ter',
    label: 'Melayu Ternate (Maluku Utara)',
    nativeName: 'Bahasa Melayu Ternate',
    isPrimary: false,
    status: 'in_review',
    isTechnicallyAvailable: false,
    humanLinguisticallyReviewed: false,
    clinicalReviewScope: 'per_article',
    humanReviewerSignOff: undefined // In review: must not be published until genuine human translation review
  }
};

/**
 * Returns only locales that are technically available, active, and linguistically verified.
 * Only these locales may be rendered in user-facing language selectors.
 */
export function getAvailableLocales(): LocaleDefinition[] {
  return Object.values(SUPPORTED_LOCALES).filter(
    (locale) =>
      locale.isTechnicallyAvailable &&
      locale.status === 'active' &&
      locale.humanLinguisticallyReviewed
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
 * Determines whether a given locale is eligible for public exposure.
 */
export function isLocaleEligibleForPublic(code: string): boolean {
  const locale = SUPPORTED_LOCALES[code];
  if (!locale) return false;
  return (
    locale.isTechnicallyAvailable &&
    locale.status === 'active' &&
    locale.humanLinguisticallyReviewed
  );
}

/**
 * Validates whether a proposed regional dialect translation has genuine human reviewer sign-off.
 * Rejects placeholder or fabricated names.
 */
export function validateLocaleSignOff(locale: LocaleDefinition): { valid: boolean; reason?: string } {
  if (locale.isPrimary) {
    return { valid: true };
  }
  if (!locale.humanLinguisticallyReviewed) {
    return { valid: false, reason: 'Dialek lokal memerlukan verifikasi linguistik manusia sebelum dapat dipublikasikan.' };
  }
  const signOff = locale.humanReviewerSignOff;
  if (!signOff?.reviewerName?.trim() || !signOff?.reviewedAt?.trim()) {
    return { valid: false, reason: 'Identitas peninjau manusia nyata dan tanggal persetujuan wajib dicatat.' };
  }
  // Prevent fabricated/synthetic placeholder reviewer names
  const placeholderRegex = /^(tim medis|admin|anonymous|sehaticare|test|dummy|placeholder)/i;
  if (placeholderRegex.test(signOff.reviewerName.trim())) {
    return { valid: false, reason: 'Nama peninjau tidak boleh menggunakan entitas anonim atau rekaan.' };
  }
  return { valid: true };
}
