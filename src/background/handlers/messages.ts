// ============================================================================
// MESSAGE HANDLERS
// Handles all message communication with content scripts
// ============================================================================

import { PERF_CONFIG } from "../config";
import { LRUCache } from "../cache/lru-cache";
import * as mediaTracker from "../services/media-tracker";
import * as tabTracker from "../services/tab-tracker";
import * as screenshot from "../services/screenshot";

// Import content script via CRXJS special query to get output filename
import contentScriptPath from "../../content/index.ts?script";

const DEBUG_LOGGING = false;
const log = (...args: unknown[]) => {
  if (DEBUG_LOGGING) {
    console.log(...args);
  }
};

type MessageAction =
  | "FlowPopupCycleNext"
  | "QuickSwitchPopupCycleNext"
  | "reportMediaPresence"
  | "getRecentlyClosed"
  | "restoreSession"
  | "switchToTab"
  | "closeTab"
  | "toggleMute"
  | "togglePlayPause"
  | "refreshTabList"
  | "captureTabScreenshot"
  | "getCacheStats"
  | "setQualityTier"
  | "updateCacheSettings"
  | "createGroup"
  | "getTabsForFlow"
  | "getTabsForQuickSwitch";

type IncomingMessage =
  | { action: "FlowPopupCycleNext" }
  | { action: "QuickSwitchPopupCycleNext" }
  | { action: "reportMediaPresence"; hasMedia?: boolean; isPlaying?: boolean }
  | { action: "getRecentlyClosed"; maxResults?: number }
  | { action: "restoreSession"; sessionId?: string }
  | { action: "switchToTab"; tabId?: number }
  | { action: "closeTab"; tabId?: number }
  | { action: "toggleMute"; tabId?: number }
  | { action: "togglePlayPause"; tabId?: number }
  | { action: "refreshTabList" }
  | { action: "captureTabScreenshot"; tabId?: number; forceQuality?: string }
  | { action: "getCacheStats" }
  | { action: "setQualityTier"; tier?: string }
  | { action: "updateCacheSettings"; maxTabs?: number; maxMB?: number }
  | { action: "createGroup"; tabId?: number }
  | { action: "getTabsForFlow" }
  | { action: "getTabsForQuickSwitch" };

type MessageResponse = {
  success: boolean;
  error?: string;
  [key: string]: unknown;
};

const MESSAGE_ACTIONS: ReadonlySet<MessageAction> = new Set([
  "FlowPopupCycleNext",
  "QuickSwitchPopupCycleNext",
  "reportMediaPresence",
  "getRecentlyClosed",
  "restoreSession",
  "switchToTab",
  "closeTab",
  "toggleMute",
  "togglePlayPause",
  "refreshTabList",
  "captureTabScreenshot",
  "getCacheStats",
  "setQualityTier",
  "updateCacheSettings",
  "createGroup",
  "getTabsForFlow",
  "getTabsForQuickSwitch",
]);

