import cron from 'node-cron';
import { db } from './database.js';
import { childLogger } from './logger.js';

const log = childLogger('scheduler');

interface ScheduledJob {
  name: string;
  schedule: string; // cron expression
  handler: () => Promise<void>;
  timezone?: string;
}

const jobs: Map<string, cron.ScheduledTask> = new Map();

export function registerJob(job: ScheduledJob): void {
  if (jobs.has(job.name)) {
    log.warn({ job: job.name }, 'Job already registered, skipping');
    return;
  }

  const task = cron.schedule(
    job.schedule,
    async () => {
      const startedAt = new Date();
      const dedupKey = `${job.name}:${startedAt.toISOString().slice(0, 13)}`; // hourly dedup

      try {
        // Atomic dedup check + job execution in a transaction
        await db().$transaction(async (tx) => {
          const existing = await tx.jobRun.findFirst({
            where: { jobName: job.name, dedupKey, status: 'success' },
          });
          if (existing) {
            log.info({ job: job.name, dedupKey }, 'Job already ran successfully, skipping');
            return;
          }

          log.info({ job: job.name }, 'Job starting');
          await job.handler();
          const durationMs = Date.now() - startedAt.getTime();

          await tx.jobRun.create({
            data: {
              jobName: job.name,
              dedupKey,
              status: 'success',
              startedAt,
              finishedAt: new Date(),
              durationMs,
            },
          });

          log.info({ job: job.name, durationMs }, 'Job completed');
        });
      } catch (err) {
        const durationMs = Date.now() - startedAt.getTime();
        log.error({ job: job.name, err }, 'Job failed');

        await db().jobRun.create({
          data: {
            jobName: job.name,
            dedupKey,
            status: 'failure',
            startedAt,
            finishedAt: new Date(),
            durationMs,
            error: err instanceof Error ? err.message : String(err),
          },
        }).catch((err) => { log.error({ err, job: job.name }, 'Failed to log job failure'); });
      }
    },
    {
      timezone: job.timezone ?? 'Europe/Paris',
      scheduled: false,
    },
  );

  jobs.set(job.name, task);
  log.info({ job: job.name, schedule: job.schedule }, 'Job registered');
}

export function startAllJobs(): void {
  for (const [name, task] of jobs) {
    task.start();
    log.info({ job: name }, 'Job started');
  }
}

export function stopAllJobs(): void {
  for (const [name, task] of jobs) {
    task.stop();
    log.info({ job: name }, 'Job stopped');
  }
  jobs.clear();
}
