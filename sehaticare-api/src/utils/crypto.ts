import crypto from 'crypto';

export function generateOtp(length = 6): string {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i += 1) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  return otp;
}

export function hashWithSalt(value: string, salt?: string) {
  const actualSalt = salt ?? crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(`${actualSalt}:${value}`).digest('hex');
  return { hash, salt: actualSalt };
}

export function verifyHash(value: string, salt: string, expectedHash: string) {
  const { hash } = hashWithSalt(value, salt);
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expectedHash));
}

export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