function parseIncomingMessage(request: unknown): IncomingMessage | null {
  if (!request || typeof request !== "object") return null;
  const action = (request as { action?: unknown }).action;
  if (
    typeof action !== "string" ||
    !MESSAGE_ACTIONS.has(action as MessageAction)
  ) {
    return null;
  }
  return request as IncomingMessage;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function handleMessage(
  request: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: MessageResponse) => void,
  screenshotCache: LRUCache,
  showTabFlow: () => Promise<void>
): Promise<void> {
  try {
    const parsedRequest = parseIncomingMessage(request);
    if (!parsedRequest) {
      console.error("[ERROR] Invalid message received:", request);
      sendResponse({ success: false, error: "Invalid message format" });
      return;
    }

    switch (parsedRequest.action) {
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
            typeof parsedRequest.maxResults === "number"
              ? parsedRequest.maxResults
              : 10
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
        } catch (error: unknown) {
          console.error("[ERROR] Failed to get recently closed:", error);
          sendResponse({ success: false, error: getErrorMessage(error) });
        }
        break;

      case "restoreSession":
        try {
          if (
            !parsedRequest.sessionId ||
            typeof parsedRequest.sessionId !== "string"
          ) {
            sendResponse({ success: false, error: "Invalid sessionId" });
            return;
          }
          const restored = await chrome.sessions.restore(parsedRequest.sessionId);
          sendResponse({ success: true, restored });
        } catch (error: unknown) {
          console.error("[ERROR] Failed to restore session:", error);
          sendResponse({ success: false, error: getErrorMessage(error) });
        }
        break;

      case "switchToTab":
        if (!parsedRequest.tabId || typeof parsedRequest.tabId !== "number") {
          sendResponse({ success: false, error: "Invalid tab ID" });
          return;
        }
        try {
          await chrome.tabs.update(parsedRequest.tabId, { active: true });
          sendResponse({ success: true });
        } catch (error: unknown) {
          console.error("[ERROR] Failed to switch to tab:", error);
          sendResponse({ success: false, error: getErrorMessage(error) });
        }
        break;

      case "closeTab":
        if (!parsedRequest.tabId || typeof parsedRequest.tabId !== "number") {
          sendResponse({ success: false, error: "Invalid tab ID" });
          return;
        }
        try {
          const tab = await chrome.tabs.get(parsedRequest.tabId).catch(() => null);
          if (!tab) {
            console.warn("[WARNING] Tab no longer exists:", parsedRequest.tabId);
            sendResponse({ success: false, error: "Tab no longer exists" });
            return;
          }
          await chrome.tabs.remove(parsedRequest.tabId);
          sendResponse({ success: true });
        } catch (error: unknown) {
          console.error("[ERROR] Failed to close tab:", error);
          sendResponse({ success: false, error: getErrorMessage(error) });
        }
        break;

      case "toggleMute":
        if (!parsedRequest.tabId || typeof parsedRequest.tabId !== "number") {
          sendResponse({ success: false, error: "Invalid tab ID" });
          return;
        }
        try {
          const tab = await chrome.tabs.get(parsedRequest.tabId);
          const newMutedStatus = !(tab.mutedInfo?.muted ?? false);
          await chrome.tabs.update(parsedRequest.tabId, { muted: newMutedStatus });
          sendResponse({ success: true, muted: newMutedStatus });
        } catch (error: unknown) {
          console.error("[ERROR] Failed to toggle mute:", error);
          sendResponse({ success: false, error: getErrorMessage(error) });
        }
        break;

      case "togglePlayPause":
        if (!parsedRequest.tabId || typeof parsedRequest.tabId !== "number") {
          sendResponse({ success: false, error: "Invalid tab ID" });
          return;
        }
        try {
          const tab = await chrome.tabs.get(parsedRequest.tabId);
          if (screenshot.isTabCapturable(tab)) {
            const results = await chrome.scripting.executeScript({
              target: { tabId: parsedRequest.tabId },
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
        } catch (error: unknown) {
          console.error("[ERROR] Failed to toggle play/pause:", error);
          sendResponse({ success: false, error: getErrorMessage(error) });
        }
        break;

      case "refreshTabList":
        try {
          await showTabFlow();
          sendResponse({ success: true });
        } catch (error: unknown) {
          console.error("[ERROR] Failed to refresh tab list:", error);
          sendResponse({ success: false, error: getErrorMessage(error) });
        }
        break;

      case "captureTabScreenshot":
        if (!parsedRequest.tabId || typeof parsedRequest.tabId !== "number") {
          sendResponse({ success: false, error: "Invalid tab ID" });
          return;
        }
        try {
          const forceQuality =
            typeof parsedRequest.forceQuality === "string"
              ? parsedRequest.forceQuality
              : null;
          const capturedScreenshot = await screenshot.captureTabScreenshot(
            parsedRequest.tabId,
            screenshotCache,
            forceQuality
          );
          sendResponse({
            success: !!capturedScreenshot,
            screenshot: capturedScreenshot,
          });
        } catch (error: unknown) {
          console.error("[ERROR] Failed to capture screenshot:", error);
          sendResponse({ success: false, error: getErrorMessage(error) });
        }
        break;

      case "getCacheStats":
        try {
          const stats = screenshotCache.getStats();
          sendResponse({ success: true, stats });
        } catch (error: unknown) {
          console.error("[ERROR] Failed to get cache stats:", error);
          sendResponse({ success: false, error: getErrorMessage(error) });
        }
        break;

      case "setQualityTier":
        try {
          const tier = parsedRequest.tier || PERF_CONFIG.DEFAULT_QUALITY_TIER;
          if (screenshot.setCurrentQualityTier(tier)) {
            chrome.storage.local.set({ qualityTier: tier });
            // Force fresh captures at the new tier instead of serving stale cache.
            screenshotCache.clear();
            log(`[SETTINGS] Quality tier changed to: ${tier}`);
            sendResponse({ success: true, tier });
          } else {
            sendResponse({ success: false, error: "Invalid quality tier" });
          }
        } catch (error: unknown) {
          console.error("[ERROR] Failed to set quality tier:", error);
          sendResponse({ success: false, error: getErrorMessage(error) });
        }
        break;

      case "updateCacheSettings":
        try {
          const rawTabs = parsedRequest.maxTabs;
          const rawMB = parsedRequest.maxMB;
          if (typeof rawTabs !== "number" || typeof rawMB !== "number") {
            sendResponse({ success: false, error: "Invalid cache settings" });
            return;
          }

          const maxTabs = Math.min(300, Math.max(20, Math.floor(rawTabs)));
          const maxMB = Math.min(200, Math.max(10, Math.floor(rawMB)));

          screenshotCache.resize(maxTabs, maxMB * 1024 * 1024);
          chrome.storage.local.set({ cacheMaxTabs: maxTabs, cacheMaxMB: maxMB });
          sendResponse({ success: true, maxTabs, maxMB });
        } catch (error: unknown) {
          console.error("[ERROR] Failed to update cache settings:", error);
          sendResponse({ success: false, error: getErrorMessage(error) });
        }
        break;

      case "createGroup":
        try {
          if (parsedRequest.tabId && chrome.tabs.group) {
            const groupId = await chrome.tabs.group({ tabIds: parsedRequest.tabId });
            sendResponse({ success: true, groupId });
          } else {
            sendResponse({
              success: false,
              error: "Missing tabId or API not supported",
            });
          }
        } catch (error: unknown) {
          console.error("[GROUPS] Failed to create group:", error);
          sendResponse({ success: false, error: getErrorMessage(error) });
        }
        break;

      case "getTabsForFlow":
        // Used by the popup window fallback to request tab data directly
        try {
          const targetWindowId = await resolveTargetNormalWindowId(sender);
          if (targetWindowId === null) {
            sendResponse({
              success: false,
              error: "No normal browser window available",
            });
            return;
          }

          const tabs = await chrome.tabs.query({ windowId: targetWindowId });

          const tabsWithIds = tabs.filter(
            (tab): tab is chrome.tabs.Tab & { id: number } =>
              typeof tab.id === "number"
          );

          // Fetch tab groups
          let groups: chrome.tabGroups.TabGroup[] = [];
          if (chrome.tabGroups) {
            try {
              groups = await chrome.tabGroups.query({
                windowId: targetWindowId,
              });
            } catch (e) {
              console.debug("[GROUPS] Failed to fetch groups:", e);
            }
          }

          // Sort by recent access order
          const sortedTabs = tabTracker.sortTabsByRecent(tabsWithIds);

          // Build tab data with cached screenshots
          const RECENT_PREVIEW_LIMIT = 30;

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
        } catch (error: unknown) {
          console.error("[ERROR] Failed to get tabs for Flow:", error);
          sendResponse({ success: false, error: getErrorMessage(error) });
        }
        break;

      case "getTabsForQuickSwitch":
        // Used by the Quick Switch popup window to request tab data directly
        try {
          const targetWindowId = await resolveTargetNormalWindowId(sender);
          if (targetWindowId === null) {
            sendResponse({
              success: false,
              error: "No normal browser window available",
            });
            return;
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
        } catch (error: unknown) {
          console.error("[ERROR] Failed to get tabs for Quick Switch:", error);
          sendResponse({ success: false, error: getErrorMessage(error) });
        }
        break;

      default:
        console.warn("[WARNING] Unknown action received.");
        sendResponse({ success: false, error: "Unknown action" });
    }
  } catch (error: unknown) {
    console.error(`[ERROR] Message handler failed:`, error);
    sendResponse({ success: false, error: getErrorMessage(error) });
  }
}

async function resolveTargetNormalWindowId(
  sender: chrome.runtime.MessageSender
): Promise<number | null> {
  const senderWindowId = sender.tab?.windowId;
  if (typeof senderWindowId === "number") {
    const senderWindow = await chrome.windows.get(senderWindowId).catch(() => null);
    if (senderWindow?.type === "normal") {
      return senderWindowId;
    }
  }

  const lastFocusedNormal = await chrome.windows
    .getLastFocused({
      populate: false,
      windowTypes: ["normal"],
    })
    .catch(() => null);
  if (typeof lastFocusedNormal?.id === "number") {
    return lastFocusedNormal.id;
  }

  const normalWindows = await chrome.windows.getAll({
    populate: false,
    windowTypes: ["normal"],
  });
  if (normalWindows.length === 0) return null;

  const focusedNormal = normalWindows.find((window) => window.focused);
  if (typeof focusedNormal?.id === "number") {
    return focusedNormal.id;
  }

  const fallbackWindow = normalWindows.find(
    (window): window is chrome.windows.Window & { id: number } =>
      typeof window.id === "number"
  );
  return fallbackWindow?.id ?? null;
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
  } catch (injectErr: unknown) {
    const msg = getErrorMessage(injectErr);
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
  message: Record<string, unknown>,
  retries = 1
): Promise<boolean> {
  try {
    await chrome.tabs.sendMessage(tabId, message);
    return true;
  } catch (err: unknown) {
    if (retries > 0 && isMissingConnectionError(err)) {
      try {
        const injected = await tryInjectContentScript(tabId);
        if (!injected) return false;

        await new Promise((resolve) => setTimeout(resolve, 150));
        await chrome.tabs.sendMessage(tabId, message);
        return true;
      } catch {
        return false;
      }
    }
    throw err;
  }
}

