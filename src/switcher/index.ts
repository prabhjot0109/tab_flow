// ============================================================================
// Standalone Tab Switcher - For Protected Pages (chrome://, new tab, etc.)
// ============================================================================
// This is a popup window version of the tab switcher that works on pages
// where content scripts cannot be injected.
// ============================================================================

interface Tab {
  id: number;
  title: string;
  url?: string;
  favIconUrl?: string;
  screenshot: string | null;
  pinned: boolean;
  index: number;
  active: boolean;
  audible?: boolean;
  mutedInfo?: { muted: boolean };
  groupId?: number;
  hasMedia?: boolean;
  // For special modes
  isWebSearch?: boolean;
  searchQuery?: string;
  sessionId?: string;
}

interface Group {
  id: number;
  title?: string;
  color: string;
  collapsed: boolean;
}

interface TabData {
  tabs: Tab[];
  groups: Group[];
  activeTabId: number;
}

// State
let tabs: Tab[] = [];
let activeTabs: Tab[] = []; // Store original active tabs for switching back
let groups: Group[] = [];
let selectedIndex = 0;
let viewMode: "grid" | "list" = "grid";
let currentMode: "active" | "recent" | "webSearch" = "active";
let searchQuery = "";
let filteredTabs: Tab[] = [];
let webSearchActive = false;

// DOM Elements
let tabGrid: HTMLElement;
let searchInput: HTMLInputElement;
let gridViewBtn: HTMLButtonElement;
let listViewBtn: HTMLButtonElement;
let sectionTitle: HTMLElement;
let tabHint: HTMLElement;
let helpText: HTMLElement;
let container: HTMLElement;

// ============================================================================
// INITIALIZATION
// ============================================================================

async function initialize() {
  console.log("[SWITCHER POPUP] Initializing...");

  // Get DOM elements
  tabGrid = document.getElementById("tab-switcher-grid")!;
  searchInput = document.querySelector(".tab-switcher-search")!;
  gridViewBtn = document.querySelector('[data-view="grid"]')!;
  listViewBtn = document.querySelector('[data-view="list"]')!;
  sectionTitle = document.querySelector(".tab-switcher-section-title")!;
  tabHint = document.querySelector(".search-tab-hint")!;
  helpText = document.querySelector(".tab-switcher-help")!;
  container = document.querySelector(".tab-switcher-container")!;

  // Match content-script overlay behavior: clicking the backdrop exits.
  const backdrop = document.querySelector(
    ".tab-switcher-backdrop"
  ) as HTMLElement | null;
  backdrop?.addEventListener("click", () => window.close());

  // Load view mode preference
  try {
    const result = await chrome.storage.local.get(["tabSwitcherViewMode"]);
    if (result.tabSwitcherViewMode === "list") {
      viewMode = "list";
      gridViewBtn.classList.remove("active");
      listViewBtn.classList.add("active");
    }
  } catch (e) {
    // Ignore
  }

  // Load tab data from session storage
  try {
    const result = await chrome.storage.session.get(["switcherTabData"]);
    if (result.switcherTabData) {
      const data = result.switcherTabData as TabData;
      tabs = data.tabs;
      activeTabs = [...tabs]; // Store for later
      groups = data.groups;
      filteredTabs = [...tabs];

      // Find the currently active tab and set selection
      const activeIndex = tabs.findIndex((t) => t.active);
      selectedIndex =
        activeIndex >= 0 ? Math.min(activeIndex + 1, tabs.length - 1) : 0;

      renderTabs();
      updateSelection();
      updateHelpText();

      // Clear the session data after loading
      chrome.storage.session.remove(["switcherTabData"]);
    } else {
      // Fallback: request tabs directly
      await requestTabsFromBackground();
    }
  } catch (e) {
    console.error("[SWITCHER POPUP] Failed to load tab data:", e);
    await requestTabsFromBackground();
  }

  // Set up event listeners
  setupEventListeners();

  // Focus search input
  setTimeout(() => searchInput.focus(), 50);
}

