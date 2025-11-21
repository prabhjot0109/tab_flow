// Background service worker for Visual Tab Switcher
// ============================================================================
// PERFORMANCE-OPTIMIZED IMPLEMENTATION
// Target: <100ms overlay open, <50MB with 100 tabs, 60fps animations
// ============================================================================

// ============================================================================
// LRU CACHE IMPLEMENTATION
// ============================================================================
class LRUCache {
  constructor(maxTabs = 30, maxBytes = 20 * 1024 * 1024) {
    this.cache = new Map(); // Map for O(1) access
    this.maxTabs = maxTabs;
    this.maxBytes = maxBytes;
    this.currentBytes = 0;
    this.accessOrder = []; // Track access order for LRU
  }

  // Get item and mark as recently used
  get(key) {
    if (!this.cache.has(key)) return null;

    // Move to front of access order (most recent)
    this.accessOrder = this.accessOrder.filter((k) => k !== key);
    this.accessOrder.unshift(key);

    return this.cache.get(key);
  }

  // Set item with automatic eviction
  set(key, value) {
    const size = this._estimateSize(value);

    // Remove existing entry if updating
    if (this.cache.has(key)) {
      const oldSize = this.cache.get(key).size;
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
    this.cache.set(key, { data: value, size, timestamp: Date.now() });
    this.currentBytes += size;

    // Update access order
    this.accessOrder = this.accessOrder.filter((k) => k !== key);
    this.accessOrder.unshift(key);
  }

  // Remove specific entry
  delete(key) {
    if (!this.cache.has(key)) return false;

    const entry = this.cache.get(key);
    this.currentBytes -= entry.size;
    this.cache.delete(key);
    this.accessOrder = this.accessOrder.filter((k) => k !== key);

    return true;
  }

  // Evict least recently used entry
  _evictLRU() {
    if (this.accessOrder.length === 0) return;

    const lruKey = this.accessOrder.pop(); // Remove from end (least recent)
    const entry = this.cache.get(lruKey);

    if (entry) {
      this.currentBytes -= entry.size;
      this.cache.delete(lruKey);
      console.debug(
        `[LRU] Evicted tab ${lruKey} (${(entry.size / 1024).toFixed(1)}KB)`
      );
    }
  }

  // Estimate size of base64 screenshot
  _estimateSize(data) {
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
    HIGH: { quality: 60, maxSize: 200 * 1024, label: "High Quality" },
    NORMAL: { quality: 50, maxSize: 150 * 1024, label: "Normal" },
    PERFORMANCE: { quality: 35, maxSize: 100 * 1024, label: "Performance" },
  },
  DEFAULT_QUALITY_TIER: "NORMAL", // Default quality tier
};

// ============================================================================
// GLOBAL STATE
// ============================================================================
const screenshotCache = new LRUCache(
  PERF_CONFIG.MAX_CACHED_TABS,
  PERF_CONFIG.MAX_CACHE_BYTES
);
const recentTabOrder = []; // Track tab access order
const captureQueue = []; // Queue for rate-limited captures
let lastCaptureTime = 0; // Timestamp of last capture
let isProcessingQueue = false; // Queue processing flag
let previousActiveTabId = null; // Track previous active tab for better screenshot capture
let currentQualityTier = PERF_CONFIG.DEFAULT_QUALITY_TIER; // Current quality setting

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================
const perfMetrics = {
  overlayOpenTimes: [],
  captureCount: 0,
  cacheHits: 0,
  cacheMisses: 0,

  recordOverlayOpen(duration) {
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
function queueCapture(tabId, priority = false) {
  // Check if already in queue
  if (captureQueue.some((item) => item.tabId === tabId)) {
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
    await captureTabScreenshot(item.tabId);
    lastCaptureTime = Date.now();
  }

  isProcessingQueue = false;
}

// Capture screenshot with error handling and compression
// "requireActive" allows callers (like the onActivated handler) to skip
// captures for background tabs, while the tab switcher can still request
// a best-effort thumbnail for already-open tabs.
async function captureTabScreenshot(
  tabId,
  forceQuality = null,
  requireActive = true
) {
  try {
    const tab = await chrome.tabs.get(tabId);

    // Normally we only want to capture active tabs, because
    // captureVisibleTab always captures the visible tab for the window.
    // For best-effort previews of already-open tabs we allow callers
    // to opt out of this strict check.
    if (requireActive && !tab.active) {
      console.debug(`[CAPTURE] Tab ${tabId} is not active, skipping capture`);
      return null;
    }

    // Check if tab is capturable
    if (!isTabCapturable(tab)) {
      console.debug(`[CAPTURE] Tab ${tabId} not capturable: ${tab.url}`);
      return null;
    }

    // Small delay for rendering
    await new Promise((resolve) =>
      setTimeout(resolve, PERF_CONFIG.CAPTURE_DELAY)
    );

    // Get quality settings from current tier or forced override
    const qualityTier = forceQuality || currentQualityTier;
    const qualitySettings =
      PERF_CONFIG.QUALITY_TIERS[qualityTier] ||
      PERF_CONFIG.QUALITY_TIERS.NORMAL;

    // Capture screenshot (this captures the currently visible/active tab)
    const startTime = performance.now();

    // Try WebP format first (better compression), fallback to JPEG
    let screenshot = null;
    let format = "jpeg";

    try {
      // WebP support check and capture
      screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: "png", // Capture as PNG first for WebP conversion
      });

      // Convert to WebP if possible (browser support)
      if (screenshot && typeof screenshot === "string") {
        format = "png"; // Keep as PNG for now (WebP conversion needs canvas in content script)
      }
    } catch (webpError) {
      // Fallback to JPEG with quality tier
      screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: "jpeg",
        quality: qualitySettings.quality,
      });
      format = "jpeg";
    }

