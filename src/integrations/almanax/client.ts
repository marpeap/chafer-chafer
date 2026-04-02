import { CircuitBreaker } from '../../core/circuit-breaker.js';
import { cacheGetOrFetchWithStale, cacheGetOrFetch } from '../../core/cache.js';
import { childLogger } from '../../core/logger.js';

const log = childLogger('almanax');
const BASE_URL = 'https://api.dofusdu.de';
const LANG = 'fr';
const PREFIX = `/dofus3/v1/${LANG}`;

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

      if (res.status === 404) {
        throw new Error(`Not found: ${path}`);
      }
      if (!res.ok) {
        throw new Error(`Almanax API ${res.status}: ${path}`);
      }

      let data: T;
      try {
        data = (await res.json()) as T;
      } catch (parseErr) {
        throw new Error(`API JSON parse error: ${path}`);
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  });
}

// ══════════════════════════════════════════
//  TYPES
// ══════════════════════════════════════════

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

export interface AlmanaxBonus {
  id: string;
  name: string;
}

// ══════════════════════════════════════════
//  ALMANAX — Single day
// ══════════════════════════════════════════

function dateStr(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }); // YYYY-MM-DD
}

export async function getToday(): Promise<{ data: AlmanaxEntry; stale: boolean }> {
  const today = dateStr(new Date());
  return cacheGetOrFetchWithStale(
    `alm:day:${today}`,
    3600 * 6,
    86400,
    async () => fetchApi<AlmanaxEntry>(`${PREFIX}/almanax/${today}`),
  );
}

export async function getDate(date: Date): Promise<{ data: AlmanaxEntry; stale: boolean }> {
  const ds = dateStr(date);
  return cacheGetOrFetchWithStale(
    `alm:day:${ds}`,
    86400,
    604800,
    async () => fetchApi<AlmanaxEntry>(`${PREFIX}/almanax/${ds}`),
  );
}

// ══════════════════════════════════════════
//  ALMANAX — Range (uses native range endpoint)
// ══════════════════════════════════════════

export async function getRange(from: Date, to: Date): Promise<{ data: AlmanaxEntry[]; stale: boolean }> {
  const fromStr = dateStr(from);
  const toStr = dateStr(to);
  return cacheGetOrFetchWithStale(
    `alm:range:${fromStr}:${toStr}`,
    3600 * 6,
    86400,
    async () => {
      const params = new URLSearchParams({
        'range[from]': fromStr,
        'range[to]': toStr,
        timezone: 'Europe/Paris',
      });
      return fetchApi<AlmanaxEntry[]>(`${PREFIX}/almanax?${params}`);
    },
  );
}

// ══════════════════════════════════════════
//  ALMANAX — Search by bonus type (single API call)
// ══════════════════════════════════════════

export async function getNextBonus(bonusType: string, fromDate?: Date): Promise<{ data: AlmanaxEntry | null; stale: boolean }> {
  const from = fromDate ?? new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + 60);

  return cacheGetOrFetchWithStale(
    `alm:nextbonus:${bonusType.toLowerCase()}:${dateStr(from)}`,
    3600 * 12,
    86400 * 3,
    async () => {
      const params = new URLSearchParams({
        'filter[bonus_type]': bonusType,
        'range[from]': dateStr(from),
        'range[to]': dateStr(to),
        timezone: 'Europe/Paris',
      });
      const results = await fetchApi<AlmanaxEntry[]>(`${PREFIX}/almanax?${params}`);
      return results.length > 0 ? results[0] : null;
    },
  );
}

// ══════════════════════════════════════════
//  ALMANAX — Bonus types list (for autocomplete)
// ══════════════════════════════════════════

export async function getBonusTypes(): Promise<AlmanaxBonus[]> {
  return cacheGetOrFetch(
    `alm:meta:bonuses`,
    86400 * 7,
    async () => fetchApi<AlmanaxBonus[]>(`/dofus3/v1/meta/${LANG}/almanax/bonuses`),
  );
}

export async function searchBonusTypes(query: string): Promise<AlmanaxBonus[]> {
  return cacheGetOrFetch(
    `alm:meta:bonuses:search:${query.toLowerCase()}`,
    86400,
    async () => {
      const encoded = encodeURIComponent(query);
      return fetchApi<AlmanaxBonus[]>(
        `/dofus3/v1/meta/${LANG}/almanax/bonuses/search?query=${encoded}`,
      );
    },
  );
}

// ══════════════════════════════════════════
//  STATUS
// ══════════════════════════════════════════

export function isCircuitOpen(): boolean {
  return breaker.getState() === 'OPEN';
}

export { LANG };
