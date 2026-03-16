/**
 * LRU Cache for LLM API call deduplication.
 * Caches row transformation results keyed by a deterministic hash.
 */

export class LRUCache<V> {
  private cache = new Map<string, V>();
  private readonly maxSize: number;

  constructor(maxSize = 500) {
    this.maxSize = maxSize;
  }

  get(key: string): V | undefined {
    const val = this.cache.get(key);
    if (val !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, val);
    }
    return val;
  }

  set(key: string, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict oldest (first key)
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, value);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  get size(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
  }
}

/**
 * Create a deterministic hash key from a row object.
 */
export function hashRow(row: Record<string, unknown>): string {
  const sorted = Object.keys(row)
    .sort()
    .map((k) => `${k}:${row[k] === null || row[k] === undefined ? '' : String(row[k]).trim().toLowerCase()}`)
    .join('|');
  // Simple string hash (djb2)
  let hash = 5381;
  for (let i = 0; i < sorted.length; i++) {
    hash = ((hash << 5) + hash + sorted.charCodeAt(i)) & 0xffffffff;
  }
  return hash.toString(36);
}
