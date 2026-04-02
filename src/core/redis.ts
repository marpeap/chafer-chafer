import Redis from 'ioredis';
import { env } from '../config/env.js';
import { childLogger } from './logger.js';

let _redis: Redis | null = null;
const log = childLogger('redis');

export function initRedis(): Redis {
  _redis = new Redis(env().REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 200, 5000);
      log.warn({ attempt: times, delay }, 'Redis reconnecting');
      return delay;
    },
    lazyConnect: true,
  });

  _redis.on('error', (err) => {
    log.error({ err }, 'Redis error');
  });

  _redis.on('connect', () => {
    log.info('Redis connected');
  });

  return _redis;
}

export function redis(): Redis {
  if (!_redis) throw new Error('Redis not initialized');
  return _redis;
}

export async function disconnectRedis(): Promise<void> {
  if (_redis) {
    await _redis.quit();
    _redis = null;
  }
}
