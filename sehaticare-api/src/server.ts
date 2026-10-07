import { buildApp } from './app';
import { prisma } from './db/prisma';
import { startHealthScheduler } from './modules/healthPlanning/scheduler.service';
import { startStage4Scheduler } from './modules/stage4/stage4.scheduler';

const port = process.env.PORT ? Number(process.env.PORT) : 3100;
const host = process.env.HOST || '0.0.0.0';

buildApp()
  .then(async (app) => {
    try {
      await prisma.$connect();
    } catch (err) {
      const message = 'Database connection failed. Check the configured database service.';
      if (process.env.NODE_ENV === 'production') {
        console.error(message);
        throw err;
      }
      console.error(`${message} Continuing startup in non-production.`);
    }
    startHealthScheduler();
    startStage4Scheduler();
    return app.listen({ port, host });
  })
  .then(() => {
    console.log(`SEHATiCare API running on http://${host}:${port}`);
  })
  .catch(() => {
    console.error('SEHATiCare API failed to start');
    process.exit(1);
  });
