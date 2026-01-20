import { buildApp } from './app';
import { prisma } from './db/prisma';
import { env } from './config/env';

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
const host = process.env.HOST || '0.0.0.0';

buildApp()
  .then(async (app) => {
    try {
      await prisma.$connect();
    } catch (err) {
      let target = 'the database server';
      try {
        const url = new URL(env.DATABASE_URL);
        const dbHost = url.hostname || 'localhost';
        const dbPort = url.port || '5432';
        const dbName = url.pathname?.replace(/^\//, '') || '(unknown db)';
        target = `${dbHost}:${dbPort}/${dbName}`;
      } catch {
        // ignore parse errors; keep generic message
      }
      const message = `Database connection failed (target: ${target}). Check \`DATABASE_URL\` and ensure Postgres is running.`;
      if (process.env.NODE_ENV === 'production') {
        console.error(message);
        throw err;
      }
      console.error(`${message} Continuing startup in non-production.`);
    }
    return app.listen({ port, host });
  })
  .then(() => {
    console.log(`SEHATiCare API running on http://${host}:${port}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
