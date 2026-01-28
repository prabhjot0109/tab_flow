// ============================================================================
// MESSAGE HANDLERS
// Handles all message communication with content scripts
// ============================================================================

import { PERF_CONFIG } from "../config";
import { LRUCache } from "../cache/lru-cache";
import { perfMetrics } from "../utils/performance";
import * as mediaTracker from "../services/media-tracker";
import * as tabTracker from "../services/tab-tracker";
import * as screenshot from "../services/screenshot";

// Import content script via CRXJS special query to get output filename
import contentScriptPath from "../../content/index.ts?script";

export async function handleMessage(
  request: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void,
  screenshotCache: LRUCache,
  showTabFlow: () => Promise<void>
): Promise<void> {
  try {
    if (!request || !request.action) {
      console.error("[ERROR] Invalid message received:", request);
      sendResponse({ success: false, error: "Invalid message format" });
      return;
    }

    switch (request.action) {
      case "FlowPopupCycleNext":
        // Internal message used to control the standalone Flow popup.
        // The popup page listens for this; background can safely ack it too.
        sendResponse({ success: true });
        break;

      case "QuickSwitchPopupCycleNext":
        // Internal message used to control the standalone Quick Switch popup.
        // The popup page listens for this; background can safely ack it too.
        sendResponse({ success: true });
        break;

      case "reportMediaPresence":
        if (sender.tab && sender.tab.id) {
          mediaTracker.addMediaTab(sender.tab.id);
        }
        sendResponse({ success: true });
        break;

      case "getRecentlyClosed":
        try {
          const apiMax = 25;
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
              for (const t of s.window.tabs) {
                items.push({
                  kind: "tab",
                  sessionId: t.sessionId || s.window.sessionId,
                  lastModified: s.lastModified,
                  title: t.title || "Untitled",
                  url: t.url || "",
                  favIconUrl: t.favIconUrl || "",
                });
              }
            } else if (s.window && s.window.sessionId) {
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
          const tab = await chrome.tabs.get(request.tabId).catch(() => null);
          if (!tab) {
            console.warn("[WARNING] Tab no longer exists:", request.tabId);
            sendResponse({ success: false, error: "Tab no longer exists" });
            return;
          }
          await chrome.tabs.remove(request.tabId);
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
          if (screenshot.isTabCapturable(tab)) {
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
                  for (const m of media) {
                    m.pause();
                  }
                  return { success: true, playing: false };
                }
                for (const m of media) {
                  m.play().catch(() => {});
                }
                return { success: true, playing: true };
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
          await showTabFlow();
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
          const capturedScreenshot = await screenshot.captureTabScreenshot(
            request.tabId,
            screenshotCache
          );
          sendResponse({
            success: !!capturedScreenshot,
            screenshot: capturedScreenshot,
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
          if (screenshot.setCurrentQualityTier(tier)) {
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

      case "getTabsForFlow":
        // Used by the popup window fallback to request tab data directly
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
              groups = await chrome.tabGroups.query({
                windowId: currentWindow.id,
              });
            } catch (e) {
              console.debug("[GROUPS] Failed to fetch groups:", e);
            }
          }

          // Sort by recent access order
          const sortedTabs = tabTracker.sortTabsByRecent(tabsWithIds);

          // Build tab data with cached screenshots
          const RECENT_PREVIEW_LIMIT = 8;

          const tabsData = sortedTabs.map((tab, index) => {
            let screenshotData = null;
            const isRecent = index < RECENT_PREVIEW_LIMIT;

            if (screenshot.isTabCapturable(tab) && isRecent) {
              const cached = screenshotCache.getIfFresh(
                tab.id,
                PERF_CONFIG.SCREENSHOT_CACHE_DURATION
              );
              if (cached) {
                screenshotData = cached;
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

          sendResponse({
            success: true,
            tabs: tabsData,
            groups: groupsData,
          });
        } catch (error: any) {
          console.error("[ERROR] Failed to get tabs for Flow:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case "getTabsForQuickSwitch":
        // Used by the Quick Switch popup window to request tab data directly
        try {
          const currentWindow = await chrome.windows.getCurrent();
          const allWindows = await chrome.windows.getAll({ populate: false });

          // Find the main browser window (not popup type)
          let targetWindowId = currentWindow.id;
          for (const win of allWindows) {
            if (win.type === "normal" && win.focused !== true) {
              targetWindowId = win.id;
              break;
            }
          }

          // If the current window is a popup, find the last focused normal window
          if (currentWindow.type === "popup") {
            for (const win of allWindows) {
              if (win.type === "normal") {
                targetWindowId = win.id;
                break;
              }
            }
          }

          const tabs = await chrome.tabs.query({
            windowId: targetWindowId,
          });

          const tabsWithIds = tabs.filter(
            (tab): tab is chrome.tabs.Tab & { id: number } =>
              typeof tab.id === "number"
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

          sendResponse({
            success: true,
            tabs: tabsData,
          });
        } catch (error: any) {
          console.error("[ERROR] Failed to get tabs for Quick Switch:", error);
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

function isMissingConnectionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Could not establish connection");
}

function isProtectedInjectionError(message: string): boolean {
  return (
    message.includes("cannot be scripted") ||
    message.includes("Cannot access a chrome://") ||
    message.includes("Cannot access a chrome-extension://") ||
    (message.includes("Cannot access") && message.includes("URL"))
  );
}

function isMissingHostPermissionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Extension manifest must request permission") ||
    message.includes("Cannot access contents of the page") ||
    message.includes("permission")
  );
}

function getOriginPermission(tabUrl: string): string | null {
  if (!tabUrl.startsWith("http://") && !tabUrl.startsWith("https://")) {
    return null;
  }
  try {
    const origin = new URL(tabUrl).origin;
    return `${origin}/*`;
  } catch {
    return null;
  }
}

async function ensureHostPermissionForTab(tabId: number): Promise<boolean> {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab || !tab.url || !screenshot.isTabCapturable(tab)) {
    return false;
  }

  const originPermission = getOriginPermission(tab.url);
  if (!originPermission) return false;

  const hasPermission = await chrome.permissions
    .contains({ origins: [originPermission] })
    .catch(() => false);
  if (hasPermission) return true;

  return chrome.permissions
    .request({ origins: [originPermission] })
    .catch(() => false);
}

async function tryInjectContentScript(tabId: number): Promise<boolean> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [contentScriptPath],
    });
    return true;
  } catch (injectErr: any) {
    const msg = injectErr && injectErr.message ? injectErr.message : "";
    if (isProtectedInjectionError(msg)) {
      console.warn(
        "[INJECT] Cannot inject on this page (protected URL). Try on a regular webpage."
      );
      return false;
    }

    if (isMissingHostPermissionError(injectErr)) {
      const granted = await ensureHostPermissionForTab(tabId);
      if (granted) {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: [contentScriptPath],
        });
        return true;
      }
      console.warn("[INJECT] Host permission not granted by user.");
      return false;
    }

    throw injectErr;
  }
}

// Send message with automatic script injection
export async function sendMessageWithRetry(
  tabId: number,
  message: any,
  retries = 1
): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch (err: any) {
    if (retries > 0 && isMissingConnectionError(err)) {
      const injected = await tryInjectContentScript(tabId);
      if (!injected) return;

      await new Promise((resolve) => setTimeout(resolve, 150));
      await chrome.tabs.sendMessage(tabId, message);
    } else {
      throw err;
    }
  }
}
