// ============================================================================
// MEDIA TRACKER SERVICE
// Tracks tabs that have media elements (even if paused/muted)
// ============================================================================

const tabsWithMedia = new Set<number>();

// Persist tabsWithMedia to session storage so it survives service worker suspension
export function saveTabsWithMedia(): void {
  try {
    chrome.storage.session.set({ tabsWithMedia: Array.from(tabsWithMedia) });
  } catch (e) {
    // Session storage might fail in some environments
  }
}

export async function loadTabsWithMedia(): Promise<void> {
  try {
    const data = await chrome.storage.session.get("tabsWithMedia");
    if (data.tabsWithMedia && Array.isArray(data.tabsWithMedia)) {
      data.tabsWithMedia.forEach((id: number) => tabsWithMedia.add(id));
    }
  } catch (e) {
    // Ignore
  }
}

export function hasMedia(tabId: number): boolean {
  return tabsWithMedia.has(tabId);
}

export function addMediaTab(tabId: number): void {
  if (!tabsWithMedia.has(tabId)) {
    tabsWithMedia.add(tabId);
    saveTabsWithMedia();
    console.debug(`[MEDIA] Tab ${tabId} marked as having media`);
  }
}

export function removeMediaTab(tabId: number): void {
  if (tabsWithMedia.has(tabId)) {
    tabsWithMedia.delete(tabId);
    saveTabsWithMedia();
  }
}

export function getMediaTabsCount(): number {
  return tabsWithMedia.size;
}

// Also query currently audible tabs on startup
export async function initializeAudibleTabs(): Promise<void> {
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
