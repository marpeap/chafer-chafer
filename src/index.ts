import { loadEnv, env } from './config/env.js';
import { initLogger, logger } from './core/logger.js';
import { initDatabase, disconnectDatabase } from './core/database.js';
import { initRedis, disconnectRedis, redis } from './core/redis.js';
import { initClient, loginClient, destroyClient, discordClient } from './core/client.js';
import { registerAllEvents } from './events/index.js';
import { startAllJobs, stopAllJobs } from './core/scheduler.js';
import Fastify from 'fastify';

async function boot(): Promise<void> {
  // Step 1: Load environment
  loadEnv();
  const log = initLogger();
  log.info('Chafer Chafer starting...');

  // Step 2: Connect to database
  const prisma = initDatabase();
  await prisma.$connect();
  log.info('Database connected');

  // Step 3: Connect to Redis
  const redisClient = initRedis();
  await redisClient.connect();
  log.info('Redis connected');

  // Step 4: Initialize Discord client
  const client = initClient();
  registerAllEvents(client);

  // Step 5: Register cron jobs (import dynamically to avoid circular deps)
  try {
    const { registerAlmanaxCron } = await import('./modules/D-almanax/cron.js');
    registerAlmanaxCron();
  } catch (err) {
    log.warn({ err }, 'Failed to register almanax cron');
  }

  try {
    const { registerActivityCrons } = await import('./modules/B-activities/cron.js');
    registerActivityCrons();
  } catch (err) {
    log.warn({ err }, 'Failed to register activity crons');
  }

  startAllJobs();
  log.info('Cron jobs started');

  // Step 6: Start health endpoint
  const fastify = Fastify({ logger: false });
  fastify.get('/health', async () => {
    const discordOk = discordClient().isReady();
    const redisOk = redis().status === 'ready';
    let dbOk = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {}

    const healthy = discordOk && redisOk && dbOk;
    return {
      status: healthy ? 'ok' : 'degraded',
      discord: discordOk,
      database: dbOk,
      redis: redisOk,
      uptime: process.uptime(),
    };
  });

  await fastify.listen({ port: env().HEALTH_PORT, host: '0.0.0.0' });
  log.info({ port: env().HEALTH_PORT }, 'Health endpoint listening');

  // Step 7: Login to Discord (last — signals readiness)
  await loginClient();
  log.info('Bot fully operational');

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    log.info({ signal }, 'Shutting down...');
    stopAllJobs();
    destroyClient();
    await fastify.close();
    await disconnectRedis();
    await disconnectDatabase();
    log.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (err) => {
    log.error({ err }, 'Unhandled rejection');
  });

  process.on('uncaughtException', (err) => {
    log.fatal({ err }, 'Uncaught exception');
    process.exit(1);
  });
}

boot().catch((err) => {
  console.error('Fatal boot error:', err);
  process.exit(1);
});
