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
      if (err instanceof DatabaseUnavailableError) throw err;
      throw new DatabaseUnavailableError();
    }
    throw err;
  }
});
