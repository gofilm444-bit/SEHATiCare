import { describe, expect, test } from 'vitest';
import { ApiError } from '../api/client';
import { getAuthErrorMessage } from './authErrors';

describe('getAuthErrorMessage', () => {
  test('explains a missing auth route without exposing raw Not Found text', () => {
    const message = getAuthErrorMessage(new ApiError('Not Found', 404, null), 'login');
    expect(message).toContain('Layanan login belum tersambung');
    expect(message).not.toContain('Not Found');
  });

  test('explains rejected credentials in user-facing language', () => {
    expect(getAuthErrorMessage(new ApiError('Invalid credentials', 401, null), 'login'))
      .toBe('ID login atau email dan kata sandi tidak cocok.');
  });

  test('explains invalid registration data and rate limits', () => {
    expect(getAuthErrorMessage(new ApiError('Invalid request', 400, null), 'register'))
      .toContain('Data pendaftaran belum valid');
    expect(getAuthErrorMessage(new ApiError('Too Many Requests', 429, null), 'register'))
      .toContain('Terlalu banyak percobaan');
  });
});
