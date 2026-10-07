export function resolveCorsOrigins(nodeEnv: string, configured: string | undefined) {
  const origins = (configured ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.some((origin) => origin === '*')) {
    throw new Error('CORS_ORIGINS must not contain a wildcard');
  }
  if (origins.length > 0) return origins;
  if (nodeEnv === 'production') {
    throw new Error('CORS_ORIGINS is required in production');
  }
  return ['https://localhost:5173', 'https://127.0.0.1:5173'];
}