async function requestTabsFromBackground() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: "getTabsForSwitcher",
    });
    if (response && response.tabs) {
      tabs = response.tabs;
      activeTabs = [...tabs]; // Store for later
      groups = response.groups || [];
      filteredTabs = [...tabs];

      const activeIndex = tabs.findIndex((t) => t.active);
      selectedIndex =
        activeIndex >= 0 ? Math.min(activeIndex + 1, tabs.length - 1) : 0;

      renderTabs();
      updateSelection();
      updateHelpText();
    }
  } catch (e) {
    console.error("[SWITCHER POPUP] Failed to request tabs:", e);
  }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function setupEventListeners() {
  // Search input
  searchInput.addEventListener("input", handleSearch);
  searchInput.addEventListener("keydown", handleSearchKeydown);

  // View toggle
  gridViewBtn.addEventListener("click", () => setViewMode("grid"));
  listViewBtn.addEventListener("click", () => setViewMode("list"));

  // Global keyboard
  document.addEventListener("keydown", handleKeyDown);

  // Tab grid click events (event delegation)
  tabGrid.addEventListener("click", handleGridClick);

  // Close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      window.close();
    }
  });

  // Allow background command (Alt+Q) to cycle selection when this popup
  // window is already open (protected-page fallback).
  if (chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
      if (request?.action === "switcherPopupCycleNext") {
        selectNext();
        updateSelection();
        sendResponse?.({ success: true });
        return true;
      }
      return false;
    });
  }
}

function handleSearch(e?: Event) {
  const rawQuery = searchInput.value;
  searchQuery = rawQuery.toLowerCase().trim();

  // Hide tab hint when typing, in recent mode, or in web search mode
  const shouldHideHint =
    searchQuery.length > 0 || currentMode === "recent" || webSearchActive;
  tabHint.classList.toggle("hidden", shouldHideHint);

  // Check for "." toggle (only when typed, not when deleting)
  const isDeleteBackward =
    e instanceof InputEvent && e.inputType === "deleteContentBackward";
  if (rawQuery === "." && !isDeleteBackward) {
    searchInput.value = "";
    searchQuery = "";
    if (currentMode === "recent") {
      switchToActive();
    } else {
      switchToRecent();
    }
    return;
  }

  // Web Search Mode (activated via Tab key)
  if (currentMode !== "recent" && webSearchActive) {
    const webSearchTab: Tab = {
      id: -1,
      title: searchQuery
        ? `Search Web for "${searchQuery}"`
        : "Type to search web...",
      url: searchQuery
        ? `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`
        : "",
      favIconUrl: "https://www.google.com/favicon.ico",
      screenshot: null,
      pinned: false,
      index: 0,
      active: false,
      isWebSearch: true,
      searchQuery: searchQuery,
    };
    filteredTabs = [webSearchTab];
    selectedIndex = 0;
    sectionTitle.textContent = "Web Search";
    tabGrid.classList.add("search-mode");
    tabGrid.classList.remove("recent-mode");
    container.classList.add("shrink-mode");
    renderTabs();
    updateSelection();
    return;
  }

  // Remove search-mode class when not in web search
  tabGrid.classList.remove("search-mode");
  container.classList.remove("shrink-mode");

  // Update section title based on current mode
  sectionTitle.textContent =
    currentMode === "recent" ? "Recently Closed" : "Opened Tabs";

  if (searchQuery) {
    filteredTabs = tabs.filter(
      (tab) =>
        tab.title.toLowerCase().includes(searchQuery) ||
        (tab.url && tab.url.toLowerCase().includes(searchQuery))
    );
    sectionTitle.textContent = `Results (${filteredTabs.length})`;
    tabGrid.classList.add("search-mode");
  } else {
    filteredTabs = [...tabs];
    sectionTitle.textContent =
      currentMode === "recent" ? "Recently Closed" : "Opened Tabs";
    tabGrid.classList.remove("search-mode");
  }

  selectedIndex = 0;
  renderTabs();
  updateSelection();
}

