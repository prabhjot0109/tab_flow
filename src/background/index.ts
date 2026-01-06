// ============================================================================
// Background Service Worker for Visual Tab Switcher
// ============================================================================
// PERFORMANCE-OPTIMIZED IMPLEMENTATION (MODULAR)
// Target: <100ms overlay open, <50MB with 100 tabs, 60fps animations
// ============================================================================

import { PERF_CONFIG } from "./config";
import { LRUCache } from "./cache/lru-cache";
import { perfMetrics } from "./utils/performance";
import * as mediaTracker from "./services/media-tracker";
import * as tabTracker from "./services/tab-tracker";
import * as screenshot from "./services/screenshot";
import { handleMessage, sendMessageWithRetry } from "./handlers/messages";

// ============================================================================
// GLOBAL STATE
// ============================================================================

const screenshotCache = new LRUCache(
  PERF_CONFIG.MAX_CACHED_TABS,
  PERF_CONFIG.MAX_CACHE_BYTES
);

// ============================================================================
// INITIALIZATION
// ============================================================================

async function initialize(): Promise<void> {
  console.log("═══════════════════════════════════════════════════════");
  console.log("Visual Tab Switcher - Performance Optimized (Modular)");
  console.log("═══════════════════════════════════════════════════════");
  console.log(
    `Cache: Max ${PERF_CONFIG.MAX_CACHED_TABS} tabs, ${(
      PERF_CONFIG.MAX_CACHE_BYTES /
      1024 /
      1024
    ).toFixed(2)}MB`
  );
  console.log(
    `Rate Limit: ${PERF_CONFIG.MAX_CAPTURES_PER_SECOND} captures/sec`
  );
  console.log(`Target: <100ms overlay open, <50MB memory, 60fps`);
  console.log("═══════════════════════════════════════════════════════");

  // Load persisted data
  await mediaTracker.loadTabsWithMedia();
  await screenshot.loadQualityTierFromStorage();

  // Initialize tabs after a short delay
  setTimeout(async () => {
    await tabTracker.initializeExistingTabs();
    await mediaTracker.initializeAudibleTabs();

    // Queue capture for active tab
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (activeTab?.id) {
      screenshot.queueCapture(activeTab.id, screenshotCache, true);
    }
  }, 100);

  // Set up alarms for periodic tasks (replaces setInterval)
  await setupAlarms();
}

// ============================================================================
// CHROME ALARMS (Replaces setInterval for service worker reliability)
// ============================================================================

async function setupAlarms(): Promise<void> {
  // Clear any existing alarms first
  await chrome.alarms.clearAll();

  // Idle check alarm - every 1 minute
  chrome.alarms.create(PERF_CONFIG.ALARMS.IDLE_CHECK, {
    delayInMinutes: 1,
    periodInMinutes: 1,
  });

  // Performance logging alarm - every 1 minute (if enabled)
  if (PERF_CONFIG.PERFORMANCE_LOGGING) {
    chrome.alarms.create(PERF_CONFIG.ALARMS.PERF_LOG, {
      delayInMinutes: 1,
      periodInMinutes: 1,
    });
  }

  console.log("[ALARMS] Periodic alarms set up successfully");
}

// Alarm listener
chrome.alarms.onAlarm.addListener(async (alarm) => {
  switch (alarm.name) {
    case PERF_CONFIG.ALARMS.IDLE_CHECK:
      await handleIdleCheck();
      break;
    case PERF_CONFIG.ALARMS.PERF_LOG:
      perfMetrics.logStats(screenshotCache);
      break;
  }
});

// Idle check: Re-capture tabs if user stays on them > 5 minutes
async function handleIdleCheck(): Promise<void> {
  try {
    const previousActiveTabId = tabTracker.getPreviousActiveTabId();
    if (!previousActiveTabId) return;

    const idleThreshold = 5 * 60 * 1000; // 5 minutes
    const startTime = tabTracker.getActiveTabStartTime();

    if (Date.now() - startTime > idleThreshold) {
      console.debug(
        `[IDLE] Tab ${previousActiveTabId} idle > 5m, refreshing screenshot`
      );
      tabTracker.resetActiveTabStartTime();
      screenshot.queueCapture(previousActiveTabId, screenshotCache, true);
    }
  } catch (error) {
    console.debug("[IDLE] Error in idle check:", error);
  }
}

// ============================================================================
// TAB EVENT LISTENERS
// ============================================================================

let tabSwitchCaptureTimeout: ReturnType<typeof setTimeout> | null = null;

