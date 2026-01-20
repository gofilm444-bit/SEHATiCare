import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';
import { DatabaseUnavailableError, isPrismaConnectionError } from './prismaErrors';

export const prisma = new PrismaClient({
  datasources: { db: { url: env.DATABASE_URL } },
  log: process.env.NODE_ENV === 'development' ? ['info', 'warn', 'error'] : ['warn', 'error']
});

prisma.$use(async (params, next) => {
  try {
    return await next(params);
  } catch (err) {
    if (isPrismaConnectionError(err)) {
      if ((err as any)?.name === 'DatabaseUnavailableError') throw err;
      let target: string | undefined;
      try {
        const url = new URL(env.DATABASE_URL);
        const dbHost = url.hostname || 'localhost';
        const dbPort = url.port || '5432';
        const dbName = url.pathname?.replace(/^\//, '') || '(unknown db)';
        target = `${dbHost}:${dbPort}/${dbName}`;
      } catch {
        // ignore
      }
      throw new DatabaseUnavailableError(target);
    }
    throw err;
  }
});