function handleSearchKeydown(e: KeyboardEvent) {
  // Handle Alt+Q to cycle through tabs (even when in search box)
  if ((e.key === "q" || e.key === "Q") && e.altKey) {
    e.preventDefault();
    e.stopPropagation();
    selectNext();
    return;
  }

  if (e.key === "Tab" && !e.shiftKey) {
    e.preventDefault();
    e.stopPropagation();

    const query = searchInput.value.trim();

    if (currentMode === "recent") {
      // In recent mode, Tab just navigates
      selectNext();
    } else if (query.length === 0) {
      // Empty search: toggle web search mode on/off
      webSearchActive = !webSearchActive;
      handleSearch();
      updateHelpText();
      searchInput.focus();
    } else if (webSearchActive && query) {
      // In web search mode with text: perform the search
      const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(
        query
      )}`;
      chrome.tabs.create({ url: googleUrl });
      window.close();
    } else {
      // Normal mode with text: search Google directly
      const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(
        query
      )}`;
      chrome.tabs.create({ url: googleUrl });
      window.close();
    }
  }
}

function handleKeyDown(e: KeyboardEvent) {
  // Handle Alt+Q to cycle through tabs (matches normal switcher behavior)
  if ((e.key === "q" || e.key === "Q") && e.altKey) {
    e.preventDefault();
    e.stopPropagation();
    // Cycle to next tab like Alt+Tab
    selectNext();
    return;
  }

  // Handle Tab key globally for web search mode toggle / Google search
  if (e.key === "Tab" && !e.shiftKey) {
    e.preventDefault();
    e.stopPropagation();

    const query = searchInput.value.trim();

    if (currentMode === "recent") {
      // In recent mode, Tab just navigates
      selectNext();
    } else if (query.length === 0) {
      // Empty search: toggle web search mode on/off
      webSearchActive = !webSearchActive;
      handleSearch();
      updateHelpText();
      searchInput.focus();
    } else {
      // Has text: search Google directly
      const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(
        query
      )}`;
      chrome.tabs.create({ url: googleUrl });
      window.close();
    }
    return;
  }

  // Handle Shift+Tab for reverse navigation
  if (e.key === "Tab" && e.shiftKey) {
    e.preventDefault();
    e.stopPropagation();
    selectPrevious();
    return;
  }

  // Backspace handling for exiting modes
  if (e.key === "Backspace" && searchInput.value === "") {
    if (webSearchActive) {
      // Exit web search mode
      webSearchActive = false;
      handleSearch();
      updateHelpText();
      return;
    }
    if (currentMode === "recent") {
      // Exit recent mode
      switchToActive();
      return;
    }
  }

  // Don't intercept if typing in search (except special keys)
  if (
    document.activeElement === searchInput &&
    ![
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Enter",
      "Escape",
      "Delete",
    ].includes(e.key)
  ) {
    return;
  }

  switch (e.key) {
    case "ArrowUp":
      e.preventDefault();
      selectPrevious();
      break;
    case "ArrowDown":
      e.preventDefault();
      selectNext();
      break;
    case "ArrowLeft":
      e.preventDefault();
      if (
        viewMode === "grid" &&
        !searchQuery &&
        !webSearchActive &&
        currentMode !== "recent"
      ) {
        selectLeft();
      } else {
        selectPrevious();
      }
      break;
    case "ArrowRight":
      e.preventDefault();
      if (
        viewMode === "grid" &&
        !searchQuery &&
        !webSearchActive &&
        currentMode !== "recent"
      ) {
        selectRight();
      } else {
        selectNext();
      }
      break;
    case "Enter":
      e.preventDefault();
      switchToSelected();
      break;
    case "Delete":
      if (
        currentMode !== "recent" &&
        (document.activeElement !== searchInput || searchInput.value === "")
      ) {
        e.preventDefault();
        closeSelectedTab();
      }
      break;
  }
}

function handleGridClick(e: Event) {
  const target = e.target as HTMLElement;
  const card = target.closest(".tab-card") as HTMLElement | null;

  if (!card) return;

  // Check if it's a web search card
  if (card.classList.contains("web-search-card")) {
    const query = searchInput.value.trim();
    if (query) {
      const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(
        query
      )}`;
      chrome.tabs.create({ url: googleUrl });
      window.close();
    }
    return;
  }

  // Check if it's a recent item (has sessionId)
  const sessionId = card.dataset.sessionId;
  if (sessionId) {
    e.stopPropagation();
    restoreSession(sessionId);
    return;
  }

  const tabId = parseInt(card.dataset.tabId || "0", 10);
  if (!tabId) return;

  // Check if close button was clicked
  if (target.closest(".tab-close-btn")) {
    e.stopPropagation();
    closeTab(tabId);
    return;
  }

  // Switch to tab
  switchToTab(tabId);
}

