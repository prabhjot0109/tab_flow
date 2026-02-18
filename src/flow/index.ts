// ============================================================================
// Flow Popup - Protected page fallback using the same overlay engine
// as injected Flow on normal websites.
// ============================================================================

import { showTabFlow, ensureShadowRoot } from "../content/ui/overlay";
import { selectNext } from "../content/input/keyboard";
import { enforceSingleSelection } from "../content/ui/rendering";
import { state } from "../content/state";
import type { Group, Tab } from "../shared/types";

type FlowPayload = {
  tabs: Tab[];
  groups: Group[];
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
  // Close once focus moves to another tab/window.
  window.addEventListener("blur", closePopupWindowSoon);

  // Escape should close popup window as well as overlay.
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        closePopupWindowSoon();
      }
    },
    true,
  );

  // If the overlay is closed without blur, close popup shell too.
  const monitor = window.setInterval(() => {
    if (!state.isOverlayVisible && !state.isClosing) {
      window.clearInterval(monitor);
      closePopupWindowSoon();
    }
  }, 120);
}

function setupCycleListener(): void {
  if (!chrome?.runtime?.onMessage) return;

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request?.action === "FlowPopupCycleNext") {
      selectNext();
      enforceSingleSelection(true);
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

async function requestTabsFromBackground(): Promise<FlowPayload | null> {
  try {
    const response = await chrome.runtime.sendMessage({ action: "getTabsForFlow" });
    if (!response?.success || !Array.isArray(response.tabs)) {
      return null;
    }

    const tabs = response.tabs as Tab[];
    const groups = (Array.isArray(response.groups) ? response.groups : []) as Group[];
    return {
      tabs,
      groups,
      activeTabId: getActiveTabId(tabs),
    };
  } catch (error) {
    console.error("[FLOW POPUP] Failed to request tabs:", error);
    return null;
  }
}

async function loadFlowData(): Promise<FlowPayload | null> {
  try {
    const result = await chrome.storage.session.get(["FlowTabData"]);
    const stored = result.FlowTabData as
      | { tabs?: Tab[]; groups?: Group[]; activeTabId?: number }
      | undefined;

    if (stored && Array.isArray(stored.tabs) && stored.tabs.length > 0) {
      await chrome.storage.session.remove(["FlowTabData"]);
      return {
        tabs: stored.tabs,
        groups: Array.isArray(stored.groups) ? stored.groups : [],
        activeTabId:
          typeof stored.activeTabId === "number"
            ? stored.activeTabId
            : getActiveTabId(stored.tabs),
      };
    }
  } catch (error) {
    console.error("[FLOW POPUP] Failed to load session tab data:", error);
  }

  return requestTabsFromBackground();
}

function applyPopupTightLayout(): void {
  const shadowRoot = ensureShadowRoot();
  if (!shadowRoot) return;

  const overlay = shadowRoot.getElementById("visual-tab-flow-overlay") as HTMLElement | null;
  const container = shadowRoot.querySelector(".tab-flow-container") as HTMLElement | null;

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

async function initialize(): Promise<void> {
  const payload = await loadFlowData();
  if (!payload || payload.tabs.length === 0) {
    closePopupWindowSoon();
    return;
  }

  setupCycleListener();
  setupPopupLifecycle();
  showTabFlow(payload.tabs, payload.activeTabId, payload.groups);
  applyPopupTightLayout();
}

initialize().catch((error) => {
  console.error("[FLOW POPUP] Initialization failed:", error);
  closePopupWindowSoon();
});
