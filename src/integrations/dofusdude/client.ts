import { CircuitBreaker, CircuitOpenError } from '../../core/circuit-breaker.js';
import { cacheGetOrFetchWithStale } from '../../core/cache.js';
import { childLogger } from '../../core/logger.js';

const log = childLogger('dofusdude');
const BASE_URL = 'https://api.dofusdu.de';
const breaker = new CircuitBreaker({ name: 'dofusdude', failureThreshold: 3, resetTimeoutMs: 60_000 });

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
        throw new Error(`DofusDude API ${res.status}: ${path}`);
      }

      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  });
}

// Types for DofusDude responses
export interface DofusDudeItem {
  ankama_id: number;
  name: string;
  type?: { name: string };
  level?: number;
  image_urls?: { icon?: string; sd?: string };
  description?: string;
  conditions?: string[];
  effects?: Array<{ int_minimum: number; int_maximum: number; type: { name: string } }>;
  recipe?: Array<{ item_ankama_id: number; item_subtype: string; quantity: number }>;
  [key: string]: unknown;
}

export interface DofusDudeSearchResult {
  ankama_id: number;
  name: string;
  type?: { name: string };
  level?: number;
  image_urls?: { icon?: string };
}

export interface DofusDudeMount {
  ankama_id: number;
  name: string;
  family_name?: string;
  image_urls?: { icon?: string };
  effects?: Array<{ int_minimum: number; int_maximum: number; type: { name: string } }>;
}

export interface DofusDudeSet {
  ankama_id: number;
  name: string;
  items?: number[];
  effects?: Record<string, Array<{ int_minimum: number; int_maximum: number; type: { name: string } }>>;
}

// Search items across all categories
export async function searchItems(query: string, limit = 8): Promise<{ data: DofusDudeSearchResult[]; stale: boolean }> {
  return cacheGetOrFetchWithStale(
    `dofusdude:search:${query.toLowerCase()}`,
    3600,    // 1h cache
    86400,   // 24h stale
    async () => {
      const encoded = encodeURIComponent(query);
      const results = await fetchApi<DofusDudeSearchResult[]>(
        `/dofus2/fr/items/search?query=${encoded}&limit=${limit}`,
      );
      return results;
    },
  );
}

// Get a specific equipment item by ID
export async function getEquipment(id: number): Promise<{ data: DofusDudeItem; stale: boolean }> {
  return cacheGetOrFetchWithStale(
    `dofusdude:equip:${id}`,
    86400,   // 24h cache
    604800,  // 7d stale
    async () => fetchApi<DofusDudeItem>(`/dofus2/fr/items/equipment/${id}`),
  );
}

// Get a specific resource item by ID
export async function getResource(id: number): Promise<{ data: DofusDudeItem; stale: boolean }> {
  return cacheGetOrFetchWithStale(
    `dofusdude:resource:${id}`,
    86400,
    604800,
    async () => fetchApi<DofusDudeItem>(`/dofus2/fr/items/resources/${id}`),
  );
}

// Get a specific consumable by ID
export async function getConsumable(id: number): Promise<{ data: DofusDudeItem; stale: boolean }> {
  return cacheGetOrFetchWithStale(
    `dofusdude:consumable:${id}`,
    86400,
    604800,
    async () => fetchApi<DofusDudeItem>(`/dofus2/fr/items/consumables/${id}`),
  );
}

// Search equipment
export async function searchEquipment(query: string, limit = 8): Promise<{ data: DofusDudeSearchResult[]; stale: boolean }> {
  return cacheGetOrFetchWithStale(
    `dofusdude:search:equip:${query.toLowerCase()}`,
    3600,
    86400,
    async () => {
      const encoded = encodeURIComponent(query);
      return fetchApi<DofusDudeSearchResult[]>(
        `/dofus2/fr/items/equipment/search?query=${encoded}&limit=${limit}`,
      );
    },
  );
}

// Search resources
export async function searchResources(query: string, limit = 8): Promise<{ data: DofusDudeSearchResult[]; stale: boolean }> {
  return cacheGetOrFetchWithStale(
    `dofusdude:search:resource:${query.toLowerCase()}`,
    3600,
    86400,
    async () => {
      const encoded = encodeURIComponent(query);
      return fetchApi<DofusDudeSearchResult[]>(
        `/dofus2/fr/items/resources/search?query=${encoded}&limit=${limit}`,
      );
    },
  );
}

// Search mounts
export async function searchMounts(query: string, limit = 8): Promise<{ data: DofusDudeMount[]; stale: boolean }> {
  return cacheGetOrFetchWithStale(
    `dofusdude:search:mount:${query.toLowerCase()}`,
    3600,
    86400,
    async () => {
      const encoded = encodeURIComponent(query);
      return fetchApi<DofusDudeMount[]>(
        `/dofus2/fr/mounts/search?query=${encoded}&limit=${limit}`,
      );
    },
  );
}

// Get a set by ID
export async function getSet(id: number): Promise<{ data: DofusDudeSet; stale: boolean }> {
  return cacheGetOrFetchWithStale(
    `dofusdude:set:${id}`,
    86400,
    604800,
    async () => fetchApi<DofusDudeSet>(`/dofus2/fr/items/equipment/sets/${id}`),
  );
}

export function isCircuitOpen(): boolean {
  return breaker.getState() === 'OPEN';
}