// ============================================================================
// NAVIGATION & ACTIONS
// ============================================================================

function selectNext() {
  if (filteredTabs.length === 0) return;

  if (viewMode === "grid" && !searchQuery) {
    // Grid navigation (move right, wrap to next row)
    const cols = getGridColumns();
    const nextIndex = selectedIndex + 1;
    selectedIndex = nextIndex >= filteredTabs.length ? 0 : nextIndex;
  } else {
    // List navigation
    selectedIndex = (selectedIndex + 1) % filteredTabs.length;
  }

  updateSelection();
}

function selectPrevious() {
  if (filteredTabs.length === 0) return;

  if (viewMode === "grid" && !searchQuery) {
    const prevIndex = selectedIndex - 1;
    selectedIndex = prevIndex < 0 ? filteredTabs.length - 1 : prevIndex;
  } else {
    selectedIndex =
      selectedIndex <= 0 ? filteredTabs.length - 1 : selectedIndex - 1;
  }

  updateSelection();
}

function selectLeft() {
  if (filteredTabs.length === 0) return;
  const prevIndex = selectedIndex - 1;
  selectedIndex = prevIndex < 0 ? filteredTabs.length - 1 : prevIndex;
  updateSelection();
}

function selectRight() {
  if (filteredTabs.length === 0) return;
  const nextIndex = selectedIndex + 1;
  selectedIndex = nextIndex >= filteredTabs.length ? 0 : nextIndex;
  updateSelection();
}

function getGridColumns(): number {
  // Estimate columns based on container width and card min-width
  const containerWidth = tabGrid.clientWidth - 24; // Account for padding
  const minCardWidth = 200;
  return Math.max(1, Math.floor(containerWidth / (minCardWidth + 10)));
}

function switchToSelected() {
  if (filteredTabs.length === 0) return;
  const tab = filteredTabs[selectedIndex];
  if (!tab) return;

  // Handle web search card
  if (tab.isWebSearch) {
    if (tab.searchQuery && tab.url) {
      chrome.tabs.create({ url: tab.url });
      window.close();
    }
    return;
  }

  // Handle recent item (has sessionId)
  if (tab.sessionId) {
    restoreSession(tab.sessionId);
    return;
  }

  // Regular tab switch
  if (tab.id > 0) {
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
    console.error("[SWITCHER POPUP] Failed to switch tab:", e);
  }
}

// ============================================================================
// MODE SWITCHING
// ============================================================================

function switchToActive() {
  if (currentMode === "active") return;

  currentMode = "active";
  webSearchActive = false;
  tabs = [...activeTabs];
  filteredTabs = [...tabs];
  selectedIndex = 0;

  tabGrid.classList.remove("recent-mode");
  tabGrid.classList.remove("search-mode");
  container.classList.remove("shrink-mode");
  sectionTitle.textContent = "Opened Tabs";

  searchInput.value = "";
  searchQuery = "";
  tabHint.classList.remove("hidden");

  renderTabs();
  updateSelection();
  updateHelpText();
  searchInput.focus();
}

async function switchToRecent() {
  if (currentMode === "recent") return;

  currentMode = "recent";
  webSearchActive = false;

  try {
    const response = await chrome.runtime.sendMessage({
      action: "getRecentlyClosed",
      maxResults: 10,
    });

    if (response?.success && response.items) {
      const recentItems: Tab[] = response.items.map(
        (item: any, idx: number) => ({
          id: -1, // Recent items don't have tab IDs
          title: item.title || "Untitled",
          url: item.url || "",
          favIconUrl: item.favIconUrl || "",
          screenshot: null,
          pinned: false,
          index: idx,
          active: false,
          sessionId: item.sessionId,
        })
      );

      tabs = recentItems;
      filteredTabs = [...tabs];
    } else {
      tabs = [];
      filteredTabs = [];
    }
  } catch (e) {
    console.error("[SWITCHER POPUP] Failed to load recently closed:", e);
    tabs = [];
    filteredTabs = [];
  }

  selectedIndex = 0;
  tabGrid.classList.add("recent-mode");
  tabGrid.classList.remove("search-mode");
  sectionTitle.textContent = "Recently Closed";

  searchInput.value = "";
  searchQuery = "";
  tabHint.classList.add("hidden");

  renderTabs();
  updateSelection();
  updateHelpText();
  searchInput.focus();
}

