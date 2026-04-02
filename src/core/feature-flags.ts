import { db } from './database.js';
import { cacheGet, cacheSet, cacheDel } from './cache.js';

const CACHE_TTL = 300; // 5 min

export async function isEnabled(guildId: string, flag: string): Promise<boolean> {
  const cacheKey = `ff:${guildId}:${flag}`;
  const cached = await cacheGet<boolean>(cacheKey);
  if (cached !== null) return cached;

  const row = await db().featureFlag.findUnique({
    where: { guildId_flag: { guildId, flag } },
  });

  const enabled = row?.enabled ?? false;
  await cacheSet(cacheKey, enabled, CACHE_TTL);
  return enabled;
}

export async function setFlag(guildId: string, flag: string, enabled: boolean): Promise<void> {
  await db().featureFlag.upsert({
    where: { guildId_flag: { guildId, flag } },
    create: { guildId, flag, enabled },
    update: { enabled },
  });
  await cacheDel(`ff:${guildId}:${flag}`);
}

export async function getAllFlags(guildId: string): Promise<Record<string, boolean>> {
  const rows = await db().featureFlag.findMany({ where: { guildId } });
  const result: Record<string, boolean> = {};
  for (const row of rows) {
    result[row.flag] = row.enabled;
  }
  return result;
}

export const FLAGS = [
  'scheduled_activities_enabled',
  'quick_calls_enabled',
  'almanax_daily_enabled',
  'encyclopedia_enabled',
  'professions_enabled',
  'rewards_enabled',
  'forum_requests_enabled',
] as const;

export type FlagName = (typeof FLAGS)[number];

// Map module name → required flag
export const MODULE_FLAGS: Record<string, FlagName> = {
  'B-activities': 'scheduled_activities_enabled',
  'C-encyclopedia': 'encyclopedia_enabled',
  'D-almanax': 'almanax_daily_enabled',
  'E-professions': 'professions_enabled',
  'F-rewards': 'rewards_enabled',
  'H-forum': 'forum_requests_enabled',
};
