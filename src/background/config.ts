// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

export interface QualityTier {
  quality: number;
  maxSize: number;
  label: string;
}

export const PERF_CONFIG = {
  MAX_CACHED_TABS: 30, // LRU cache size
  MAX_CACHE_BYTES: 20 * 1024 * 1024, // 20MB total cache
  MAX_SCREENSHOT_SIZE: 200 * 1024, // 200KB per screenshot (will be adjusted by quality tier)
  JPEG_QUALITY: 60, // JPEG compression quality (will be adjusted by quality tier)
  CAPTURE_DELAY: 100, // Delay before capture (ms)
  SCREENSHOT_CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
  MAX_CAPTURES_PER_SECOND: 2, // Chrome API limit
  THROTTLE_INTERVAL: 500, // Min time between captures (ms)
  PERFORMANCE_LOGGING: true, // Enable performance metrics

  // Quality tiers for memory optimization
  QUALITY_TIERS: {
    HIGH: { quality: 80, maxSize: 300 * 1024, label: "High Quality" },
    NORMAL: { quality: 60, maxSize: 200 * 1024, label: "Normal" },
    PERFORMANCE: { quality: 40, maxSize: 100 * 1024, label: "Performance" },
  } as Record<string, QualityTier>,
  DEFAULT_QUALITY_TIER: "PERFORMANCE", // Default quality tier

  // Alarm names for chrome.alarms API
  ALARMS: {
    IDLE_CHECK: "idle-screenshot-check",
    PERF_LOG: "performance-log",
  },
} as const;

export type PerfConfig = typeof PERF_CONFIG;
