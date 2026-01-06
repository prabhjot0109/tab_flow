// ============================================================================
// LRU CACHE IMPLEMENTATION (WITH PERSISTENCE)
// ============================================================================

import { SimpleIDB } from "./indexed-db";

export interface CacheEntry {
  data: string; // base64
  size: number;
  timestamp: number;
}

export class LRUCache {
  private cache: Map<number, CacheEntry>;
  private maxTabs: number;
  private maxBytes: number;
  private currentBytes: number;
  private accessOrder: number[];
  private storage: SimpleIDB;
  public ready: Promise<void>;

  constructor(maxTabs = 30, maxBytes = 20 * 1024 * 1024) {
    this.cache = new Map(); // Map for O(1) access
    this.maxTabs = maxTabs;
    this.maxBytes = maxBytes;
    this.currentBytes = 0;
    this.accessOrder = []; // Track access order for LRU

    // Persistence
    this.storage = new SimpleIDB("TabSwitcherDB", "screenshots");
    this.ready = this._restoreFromStorage();
  }

  // Restore cache from IndexedDB on startup
  private async _restoreFromStorage(): Promise<void> {
    try {
      const keys = await this.storage.getAllKeys();
      if (keys.length === 0) return;

      const values = await this.storage.getAll();

      // Reconstruct cache
      keys.forEach((key, index) => {
        const raw = values[index];
        if (typeof key !== "number" || !raw || typeof raw !== "object") return;

        const value = raw as Partial<CacheEntry>;
        if (
          typeof value.data === "string" &&
          typeof value.size === "number" &&
          typeof value.timestamp === "number"
        ) {
          this.cache.set(key, value as CacheEntry);
          this.currentBytes += value.size;
        }
      });

      // Reconstruct access order based on timestamps (descending)
      this.accessOrder = Array.from(this.cache.entries())
        .sort((a, b) => b[1].timestamp - a[1].timestamp)
        .map((entry) => entry[0]);

      console.log(
        `[CACHE] Restored ${this.cache.size} screenshots from storage`
      );
    } catch (error) {
      console.error("[CACHE] Failed to restore from storage:", error);
    }
  }

  // Get item and mark as recently used
  get(key: number): CacheEntry | null {
    if (!this.cache.has(key)) return null;

    // Move to front of access order (most recent)
    this.accessOrder = this.accessOrder.filter((k) => k !== key);
    this.accessOrder.unshift(key);

    // Update timestamp in background for persistence
    const entry = this.cache.get(key)!;
    entry.timestamp = Date.now();
    this.storage
      .set(key, entry)
      .catch((e) => console.warn("Failed to update timestamp", e));

    return entry;
  }

  // Set item with automatic eviction
  set(key: number, value: string): void {
    const size = this._estimateSize(value);

    // Remove existing entry if updating
    if (this.cache.has(key)) {
      const oldSize = this.cache.get(key)!.size;
      this.currentBytes -= oldSize;
    }

    // Evict if necessary
    while (
      (this.cache.size >= this.maxTabs ||
        this.currentBytes + size > this.maxBytes) &&
      this.cache.size > 0
    ) {
      this._evictLRU();
    }

    // Add new entry
    const entry = { data: value, size, timestamp: Date.now() };
    this.cache.set(key, entry);
    this.currentBytes += size;

    // Update access order
    this.accessOrder = this.accessOrder.filter((k) => k !== key);
    this.accessOrder.unshift(key);

    // Persist to storage
    this.storage
      .set(key, entry)
      .catch((e) => console.error("Failed to persist screenshot", e));
  }

  // Remove specific entry
  delete(key: number): boolean {
    if (!this.cache.has(key)) return false;

    const entry = this.cache.get(key);
    if (!entry) return false;
    this.currentBytes -= entry.size;
    this.cache.delete(key);
    this.accessOrder = this.accessOrder.filter((k) => k !== key);

    // Remove from storage
    this.storage
      .delete(key)
      .catch((e) => console.error("Failed to delete screenshot", e));

    return true;
  }

  // Evict least recently used entry
  private _evictLRU(): void {
    if (this.accessOrder.length === 0) return;

    const lruKey = this.accessOrder.pop(); // Remove from end (least recent)
    if (lruKey === undefined) return;
    const entry = this.cache.get(lruKey);

    if (entry) {
      this.currentBytes -= entry.size;
      this.cache.delete(lruKey);
      this.storage
        .delete(lruKey)
        .catch((e) => console.warn("Failed to evict from storage", e));

      console.debug(
        `[LRU] Evicted tab ${lruKey} (${(entry.size / 1024).toFixed(1)}KB)`
      );
    }
  }

  // Estimate size of base64 screenshot
  _estimateSize(data: string): number {
    // Base64 string size in bytes
    return Math.ceil(data.length * 0.75); // Base64 is ~33% larger than binary
  }

  // Get cache statistics
  getStats(): {
    entries: number;
    bytes: number;
    maxTabs: number;
    maxBytes: number;
    utilizationPercent: string;
  } {
    return {
      entries: this.cache.size,
      bytes: this.currentBytes,
      maxTabs: this.maxTabs,
      maxBytes: this.maxBytes,
      utilizationPercent: ((this.currentBytes / this.maxBytes) * 100).toFixed(
        1
      ),
    };
  }

  // Clear all entries
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.currentBytes = 0;
    this.storage
      .clear()
      .catch((e) => console.error("Failed to clear storage", e));
  }
}
