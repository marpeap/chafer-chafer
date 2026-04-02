import { CircuitBreaker } from '../../core/circuit-breaker.js';
import { cacheGetOrFetchWithStale, cacheGetOrFetch } from '../../core/cache.js';
import { childLogger } from '../../core/logger.js';

const log = childLogger('dofusdude');
const BASE_URL = 'https://api.dofusdu.de';
const GAME = 'dofus3';
const LANG = 'fr';
const PREFIX = `/${GAME}/v1/${LANG}`;

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

      if (res.status === 404) {
        throw new Error(`Not found: ${path}`);
      }
      if (!res.ok) {
        throw new Error(`DofusDude API ${res.status}: ${path}`);
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

export interface DofusDudeItem {
  ankama_id: number;
  name: string;
  type?: { name: string; id?: number };
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
  highest_equipment_level?: number;
  effects?: Record<string, Array<{ int_minimum: number; int_maximum: number; type: { name: string } }>>;
}

export interface DofusDudeSetSearchResult {
  ankama_id: number;
  name: string;
  highest_equipment_level?: number;
}

export interface GameVersion {
  version: string;
  release: string;
  update_stamp: string;
}

export interface ItemType {
  id: number;
  name: string;
}

// ══════════════════════════════════════════
//  GLOBAL SEARCH (cross-type)
// ══════════════════════════════════════════

export async function searchGlobal(query: string, limit = 8): Promise<{ data: DofusDudeSearchResult[]; stale: boolean }> {
  return cacheGetOrFetchWithStale(
    `dd:search:global:${query.toLowerCase()}`,
    3600,
    86400,
    async () => {
      const encoded = encodeURIComponent(query);
      return fetchApi<DofusDudeSearchResult[]>(
        `${PREFIX}/search?query=${encoded}&limit=${limit}`,
      );
    },
  );
}

// ══════════════════════════════════════════
//  ITEMS — Search
// ══════════════════════════════════════════

export async function searchItems(query: string, limit = 8): Promise<{ data: DofusDudeSearchResult[]; stale: boolean }> {
  return cacheGetOrFetchWithStale(
    `dd:search:items:${query.toLowerCase()}`,
    3600,
    86400,
    async () => {
      const encoded = encodeURIComponent(query);
      return fetchApi<DofusDudeSearchResult[]>(
        `${PREFIX}/items/search?query=${encoded}&limit=${limit}`,
      );
    },
  );
}

export async function searchEquipment(query: string, limit = 8): Promise<{ data: DofusDudeSearchResult[]; stale: boolean }> {
  return cacheGetOrFetchWithStale(
    `dd:search:equip:${query.toLowerCase()}`,
    3600,
    86400,
    async () => {
      const encoded = encodeURIComponent(query);
      return fetchApi<DofusDudeSearchResult[]>(
        `${PREFIX}/items/equipment/search?query=${encoded}&limit=${limit}`,
      );
    },
  );
}

export async function searchResources(query: string, limit = 8): Promise<{ data: DofusDudeSearchResult[]; stale: boolean }> {
  return cacheGetOrFetchWithStale(
    `dd:search:resource:${query.toLowerCase()}`,
    3600,
    86400,
    async () => {
      const encoded = encodeURIComponent(query);
      return fetchApi<DofusDudeSearchResult[]>(
        `${PREFIX}/items/resources/search?query=${encoded}&limit=${limit}`,
      );
    },
  );
}

export async function searchConsumables(query: string, limit = 8): Promise<{ data: DofusDudeSearchResult[]; stale: boolean }> {
  return cacheGetOrFetchWithStale(
    `dd:search:consumable:${query.toLowerCase()}`,
    3600,
    86400,
    async () => {
      const encoded = encodeURIComponent(query);
      return fetchApi<DofusDudeSearchResult[]>(
        `${PREFIX}/items/consumables/search?query=${encoded}&limit=${limit}`,
      );
    },
  );
}

export async function searchQuestItems(query: string, limit = 8): Promise<{ data: DofusDudeSearchResult[]; stale: boolean }> {
  return cacheGetOrFetchWithStale(
    `dd:search:quest:${query.toLowerCase()}`,
    3600,
    86400,
    async () => {
      const encoded = encodeURIComponent(query);
      return fetchApi<DofusDudeSearchResult[]>(
        `${PREFIX}/items/quest/search?query=${encoded}&limit=${limit}`,
      );
    },
  );
}

export async function searchCosmetics(query: string, limit = 8): Promise<{ data: DofusDudeSearchResult[]; stale: boolean }> {
  return cacheGetOrFetchWithStale(
    `dd:search:cosmetic:${query.toLowerCase()}`,
    3600,
    86400,
    async () => {
      const encoded = encodeURIComponent(query);
      return fetchApi<DofusDudeSearchResult[]>(
        `${PREFIX}/items/cosmetics/search?query=${encoded}&limit=${limit}`,
      );
    },
  );
}

// ══════════════════════════════════════════
//  ITEMS — Get by ID
// ══════════════════════════════════════════

export async function getEquipment(id: number): Promise<{ data: DofusDudeItem; stale: boolean }> {
  return cacheGetOrFetchWithStale(
    `dd:equip:${id}`,
    86400,
    604800,
    async () => fetchApi<DofusDudeItem>(`${PREFIX}/items/equipment/${id}`),
  );
}

export async function getResource(id: number): Promise<{ data: DofusDudeItem; stale: boolean }> {
  return cacheGetOrFetchWithStale(
    `dd:resource:${id}`,
    86400,
    604800,
    async () => fetchApi<DofusDudeItem>(`${PREFIX}/items/resources/${id}`),
  );
}

export async function getConsumable(id: number): Promise<{ data: DofusDudeItem; stale: boolean }> {
  return cacheGetOrFetchWithStale(
    `dd:consumable:${id}`,
    86400,
    604800,
    async () => fetchApi<DofusDudeItem>(`${PREFIX}/items/consumables/${id}`),
  );
}

export async function getQuestItem(id: number): Promise<{ data: DofusDudeItem; stale: boolean }> {
  return cacheGetOrFetchWithStale(
    `dd:quest:${id}`,
    86400,
    604800,
    async () => fetchApi<DofusDudeItem>(`${PREFIX}/items/quest/${id}`),
  );
}

export async function getCosmetic(id: number): Promise<{ data: DofusDudeItem; stale: boolean }> {
  return cacheGetOrFetchWithStale(
    `dd:cosmetic:${id}`,
    86400,
    604800,
    async () => fetchApi<DofusDudeItem>(`${PREFIX}/items/cosmetics/${id}`),
  );
}

// ══════════════════════════════════════════
//  MOUNTS
// ══════════════════════════════════════════

export async function searchMounts(query: string, limit = 8): Promise<{ data: DofusDudeMount[]; stale: boolean }> {
  return cacheGetOrFetchWithStale(
    `dd:search:mount:${query.toLowerCase()}`,
    3600,
    86400,
    async () => {
      const encoded = encodeURIComponent(query);
      return fetchApi<DofusDudeMount[]>(
        `${PREFIX}/mounts/search?query=${encoded}&limit=${limit}`,
      );
    },
  );
}

export async function getMount(id: number): Promise<{ data: DofusDudeMount; stale: boolean }> {
  return cacheGetOrFetchWithStale(
    `dd:mount:${id}`,
    86400,
    604800,
    async () => fetchApi<DofusDudeMount>(`${PREFIX}/mounts/${id}`),
  );
}

// ══════════════════════════════════════════
//  SETS (Panoplies)
// ══════════════════════════════════════════

export async function searchSets(query: string, limit = 8): Promise<{ data: DofusDudeSetSearchResult[]; stale: boolean }> {
  return cacheGetOrFetchWithStale(
    `dd:search:set:${query.toLowerCase()}`,
    3600,
    86400,
    async () => {
      const encoded = encodeURIComponent(query);
      return fetchApi<DofusDudeSetSearchResult[]>(
        `${PREFIX}/sets/search?query=${encoded}&limit=${limit}`,
      );
    },
  );
}

export async function getSet(id: number): Promise<{ data: DofusDudeSet; stale: boolean }> {
  return cacheGetOrFetchWithStale(
    `dd:set:${id}`,
    86400,
    604800,
    async () => fetchApi<DofusDudeSet>(`${PREFIX}/sets/${id}`),
  );
}

// ══════════════════════════════════════════
//  META
// ══════════════════════════════════════════

export async function getGameVersion(): Promise<GameVersion> {
  return cacheGetOrFetch(
    `dd:meta:version`,
    3600,
    async () => fetchApi<GameVersion>(`/${GAME}/v1/meta/version`),
  );
}

export async function getItemTypes(): Promise<ItemType[]> {
  return cacheGetOrFetch(
    `dd:meta:item_types`,
    86400,
    async () => fetchApi<ItemType[]>(`/${GAME}/v1/meta/items/types`),
  );
}

// ══════════════════════════════════════════
//  STATUS
// ══════════════════════════════════════════

export function isCircuitOpen(): boolean {
  return breaker.getState() === 'OPEN';
}
