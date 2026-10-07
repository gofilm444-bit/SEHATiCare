import { randomBytes } from 'node:crypto';

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function randomChars(length: number) {
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('');
}

export function generatePublicId() {
  return `usr_${randomBytes(16).toString('hex')}`;
}

export function generateLoginId() {
  return `SC-${randomChars(4)}-${randomChars(4)}-${randomChars(4)}`;
}

export function generateRecoveryCode() {
  return `${randomChars(5)}-${randomChars(5)}-${randomChars(5)}-${randomChars(5)}`;
}

export function normalizeLoginId(value: string) {
  return value.trim().toUpperCase().replace(/[\s_]+/g, '-');
}

export function maskLoginId(value: string) {
  const normalized = normalizeLoginId(value);
  return normalized.length < 8 ? '[MASKED]' : `${normalized.split('-')[0]}-****-${normalized.slice(-4)}`;
}
