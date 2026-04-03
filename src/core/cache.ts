import { redis } from './redis.js';
import { childLogger } from './logger.js';

const log = childLogger('cache');

/** Envelope wrapper to distinguish null values from cache misses. */
interface CacheEnvelope<T> {
  v: T;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis().get(key);
    if (!raw) return null;
    try {
      const envelope = JSON.parse(raw) as CacheEnvelope<T>;
      if (envelope && typeof envelope === 'object' && 'v' in envelope) {
        return envelope.v;
      }
      // Legacy value without envelope — return as-is
      return envelope as unknown as T;
    } catch {
      log.warn({ key }, 'Cache parse error, deleting key');
      await redis().del(key).catch(() => {});
      return null;
    }
  } catch (err) {
    log.warn({ err, key }, 'Redis GET failed, treating as cache miss');
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    const envelope: CacheEnvelope<unknown> = { v: value };
    await redis().set(key, JSON.stringify(envelope), 'EX', ttlSeconds);
  } catch (err) {
    log.warn({ err, key }, 'Redis SET failed, skipping cache write');
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    await redis().del(key);
  } catch (err) {
    log.warn({ err, key }, 'Redis DEL failed, skipping cache delete');
  }
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
