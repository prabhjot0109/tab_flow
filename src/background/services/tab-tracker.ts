// ============================================================================
// TAB TRACKER SERVICE
// Manages tab order tracking (recent access order, open order)
// ============================================================================

import { PERF_CONFIG } from "../config";

// Track tab access order (most recent first) - will be restored from storage
let recentTabOrder: number[] = [];

// Track when tabs were opened (tabId -> timestamp)
const tabOpenOrder = new Map<number, number>();

// Track previous active tab for better screenshot capture
let previousActiveTabId: number | null = null;

// Track when the active tab was switched to (for idle detection)
let activeTabStartTime = Date.now();

// Flag to track if recent order has been restored
let recentOrderRestored = false;

// Debounced save timer
let saveRecentOrderTimer: ReturnType<typeof setTimeout> | null = null;

// ============================================================================
// GETTERS
// ============================================================================

export function getRecentTabOrder(): number[] {
  return recentTabOrder;
}

export function getTabOpenTime(tabId: number): number | undefined {
  return tabOpenOrder.get(tabId);
}

export function getPreviousActiveTabId(): number | null {
  return previousActiveTabId;
}

export function getActiveTabStartTime(): number {
  return activeTabStartTime;
}

export function isRecentOrderRestored(): boolean {
  return recentOrderRestored;
}

// ============================================================================
// SETTERS
// ============================================================================

export function setPreviousActiveTabId(tabId: number): void {
  previousActiveTabId = tabId;
}

export function resetActiveTabStartTime(): void {
  activeTabStartTime = Date.now();
}

export function setTabOpenTime(tabId: number, timestamp?: number): void {
  tabOpenOrder.set(tabId, timestamp ?? Date.now());
}

// ============================================================================
// RECENT ORDER MANAGEMENT
// ============================================================================

export function updateRecentTabOrder(tabId: number): void {
  removeFromRecentOrder(tabId);
  recentTabOrder.unshift(tabId);

  // Keep only necessary entries
  if (recentTabOrder.length > PERF_CONFIG.MAX_CACHED_TABS * 2) {
    recentTabOrder.length = PERF_CONFIG.MAX_CACHED_TABS * 2;
  }

  // Persist to storage (debounced)
  saveRecentOrderDebounced();
}

export function removeFromRecentOrder(tabId: number): void {
  const index = recentTabOrder.indexOf(tabId);
  if (index !== -1) {
    recentTabOrder.splice(index, 1);
  }
}

export function removeTabOpenOrder(tabId: number): void {
  tabOpenOrder.delete(tabId);
}

// Debounced save to avoid too many writes
function saveRecentOrderDebounced(): void {
  if (saveRecentOrderTimer) clearTimeout(saveRecentOrderTimer);
  saveRecentOrderTimer = setTimeout(() => {
    chrome.storage.local
      .set({ recentTabOrder: recentTabOrder.slice(0, 100) })
      .catch((e) => console.debug("[STORAGE] Failed to save recent order:", e));
  }, 500);
}

// Restore recent order from storage
export async function restoreRecentOrder(): Promise<void> {
  try {
    const result = await chrome.storage.local.get(["recentTabOrder"]);
    if (result.recentTabOrder && Array.isArray(result.recentTabOrder)) {
      // Filter out tabs that no longer exist
      const existingTabs = await chrome.tabs.query({});
      const existingIds = new Set(existingTabs.map((t) => t.id));
      recentTabOrder = result.recentTabOrder.filter((id: number) =>
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
// SORTING
// ============================================================================

// Sort tabs by recent usage (most recently accessed first)
// Uses Chrome's lastAccessed timestamp as primary sort, falls back to our tracking
export function sortTabsByRecent<T extends chrome.tabs.Tab>(tabs: T[]): T[] {
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
// INITIALIZATION
// ============================================================================

export async function initializeExistingTabs(): Promise<void> {
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

    // Find active tabs in each window
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
      }
    }

    console.log(
      `[INIT] Initialized ${tabs.length} existing tabs, ${recentTabOrder.length} in recent order`
    );
  } catch (error: any) {
    console.error("[INIT] Failed to initialize existing tabs:", error);
  }
}