async function restoreSession(sessionId: string) {
  try {
    await chrome.runtime.sendMessage({
      action: "restoreSession",
      sessionId: sessionId,
    });
    window.close();
  } catch (e) {
    console.error("[SWITCHER POPUP] Failed to restore session:", e);
  }
}

function updateHelpText() {
  if (!helpText) return;

  if (currentMode === "recent") {
    helpText.innerHTML = `
      <span><kbd>↑↓</kbd> Navigate</span>
      <span><kbd>↵</kbd>Restore</span>
      <span><kbd>.</kbd> <kbd>Backspace</kbd> Active Tabs</span>
      <span><kbd>Esc</kbd>Exit</span>
    `;
  } else if (webSearchActive) {
    helpText.innerHTML = `
      <span><kbd>Tab</kbd>Exit Search Mode</span>
      <span><kbd>↵</kbd>Search Google</span>
      <span><kbd>Backspace</kbd>Exit</span>
      <span><kbd>Esc</kbd>Exit</span>
    `;
  } else {
    helpText.innerHTML = `
      <span><kbd>Alt+Q</kbd> <kbd>↑↓</kbd> Navigate</span>
      <span><kbd>↵</kbd>Switch</span>
      <span><kbd>Del</kbd>Close</span>
      <span><kbd>.</kbd>Recent</span>
      <span><kbd>Tab</kbd>Web Search</span>
      <span><kbd>Esc</kbd>Exit</span>
    `;
  }
}

async function closeTab(tabId: number) {
  try {
    await chrome.tabs.remove(tabId);

    // Remove from lists
    tabs = tabs.filter((t) => t.id !== tabId);
    filteredTabs = filteredTabs.filter((t) => t.id !== tabId);

    // Adjust selection
    if (selectedIndex >= filteredTabs.length) {
      selectedIndex = Math.max(0, filteredTabs.length - 1);
    }

    renderTabs();
    updateSelection();

    // Close window if no tabs left
    if (filteredTabs.length === 0) {
      window.close();
    }
  } catch (e) {
    console.error("[SWITCHER POPUP] Failed to close tab:", e);
  }
}

function closeSelectedTab() {
  if (filteredTabs.length === 0) return;
  const tab = filteredTabs[selectedIndex];
  if (tab) {
    closeTab(tab.id);
  }
}

function setViewMode(mode: "grid" | "list") {
  viewMode = mode;

  gridViewBtn.classList.toggle("active", mode === "grid");
  listViewBtn.classList.toggle("active", mode === "list");

  tabGrid.classList.toggle("list-view", mode === "list");

  // Save preference
  try {
    chrome.storage.local.set({ tabSwitcherViewMode: mode });
  } catch (e) {
    // Ignore
  }

  updateSelection();
}

function updateSelection() {
  // Remove old selection
  tabGrid.querySelectorAll(".tab-card.selected").forEach((el) => {
    el.classList.remove("selected");
  });

  // Add new selection
  const cards = tabGrid.querySelectorAll(".tab-card");
  if (cards[selectedIndex]) {
    cards[selectedIndex].classList.add("selected");
    cards[selectedIndex].scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }
}

// ============================================================================
// RENDERING
// ============================================================================

