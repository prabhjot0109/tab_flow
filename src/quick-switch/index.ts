// ============================================================================
// Quick Switch Popup - For Protected Pages (chrome://, new tab, etc.)
// ============================================================================
// Standalone quick switch that works on pages where content scripts
// cannot be injected.
// ============================================================================

// Make this a module to avoid global scope conflicts
export {};

interface Tab {
  id: number;
  title: string;
  url?: string;
  favIconUrl?: string;
  pinned: boolean;
  index: number;
  active: boolean;
  audible?: boolean;
  mutedInfo?: { muted: boolean };
  groupId?: number;
  hasMedia?: boolean;
}

interface TabData {
  tabs: Tab[];
  activeTabId: number;
}

const DEBUG_LOGGING = false;
const log = (...args: unknown[]) => {
  if (DEBUG_LOGGING) {
    console.log(...args);
  }
};

function getFaviconUrl(url?: string, size = 32): string | null {
  if (!url) return null;
  try {
    const favUrl = new URL(chrome.runtime.getURL("/_favicon/"));
    favUrl.searchParams.set("pageUrl", url);
    favUrl.searchParams.set("size", String(size));
    return favUrl.toString();
  } catch {
    return null;
  }
}

// State
let tabs: Tab[] = [];
let selectedIndex = 0;
let viewMode: "grid" | "list" = "grid"; // Default to grid
let tabCards: HTMLElement[] = [];
let lastSelectedIndex = -1;

// DOM Elements
let tabGrid: HTMLElement;
let gridViewBtn: HTMLButtonElement;
let listViewBtn: HTMLButtonElement;

// ============================================================================
// INITIALIZATION
// ============================================================================

async function initialize() {
  log("[QUICK SWITCH POPUP] Initializing...");

  // Get DOM elements
  tabGrid = document.getElementById("tab-grid")!;
  gridViewBtn = document.querySelector('[data-view="grid"]')!;
  listViewBtn = document.querySelector('[data-view="list"]')!;

  // Load view mode preference from chrome.storage
  try {
    const result = await chrome.storage.local.get(["QuickSwitchViewMode"]);
    if (result.QuickSwitchViewMode) {
      viewMode = result.QuickSwitchViewMode as "grid" | "list";
      updateViewToggle();
    }
  } catch (e) {
    // Ignore
  }

  updateViewToggle();

  // Load tab data from session storage
  try {
    const result = await chrome.storage.session.get(["QuickSwitchTabData"]);
    if (result.QuickSwitchTabData) {
      const data = result.QuickSwitchTabData as TabData;
      tabs = data.tabs;

      // Find the currently active tab and set selection to next tab (like Alt+Tab)
      const activeIndex = tabs.findIndex((t) => t.active);
      if (tabs.length > 1 && activeIndex === 0) {
        selectedIndex = 1;
      } else if (activeIndex > 0) {
        selectedIndex = 0;
      } else {
        selectedIndex = 0;
      }

      renderTabs();

      // Clear the session data after loading
      chrome.storage.session.remove(["QuickSwitchTabData"]);
    } else {
      // Fallback: request tabs directly
      await requestTabsFromBackground();
    }
  } catch (e) {
    console.error("[QUICK SWITCH POPUP] Failed to load tab data:", e);
    await requestTabsFromBackground();
  }

  // Set up event listeners
  setupEventListeners();
  tabGrid.setAttribute("role", "listbox");
  tabGrid.setAttribute("aria-label", "Quick switch tabs");
  tabGrid.tabIndex = 0;
}

