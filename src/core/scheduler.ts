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
        // Step 1: Atomic dedup check + create "running" record inside a short transaction
        const shouldRun = await db().$transaction(async (tx) => {
          const existing = await tx.jobRun.findFirst({
            where: { jobName: job.name, dedupKey, status: { in: ['success', 'running'] } },
          });
          if (existing) {
            log.info({ job: job.name, dedupKey }, 'Job already ran or is running, skipping');
            return false;
          }

          await tx.jobRun.create({
            data: {
              jobName: job.name,
              dedupKey,
              status: 'running',
              startedAt,
              finishedAt: new Date(),
              durationMs: 0,
            },
          });

          return true;
        });

        if (!shouldRun) return;

        // Step 2: Run the job handler OUTSIDE the transaction
        log.info({ job: job.name }, 'Job starting');
        await job.handler();
        const durationMs = Date.now() - startedAt.getTime();

        // Step 3: Update the JobRun record with success status
        await db().jobRun.updateMany({
          where: { jobName: job.name, dedupKey, status: 'running' },
          data: {
            status: 'success',
            finishedAt: new Date(),
            durationMs,
          },
        });

        log.info({ job: job.name, durationMs }, 'Job completed');
      } catch (err) {
        const durationMs = Date.now() - startedAt.getTime();
        log.error({ job: job.name, err }, 'Job failed');

        // Step 3 (failure): Update the JobRun record with failure status
        await db().jobRun.updateMany({
          where: { jobName: job.name, dedupKey, status: 'running' },
          data: {
            status: 'failure',
            finishedAt: new Date(),
            durationMs,
            error: err instanceof Error ? err.message : String(err),
          },
        }).catch((updateErr) => { log.error({ err: updateErr, job: job.name }, 'Failed to log job failure'); });
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
