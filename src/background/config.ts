// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

export interface QualityTier {
  quality: number;
  maxSize: number;
  label: string;
}

export const PERF_CONFIG = {
  MAX_CACHED_TABS: 100, // LRU cache size - increased for 100+ tabs support
  MAX_CACHE_BYTES: 50 * 1024 * 1024, // 50MB total cache for 100+ tabs
  MAX_SCREENSHOT_SIZE: 150 * 1024, // 150KB per screenshot (optimized for many tabs)
  JPEG_QUALITY: 50, // JPEG compression quality (balanced for performance)
  THUMBNAIL_MAX_WIDTH: 320, // Downscale captures for memory efficiency
  THUMBNAIL_MAX_HEIGHT: 200,
  CAPTURE_DELAY: 100, // Delay before capture (ms)
  SCREENSHOT_CACHE_DURATION: 10 * 60 * 1000, // 10 minutes (increased for better cache utilization)
  MAX_CAPTURES_PER_SECOND: 2, // Chrome API limit
  THROTTLE_INTERVAL: 500, // Min time between captures (ms)
  PERFORMANCE_LOGGING: false, // Enable performance metrics

  // Quality tiers for memory optimization
  QUALITY_TIERS: {
    HIGH: { quality: 70, maxSize: 200 * 1024, label: "High Quality" },
    NORMAL: { quality: 50, maxSize: 150 * 1024, label: "Normal" },
    PERFORMANCE: { quality: 35, maxSize: 80 * 1024, label: "Performance" },
  } as Record<string, QualityTier>,
  DEFAULT_QUALITY_TIER: "PERFORMANCE", // Default quality tier for memory efficiency

  // Alarm names for chrome.alarms API
  ALARMS: {
    IDLE_CHECK: "idle-screenshot-check",
    PERF_LOG: "performance-log",
  },
} as const;

export type PerfConfig = typeof PERF_CONFIG;