function renderTabs() {
  tabGrid.innerHTML = "";
  tabGrid.classList.toggle("list-view", viewMode === "list");

  if (filteredTabs.length === 0) {
    const emptyMessage =
      currentMode === "recent"
        ? "No recently closed tabs"
        : webSearchActive
        ? "Type to search the web..."
        : "No tabs found";

    tabGrid.innerHTML = `
      <div class="tab-switcher-empty">
        <div class="empty-icon">${
          currentMode === "recent" ? "📋" : webSearchActive ? "🌐" : "🔍"
        }</div>
        <div>${emptyMessage}</div>
      </div>
    `;
    return;
  }

  filteredTabs.forEach((tab, index) => {
    const card = createTabCard(tab, index);
    tabGrid.appendChild(card);
  });
}

function createTabCard(tab: Tab, index: number): HTMLElement {
  const card = document.createElement("div");

  // Handle web search card
  if (tab.isWebSearch) {
    card.className = "tab-card web-search-card";
    card.dataset.index = String(index);

    const thumbnail = document.createElement("div");
    thumbnail.className = "tab-thumbnail";

    const faviconTile = document.createElement("div");
    faviconTile.className = "favicon-tile";
    const googleIcon = document.createElement("img");
    googleIcon.className = "favicon-large";
    googleIcon.src = "https://www.google.com/favicon.ico";
    googleIcon.alt = "Google";
    googleIcon.onerror = () => {
      faviconTile.innerHTML = `<div class="favicon-letter">G</div>`;
    };
    faviconTile.appendChild(googleIcon);
    thumbnail.appendChild(faviconTile);
    card.appendChild(thumbnail);

    const info = document.createElement("div");
    info.className = "tab-info";

    const titleRow = document.createElement("div");
    titleRow.className = "tab-title-row";

    const favicon = document.createElement("img");
    favicon.className = "tab-favicon";
    favicon.src = "https://www.google.com/favicon.ico";
    favicon.alt = "";
    titleRow.appendChild(favicon);

    const title = document.createElement("span");
    title.className = "tab-title";
    title.textContent = tab.title;
    titleRow.appendChild(title);

    info.appendChild(titleRow);

    const url = document.createElement("div");
    url.className = "tab-url";
    url.textContent = tab.searchQuery
      ? "Press Enter to search Google"
      : "Type your search query...";
    info.appendChild(url);

    card.appendChild(info);
    return card;
  }

  // Handle recent item (has sessionId)
  if (tab.sessionId) {
    card.className = "tab-card recent-item";
    card.dataset.sessionId = tab.sessionId;
    card.dataset.index = String(index);

    const thumbnail = document.createElement("div");
    thumbnail.className = "tab-thumbnail";

    if (tab.favIconUrl) {
      const faviconTile = document.createElement("div");
      faviconTile.className = "favicon-tile";
      const favicon = document.createElement("img");
      favicon.className = "favicon-large";
      favicon.src = tab.favIconUrl;
      favicon.alt = "";
      favicon.onerror = () => {
        faviconTile.innerHTML = `<div class="favicon-letter">${getFirstLetter(
          tab.title
        )}</div>`;
      };
      faviconTile.appendChild(favicon);
      thumbnail.appendChild(faviconTile);
    } else {
      thumbnail.innerHTML = `<div class="favicon-tile"><div class="favicon-letter">${getFirstLetter(
        tab.title
      )}</div></div>`;
    }

    card.appendChild(thumbnail);

    const info = document.createElement("div");
    info.className = "tab-info";

    const titleRow = document.createElement("div");
    titleRow.className = "tab-title-row";

    if (tab.favIconUrl) {
      const favicon = document.createElement("img");
      favicon.className = "tab-favicon";
      favicon.src = tab.favIconUrl;
      favicon.alt = "";
      favicon.onerror = () => favicon.remove();
      titleRow.appendChild(favicon);
    }

    const title = document.createElement("span");
    title.className = "tab-title";
    title.textContent = tab.title || "Untitled";
    title.title = tab.title || "Untitled";
    titleRow.appendChild(title);

    info.appendChild(titleRow);

    const url = document.createElement("div");
    url.className = "tab-url";
    url.textContent = formatUrl(tab.url);
    url.title = tab.url || "";
    info.appendChild(url);

    card.appendChild(info);

    // Restore icon instead of close button for recent items
    const restoreBtn = document.createElement("button");
    restoreBtn.className = "tab-close-btn restore-btn";
    restoreBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
    </svg>`;
    restoreBtn.title = "Restore tab";
    card.appendChild(restoreBtn);

    return card;
  }

  // Regular tab card
  card.className = `tab-card${tab.pinned ? " pinned" : ""}${
    tab.active ? " active-tab" : ""
  }`;
  card.dataset.tabId = String(tab.id);
  card.dataset.index = String(index);

  // Find group info
  const group =
    tab.groupId && tab.groupId !== -1
      ? groups.find((g) => g.id === tab.groupId)
      : null;
  if (group) {
    card.dataset.groupId = String(group.id);
    card.style.setProperty("--group-color", getGroupColorValue(group.color));
  }

  // Thumbnail
  const thumbnail = document.createElement("div");
  thumbnail.className = "tab-thumbnail";

  if (tab.screenshot) {
    const img = document.createElement("img");
    img.className = "screenshot-img";
    img.src = tab.screenshot;
    img.alt = "";
    img.loading = "lazy";
    thumbnail.appendChild(img);
  } else {
    const faviconTile = document.createElement("div");
    faviconTile.className = "favicon-tile";

    if (tab.favIconUrl && !tab.favIconUrl.startsWith("chrome://")) {
      const favicon = document.createElement("img");
      favicon.className = "favicon-large";
      favicon.src = tab.favIconUrl;
      favicon.alt = "";
      favicon.onerror = () => {
        faviconTile.innerHTML = `<div class="favicon-letter">${getFirstLetter(
          tab.title
        )}</div>`;
      };
      faviconTile.appendChild(favicon);
    } else {
      faviconTile.innerHTML = `<div class="favicon-letter">${getFirstLetter(
        tab.title
      )}</div>`;
    }

    thumbnail.appendChild(faviconTile);
  }

  card.appendChild(thumbnail);

  // Tab Info
  const info = document.createElement("div");
  info.className = "tab-info";

  const titleRow = document.createElement("div");
  titleRow.className = "tab-title-row";

  if (tab.favIconUrl && !tab.favIconUrl.startsWith("chrome://")) {
    const favicon = document.createElement("img");
    favicon.className = "tab-favicon";
    favicon.src = tab.favIconUrl;
    favicon.alt = "";
    favicon.onerror = () => favicon.remove();
    titleRow.appendChild(favicon);
  }

  const title = document.createElement("span");
  title.className = "tab-title";
  title.textContent = tab.title || "Untitled";
  title.title = tab.title || "Untitled";
  titleRow.appendChild(title);

  info.appendChild(titleRow);

  const url = document.createElement("div");
  url.className = "tab-url";
  url.textContent = formatUrl(tab.url);
  url.title = tab.url || "";
  info.appendChild(url);

  card.appendChild(info);

  // Close button
  const closeBtn = document.createElement("button");
  closeBtn.className = "tab-close-btn";
  closeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>`;
  closeBtn.title = "Close tab";
  card.appendChild(closeBtn);

  // Audio indicator
  if (tab.audible && !tab.mutedInfo?.muted) {
    const audioIndicator = document.createElement("div");
    audioIndicator.className = "tab-audio-indicator";
    audioIndicator.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
    card.appendChild(audioIndicator);
  } else if (tab.mutedInfo?.muted) {
    const audioIndicator = document.createElement("div");
    audioIndicator.className = "tab-audio-indicator muted";
    audioIndicator.innerHTML = `<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`;
    card.appendChild(audioIndicator);
  }

  return card;
}

function getFirstLetter(title: string): string {
  const cleaned = title.replace(/[^a-zA-Z0-9]/g, "");
  return (cleaned[0] || "T").toUpperCase();
}

function formatUrl(url?: string): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 50);
  }
}

function getGroupColorValue(color: string): string {
  const colorMap: Record<string, string> = {
    grey: "#5f6368",
    blue: "#1a73e8",
    red: "#d93025",
    yellow: "#f9ab00",
    green: "#1e8e3e",
    pink: "#d01884",
    purple: "#9334e6",
    cyan: "#007b83",
    orange: "#e8710a",
  };
  return colorMap[color] || colorMap.grey;
}

// ============================================================================
// START
// ============================================================================

document.addEventListener("DOMContentLoaded", initialize);
