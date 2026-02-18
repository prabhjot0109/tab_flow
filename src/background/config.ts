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
  MAX_SCREENSHOT_SIZE: 220 * 1024, // Higher per-screenshot budget for clearer previews
  JPEG_QUALITY: 72, // Better baseline JPEG quality for tab previews
  THUMBNAIL_MAX_WIDTH: 520, // Preserve more detail before card rendering
  THUMBNAIL_MAX_HEIGHT: 325,
  CAPTURE_DELAY: 100, // Delay before capture (ms)
  SCREENSHOT_CACHE_DURATION: 10 * 60 * 1000, // 10 minutes (increased for better cache utilization)
  MAX_CAPTURES_PER_SECOND: 2, // Chrome API limit
  THROTTLE_INTERVAL: 500, // Min time between captures (ms)
  PERFORMANCE_LOGGING: false, // Enable performance metrics

  // Quality tiers for memory optimization
  QUALITY_TIERS: {
    HIGH: { quality: 85, maxSize: 320 * 1024, label: "High Quality" },
    NORMAL: { quality: 72, maxSize: 220 * 1024, label: "Normal" },
    PERFORMANCE: { quality: 50, maxSize: 130 * 1024, label: "Performance" },
  } as Record<string, QualityTier>,
  DEFAULT_QUALITY_TIER: "NORMAL", // Balanced quality/speed default for large tab sets

  // Alarm names for chrome.alarms API
  ALARMS: {
    IDLE_CHECK: "idle-screenshot-check",
    PERF_LOG: "performance-log",
  },
} as const;

