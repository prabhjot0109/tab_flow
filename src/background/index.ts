// ============================================================================
// Background Service Worker for Visual Tab Flow
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

// Track the popup window ID to avoid duplicates
let FlowPopupWindowId: number | null = null;

// ============================================================================
// POPUP WINDOW FALLBACK (for protected pages)
// ============================================================================

async function openFlowPopup(
  tabsData: any[],
  groupsData: any[],
  activeTabId: number
): Promise<void> {
  try {
    // Check if popup already exists and is still open
    if (FlowPopupWindowId !== null) {
      try {
        const existingWindow = await chrome.windows.get(FlowPopupWindowId);
        if (existingWindow) {
          // Focus the existing popup
          await chrome.windows.update(FlowPopupWindowId, { focused: true });

          // If the popup is already open, treat repeated command as cycle-next
          // (matches the overlay behavior where repeated Alt+Q advances selection).
          try {
            chrome.runtime.sendMessage({ action: "FlowPopupCycleNext" });
          } catch {
            // Ignore messaging errors
          }
          return;
        }
      } catch {
        // Window no longer exists, proceed to create new one
        FlowPopupWindowId = null;
      }
    }

    // Store tab data in session storage for the popup to retrieve
    await chrome.storage.session.set({
      FlowTabData: {
        tabs: tabsData,
        groups: groupsData,
        activeTabId: activeTabId,
      },
    });

    // Get the current window to position the popup
    const currentWindow = await chrome.windows.getCurrent();
    const popupWidth = 780;
    const popupHeight = 550;

    // Calculate center position
    const left =
      currentWindow.left !== undefined
        ? Math.round(
            currentWindow.left + (currentWindow.width! - popupWidth) / 2
          )
        : 100;
    const top =
      currentWindow.top !== undefined
        ? Math.round(
            currentWindow.top + (currentWindow.height! - popupHeight) / 2
          )
        : 100;

    // Create popup window
    const popupWindow = await chrome.windows.create({
      url: chrome.runtime.getURL("src/flow/index.html"),
      type: "popup",
      width: popupWidth,
      height: popupHeight,
      left: left,
      top: top,
      focused: true,
    });

    if (popupWindow?.id) {
      FlowPopupWindowId = popupWindow.id;

      // Listen for window close to reset the ID
      const handleWindowRemoved = (windowId: number) => {
        if (windowId === FlowPopupWindowId) {
          FlowPopupWindowId = null;
          chrome.windows.onRemoved.removeListener(handleWindowRemoved);
        }
      };
      chrome.windows.onRemoved.addListener(handleWindowRemoved);
    }

    console.log("[POPUP] Flow popup window created");
  } catch (error) {
    console.error("[POPUP] Failed to create Flow popup:", error);
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

async function initialize(): Promise<void> {
  console.log("═══════════════════════════════════════════════════════");
  console.log("Visual Tab Flow - Performance Optimized (Modular)");
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
    if (command === "show-tab-flow" || command === "cycle-next-tab") {
      handleShowTabFlow();
    }
  });
}

// Handle showing the Tab Flow - OPTIMIZED FOR <100ms
async function handleShowTabFlow(): Promise<void> {
  // Ensure cache and recent order are restored
  if (screenshotCache.ready) await screenshotCache.ready;
  if (!tabTracker.isRecentOrderRestored()) {
    await tabTracker.restoreRecentOrder();
  }

  const startTime = performance.now();

  try {
    // If the protected-page fallback popup is currently focused, the command
    // should cycle selection inside that popup (matching the in-page overlay
    // behavior) instead of attempting to inject into the popup tab.
    try {
      const currentWindow = await chrome.windows.getCurrent();
      const [currentActiveTab] = await chrome.tabs.query({
        active: true,
        windowId: currentWindow.id,
      });

      const FlowUrl = chrome.runtime.getURL("src/flow/index.html");
      if (currentWindow?.type === "popup" && currentActiveTab?.url === FlowUrl) {
        chrome.runtime.sendMessage({ action: "FlowPopupCycleNext" });
        return;
      }
    } catch {
      // Ignore detection errors and proceed with normal flow
    }

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
      console.log(
        "[INJECT] Protected page detected, opening popup window fallback..."
      );
      // Open popup window for protected pages
      await openFlowPopup(tabsData, groupsData, activeTab.id);
      return;
    }

    // Send to content script
    await sendMessageWithRetry(activeTab.id, {
      action: "showTabFlow",
      tabs: tabsData,
      groups: groupsData,
      activeTabId: activeTab.id,
    });

    // Record performance
    const duration = performance.now() - startTime;
    perfMetrics.recordOverlayOpen(duration);
  } catch (error) {
    console.error("[ERROR] Failed to show Tab Flow:", error);
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
      handleShowTabFlow
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