    const captureTime = performance.now() - startTime;

    // Check size and compress if needed
    const size = screenshotCache._estimateSize(screenshot);
    if (size > qualitySettings.maxSize) {
      console.warn(
        `[CAPTURE] Screenshot too large: ${(size / 1024).toFixed(1)}KB (max: ${(
          qualitySettings.maxSize / 1024
        ).toFixed(1)}KB), skipping`
      );
      return null;
    }

    // Store in LRU cache with metadata
    screenshotCache.set(tabId, screenshot);
    perfMetrics.captureCount++;

    if (PERF_CONFIG.PERFORMANCE_LOGGING) {
      console.debug(
        `[CAPTURE] Tab ${tabId}: ${captureTime.toFixed(2)}ms, ${(
          size / 1024
        ).toFixed(1)}KB (${format}, ${qualitySettings.label})`
      );
    }

    return screenshot;
  } catch (error) {
    console.debug(`[CAPTURE] Failed for tab ${tabId}:`, error.message);
    return null;
  }
}

// Check if tab can be captured
function isTabCapturable(tab) {
  if (tab.discarded) return false;
  if (!tab.url) return false;

  const protectedSchemes = [
    "chrome://",
    "chrome-extension://",
    "edge://",
    "about:",
    "file://",
  ];
  return !protectedSchemes.some((scheme) => tab.url.startsWith(scheme));
}

// ============================================================================
// TAB EVENT LISTENERS
// ============================================================================

// Listen for tab activation - auto-capture screenshots
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  // IMPROVED STRATEGY: Capture the PREVIOUS tab before it loses focus
  // This ensures we get screenshots before switching away
  if (
    previousActiveTabId !== null &&
    previousActiveTabId !== activeInfo.tabId
  ) {
    try {
      const previousTab = await chrome.tabs.get(previousActiveTabId);
      // Only capture if the previous tab still exists and was in the same window
      if (previousTab && previousTab.windowId === activeInfo.windowId) {
        // Immediate capture of previous tab (it's still visible for a brief moment)
        queueCapture(previousActiveTabId, true);
      }
    } catch (error) {
      // Previous tab may have been closed, ignore
      console.debug(
        `[CAPTURE] Previous tab ${previousActiveTabId} no longer exists`
      );
    }
  }

  // Update tracking
  previousActiveTabId = activeInfo.tabId;
  updateRecentTabOrder(activeInfo.tabId);

  // Queue capture for newly activated tab (lower priority since we focus on previous tab)
  queueCapture(activeInfo.tabId, false);
});

// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  screenshotCache.delete(tabId);
  removeFromRecentOrder(tabId);
  console.debug(`[CLEANUP] Removed tab ${tabId} from cache`);
});

// Update tab order tracking
function updateRecentTabOrder(tabId) {
  removeFromRecentOrder(tabId);
  recentTabOrder.unshift(tabId);

  // Keep only necessary entries
  if (recentTabOrder.length > PERF_CONFIG.MAX_CACHED_TABS * 2) {
    recentTabOrder.length = PERF_CONFIG.MAX_CACHED_TABS * 2;
  }
}

function removeFromRecentOrder(tabId) {
  const index = recentTabOrder.indexOf(tabId);
  if (index !== -1) {
    recentTabOrder.splice(index, 1);
  }
}

// ============================================================================
// COMMAND HANDLER - SHOW TAB SWITCHER
// ============================================================================

// Listen for keyboard shortcut
chrome.commands.onCommand.addListener((command) => {
  if (command === "show-tab-switcher" || command === "cycle-next-tab") {
    handleShowTabSwitcher();
  }
});

