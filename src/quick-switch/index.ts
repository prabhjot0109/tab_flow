// ============================================================================
// Quick Switch Popup - Protected page fallback using the same overlay engine
// as injected quick switch on normal websites.
// ============================================================================

import {
  showQuickSwitch,
  advanceQuickSwitchSelection,
  ensureShadowRoot,
} from "../content/ui/overlay";
import type { Tab } from "../shared/types";

type QuickSwitchPayload = {
  tabs: Tab[];
  activeTabId: number | null;
};

function closePopupWindowSoon(): void {
  setTimeout(() => {
    try {
      window.close();
    } catch {
      // Ignore close errors.
    }
  }, 0);
}

function setupPopupLifecycle(): void {
  // Auto-close once focus leaves the popup (e.g. tab switch completed).
  window.addEventListener("blur", closePopupWindowSoon);

  // Close on explicit cancel/confirm keys.
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" || event.key === "Enter") {
      closePopupWindowSoon();
    }
  }, true);

  document.addEventListener("keyup", (event) => {
    if (event.key === "Alt" || (!event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey)) {
      closePopupWindowSoon();
    }
  }, true);
}

function setupCycleListener(): void {
  if (!chrome?.runtime?.onMessage) return;

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request?.action === "QuickSwitchPopupCycleNext") {
      advanceQuickSwitchSelection(1);
      sendResponse?.({ success: true });
      return true;
    }
    return false;
  });
}

function getActiveTabId(tabs: Tab[]): number | null {
  const activeTab = tabs.find((tab) => tab.active && typeof tab.id === "number");
  return activeTab?.id ?? null;
}

async function requestTabsFromBackground(): Promise<QuickSwitchPayload | null> {
  try {
    const response = await chrome.runtime.sendMessage({
      action: "getTabsForQuickSwitch",
    });

    if (!response?.success || !Array.isArray(response.tabs)) {
      return null;
    }

    return {
      tabs: response.tabs as Tab[],
      activeTabId: getActiveTabId(response.tabs as Tab[]),
    };
  } catch (error) {
    console.error("[QS POPUP] Failed to request tabs:", error);
    return null;
  }
}

async function loadTabs(): Promise<QuickSwitchPayload | null> {
  try {
    const result = await chrome.storage.session.get(["QuickSwitchTabData"]);
    const stored = result.QuickSwitchTabData as
      | { tabs?: Tab[]; activeTabId?: number }
      | undefined;

    if (stored && Array.isArray(stored.tabs) && stored.tabs.length > 0) {
      return {
        tabs: stored.tabs,
        activeTabId:
          typeof stored.activeTabId === "number"
            ? stored.activeTabId
            : getActiveTabId(stored.tabs),
      };
    }
  } catch (error) {
    console.error("[QS POPUP] Failed to load session tab data:", error);
  }

  return requestTabsFromBackground();
}

async function initialize(): Promise<void> {
  const payload = await loadTabs();
  if (!payload || payload.tabs.length === 0) {
    closePopupWindowSoon();
    return;
  }

  setupCycleListener();
  setupPopupLifecycle();
  await showQuickSwitch(payload.tabs, payload.activeTabId);
  applyPopupTightLayout();
}

initialize().catch((error) => {
  console.error("[QS POPUP] Initialization failed:", error);
  closePopupWindowSoon();
});

function applyPopupTightLayout(): void {
  const shadowRoot = ensureShadowRoot();
  if (!shadowRoot) return;

  const overlay = shadowRoot.getElementById("quick-switch-overlay") as HTMLElement | null;
  const container = shadowRoot.querySelector(
    ".tab-flow-container.quick-switch-container",
  ) as HTMLElement | null;

  if (overlay) {
    overlay.style.padding = "0";
    overlay.style.alignItems = "stretch";
    overlay.style.justifyContent = "stretch";
  }

  if (container) {
    container.style.width = "100%";
    container.style.maxWidth = "100%";
    container.style.height = "100%";
    container.style.maxHeight = "100%";
    container.style.borderRadius = "0";
  }
}
