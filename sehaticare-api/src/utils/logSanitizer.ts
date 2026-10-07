export function maskSensitiveText(value: string) {
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL_REDACTED]')
    .replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, '[PHONE_REDACTED]')
    .replace(/\bBearer\s+[^\s]+/gi, 'Bearer [REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[TOKEN_REDACTED]')
    .replace(/\b(password|token|secret|otp)\s*[=:]\s*[^\s,;]+/gi, '$1=[REDACTED]');
}

export function sanitizeErrorForLog(error: unknown) {
  if (!(error instanceof Error)) {
    return { name: 'UnknownError', message: 'A non-Error value was thrown' };
  }
  return {
    name: error.name,
    message: maskSensitiveText(error.message).slice(0, 1000),
    ...(error.stack ? { stack: maskSensitiveText(error.stack).slice(0, 8000) } : {})
  };
}
