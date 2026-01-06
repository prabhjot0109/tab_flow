// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

import { PERF_CONFIG } from "../config";
import type { LRUCache } from "../cache/lru-cache";

export interface PerfMetrics {
  overlayOpenTimes: number[];
  captureCount: number;
  cacheHits: number;
  cacheMisses: number;
  recordOverlayOpen: (duration: number) => void;
  getAverageOverlayTime: () => number;
  logStats: (screenshotCache: LRUCache) => void;
}

export const perfMetrics: PerfMetrics = {
  overlayOpenTimes: [],
  captureCount: 0,
  cacheHits: 0,
  cacheMisses: 0,

  recordOverlayOpen(duration: number) {
    this.overlayOpenTimes.push(duration);
    if (this.overlayOpenTimes.length > 100) this.overlayOpenTimes.shift();

    if (PERF_CONFIG.PERFORMANCE_LOGGING) {
      console.log(
        `[PERF] Overlay open: ${duration.toFixed(2)}ms (Target: <100ms)`
      );
    }
  },

  getAverageOverlayTime() {
    if (this.overlayOpenTimes.length === 0) return 0;
    const sum = this.overlayOpenTimes.reduce((a, b) => a + b, 0);
    return sum / this.overlayOpenTimes.length;
  },

  logStats(screenshotCache: LRUCache) {
    const cacheStats = screenshotCache.getStats();
    const avgOverlay = this.getAverageOverlayTime();

    console.log(`[STATS] ═══════════════════════════════════════`);
    console.log(
      `[STATS] Cache: ${cacheStats.entries}/${cacheStats.maxTabs} tabs`
    );
    console.log(
      `[STATS] Memory: ${(cacheStats.bytes / 1024 / 1024).toFixed(2)}MB / ${(
        cacheStats.maxBytes /
        1024 /
        1024
      ).toFixed(2)}MB (${cacheStats.utilizationPercent}%)`
    );
    console.log(
      `[STATS] Captures: ${this.captureCount} (Hits: ${this.cacheHits}, Misses: ${this.cacheMisses})`
    );
    console.log(
      `[STATS] Avg Overlay Open: ${avgOverlay.toFixed(2)}ms (Target: <100ms)`
    );
    console.log(`[STATS] ═══════════════════════════════════════`);
  },
};