if (typeof chrome !== "undefined" && chrome.tabs) {
  // Listen for tab activation
  chrome.tabs.onActivated.addListener(
    async (activeInfo: chrome.tabs.OnActivatedInfo) => {
      try {
        tabTracker.setPreviousActiveTabId(activeInfo.tabId);
        tabTracker.resetActiveTabStartTime();
        tabTracker.updateRecentTabOrder(activeInfo.tabId);

        // Cancel previous capture if user switched away quickly (debounce)
        if (tabSwitchCaptureTimeout) {
          clearTimeout(tabSwitchCaptureTimeout);
        }

        // Capture after a "settle" delay (500ms)
        // This prevents capturing tabs that are merely stepped over
        tabSwitchCaptureTimeout = setTimeout(() => {
          screenshot.queueCapture(activeInfo.tabId, screenshotCache, true);
          tabSwitchCaptureTimeout = null;
        }, 500);
      } catch (e) {
        console.debug("[TAB] Error in onActivated:", e);
      }
    }
  );

  // Listen for tab updates
  chrome.tabs.onUpdated.addListener(
    (
      tabId: number,
      changeInfo: chrome.tabs.OnUpdatedInfo,
      tab: chrome.tabs.Tab
    ) => {
      try {
        // Track audible state changes
        if (changeInfo.audible !== undefined && changeInfo.audible) {
          mediaTracker.addMediaTab(tabId);
        }

        // Capture when page finishes loading and tab is active
        if (changeInfo.status === "complete" && tab.active) {
          setTimeout(() => {
            screenshot.queueCapture(tabId, screenshotCache, true);
          }, 300);
        }
      } catch (e) {
        console.debug("[TAB] Error in onUpdated:", e);
      }
    }
  );

  // Track when tabs are created
  chrome.tabs.onCreated.addListener((tab: chrome.tabs.Tab) => {
    try {
      if (tab.id) tabTracker.setTabOpenTime(tab.id);
    } catch (e) {
      console.debug("[TAB] Error in onCreated:", e);
    }
  });

  // Clean up when tabs are closed
  chrome.tabs.onRemoved.addListener((tabId: number) => {
    try {
      screenshotCache.delete(tabId);
      tabTracker.removeFromRecentOrder(tabId);
      tabTracker.removeTabOpenOrder(tabId);
      screenshot.removePendingCapture(tabId);
      mediaTracker.removeMediaTab(tabId);
      console.debug(`[CLEANUP] Removed tab ${tabId} from cache`);
    } catch (e) {
      console.debug("[TAB] Error in onRemoved:", e);
    }
  });
} else {
  console.error("[INIT] chrome.tabs API not available");
}

// ============================================================================
// COMMAND HANDLER
// ============================================================================

if (typeof chrome !== "undefined" && chrome.commands) {
  chrome.commands.onCommand.addListener((command) => {
    if (command === "show-tab-switcher" || command === "cycle-next-tab") {
      handleShowTabSwitcher();
    }
  });
}

// Handle showing the tab switcher - OPTIMIZED FOR <100ms
async function handleShowTabSwitcher(): Promise<void> {
  // Ensure cache and recent order are restored
  if (screenshotCache.ready) await screenshotCache.ready;
  if (!tabTracker.isRecentOrderRestored()) {
    await tabTracker.restoreRecentOrder();
  }

  const startTime = performance.now();

  try {
    const currentWindow = await chrome.windows.getCurrent();
    const tabs = await chrome.tabs.query({ windowId: currentWindow.id });

    const tabsWithIds = tabs.filter(
      (tab): tab is chrome.tabs.Tab & { id: number } =>
        typeof tab.id === "number"
    );

    // Fetch tab groups
    let groups: chrome.tabGroups.TabGroup[] = [];
    if (chrome.tabGroups) {
      try {
        groups = await chrome.tabGroups.query({ windowId: currentWindow.id });
      } catch (e) {
        console.debug("[GROUPS] Failed to fetch groups:", e);
      }
    }

    // Initialize open order for new tabs
    const now = Date.now();
    tabsWithIds.forEach((tab, index) => {
      if (!tabTracker.getTabOpenTime(tab.id)) {
        tabTracker.setTabOpenTime(tab.id, now - (tabs.length - index) * 1000);
      }
    });

    // Sort by recent access order
    const sortedTabs = tabTracker.sortTabsByRecent(tabsWithIds);

    // Build tab data with cached screenshots
    const RECENT_PREVIEW_LIMIT = 8;

    const tabsData = sortedTabs.map((tab, index) => {
      let screenshotData = null;
      const isRecent = index < RECENT_PREVIEW_LIMIT;

      if (screenshot.isTabCapturable(tab) && isRecent) {
        const cached = screenshotCache.get(tab.id);
        if (cached) {
          screenshotData = cached;
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
        screenshot: screenshotData ? screenshotData.data : null,
        pinned: tab.pinned,
        index: tab.index,
        active: tab.active,
        audible: tab.audible,
        mutedInfo: tab.mutedInfo,
        groupId: tab.groupId,
        hasMedia: mediaTracker.hasMedia(tab.id) || tab.audible,
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

    if (!screenshot.isTabCapturable(activeTab)) {
      console.warn(
        "[INJECT] Cannot open overlay on protected page. Switch to a regular webpage and try again."
      );
      return;
    }

    // Send to content script
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

// ============================================================================
// MESSAGE LISTENER
// ============================================================================

if (
  typeof chrome !== "undefined" &&
  chrome.runtime &&
  chrome.runtime.onMessage
) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    handleMessage(
      request,
      sender,
      sendResponse,
      screenshotCache,
      handleShowTabSwitcher
    );
    return true; // Keep channel open for async response
  });
}

// ============================================================================
// START INITIALIZATION
// ============================================================================

initialize().catch((error) => {
  console.error("[INIT] Failed to initialize:", error);
});
