// ============================================================================
// SCREENSHOT SERVICE
// Handles screenshot capture with rate limiting and queue management
// ============================================================================

import { PERF_CONFIG } from "../config";
import { LRUCache } from "../cache/lru-cache";
import { perfMetrics } from "../utils/performance";

// Queue for rate-limited captures
const captureQueue: { tabId: number; timestamp: number }[] = [];
let lastCaptureTime = 0;
let isProcessingQueue = false;
const pendingCaptures = new Set<number>();

// Current quality tier setting
let currentQualityTier: string = PERF_CONFIG.DEFAULT_QUALITY_TIER;

// ============================================================================
// QUALITY TIER MANAGEMENT
// ============================================================================

export function getCurrentQualityTier(): string {
  return currentQualityTier;
}

export function setCurrentQualityTier(tier: string): boolean {
  if (PERF_CONFIG.QUALITY_TIERS[tier]) {
    currentQualityTier = tier;
    return true;
  }
  return false;
}

export async function loadQualityTierFromStorage(): Promise<void> {
  try {
    const result = await chrome.storage.local.get(["qualityTier"]);
    const stored = result?.qualityTier as string;
    if (stored && PERF_CONFIG.QUALITY_TIERS[stored]) {
      currentQualityTier = stored;
      console.log(`[INIT] Loaded quality tier: ${currentQualityTier}`);
    } else {
      console.log("[INIT] Using default quality tier:", currentQualityTier);
    }
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : typeof e === "string" ? e : String(e);
    console.warn("[INIT] Failed to load quality tier, using default:", msg);
  }
}

// ============================================================================
// CAPTURE QUEUE MANAGEMENT
// ============================================================================

export function queueCapture(
  tabId: number,
  screenshotCache: LRUCache,
  priority = false
): void {
  // Check if already in queue or pending
  if (
    captureQueue.some((item) => item.tabId === tabId) ||
    pendingCaptures.has(tabId)
  ) {
    return;
  }

  const queueItem = { tabId, timestamp: Date.now() };

  if (priority) {
    captureQueue.unshift(queueItem);
  } else {
    captureQueue.push(queueItem);
  }

  processQueue(screenshotCache);
}

async function processQueue(screenshotCache: LRUCache): Promise<void> {
  if (isProcessingQueue || captureQueue.length === 0) return;

  isProcessingQueue = true;

  while (captureQueue.length > 0) {
    const now = Date.now();
    const timeSinceLastCapture = now - lastCaptureTime;

    // Enforce rate limit: max 2 captures per second
    if (timeSinceLastCapture < PERF_CONFIG.THROTTLE_INTERVAL) {
      const waitTime = PERF_CONFIG.THROTTLE_INTERVAL - timeSinceLastCapture;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    const item = captureQueue.shift();
    if (item && item.tabId) {
      pendingCaptures.add(item.tabId);

      try {
        await captureTabScreenshot(item.tabId, screenshotCache);
      } finally {
        pendingCaptures.delete(item.tabId);
      }
    }

    lastCaptureTime = Date.now();
  }

  isProcessingQueue = false;
}

// ============================================================================
// SCREENSHOT CAPTURE
// ============================================================================

export async function captureTabScreenshot(
  tabId: number,
  screenshotCache: LRUCache,
  forceQuality: string | null = null
): Promise<string | null> {
  try {
    const tab = await chrome.tabs.get(tabId);

    // Only capture if tab is currently active (visible)
    if (!tab.active) {
      console.debug(`[CAPTURE] Tab ${tabId} is not active, skipping capture`);
      return null;
    }

    // Check if tab is capturable
    if (!isTabCapturable(tab)) {
      console.debug(`[CAPTURE] Tab ${tabId} not capturable: ${tab.url}`);
      return null;
    }

    // Wait for page to be fully rendered
    await new Promise((resolve) =>
      setTimeout(resolve, PERF_CONFIG.CAPTURE_DELAY + 50)
    );

    // Verify tab is still active after delay
    const tabAfterDelay = await chrome.tabs.get(tabId).catch(() => null);
    if (!tabAfterDelay || !tabAfterDelay.active) {
      console.debug(`[CAPTURE] Tab ${tabId} no longer active after delay`);
      return null;
    }

    // Get quality settings
    const qualityTier = forceQuality || currentQualityTier;
    const qualitySettings =
      PERF_CONFIG.QUALITY_TIERS[qualityTier] ||
      PERF_CONFIG.QUALITY_TIERS.NORMAL;

    const startTime = performance.now();

    // Capture as JPEG directly for better compression
    let screenshot = null;
    try {
      screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: "jpeg",
        quality: qualitySettings.quality,
      });
    } catch (captureError) {
      // Retry once with lower quality if first attempt fails
      console.debug(
        `[CAPTURE] First attempt failed, retrying with lower quality`
      );
      try {
        await new Promise((resolve) => setTimeout(resolve, 100));
        screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, {
          format: "jpeg",
          quality: Math.max(30, qualitySettings.quality - 20),
        });
      } catch (retryError) {
        const retryMessage =
          retryError instanceof Error ? retryError.message : String(retryError);
        console.debug(
          `[CAPTURE] Retry also failed for tab ${tabId}:`,
          retryMessage
        );
        return null;
      }
    }

    if (!screenshot) {
      console.debug(`[CAPTURE] No screenshot data for tab ${tabId}`);
      return null;
    }

    const captureTime = performance.now() - startTime;

    // Check size
    const size = screenshotCache._estimateSize(screenshot);
    if (size > qualitySettings.maxSize * 1.5) {
      console.warn(
        `[CAPTURE] Screenshot large: ${(size / 1024).toFixed(1)}KB (target: ${(
          qualitySettings.maxSize / 1024
        ).toFixed(1)}KB)`
      );
    }

    // Store in LRU cache
    screenshotCache.set(tabId, screenshot);
    perfMetrics.captureCount++;

    if (PERF_CONFIG.PERFORMANCE_LOGGING) {
      console.debug(
        `[CAPTURE] Tab ${tabId}: ${captureTime.toFixed(2)}ms, ${(
          size / 1024
        ).toFixed(1)}KB (${qualitySettings.label})`
      );
    }

    return screenshot;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.debug(`[CAPTURE] Failed for tab ${tabId}:`, errorMessage);
    return null;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function isTabCapturable(tab: chrome.tabs.Tab): boolean {
  if (tab.discarded) return false;
  if (!tab.url) return false;

  // Protected schemes that cannot be scripted
  const protectedSchemes = [
    "chrome://",
    "edge://",
    "devtools://",
    "view-source:",
  ];

  if (
    tab.url &&
    protectedSchemes.some((scheme) => tab.url!.startsWith(scheme))
  ) {
    return false;
  }

  return true;
}

export function removePendingCapture(tabId: number): void {
  pendingCaptures.delete(tabId);
}
