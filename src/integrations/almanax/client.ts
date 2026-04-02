import { CircuitBreaker } from '../../core/circuit-breaker.js';
import { cacheGetOrFetchWithStale } from '../../core/cache.js';
import { childLogger } from '../../core/logger.js';

const log = childLogger('almanax');
const BASE_URL = 'https://alm.dofusdu.de';
const breaker = new CircuitBreaker({ name: 'almanax', failureThreshold: 3, resetTimeoutMs: 60_000 });

async function fetchApi<T>(path: string, timeout = 8000): Promise<T> {
  return breaker.execute(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });

      if (!res.ok) {
        throw new Error(`Almanax API ${res.status}: ${path}`);
      }

      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  });
}

export interface AlmanaxEntry {
  date: string;
  bonus: {
    type: { id: string; name: string };
    description: string;
  };
  tribute: {
    item: {
      ankama_id: number;
      name: string;
      image_urls?: { icon?: string; sd?: string };
      subtype: string;
    };
    quantity: number;
  };
}

function dateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function getToday(): Promise<{ data: AlmanaxEntry; stale: boolean }> {
  const today = dateStr(new Date());
  return cacheGetOrFetchWithStale(
    `almanax:day:${today}`,
    3600 * 6,  // 6h cache
    86400,     // 24h stale
    async () => fetchApi<AlmanaxEntry>(`/dofus2/fr/${today}`),
  );
}

export async function getDate(date: Date): Promise<{ data: AlmanaxEntry; stale: boolean }> {
  const ds = dateStr(date);
  return cacheGetOrFetchWithStale(
    `almanax:day:${ds}`,
    86400,
    604800,
    async () => fetchApi<AlmanaxEntry>(`/dofus2/fr/${ds}`),
  );
}

export async function getRange(from: Date, to: Date): Promise<{ data: AlmanaxEntry[]; stale: boolean }> {
  const fromStr = dateStr(from);
  const toStr = dateStr(to);
  return cacheGetOrFetchWithStale(
    `almanax:range:${fromStr}:${toStr}`,
    3600 * 6,
    86400,
    async () => {
      // Fetch day by day (API doesn't have range endpoint in all versions)
      const entries: AlmanaxEntry[] = [];
      const current = new Date(from);
      while (current <= to) {
        const entry = await fetchApi<AlmanaxEntry>(`/dofus2/fr/${dateStr(current)}`);
        entries.push(entry);
        current.setDate(current.getDate() + 1);
      }
      return entries;
    },
  );
}

export async function getNextBonus(bonusType: string, fromDate?: Date): Promise<{ data: AlmanaxEntry | null; stale: boolean }> {
  const from = fromDate ?? new Date();
  return cacheGetOrFetchWithStale(
    `almanax:nextbonus:${bonusType}:${dateStr(from)}`,
    3600 * 12,
    86400 * 3,
    async () => {
      // Search next 60 days
      const current = new Date(from);
      for (let i = 0; i < 60; i++) {
        const entry = await fetchApi<AlmanaxEntry>(`/dofus2/fr/${dateStr(current)}`);
        if (entry.bonus.type.name.toLowerCase().includes(bonusType.toLowerCase())) {
          return entry;
        }
        current.setDate(current.getDate() + 1);
      }
      return null;
    },
  );
}

export function isCircuitOpen(): boolean {
  return breaker.getState() === 'OPEN';
}
