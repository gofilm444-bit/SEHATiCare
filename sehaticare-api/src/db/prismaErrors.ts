export class DatabaseUnavailableError extends Error {
  code = 'P1001';
  errorCode = 'P1001';

  constructor() {
    super('Database is not reachable');
    this.name = 'DatabaseUnavailableError';
  }
}

export function isPrismaConnectionError(err: unknown) {
  if (!err || typeof err !== 'object') return false;

  const maybe = err as { name?: unknown; message?: unknown; code?: unknown; errorCode?: unknown; cause?: unknown };

  if (maybe.name === 'DatabaseUnavailableError') return true;

  // Prisma's `PrismaClientInitializationError` sometimes does not expose `errorCode`
  // reliably, so detect the known connection failure message.
  const message = typeof maybe.message === 'string' ? maybe.message : '';
  if (maybe.name === 'PrismaClientInitializationError' && message.includes("Can't reach database server")) return true;

  if (maybe.code === 'P1001' || maybe.errorCode === 'P1001') return true;

  // One-level cause chain
  if (maybe.cause && typeof maybe.cause === 'object') return isPrismaConnectionError(maybe.cause);
  return false;
}
