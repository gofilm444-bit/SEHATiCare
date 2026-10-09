import { describe, expect, it } from 'vitest';
import {
  getAvailableLocales,
  getAllRegisteredLocales,
  isLocaleEligibleForPublic,
  validateLocaleSignOff,
  SUPPORTED_LOCALES,
  type LocaleDefinition
} from './locale';

describe('Localized Language Architecture & Governance', () => {
  it('exposes Bahasa Indonesia (id) as the active primary locale', () => {
    const available = getAvailableLocales();
    expect(available.length).toBeGreaterThanOrEqual(1);
    const primary = available.find((l) => l.isPrimary);
    expect(primary).toBeDefined();
    expect(primary?.code).toBe('id');
    expect(primary?.humanReviewed).toBe(true);
    expect(isLocaleEligibleForPublic('id')).toBe(true);
  });

  it('prohibits unreviewed local dialects (ms-ter) from appearing in public selectors', () => {
    const available = getAvailableLocales();
    // Must NOT contain ms-ter because humanReviewed is false
    const ternate = available.find((l) => l.code === 'ms-ter');
    expect(ternate).toBeUndefined();
    expect(isLocaleEligibleForPublic('ms-ter')).toBe(false);
  });

  it('keeps in-review dialects registered for audit and admin overview', () => {
    const all = getAllRegisteredLocales();
    const ternate = all.find((l) => l.code === 'ms-ter');
    expect(ternate).toBeDefined();
    expect(ternate?.status).toBe('in_review');
    expect(ternate?.humanReviewed).toBe(false);
  });

  it('validates human reviewer sign-off requirements strictly', () => {
    const unsignedLocale: LocaleDefinition = {
      code: 'ms-ter',
      label: 'Melayu Ternate',
      nativeName: 'Bahasa Melayu Ternate',
      isPrimary: false,
      humanReviewed: false,
      status: 'in_review'
    };
    const unsignedResult = validateLocaleSignOff(unsignedLocale);
    expect(unsignedResult.valid).toBe(false);
    expect(unsignedResult.reason).toMatch(/peninjauan dan persetujuan peninjau manusia/i);

    const signedWithoutName: LocaleDefinition = {
      ...unsignedLocale,
      humanReviewed: true,
      reviewerSignOff: {
        reviewerName: '',
        reviewedAt: '2026-10-09T00:00:00Z'
      }
    };
    expect(validateLocaleSignOff(signedWithoutName).valid).toBe(false);

    const fullySigned: LocaleDefinition = {
      ...unsignedLocale,
      humanReviewed: true,
      status: 'active',
      reviewerSignOff: {
        reviewerName: 'Dokter & Penutur Asli Ternate',
        reviewedAt: '2026-10-09T00:00:00Z',
        notes: 'Verifikasi terminologi medis HIV dan dialek Ternate selesai.'
      }
    };
    expect(validateLocaleSignOff(fullySigned).valid).toBe(true);
  });
});
