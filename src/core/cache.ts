import NodeCache from "node-cache";

const DEFAULT_TTL = {
  search: 60 * 30,
  product: 60 * 60,
  priceHistory: 60 * 60 * 6,
  category: 60 * 60 * 24,
} as const;

type CacheType = keyof typeof DEFAULT_TTL;

const cache = new NodeCache({
  checkperiod: 120,
  useClones: false,
});

export function getCached<T>(key: string): T | undefined {
  return cache.get<T>(key);
}

export function setCached<T>(
  key: string,
  value: T,
  type: CacheType = "search",
): void {
  cache.set(key, value, DEFAULT_TTL[type]);
}

export function buildCacheKey(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(":");
}

export function clearCache(): void {
  cache.flushAll();
}
