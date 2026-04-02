import { PrismaClient } from '@prisma/client';
import { childLogger } from './logger.js';

let _prisma: PrismaClient | null = null;
const log = childLogger('database');

export function initDatabase(): PrismaClient {
  _prisma = new PrismaClient({
    log: [
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
    ],
  });

  _prisma.$on('error' as never, (e: unknown) => {
    log.error(e, 'Prisma error');
  });

  _prisma.$on('warn' as never, (e: unknown) => {
    log.warn(e, 'Prisma warning');
  });

  return _prisma;
}

export function db(): PrismaClient {
  if (!_prisma) throw new Error('Database not initialized');
  return _prisma;
}

export async function disconnectDatabase(): Promise<void> {
  if (_prisma) {
    await _prisma.$disconnect();
    _prisma = null;
  }
}
