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
  showTabSwitcher: () => Promise<void>
): Promise<void> {
  try {
    if (!request || !request.action) {
      console.error("[ERROR] Invalid message received:", request);
      sendResponse({ success: false, error: "Invalid message format" });
      return;
    }

    switch (request.action) {
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
          await showTabSwitcher();
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

      default:
        console.warn("[WARNING] Unknown action:", request.action);
        sendResponse({ success: false, error: "Unknown action" });
    }
  } catch (error: any) {
    console.error(`[ERROR] Message handler failed:`, error);
    sendResponse({ success: false, error: error.message });
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
    if (
      retries > 0 &&
      err.message &&
      err.message.includes("Could not establish connection")
    ) {
      console.log("[INJECT] Content script not ready, injecting...");

      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: [contentScriptPath],
        });

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
