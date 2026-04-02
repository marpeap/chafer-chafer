import { redis } from './redis.js';
import { childLogger } from './logger.js';

const log = childLogger('cache');

export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await redis().get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    log.warn({ key }, 'Cache parse error, deleting key');
    await redis().del(key);
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  await redis().set(key, JSON.stringify(value), 'EX', ttlSeconds);
}

export async function cacheDel(key: string): Promise<void> {
  await redis().del(key);
}

export async function cacheGetOrFetch<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;

  const fresh = await fetcher();
  await cacheSet(key, fresh, ttlSeconds);
  return fresh;
}

/** Get from cache. If miss, fetch. If fetch fails, return stale cache (graceful degradation). */
export async function cacheGetOrFetchWithStale<T>(
  key: string,
  ttlSeconds: number,
  staleTtlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<{ data: T; stale: boolean }> {
  const staleKey = `${key}:stale`;

  const cached = await cacheGet<T>(key);
  if (cached !== null) return { data: cached, stale: false };

  try {
    const fresh = await fetcher();
    await cacheSet(key, fresh, ttlSeconds);
    await cacheSet(staleKey, fresh, staleTtlSeconds);
    return { data: fresh, stale: false };
  } catch (err) {
    const stale = await cacheGet<T>(staleKey);
    if (stale !== null) {
      log.warn({ key, err }, 'Fetch failed, serving stale cache');
      return { data: stale, stale: true };
    }
    throw err;
  }
}
