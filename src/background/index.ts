// Background service worker for Visual Tab Switcher
// ============================================================================
// PERFORMANCE-OPTIMIZED IMPLEMENTATION
// Target: <100ms overlay open, <50MB with 100 tabs, 60fps animations
// ============================================================================

// ============================================================================
// LRU CACHE IMPLEMENTATION
// ============================================================================
// ============================================================================
// INDEXEDDB STORAGE WRAPPER
// ============================================================================
class SimpleIDB {
  private dbName: string;
  private storeName: string;
  private db: IDBDatabase | null;
  private initPromise: Promise<IDBDatabase>;

  constructor(dbName: string, storeName: string) {
    this.dbName = dbName;
    this.storeName = storeName;
    this.db = null;
    this.initPromise = this._open();
  }

  _open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db!);
      };
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest)!.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  }

  async getAll(): Promise<unknown[]> {
    await this.initPromise;
    if (!this.db) throw new Error("DB not initialized");
    return new Promise<unknown[]>((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllKeys(): Promise<IDBValidKey[]> {
    await this.initPromise;
    if (!this.db) throw new Error("DB not initialized");
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.getAllKeys();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async set(key: IDBValidKey, value: unknown): Promise<void> {
    await this.initPromise;
    if (!this.db) throw new Error("DB not initialized");
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async delete(key: IDBValidKey): Promise<void> {
    await this.initPromise;
    if (!this.db) throw new Error("DB not initialized");
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(): Promise<void> {
    await this.initPromise;
    if (!this.db) throw new Error("DB not initialized");
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// ============================================================================
// LRU CACHE IMPLEMENTATION (WITH PERSISTENCE)
// ============================================================================
interface CacheEntry {
  data: string; // base64
  size: number;
  timestamp: number;
}

class LRUCache {
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
  async _restoreFromStorage() {
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
  set(key: number, value: string) {
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
  delete(key: number) {
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
  _evictLRU() {
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
  _estimateSize(data: string) {
    // Base64 string size in bytes
    return Math.ceil(data.length * 0.75); // Base64 is ~33% larger than binary
  }

  // Get cache statistics
  getStats() {
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
  clear() {
    this.cache.clear();
    this.accessOrder = [];
    this.currentBytes = 0;
    this.storage
      .clear()
      .catch((e) => console.error("Failed to clear storage", e));
  }
}

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================
const PERF_CONFIG = {
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
  } as Record<string, { quality: number; maxSize: number; label: string }>,
  DEFAULT_QUALITY_TIER: "PERFORMANCE", // Default quality tier
};

// ============================================================================
// GLOBAL STATE
// ============================================================================
const screenshotCache = new LRUCache(
  PERF_CONFIG.MAX_CACHED_TABS,
  PERF_CONFIG.MAX_CACHE_BYTES
);
let recentTabOrder: number[] = []; // Track tab access order (most recent first) - will be restored from storage
const tabOpenOrder = new Map<number, number>(); // Track when tabs were opened (tabId -> timestamp)
const captureQueue: { tabId: number; timestamp: number }[] = []; // Queue for rate-limited captures
let lastCaptureTime = 0; // Timestamp of last capture
let isProcessingQueue = false; // Queue processing flag
let previousActiveTabId: number | null = null; // Track previous active tab for better screenshot capture
let currentQualityTier = PERF_CONFIG.DEFAULT_QUALITY_TIER; // Current quality setting
const pendingCaptures = new Set<number>(); // Track tabs with pending captures to avoid duplicates
let recentOrderRestored = false; // Flag to track if recent order has been restored
const tabsWithMedia = new Set<number>(); // Track tabs that have media elements (even if paused/muted)

// Persist tabsWithMedia to session storage so it survives service worker suspension
function saveTabsWithMedia() {
  try {
    chrome.storage.session.set({ tabsWithMedia: Array.from(tabsWithMedia) });
  } catch (e) {
    // Session storage might fail in some environments
  }
}

async function loadTabsWithMedia() {
  try {
    const data = await chrome.storage.session.get("tabsWithMedia");
    if (data.tabsWithMedia && Array.isArray(data.tabsWithMedia)) {
      data.tabsWithMedia.forEach((id: number) => tabsWithMedia.add(id));
    }
  } catch (e) {
    // Ignore
  }
}

// Initialize on load
loadTabsWithMedia();

// Also query currently audible tabs on startup
async function initializeAudibleTabs() {
  try {
    const audibleTabs = await chrome.tabs.query({ audible: true });
    for (const tab of audibleTabs) {
      if (tab.id && !tabsWithMedia.has(tab.id)) {
        tabsWithMedia.add(tab.id);
      }
    }
    // Also add tabs that are muted (they had audio at some point)
    const allTabs = await chrome.tabs.query({});
    for (const tab of allTabs) {
      if (tab.id && tab.mutedInfo?.muted && !tabsWithMedia.has(tab.id)) {
        tabsWithMedia.add(tab.id);
      }
    }
    if (tabsWithMedia.size > 0) {
      saveTabsWithMedia();
      console.log(`[MEDIA] Initialized ${tabsWithMedia.size} tabs with media`);
    }
  } catch (e) {
    console.debug("[MEDIA] Error initializing audible tabs:", e);
  }
}

// Run after a short delay to let service worker settle
setTimeout(initializeAudibleTabs, 200);

// ... existing code ...

// In the message handler (which I'll find below)

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================
const perfMetrics: {
  overlayOpenTimes: number[];
  captureCount: number;
  cacheHits: number;
  cacheMisses: number;
  recordOverlayOpen: (duration: number) => void;
  getAverageOverlayTime: () => number;
  logStats: () => void;
} = {
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

  logStats() {
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

// ============================================================================
// SCREENSHOT CAPTURE WITH RATE LIMITING
// ============================================================================

// Add capture to queue
function queueCapture(tabId: number, priority = false) {
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

  processQueue();
}

// Process capture queue with rate limiting
async function processQueue() {
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
        await captureTabScreenshot(item.tabId);
      } finally {
        pendingCaptures.delete(item.tabId);
      }
    }

    lastCaptureTime = Date.now();
  }

  isProcessingQueue = false;
}

// Capture screenshot with error handling and compression
// This function captures the currently visible tab in the specified window.
// It should only be called when the target tab is active and visible.
async function captureTabScreenshot(
  tabId: number,
  forceQuality: string | null = null
) {
  try {
    const tab = await chrome.tabs.get(tabId);

    // Only capture if tab is currently active (visible)
    // captureVisibleTab captures whatever is visible, so we must verify
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
    // Longer delay helps ensure content is painted
    await new Promise((resolve) =>
      setTimeout(resolve, PERF_CONFIG.CAPTURE_DELAY + 50)
    );

    // Verify tab is still active after delay (user might have switched)
    const tabAfterDelay = await chrome.tabs.get(tabId).catch(() => null);
    if (!tabAfterDelay || !tabAfterDelay.active) {
      console.debug(`[CAPTURE] Tab ${tabId} no longer active after delay`);
      return null;
    }

    // Get quality settings from current tier or forced override
    const qualityTier = forceQuality || currentQualityTier;
    const qualitySettings =
      PERF_CONFIG.QUALITY_TIERS[qualityTier] ||
      PERF_CONFIG.QUALITY_TIERS.NORMAL;

    const startTime = performance.now();

    // Capture as JPEG directly for better compression and smaller size
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
          retryError instanceof Error
            ? retryError.message
            : typeof retryError === "string"
            ? retryError
            : String(retryError);
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
      // Allow some overflow but warn
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
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === "string"
        ? error
        : String(error);
    console.debug(`[CAPTURE] Failed for tab ${tabId}:`, errorMessage);
    return null;
  }
}

// Check if tab can be captured and injected
function isTabCapturable(tab: chrome.tabs.Tab): boolean {
  if (tab.discarded) return false;
  if (!tab.url) return false;

  // Protected schemes that cannot be scripted due to browser security policies
  const protectedSchemes = [
    "chrome://",
    "edge://",
    "devtools://",
    "view-source:",
  ];

  // Check protected schemes
  if (
    tab.url &&
    protectedSchemes.some((scheme) => tab.url!.startsWith(scheme))
  ) {
    return false;
  }

  return true;
}

// ============================================================================
// TAB EVENT LISTENERS
// ============================================================================

// Defensive check for chrome.tabs API availability
if (typeof chrome !== "undefined" && chrome.tabs) {
  // Listen for tab activation - auto-capture screenshots
  chrome.tabs.onActivated.addListener(
    async (activeInfo: chrome.tabs.OnActivatedInfo) => {
      try {
        // Update tracking immediately
        previousActiveTabId = activeInfo.tabId;
        activeTabStartTime = Date.now();
        updateRecentTabOrder(activeInfo.tabId);

        // Capture the newly activated tab after a short delay to let it render
        setTimeout(() => {
          queueCapture(activeInfo.tabId, true);
        }, 200);
      } catch (e) {
        console.debug("[TAB] Error in onActivated:", e);
      }
    }
  );

  // Listen for tab updates (page load complete) - capture screenshot + track audible state
  chrome.tabs.onUpdated.addListener(
    (
      tabId: number,
      changeInfo: chrome.tabs.OnUpdatedInfo,
      tab: chrome.tabs.Tab
    ) => {
      try {
        // Track audible state changes - if tab produces sound, mark it as having media
        if (changeInfo.audible !== undefined) {
          if (changeInfo.audible) {
            // Tab started producing sound - definitely has media
            if (!tabsWithMedia.has(tabId)) {
              tabsWithMedia.add(tabId);
              saveTabsWithMedia();
              console.debug(
                `[MEDIA] Tab ${tabId} became audible, marked as having media`
              );
            }
          }
          // Note: We don't remove from tabsWithMedia when audible becomes false
          // because the tab might just have paused media that can still be controlled
        }

        // Capture when page finishes loading and tab is active
        if (changeInfo.status === "complete" && tab.active) {
          // Delay capture to ensure page is fully rendered
          setTimeout(() => {
            queueCapture(tabId, true);
          }, 300);
        }
      } catch (e) {
        console.debug("[TAB] Error in onUpdated:", e);
      }
    }
  );

  // Track when tabs are created for open order
  chrome.tabs.onCreated.addListener((tab: chrome.tabs.Tab) => {
    try {
      if (tab.id) tabOpenOrder.set(tab.id, Date.now());
    } catch (e) {
      console.debug("[TAB] Error in onCreated:", e);
    }
  });

  // Clean up when tabs are closed
  chrome.tabs.onRemoved.addListener((tabId: number) => {
    try {
      screenshotCache.delete(tabId);
      removeFromRecentOrder(tabId);
      tabOpenOrder.delete(tabId);
      pendingCaptures.delete(tabId);
      if (tabsWithMedia.has(tabId)) {
        tabsWithMedia.delete(tabId);
        saveTabsWithMedia();
      }
      console.debug(`[CLEANUP] Removed tab ${tabId} from cache`);
    } catch (e) {
      console.debug("[TAB] Error in onRemoved:", e);
    }
  });
} else {
  console.error("[INIT] chrome.tabs API not available");
}

// Global variable for idle tracking
let activeTabStartTime = Date.now();

// Idle Capture Strategy: Re-capture tabs if user stays on them > 5 minutes
setInterval(async () => {
  try {
    if (!previousActiveTabId) return;

    // Check if user is idle on the current tab for > 5 mins
    const idleThreshold = 5 * 60 * 1000;
    if (Date.now() - activeTabStartTime > idleThreshold) {
      console.debug(
        `[IDLE] Tab ${previousActiveTabId} idle > 5m, refreshing screenshot`
      );
      // Update start time to avoid repeated captures every minute
      activeTabStartTime = Date.now();
      queueCapture(previousActiveTabId, true);
    }
  } catch (error) {
    console.debug("[IDLE] Error in idle check:", error);
  }
}, 60 * 1000); // Check every minute

// Update tab order tracking
function updateRecentTabOrder(tabId: number) {
  removeFromRecentOrder(tabId);
  recentTabOrder.unshift(tabId);

  // Keep only necessary entries
  if (recentTabOrder.length > PERF_CONFIG.MAX_CACHED_TABS * 2) {
    recentTabOrder.length = PERF_CONFIG.MAX_CACHED_TABS * 2;
  }

  // Persist to storage (debounced)
  saveRecentOrderDebounced();
}

function removeFromRecentOrder(tabId: number) {
  const index = recentTabOrder.indexOf(tabId);
  if (index !== -1) {
    recentTabOrder.splice(index, 1);
  }
}

// Debounced save to avoid too many writes
let saveRecentOrderTimer: ReturnType<typeof setTimeout> | null = null;
function saveRecentOrderDebounced() {
  if (saveRecentOrderTimer) clearTimeout(saveRecentOrderTimer);
  saveRecentOrderTimer = setTimeout(() => {
    chrome.storage.local
      .set({ recentTabOrder: recentTabOrder.slice(0, 100) })
      .catch((e) => console.debug("[STORAGE] Failed to save recent order:", e));
  }, 500);
}

// Restore recent order from storage
async function restoreRecentOrder() {
  try {
    const result = await chrome.storage.local.get(["recentTabOrder"]);
    if (result.recentTabOrder && Array.isArray(result.recentTabOrder)) {
      // Filter out tabs that no longer exist
      const existingTabs = await chrome.tabs.query({});
      const existingIds = new Set(existingTabs.map((t) => t.id));
      recentTabOrder = result.recentTabOrder.filter((id) =>
        existingIds.has(id)
      );
      console.log(
        `[INIT] Restored ${recentTabOrder.length} recent tab order entries`
      );
    }
  } catch (e) {
    console.debug("[STORAGE] Failed to restore recent order:", e);
  }
  recentOrderRestored = true;
}

// ============================================================================
// COMMAND HANDLER - SHOW TAB SWITCHER
// ============================================================================

// Listen for keyboard shortcut
if (typeof chrome !== "undefined" && chrome.commands) {
  chrome.commands.onCommand.addListener((command) => {
    if (command === "show-tab-switcher" || command === "cycle-next-tab") {
      handleShowTabSwitcher();
    }
  });
}

// Handle showing the tab switcher - OPTIMIZED FOR <100ms
async function handleShowTabSwitcher() {
  // Ensure cache and recent order are restored before querying
  if (screenshotCache.ready) await screenshotCache.ready;
  if (!recentOrderRestored) await restoreRecentOrder();

  const startTime = performance.now();

  try {
    // Get current window tabs and groups
    const currentWindow = await chrome.windows.getCurrent();
    const tabs = await chrome.tabs.query({ windowId: currentWindow.id });

    const tabsWithIds = tabs.filter(
      (tab): tab is chrome.tabs.Tab & { id: number } =>
        typeof tab.id === "number"
    );

    // Fetch tab groups if API is available
    let groups: chrome.tabGroups.TabGroup[] = [];
    if (chrome.tabGroups) {
      try {
        groups = await chrome.tabGroups.query({ windowId: currentWindow.id });
      } catch (e) {
        console.debug("[GROUPS] Failed to fetch groups:", e);
      }
    }

    // Initialize open order for tabs we haven't seen yet
    const now = Date.now();
    tabsWithIds.forEach((tab, index) => {
      if (!tabOpenOrder.has(tab.id)) {
        // Use a timestamp based on tab index for existing tabs
        tabOpenOrder.set(tab.id, now - (tabs.length - index) * 1000);
      }
    });

    // Sort by recent access order
    const sortedTabs = sortTabsByRecent(tabsWithIds);

    // INSTANT RESPONSE: Build tab data with cached screenshots only
    // Show screenshots for top 8 most recent tabs for better preview coverage
    const RECENT_PREVIEW_LIMIT = 8;

    const tabsData = sortedTabs.map((tab, index) => {
      let screenshot = null;

      // Check if this tab should show a screenshot preview
      const isRecent = index < RECENT_PREVIEW_LIMIT;

      if (isTabCapturable(tab) && isRecent) {
        const cached = screenshotCache.get(tab.id);
        if (cached) {
          screenshot = cached;
          perfMetrics.cacheHits++;
        } else {
          perfMetrics.cacheMisses++;
        }
      }

      return {
        id: tab.id,
        title: tab.title || "Untitled",
        url: tab.url,
        favIconUrl: tab.favIconUrl,
        screenshot: screenshot ? screenshot.data : null,
        pinned: tab.pinned,
        index: tab.index,
        active: tab.active,
        audible: tab.audible,
        mutedInfo: tab.mutedInfo,
        groupId: tab.groupId,
        hasMedia: tabsWithMedia.has(tab.id) || tab.audible,
      };
    });

    const groupsData = groups.map((g) => ({
      id: g.id,
      title: g.title,
      color: g.color,
      collapsed: g.collapsed,
    }));

    // Get active tab
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!activeTab || typeof activeTab.id !== "number") {
      console.warn("[INJECT] No active tab found to open overlay");
      return;
    }

    // Guard: Do not attempt to inject on protected pages
    if (!isTabCapturable(activeTab)) {
      console.warn(
        "[INJECT] Cannot open overlay on protected page. Switch to a regular webpage and try again."
      );
      return;
    }

    // Send to content script IMMEDIATELY
    await sendMessageWithRetry(activeTab.id, {
      action: "showTabSwitcher",
      tabs: tabsData,
      groups: groupsData,
      activeTabId: activeTab.id,
    });

    // Record performance
    const duration = performance.now() - startTime;
    perfMetrics.recordOverlayOpen(duration);
  } catch (error) {
    console.error("[ERROR] Failed to show tab switcher:", error);
  }
}

// Import content script via CRXJS special query to get output filename
import contentScriptPath from "../content/index.ts?script";

// Send message with automatic script injection
async function sendMessageWithRetry(tabId: number, message: any, retries = 1) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch (err: any) {
    if (
      retries > 0 &&
      err.message &&
      err.message.includes("Could not establish connection")
    ) {
      console.log("[INJECT] Content script not ready, injecting...");

      try {
        // Inject content script using the dynamic path from CRXJS
        await chrome.scripting.executeScript({
          target: { tabId },
          files: [contentScriptPath],
        });

        // Retry after injection
        await new Promise((resolve) => setTimeout(resolve, 150));
        await chrome.tabs.sendMessage(tabId, message);
      } catch (injectErr: any) {
        const msg = injectErr && injectErr.message ? injectErr.message : "";
        const protectedErr =
          msg.includes("cannot be scripted") ||
          msg.includes("Cannot access a chrome://") ||
          msg.includes("Cannot access a chrome-extension://") ||
          (msg.includes("Cannot access") && msg.includes("URL"));
        if (protectedErr) {
          console.warn(
            "[INJECT] Cannot inject on this page (protected URL). Try on a regular webpage."
          );
        } else {
          throw injectErr;
        }
      }
    } else {
      throw err;
    }
  }
}

// Sort tabs by recent usage (most recently accessed first)
// Uses Chrome's lastAccessed timestamp as primary sort, falls back to our tracking
function sortTabsByRecent<T extends chrome.tabs.Tab>(tabs: T[]): T[] {
  return [...tabs].sort((a, b) => {
    // Primary: Use Chrome's lastAccessed timestamp if available (most reliable)
    const aLastAccessed = (a as any).lastAccessed || 0;
    const bLastAccessed = (b as any).lastAccessed || 0;

    if (aLastAccessed && bLastAccessed) {
      return bLastAccessed - aLastAccessed; // Higher (more recent) first
    }
    if (aLastAccessed) return -1;
    if (bLastAccessed) return 1;

    // Fallback: Use our tracked recent order
    const aRecentIndex =
      typeof a.id === "number" ? recentTabOrder.indexOf(a.id) : -1;
    const bRecentIndex =
      typeof b.id === "number" ? recentTabOrder.indexOf(b.id) : -1;

    // Both in recent order - sort by recency (lower index = more recent)
    if (aRecentIndex !== -1 && bRecentIndex !== -1) {
      return aRecentIndex - bRecentIndex;
    }

    // One in recent, one not
    if (aRecentIndex !== -1) return -1;
    if (bRecentIndex !== -1) return 1;

    // Neither in recent - sort by open time (newer first)
    const aTime = typeof a.id === "number" ? tabOpenOrder.get(a.id) ?? 0 : 0;
    const bTime = typeof b.id === "number" ? tabOpenOrder.get(b.id) ?? 0 : 0;

    if (aTime !== bTime) {
      return bTime - aTime;
    }

    // Final fallback: tab index (higher index = more recent in Chrome)
    return (b.index ?? 0) - (a.index ?? 0);
  });
}

// ============================================================================
// HISTORY NOTE: Tab history is now handled directly in the content script
// using the Navigation API (window.navigation.entries()). This provides
// accurate back/forward entries without complex background tracking.
// ============================================================================

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

// Listen for messages from content script
if (
  typeof chrome !== "undefined" &&
  chrome.runtime &&
  chrome.runtime.onMessage
) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Handle async operations properly
    handleMessage(request, sender, sendResponse);
    return true; // Keep channel open for async response
  });
}

async function handleMessage(
  request: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
) {
  try {
    if (!request || !request.action) {
      console.error("[ERROR] Invalid message received:", request);
      sendResponse({ success: false, error: "Invalid message format" });
      return;
    }

    switch (request.action) {
      case "reportMediaPresence":
        if (sender.tab && sender.tab.id) {
          if (!tabsWithMedia.has(sender.tab.id)) {
            tabsWithMedia.add(sender.tab.id);
            saveTabsWithMedia();
          }
        }
        sendResponse({ success: true });
        break;

      case "getRecentlyClosed":
        try {
          const apiMax = 25; // sessions.MAX_SESSION_RESULTS
          const uiMax = Math.min(
            25,
            typeof request.maxResults === "number" ? request.maxResults : 10
          );
          const sessions = await chrome.sessions.getRecentlyClosed({
            maxResults: apiMax,
          });
          const items = [];
          for (const s of sessions) {
            if (s.tab) {
              items.push({
                kind: "tab",
                sessionId: s.tab.sessionId,
                lastModified: s.lastModified,
                title: s.tab.title || "Untitled",
                url: s.tab.url || "",
                favIconUrl: s.tab.favIconUrl || "",
              });
            } else if (s.window && Array.isArray(s.window.tabs)) {
              // Flatten window tabs into individual recent entries when possible
              for (const t of s.window.tabs) {
                items.push({
                  kind: "tab",
                  sessionId: t.sessionId || s.window.sessionId, // fall back to window sessionId
                  lastModified: s.lastModified,
                  title: t.title || "Untitled",
                  url: t.url || "",
                  favIconUrl: t.favIconUrl || "",
                });
              }
            } else if (s.window && s.window.sessionId) {
              // As a last resort, expose the window as a single restorable item
              items.push({
                kind: "window",
                sessionId: s.window.sessionId,
                lastModified: s.lastModified,
                title: "Window",
                url: "",
                favIconUrl: "",
              });
            }
          }
          // Sort by most recently modified (desc) and limit to uiMax results
          items.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
          const limited = items.slice(0, uiMax);
          sendResponse({ success: true, items: limited });
        } catch (error: any) {
          console.error("[ERROR] Failed to get recently closed:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case "restoreSession":
        try {
          if (!request.sessionId || typeof request.sessionId !== "string") {
            sendResponse({ success: false, error: "Invalid sessionId" });
            return;
          }
          const restored = await chrome.sessions.restore(request.sessionId);
          sendResponse({ success: true, restored });
        } catch (error: any) {
          console.error("[ERROR] Failed to restore session:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;
      case "switchToTab":
        if (!request.tabId || typeof request.tabId !== "number") {
          sendResponse({ success: false, error: "Invalid tab ID" });
          return;
        }
        try {
          await chrome.tabs.update(request.tabId, { active: true });
          sendResponse({ success: true });
        } catch (error: any) {
          console.error("[ERROR] Failed to switch to tab:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case "closeTab":
        if (!request.tabId || typeof request.tabId !== "number") {
          sendResponse({ success: false, error: "Invalid tab ID" });
          return;
        }
        try {
          // Verify tab exists before attempting to close
          const tab = await chrome.tabs.get(request.tabId).catch(() => null);
          if (!tab) {
            console.warn("[WARNING] Tab no longer exists:", request.tabId);
            sendResponse({ success: false, error: "Tab no longer exists" });
            return;
          }
          await chrome.tabs.remove(request.tabId);
          // Cache cleanup handled by onRemoved listener
          sendResponse({ success: true });
        } catch (error: any) {
          console.error("[ERROR] Failed to close tab:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case "toggleMute":
        if (!request.tabId || typeof request.tabId !== "number") {
          sendResponse({ success: false, error: "Invalid tab ID" });
          return;
        }
        try {
          const tab = await chrome.tabs.get(request.tabId);
          const newMutedStatus = !(tab.mutedInfo?.muted ?? false);
          await chrome.tabs.update(request.tabId, { muted: newMutedStatus });
          sendResponse({ success: true, muted: newMutedStatus });
        } catch (error: any) {
          console.error("[ERROR] Failed to toggle mute:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case "togglePlayPause":
        if (!request.tabId || typeof request.tabId !== "number") {
          sendResponse({ success: false, error: "Invalid tab ID" });
          return;
        }
        try {
          const tab = await chrome.tabs.get(request.tabId);
          if (isTabCapturable(tab)) {
            const results = await chrome.scripting.executeScript({
              target: { tabId: request.tabId },
              func: () => {
                const media = [
                  ...document.querySelectorAll("video, audio"),
                ] as HTMLMediaElement[];
                if (media.length === 0)
                  return { success: false, reason: "no_media" };

                const anyPlaying = media.some((m) => !m.paused && !m.ended);
                if (anyPlaying) {
                  media.forEach((m) => m.pause());
                  return { success: true, playing: false };
                } else {
                  media.forEach((m) => m.play().catch(() => {}));
                  return { success: true, playing: true };
                }
              },
            });
            if (results && results[0]) {
              sendResponse({ success: true, ...results[0].result });
            } else {
              sendResponse({
                success: false,
                error: "Script execution failed",
              });
            }
          } else {
            sendResponse({
              success: false,
              error: "Cannot script in this tab",
            });
          }
        } catch (error: any) {
          console.error("[ERROR] Failed to toggle play/pause:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case "refreshTabList":
        try {
          await handleShowTabSwitcher();
          sendResponse({ success: true });
        } catch (error: any) {
          console.error("[ERROR] Failed to refresh tab list:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case "captureTabScreenshot":
        if (!request.tabId || typeof request.tabId !== "number") {
          sendResponse({ success: false, error: "Invalid tab ID" });
          return;
        }
        try {
          // Manual capture request - only works for active tabs
          const screenshot = await captureTabScreenshot(request.tabId, null);
          sendResponse({
            success: !!screenshot,
            screenshot: screenshot,
          });
        } catch (error: any) {
          console.error("[ERROR] Failed to capture screenshot:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case "getCacheStats":
        try {
          const stats = screenshotCache.getStats();
          sendResponse({ success: true, stats });
        } catch (error: any) {
          console.error("[ERROR] Failed to get cache stats:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case "setQualityTier":
        try {
          const tier = request.tier || PERF_CONFIG.DEFAULT_QUALITY_TIER;
          if (PERF_CONFIG.QUALITY_TIERS[tier]) {
            currentQualityTier = tier;
            // Store setting
            chrome.storage.local.set({ qualityTier: tier });
            console.log(`[SETTINGS] Quality tier changed to: ${tier}`);
            sendResponse({ success: true, tier });
          } else {
            sendResponse({ success: false, error: "Invalid quality tier" });
          }
        } catch (error: any) {
          console.error("[ERROR] Failed to set quality tier:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      // Note: History navigation (GET_TAB_HISTORY, REPORT_NAVIGATION, NAVIGATE_HISTORY)
      // is now handled directly in the content script using the Navigation API

      case "createGroup":
        try {
          if (request.tabId && chrome.tabs.group) {
            const groupId = await chrome.tabs.group({ tabIds: request.tabId });
            sendResponse({ success: true, groupId });
          } else {
            sendResponse({
              success: false,
              error: "Missing tabId or API not supported",
            });
          }
        } catch (error: any) {
          console.error("[GROUPS] Failed to create group:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      default:
        console.warn("[WARNING] Unknown action:", request.action);
        sendResponse({ success: false, error: "Unknown action" });
    }
  } catch (error: any) {
    console.error(`[ERROR] Message handler failed:`, error);
    sendResponse({ success: false, error: error.message });
  }
}

// ============================================================================
// PERIODIC MAINTENANCE
// ============================================================================

// Log performance stats periodically
if (PERF_CONFIG.PERFORMANCE_LOGGING) {
  setInterval(() => {
    perfMetrics.logStats();
  }, 60000); // Every minute
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize existing tabs on startup
async function initializeExistingTabs() {
  try {
    // First restore recent order from storage
    await restoreRecentOrder();

    const tabs = await chrome.tabs.query({});
    const now = Date.now();

    // Initialize open order for all existing tabs
    tabs.forEach((tab, index) => {
      if (tab.id && !tabOpenOrder.has(tab.id)) {
        // Assign timestamps based on tab index to preserve relative order
        tabOpenOrder.set(tab.id, now - (tabs.length - index) * 1000);
      }
    });

    // Find and capture the active tab in each window
    const windows = await chrome.windows.getAll();
    for (const win of windows) {
      const [activeTab] = await chrome.tabs.query({
        windowId: win.id,
        active: true,
      });
      if (activeTab && activeTab.id) {
        // Only update if not already in recent order (to preserve restored order)
        if (recentTabOrder.indexOf(activeTab.id) === -1) {
          updateRecentTabOrder(activeTab.id);
        }
        previousActiveTabId = activeTab.id;
        // Capture active tab screenshot after a delay
        setTimeout(() => {
          if (activeTab.id) queueCapture(activeTab.id, true);
        }, 500);
      }
    }

    console.log(
      `[INIT] Initialized ${tabs.length} existing tabs, ${recentTabOrder.length} in recent order`
    );
  } catch (error: any) {
    console.error("[INIT] Failed to initialize existing tabs:", error);
  }
}

// Cache is now persistent, so we don't clear it on load.
// Stale entries will be evicted by LRU policy naturally.
console.log("[INIT] Visual Tab Switcher initialized");

// Load quality tier setting from storage (defensive to avoid TypeError)
chrome.storage.local.get(["qualityTier"], (result) => {
  try {
    const stored = (result && result.qualityTier) as string;
    const tiers: Record<string, any> = PERF_CONFIG && PERF_CONFIG.QUALITY_TIERS;
    if (stored && tiers && tiers[stored]) {
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
});

// Initialize existing tabs after a short delay to let the service worker settle
setTimeout(initializeExistingTabs, 100);

console.log("═══════════════════════════════════════════════════════");
console.log("Visual Tab Switcher - Performance Optimized");
console.log("═══════════════════════════════════════════════════════");
console.log(
  `Cache: Max ${PERF_CONFIG.MAX_CACHED_TABS} tabs, ${(
    PERF_CONFIG.MAX_CACHE_BYTES /
    1024 /
    1024
  ).toFixed(2)}MB`
);
console.log(
  `Screenshots: Quality tiers - HIGH: 60%/200KB, NORMAL: 50%/150KB, PERF: 35%/100KB`
);
console.log(`Rate Limit: ${PERF_CONFIG.MAX_CAPTURES_PER_SECOND} captures/sec`);
console.log(`Target: <100ms overlay open, <50MB memory, 60fps`);
console.log("═══════════════════════════════════════════════════════");
