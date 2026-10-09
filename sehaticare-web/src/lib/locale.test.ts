import { describe, expect, it } from 'vitest';
import {
  getAvailableLocales,
  getAllRegisteredLocales,
  isLocaleEligibleForPublic,
  validateLocaleSignOff,
  SUPPORTED_LOCALES,
  type LocaleDefinition
} from './locale';

describe('AG-11A Localized Language Architecture & Review Governance', () => {
  it('exposes Bahasa Indonesia (id) as the active primary locale without fabricated reviewer metadata', () => {
    const primary = SUPPORTED_LOCALES.id;
    expect(primary).toBeDefined();
    expect(primary.code).toBe('id');
    expect(primary.isPrimary).toBe(true);
    expect(primary.status).toBe('active');
    expect(primary.isTechnicallyAvailable).toBe(true);
    expect(primary.humanLinguisticallyReviewed).toBe(true);
    // CRITICAL: Must not contain fabricated reviewer sign-off
    expect(primary.humanReviewerSignOff).toBeUndefined();

    // Available in public selectors
    const available = getAvailableLocales();
    expect(available.some((l) => l.code === 'id')).toBe(true);
    expect(isLocaleEligibleForPublic('id')).toBe(true);
  });

  it('clarifies that clinical review is scoped per-article rather than blanket certified across a language', () => {
    expect(SUPPORTED_LOCALES.id.clinicalReviewScope).toBe('per_article');
    expect(SUPPORTED_LOCALES['ms-ter'].clinicalReviewScope).toBe('per_article');
  });

  it('prohibits unreviewed local dialects (ms-ter) from appearing in public selectors', () => {
    const available = getAvailableLocales();
    // Must NOT contain ms-ter because it is in review and unreviewed
    const ternate = available.find((l) => l.code === 'ms-ter');
    expect(ternate).toBeUndefined();
    expect(isLocaleEligibleForPublic('ms-ter')).toBe(false);
  });

  it('keeps in-review dialects registered for audit and admin overview', () => {
    const all = getAllRegisteredLocales();
    const ternate = all.find((l) => l.code === 'ms-ter');
    expect(ternate).toBeDefined();
    expect(ternate?.status).toBe('in_review');
    expect(ternate?.humanLinguisticallyReviewed).toBe(false);
    expect(ternate?.humanReviewerSignOff).toBeUndefined();
  });

  it('rejects unverified or placeholder reviewer sign-offs for local dialects', () => {
    const unsignedLocale: LocaleDefinition = {
      code: 'ms-ter',
      label: 'Melayu Ternate',
      nativeName: 'Bahasa Melayu Ternate',
      isPrimary: false,
      status: 'in_review',
      isTechnicallyAvailable: false,
      humanLinguisticallyReviewed: false,
      clinicalReviewScope: 'per_article'
    };
    const unsignedResult = validateLocaleSignOff(unsignedLocale);
    expect(unsignedResult.valid).toBe(false);
    expect(unsignedResult.reason).toMatch(/verifikasi linguistik manusia/i);

    // Rejects placeholder/generic reviewer name
    const placeholderSigned: LocaleDefinition = {
      ...unsignedLocale,
      humanLinguisticallyReviewed: true,
      humanReviewerSignOff: {
        reviewerName: 'Tim Medis SEHATiCare',
        reviewedAt: '2026-10-10T00:00:00Z'
      }
    };
    const placeholderResult = validateLocaleSignOff(placeholderSigned);
    expect(placeholderResult.valid).toBe(false);
    expect(placeholderResult.reason).toMatch(/tidak boleh menggunakan entitas anonim atau rekaan/i);

    // Accepts genuine named linguist review
    const genuineSigned: LocaleDefinition = {
      ...unsignedLocale,
      humanLinguisticallyReviewed: true,
      status: 'active',
      isTechnicallyAvailable: true,
      humanReviewerSignOff: {
        reviewerName: 'Dr. Nurul Hidayah, M.Hum.',
        organization: 'Komunitas Bahasa Maluku Utara',
        reviewedAt: '2026-10-10T00:00:00Z',
        notes: 'Verifikasi kelayakan istilah dialek Ternate selesai.'
      }
    };
    expect(validateLocaleSignOff(genuineSigned).valid).toBe(true);
  });
});