// Handle showing the tab switcher - OPTIMIZED FOR <100ms
async function handleShowTabSwitcher() {
  const startTime = performance.now();

  try {
    // Get current window tabs (cached query when possible)
    const currentWindow = await chrome.windows.getCurrent();
    const tabs = await chrome.tabs.query({ windowId: currentWindow.id });

    // Sort by recent order
    const sortedTabs = sortTabsByRecent(tabs);

    // INSTANT RESPONSE: Build tab data with cached screenshots only
    // No waiting for captures - overlay opens immediately

    // Smart Preview Strategy:
    // Only show screenshots for the top 6 most recent tabs (including current).
    // All other tabs get favicons to keep the UI clean and performant.
    const RECENT_PREVIEW_LIMIT = 6;

    const tabsData = sortedTabs.map((tab, index) => {
      // Only use screenshot if tab is capturable and has valid cache
      let screenshot = null;

      // Check if this tab is in the top recent list
      // Since sortedTabs is already sorted by recency, we can just use the index
      const isRecent = index < RECENT_PREVIEW_LIMIT;

      if (isTabCapturable(tab) && isRecent) {
        const cached = screenshotCache.get(tab.id);
        if (cached) {
          screenshot = cached;
          perfMetrics.cacheHits++;
        } else {
          perfMetrics.cacheMisses++;
          // Don't queue captures for inactive tabs - they would capture the wrong content
          // Screenshots will be captured automatically when user activates those tabs
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
      };
    });

    // Get active tab
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    // Guard: Do not attempt to inject on protected pages (chrome://, edge://, etc.)
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
      activeTabId: activeTab.id,
    });

    // Record performance
    const duration = performance.now() - startTime;
    perfMetrics.recordOverlayOpen(duration);
  } catch (error) {
    console.error("[ERROR] Failed to show tab switcher:", error);
  }
}

// Send message with automatic script injection
async function sendMessageWithRetry(tabId, message, retries = 1) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch (err) {
    if (retries > 0 && err.message.includes("Could not establish connection")) {
      console.log("[INJECT] Content script not ready, injecting...");

      try {
        // Inject content script
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ["content.js"],
        });

        // Inject CSS
        await chrome.scripting.insertCSS({
          target: { tabId },
          files: ["overlay.css"],
        });

        // Retry after injection
        await new Promise((resolve) => setTimeout(resolve, 150));
        await chrome.tabs.sendMessage(tabId, message);
      } catch (injectErr) {
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

// Sort tabs by recent usage
function sortTabsByRecent(tabs) {
  return tabs.sort((a, b) => {
    const aIndex = recentTabOrder.indexOf(a.id);
    const bIndex = recentTabOrder.indexOf(b.id);

    // If neither in recent order, sort by tab index
    if (aIndex === -1 && bIndex === -1) return a.index - b.index;

    // If only one in recent order, prioritize it
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;

    // Both in recent order, sort by recent order
    return aIndex - bIndex;
  });
}

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle async operations properly
  handleMessage(request, sender, sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(request, sender, sendResponse) {
  try {
    if (!request || !request.action) {
      console.error("[ERROR] Invalid message received:", request);
      sendResponse({ success: false, error: "Invalid message format" });
      return;
    }

    switch (request.action) {
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
        } catch (error) {
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
        } catch (error) {
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
        } catch (error) {
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
        } catch (error) {
          console.error("[ERROR] Failed to close tab:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case "refreshTabList":
        try {
          await handleShowTabSwitcher();
          sendResponse({ success: true });
        } catch (error) {
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
          // Manual capture request from UI: we do a best-effort capture
          // for already-open tabs, so do not require the tab to be active
          const screenshot = await captureTabScreenshot(
            request.tabId,
            null,
            false
          );
          sendResponse({
            success: !!screenshot,
            screenshot: screenshot,
          });
        } catch (error) {
          console.error("[ERROR] Failed to capture screenshot:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case "getCacheStats":
        try {
          const stats = screenshotCache.getStats();
          sendResponse({ success: true, stats });
        } catch (error) {
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
        } catch (error) {
          console.error("[ERROR] Failed to set quality tier:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      default:
        console.warn("[WARNING] Unknown action:", request.action);
        sendResponse({ success: false, error: "Unknown action" });
    }
  } catch (error) {
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

// Clear cache on extension load to prevent stale screenshots
screenshotCache.clear();
console.log("[INIT] Screenshot cache cleared");

// Load quality tier setting from storage (defensive to avoid TypeError)
chrome.storage.local.get(["qualityTier"], (result) => {
  try {
    const stored = result && result.qualityTier;
    const tiers = PERF_CONFIG && PERF_CONFIG.QUALITY_TIERS;
    if (stored && tiers && tiers[stored]) {
      currentQualityTier = stored;
      console.log(`[INIT] Loaded quality tier: ${currentQualityTier}`);
    } else {
      console.log("[INIT] Using default quality tier:", currentQualityTier);
    }
  } catch (e) {
    console.warn(
      "[INIT] Failed to load quality tier, using default:",
      e && e.message ? e.message : e
    );
  }
});

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