async function requestTabsFromBackground() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: "getTabsForQuickSwitch",
    });
    if (response && response.tabs) {
      tabs = response.tabs;

      const activeIndex = tabs.findIndex((t) => t.active);
      if (tabs.length > 1 && activeIndex === 0) {
        selectedIndex = 1;
      } else if (activeIndex > 0) {
        selectedIndex = 0;
      } else {
        selectedIndex = 0;
      }

      renderTabs();
    }
  } catch (e) {
    console.error("[QUICK SWITCH POPUP] Failed to request tabs:", e);
  }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function setupEventListeners() {
  // View toggle
  gridViewBtn.addEventListener("click", () => setViewMode("grid"));
  listViewBtn.addEventListener("click", () => setViewMode("list"));

  // Global keyboard
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("keyup", handleKeyUp);

  // Tab grid click events (event delegation)
  tabGrid.addEventListener("click", handleGridClick);

  // Auto-close on focus loss
  window.addEventListener("blur", () => {
    window.close();
  });

  // Listen for cycle-next message from background
  if (chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
      log("[QUICK SWITCH POPUP] Received message:", request?.action);
      if (request?.action === "QuickSwitchPopupCycleNext") {
        log("[QUICK SWITCH POPUP] Cycling to next tab");
        selectNext();
        sendResponse?.({ success: true });
        return true;
      }
      return false;
    });
  }
}

function handleKeyDown(e: KeyboardEvent) {
  log("[QUICK SWITCH POPUP] Key pressed:", e.key, "Alt:", e.altKey);
  // Handle Alt+Q to cycle through tabs
  if ((e.key === "q" || e.key === "Q") && e.altKey) {
    log("[QUICK SWITCH POPUP] Alt+Q detected, cycling");
    e.preventDefault();
    e.stopPropagation();
    selectNext();
    return;
  }

  // Escape to close
  if (e.key === "Escape") {
    window.close();
    return;
  }

  // Arrow navigation
  if (e.key === "ArrowDown" || e.key === "ArrowRight") {
    e.preventDefault();
    selectNext();
    return;
  }

  if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
    e.preventDefault();
    selectPrevious();
    return;
  }

  // Enter to switch
  if (e.key === "Enter") {
    e.preventDefault();
    switchToSelected();
    return;
  }
}

function handleKeyUp(e: KeyboardEvent) {
  // When Alt is released, switch to the selected tab
  if (e.key === "Alt") {
    e.preventDefault();
    switchToSelected();
  }
}

function handleGridClick(e: Event) {
  const target = e.target as HTMLElement;
  const card = target.closest(".tab-card") as HTMLElement | null;

  if (!card) return;

  const tabId = parseInt(card.dataset.tabId || "0", 10);
  if (!tabId) return;

  // Switch to tab
  switchToTab(tabId);
}

// ============================================================================
// NAVIGATION & ACTIONS
// ============================================================================

function selectNext() {
  if (tabs.length === 0) return;
  selectedIndex = (selectedIndex + 1) % tabs.length;
  updateSelection();
}

function selectPrevious() {
  if (tabs.length === 0) return;
  selectedIndex = selectedIndex <= 0 ? tabs.length - 1 : selectedIndex - 1;
  updateSelection();
}

function switchToSelected() {
  if (tabs.length === 0 || selectedIndex < 0) return;
  const tab = tabs[selectedIndex];
  if (tab?.id) {
    switchToTab(tab.id);
  }
}

async function switchToTab(tabId: number) {
  try {
    await chrome.tabs.update(tabId, { active: true });
    const tab = await chrome.tabs.get(tabId);
    if (tab.windowId) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
    window.close();
  } catch (e) {
    console.error("[QUICK SWITCH POPUP] Failed to switch tab:", e);
  }
}

// ============================================================================
// VIEW MODE
// ============================================================================

function setViewMode(mode: "grid" | "list") {
  if (viewMode === mode) return;

  viewMode = mode;
  updateViewToggle();

  // Save preference
  try {
    chrome.storage.local.set({ QuickSwitchViewMode: mode });
  } catch {
    // Ignore
  }
}

