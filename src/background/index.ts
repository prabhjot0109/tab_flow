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

const DEBUG_LOGGING = false;
const log = (...args: unknown[]) => {
  if (DEBUG_LOGGING) {
    console.log(...args);
  }
};

// ============================================================================
// GLOBAL STATE
// ============================================================================

const screenshotCache = new LRUCache(
  PERF_CONFIG.MAX_CACHED_TABS,
  PERF_CONFIG.MAX_CACHE_BYTES,
);

// Track the popup window ID to avoid duplicates
let FlowPopupWindowId: number | null = null;

// ============================================================================
// POPUP WINDOW FALLBACK (for protected pages)
// ============================================================================

async function openFlowPopup(
  tabsData: any[],
  groupsData: any[],
  activeTabId: number,
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
          log("[POPUP] Sending FlowPopupCycleNext message");
          try {
            // Send message to all extension contexts (popup will receive it)
            chrome.runtime.sendMessage({ action: "FlowPopupCycleNext" });
          } catch (err) {
            log("[POPUP] Message send error:", err);
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
    const popupWidth = 750;
    const popupHeight = 560;

    // Calculate center position
    const left =
      currentWindow.left !== undefined
        ? Math.round(
            currentWindow.left + (currentWindow.width! - popupWidth) / 2,
          )
        : 100;
    const top =
      currentWindow.top !== undefined
        ? Math.round(
            currentWindow.top + (currentWindow.height! - popupHeight) / 2,
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

    log("[POPUP] Flow popup window created");
  } catch (error) {
    console.error("[POPUP] Failed to create Flow popup:", error);
  }
}

// Track the quick switch popup window ID to avoid duplicates
let QuickSwitchPopupWindowId: number | null = null;

async function openQuickSwitchPopup(
  tabsData: any[],
  activeTabId: number,
): Promise<void> {
  try {
    // Check if popup already exists and is still open
    if (QuickSwitchPopupWindowId !== null) {
      try {
        const existingWindow = await chrome.windows.get(
          QuickSwitchPopupWindowId,
        );
        if (existingWindow) {
          // Focus the existing popup
          await chrome.windows.update(QuickSwitchPopupWindowId, {
            focused: true,
          });

          // If the popup is already open, treat repeated command as cycle-next
          log("[QUICK SWITCH] Sending QuickSwitchPopupCycleNext message");
          try {
            chrome.runtime.sendMessage({ action: "QuickSwitchPopupCycleNext" });
          } catch (err) {
            log("[QUICK SWITCH] Message send error:", err);
          }
          return;
        }
      } catch {
        // Window no longer exists, proceed to create new one
        QuickSwitchPopupWindowId = null;
      }
    }

    // Store tab data in session storage for the popup to retrieve
    await chrome.storage.session.set({
      QuickSwitchTabData: {
        tabs: tabsData,
        activeTabId: activeTabId,
      },
    });

    // Get the current window to position the popup
    const currentWindow = await chrome.windows.getCurrent();
    const popupWidth = 750;
    const popupHeight = 560;

    // Calculate center position
    const left =
      currentWindow.left !== undefined
        ? Math.round(
            currentWindow.left + (currentWindow.width! - popupWidth) / 2,
          )
        : 100;
    const top =
      currentWindow.top !== undefined
        ? Math.round(
            currentWindow.top + (currentWindow.height! - popupHeight) / 2,
          )
        : 100;

    // Create popup window with quick switch page
    const popupWindow = await chrome.windows.create({
      url: chrome.runtime.getURL("src/quick-switch/index.html"),
      type: "popup",
      width: popupWidth,
      height: popupHeight,
      left: left,
      top: top,
      focused: true,
    });

    if (popupWindow?.id) {
      QuickSwitchPopupWindowId = popupWindow.id;

      // Listen for window close to reset the ID
      const handleWindowRemoved = (windowId: number) => {
        if (windowId === QuickSwitchPopupWindowId) {
          QuickSwitchPopupWindowId = null;
          chrome.windows.onRemoved.removeListener(handleWindowRemoved);
        }
      };
      chrome.windows.onRemoved.addListener(handleWindowRemoved);
    }

    log("[POPUP] Quick Switch popup window created");
  } catch (error) {
    console.error("[POPUP] Failed to create Quick Switch popup:", error);
  }
}

async function tryCycleOpenQuickSwitchOverlay(tabId: number): Promise<boolean> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      action: "quickSwitchCycleIfOpen",
    });
    return !!response?.advanced;
  } catch {
    return false;
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

async function initialize(): Promise<void> {
  log("═══════════════════════════════════════════════════════");
  log("Visual Tab Flow - Performance Optimized (Modular)");
  log("═══════════════════════════════════════════════════════");
  log(
    `Cache: Max ${PERF_CONFIG.MAX_CACHED_TABS} tabs, ${(
      PERF_CONFIG.MAX_CACHE_BYTES /
      1024 /
      1024
    ).toFixed(2)}MB`,
  );
  log(`Rate Limit: ${PERF_CONFIG.MAX_CAPTURES_PER_SECOND} captures/sec`);
  log(`Target: <100ms overlay open, <50MB memory, 60fps`);
  log("═══════════════════════════════════════════════════════");

  await loadCacheSettings();

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

  log("[ALARMS] Periodic alarms set up successfully");
}

async function loadCacheSettings(): Promise<void> {
  try {
    const result = await chrome.storage.local.get([
      "cacheMaxTabs",
      "cacheMaxMB",
    ]);

    const maxTabs =
      typeof result.cacheMaxTabs === "number"
        ? result.cacheMaxTabs
        : PERF_CONFIG.MAX_CACHED_TABS;

    const maxMB =
      typeof result.cacheMaxMB === "number"
        ? result.cacheMaxMB
        : PERF_CONFIG.MAX_CACHE_BYTES / 1024 / 1024;

    await screenshotCache.ready;
    screenshotCache.resize(maxTabs, Math.round(maxMB * 1024 * 1024));
    log(`[CACHE] Limits set to ${maxTabs} tabs, ${Math.round(maxMB)}MB total`);
  } catch (error) {
    console.warn("[CACHE] Failed to load cache settings:", error);
  }
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
        `[IDLE] Tab ${previousActiveTabId} idle > 5m, refreshing screenshot`,
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
    },
  );

  // Listen for tab updates
  chrome.tabs.onUpdated.addListener(
    (
      tabId: number,
      changeInfo: chrome.tabs.OnUpdatedInfo,
      tab: chrome.tabs.Tab,
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
    },
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
    } else if (command === "quick-switch") {
      handleQuickSwitch();
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
      if (
        currentWindow?.type === "popup" &&
        currentActiveTab?.url === FlowUrl
      ) {
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
        typeof tab.id === "number",
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
    // Increased limit for better preview coverage with 100+ tabs
    const RECENT_PREVIEW_LIMIT = 20;

    const tabsData = sortedTabs.map((tab, index) => {
      let screenshotData = null;
      const isRecent = index < RECENT_PREVIEW_LIMIT;

      if (screenshot.isTabCapturable(tab) && isRecent) {
        const cached = screenshotCache.getIfFresh(
          tab.id,
          PERF_CONFIG.SCREENSHOT_CACHE_DURATION,
        );
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
        "[INJECT] Protected page detected, opening popup window fallback...",
      );
      // Open popup window for protected pages
      await openFlowPopup(tabsData, groupsData, activeTab.id);
      return;
    }

    let delivered = false;
    try {
      delivered = await sendMessageWithRetry(activeTab.id, {
        action: "showTabFlow",
        tabs: tabsData,
        groups: groupsData,
        activeTabId: activeTab.id,
      });
    } catch (error) {
      console.error("[ERROR] Failed to send Tab Flow message:", error);
    }

    if (!delivered) {
      console.warn(
        "[INJECT] Content script unavailable. Overlay could not be shown.",
      );
      return;
    }

    const duration = performance.now() - startTime;
    perfMetrics.recordOverlayOpen(duration);
  } catch (error) {
    console.error("[ERROR] Failed to show Tab Flow:", error);
  }
}

// Handle Quick Switch (Alt+Q) - Alt+Tab style switching without search
async function handleQuickSwitch(): Promise<void> {
  // FAST PATH: If Quick Switch popup already exists, cycle selection and return
  if (QuickSwitchPopupWindowId !== null) {
    try {
      const existingWindow = await chrome.windows.get(QuickSwitchPopupWindowId);
      if (existingWindow) {
        // Focus the existing popup
        await chrome.windows.update(QuickSwitchPopupWindowId, {
          focused: true,
        });
        // Cycle to next tab
        console.log("[QUICK SWITCH] Popup exists, sending cycle message");
        try {
          chrome.runtime.sendMessage({ action: "QuickSwitchPopupCycleNext" });
        } catch (err) {
          console.log("[QUICK SWITCH] Message send error:", err);
        }
        return;
      }
    } catch {
      // Window no longer exists, clear the ID and continue
      QuickSwitchPopupWindowId = null;
    }
  }

  // FAST PATH: If currently focused on quick switch popup, cycle and return.
  try {
    const currentWindow = await chrome.windows.getCurrent();
    const QuickSwitchUrl = chrome.runtime.getURL("src/quick-switch/index.html");
    const [currentActiveTab] = await chrome.tabs.query({
      active: true,
      windowId: currentWindow.id,
    });

    if (
      currentWindow?.type === "popup" &&
      currentActiveTab?.url?.startsWith(QuickSwitchUrl.split("?")[0])
    ) {
      // We're in the quick switch popup, just cycle
      console.log("[QUICK SWITCH] Inside popup, sending cycle message");
      chrome.runtime.sendMessage({ action: "QuickSwitchPopupCycleNext" });
      return;
    }
  } catch {
    // Ignore detection errors and proceed with normal flow
  }

  try {
    const currentWindow = await chrome.windows.getCurrent();

    // Resolve active tab first for cheap cycle checks.
    const [activeTab] = await chrome.tabs.query({
      active: true,
      windowId: currentWindow.id,
    });

    if (!activeTab || typeof activeTab.id !== "number") {
      console.warn("[QUICK SWITCH] No active tab found");
      return;
    }

    // FAST PATH: If quick switch overlay is already open in page, cycle without
    // rebuilding tab data.
    if (screenshot.isTabCapturable(activeTab)) {
      const cycled = await tryCycleOpenQuickSwitchOverlay(activeTab.id);
      if (cycled) {
        return;
      }
    }

    // Restore recent order asynchronously. Quick switch can open immediately
    // with Chrome's lastAccessed sorting while restoration catches up.
    if (!tabTracker.isRecentOrderRestored()) {
      tabTracker.restoreRecentOrder().catch((error) => {
        console.debug(
          "[QUICK SWITCH] Failed to restore recent order in background:",
          error,
        );
      });
    }

    const tabs = await chrome.tabs.query({ windowId: currentWindow.id });

    const tabsWithIds = tabs.filter(
      (tab): tab is chrome.tabs.Tab & { id: number } =>
        typeof tab.id === "number",
    );

    // Sort by recent access order
    const sortedTabs = tabTracker.sortTabsByRecent(tabsWithIds);

    // Build minimal tab data (no screenshots needed for quick switch)
    const tabsData = sortedTabs.map((tab) => ({
      id: tab.id,
      title: tab.title || "Untitled",
      url: tab.url,
      favIconUrl: tab.favIconUrl,
      pinned: tab.pinned,
      index: tab.index,
      active: tab.active,
      audible: tab.audible,
      mutedInfo: tab.mutedInfo,
      groupId: tab.groupId,
      hasMedia: mediaTracker.hasMedia(tab.id) || tab.audible,
    }));

    // For protected pages, open popup window instead
    if (!screenshot.isTabCapturable(activeTab)) {
      console.log("[QUICK SWITCH] Protected page, opening popup window");
      await openQuickSwitchPopup(tabsData, activeTab.id);
      return;
    }

    let delivered = false;
    try {
      delivered = await sendMessageWithRetry(activeTab.id, {
        action: "showQuickSwitch",
        tabs: tabsData,
        activeTabId: activeTab.id,
      });
    } catch (error) {
      console.error("[ERROR] Failed to send Quick Switch message:", error);
    }

    if (!delivered) {
      console.warn(
        "[INJECT] Content script unavailable. Overlay could not be shown.",
      );
      return;
    }

    log("[QUICK SWITCH] Quick switch overlay triggered");
  } catch (error) {
    console.error("[ERROR] Failed to show quick switch:", error);
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
      handleShowTabFlow,
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