function updateViewToggle() {
  gridViewBtn.classList.toggle("active", viewMode === "grid");
  listViewBtn.classList.toggle("active", viewMode === "list");
  tabGrid.classList.toggle("list-view", viewMode === "list");
  gridViewBtn.setAttribute("aria-pressed", String(viewMode === "grid"));
  listViewBtn.setAttribute("aria-pressed", String(viewMode === "list"));
}

// ============================================================================
// RENDERING
// ============================================================================

function renderTabs() {
  tabGrid.innerHTML = "";
  tabCards = [];
  lastSelectedIndex = -1;
  const fragment = document.createDocumentFragment();

  // Apply view mode class
  tabGrid.classList.toggle("list-view", viewMode === "list");

  tabs.forEach((tab, index) => {
    const card = document.createElement("div");
    card.className = `tab-card${index === selectedIndex ? " selected" : ""}${
      tab.active ? " current-tab" : ""
    }`;
    card.dataset.tabId = String(tab.id);
    card.dataset.tabIndex = String(index);
    card.setAttribute("role", "option");
    card.setAttribute("aria-selected", String(index === selectedIndex));

    // Thumbnail area
    const thumbnail = document.createElement("div");
    thumbnail.className = "tab-thumbnail";

    const faviconTile = document.createElement("div");
    faviconTile.className = "favicon-tile";

    const faviconLarge = document.createElement("img");
    faviconLarge.className = "favicon-large";
    faviconLarge.loading = "eager";
    faviconLarge.decoding = "async";
    faviconLarge.setAttribute("fetchpriority", "high");
    faviconLarge.src =
      tab.favIconUrl || getFaviconUrl(tab.url) || "";
    faviconLarge.alt = "";
    faviconLarge.onerror = () => {
      faviconLarge.style.display = "none";
      const letter = document.createElement("div");
      letter.className = "favicon-letter";
      letter.textContent = (tab.title || "?")[0].toUpperCase();
      faviconTile.appendChild(letter);
    };
    faviconTile.appendChild(faviconLarge);
    thumbnail.appendChild(faviconTile);

    // Tab info
    const tabInfo = document.createElement("div");
    tabInfo.className = "tab-info";

    const tabHeader = document.createElement("div");
    tabHeader.className = "tab-header";

    const title = document.createElement("span");
    title.className = "tab-title";
    title.textContent = tab.title || "Untitled";
    title.title = tab.title || "";

    tabHeader.appendChild(title);
    tabInfo.appendChild(tabHeader);

    // URL domain
    const domain = document.createElement("span");
    domain.className = "tab-url";
    try {
      domain.textContent = new URL(tab.url || "").hostname;
    } catch {
      domain.textContent = "";
    }
    tabInfo.appendChild(domain);

    // Add elements to card
    card.appendChild(thumbnail);
    card.appendChild(tabInfo);

    fragment.appendChild(card);
    tabCards.push(card);
  });

  tabGrid.appendChild(fragment);
  updateSelection(true);
}

function updateSelection(forceRefresh = false) {
  if (tabCards.length === 0) return;

  if (selectedIndex < 0 || selectedIndex >= tabCards.length) return;

  if (forceRefresh) {
    tabCards.forEach((card, index) => {
      const isSelected = index === selectedIndex;
      card.classList.toggle("selected", isSelected);
      card.setAttribute("aria-selected", String(isSelected));
    });
  } else if (lastSelectedIndex !== selectedIndex) {
    if (lastSelectedIndex >= 0 && lastSelectedIndex < tabCards.length) {
      const previous = tabCards[lastSelectedIndex];
      previous.classList.remove("selected");
      previous.setAttribute("aria-selected", "false");
    }

    const current = tabCards[selectedIndex];
    current.classList.add("selected");
    current.setAttribute("aria-selected", "true");
  }

  tabCards[selectedIndex]?.scrollIntoView({ block: "nearest", behavior: "auto" });
  lastSelectedIndex = selectedIndex;
}

// ============================================================================
// START
// ============================================================================

document.addEventListener("DOMContentLoaded", initialize);
