// Content script for Visual Tab Switcher overlay
// ============================================================================
// PERFORMANCE-OPTIMIZED IMPLEMENTATION
// Virtual scrolling, event delegation, GPU acceleration, throttling
// Target: <16ms interactions, 60fps animations, <50MB memory
// ============================================================================

(function () {
  "use strict";

  const SHADOW_HOST_ID = "tab-switcher-host";
  const SHADOW_CSS = `/* Visual Tab Switcher Overlay Styles */
/* Modern, Minimalist, Solid Design */

:host {
  --bg-overlay: rgba(0, 0, 0, 0.85); /* Darker, less transparent backdrop */
  --bg-surface: #1a1a1a; /* Solid background */
  --border-subtle: #333333;
  --text-primary: #ffffff;
  --text-secondary: #a0a0a0;
  --accent: #3b82f6;
  --accent-hover: #2563eb;
  --card-bg: #262626;
  --card-hover: #303030;
  --radius-lg: 12px;
  --radius-md: 8px;
  --shadow-lg: 0 20px 40px rgba(0, 0, 0, 0.6);
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

@media (prefers-color-scheme: light) {
  :host {
    --bg-overlay: rgba(255, 255, 255, 0.8);
    --bg-surface: #ffffff;
    --border-subtle: #e5e7eb;
    --text-primary: #111827;
    --text-secondary: #6b7280;
    --card-bg: #f3f4f6;
    --card-hover: #e5e7eb;
    --shadow-lg: 0 20px 40px rgba(0, 0, 0, 0.1);
  }
}

.tab-switcher-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: none;
  align-items: center;
  justify-content: center;
  font-family: var(--font-family);
  animation: fadeIn 0.15s ease-out;
}

.tab-switcher-backdrop {
  position: absolute;
  inset: 0;
  background: var(--bg-overlay);
  backdrop-filter: blur(4px); /* Reduced blur, more solid feel */
  -webkit-backdrop-filter: blur(4px);
}

.tab-switcher-container {
  position: relative;
  width: 800px;
  max-width: 90vw;
  max-height: 85vh;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  padding: 20px;
  overflow: hidden;
  animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Search Header */
.tab-switcher-search-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.tab-switcher-search-wrap {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}

.tab-switcher-search {
  width: 100%;
  background: var(--card-bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 12px 16px;
  padding-left: 44px;
  font-size: 15px;
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.2s, background-color 0.2s;
}

.tab-switcher-search:focus {
  background: var(--bg-surface);
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.tab-switcher-search::placeholder {
  color: var(--text-secondary);
}

.search-icon {
  position: absolute;
  left: 14px;
  color: var(--text-secondary);
  pointer-events: none;
  display: flex;
  align-items: center;
}

/* Buttons */
.recently-closed-btn {
  background: transparent;
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  padding: 12px 16px;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  height: 44px; /* Match search input height */
  display: flex;
  align-items: center;
}

.recently-closed-btn:hover {
  border-color: var(--text-secondary);
  color: var(--text-primary);
  background: var(--card-bg);
}

.recent-back-btn {
  position: absolute;
  left: 8px;
  z-index: 10;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: var(--card-hover);
  color: var(--text-primary);
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
}

.recent-back-btn:hover {
  background: var(--accent);
  color: white;
}

/* Grid */
.tab-switcher-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  overflow-y: auto;
  padding-right: 4px; /* Space for scrollbar */
  min-height: 200px;
}

.tab-switcher-grid::-webkit-scrollbar {
  width: 8px;
}

.tab-switcher-grid::-webkit-scrollbar-track {
  background: transparent;
}

.tab-switcher-grid::-webkit-scrollbar-thumb {
  background: var(--border-subtle);
  border-radius: 4px;
}

.tab-switcher-grid::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}

/* Tab Card */
.tab-card {
  background: var(--card-bg);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.1s ease, border-color 0.1s ease;
  position: relative;
  display: flex;
  flex-direction: column;
  height: 160px;
}

.tab-card:hover {
  transform: translateY(-2px);
  border-color: var(--border-subtle);
  background: var(--card-hover);
}

.tab-card.selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
  background: var(--card-hover);
}

/* Thumbnail Area */
.tab-thumbnail {
  flex: 1;
  background: #000;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.screenshot-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
  opacity: 0.9;
  transition: opacity 0.2s;
}

.tab-card:hover .screenshot-img {
  opacity: 1;
}

/* Favicon Tile (Fallback) */
.favicon-tile {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--card-bg);
}

.favicon-large {
  width: 40px;
  height: 40px;
  object-fit: contain;
}

.favicon-letter {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--accent);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 600;
}

/* Tab Info */
.tab-info {
  padding: 10px 12px;
  background: var(--card-bg);
  border-top: 1px solid var(--border-subtle);
}

.tab-card:hover .tab-info {
  background: var(--card-hover);
}

.tab-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.tab-favicon {
  width: 14px;
  height: 14px;
  opacity: 0.8;
}

.tab-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.tab-url {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-left: 22px; /* Align with title text */
}

/* Close Button */
.tab-close-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  opacity: 0;
  transition: all 0.1s;
  cursor: pointer;
}

.tab-card:hover .tab-close-btn {
  opacity: 1;
}

.tab-close-btn:hover {
  background: #ef4444;
}

/* Footer/Help */
.tab-switcher-help {
  display: flex;
  gap: 16px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  font-size: 12px;
  justify-content: center;
}

kbd {
  background: var(--card-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  padding: 2px 6px;
  font-family: monospace;
  margin-right: 4px;
  color: var(--text-primary);
  box-shadow: 0 1px 0 var(--border-subtle);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.98); }
  to { opacity: 1; transform: scale(1); }
}
`;

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  const state = {
    overlay: null,
    currentTabs: [],
    activeTabs: [],
    filteredTabs: [],
    selectedIndex: 0,
    isOverlayVisible: false,
    viewMode: "active",
    recentItems: [],
    host: null,
    shadowRoot: null,
    styleElement: null,

    // DOM cache
    domCache: {
      grid: null,
      searchBox: null,
      container: null,
      searchWrap: null,
      backBtn: null,
      recentBtn: null,
    },

    // Virtual scrolling
    virtualScroll: {
      startIndex: 0,
      endIndex: 0,
      visibleCount: 20, // Render 20 tabs at a time
      bufferCount: 5, // Buffer above/below viewport
    },

    // Performance
    lastKeyTime: 0,
    keyThrottleMs: 16, // ~60fps
    resizeObserver: null,
    intersectionObserver: null,
  };

  // WeakMap for tab metadata (automatic garbage collection)
  const tabMetadata = new WeakMap();

  // ============================================================================
  // MESSAGE LISTENER
  // ============================================================================
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "showTabSwitcher") {
      // If overlay already visible, treat repeated Alt+Q as cycle-next
      if (state.isOverlayVisible) {
        selectNext();
        // Ensure only one selection is highlighted
        enforceSingleSelection(true);
        sendResponse?.({ success: true, advanced: true });
        return true;
      }
      showTabSwitcher(request.tabs, request.activeTabId);
      sendResponse?.({ success: true });
    }
    return true;
  });

  // ============================================================================
  // OVERLAY CREATION
  // ============================================================================
  function ensureShadowRoot() {
    try {
      if (!state.host) {
        const existingHost = document.getElementById(SHADOW_HOST_ID);
        if (existingHost) {
          state.host = existingHost;
        } else {
          const host = document.createElement("div");
          host.id = SHADOW_HOST_ID;
          document.body.appendChild(host);
          state.host = host;
        }
      }
      if (!state.shadowRoot) {
        if (state.host.shadowRoot) {
          state.shadowRoot = state.host.shadowRoot;
        } else {
          state.shadowRoot = state.host.attachShadow({ mode: "open" });
        }
      }
      if (
        !state.styleElement ||
        !state.shadowRoot.contains(state.styleElement)
      ) {
        const style = document.createElement("style");
        style.textContent = SHADOW_CSS;
        state.shadowRoot.appendChild(style);
        state.styleElement = style;
      }
      return state.shadowRoot;
    } catch (error) {
      console.error("[TAB SWITCHER] Failed to initialize shadow root:", error);
      return null;
    }
  }

  function createOverlay() {
    if (state.overlay) return;

    const shadowRoot = ensureShadowRoot();
    if (!shadowRoot) {
      return;
    }

    // Create overlay container
    const overlay = document.createElement("div");
    overlay.id = "visual-tab-switcher-overlay";
    overlay.className = "tab-switcher-overlay";
    overlay.style.willChange = "opacity"; // GPU hint

    // Create backdrop
    const backdrop = document.createElement("div");
    backdrop.className = "tab-switcher-backdrop";
    overlay.appendChild(backdrop);

    // Create main container
    const container = document.createElement("div");
    container.className = "tab-switcher-container";
    container.style.transform = "translate3d(0, 0, 0)"; // GPU acceleration

    // Search + actions row
    const searchRow = document.createElement("div");
    searchRow.className = "tab-switcher-search-row";

    // Search wrapper and box
    const searchWrap = document.createElement("div");
    searchWrap.className = "tab-switcher-search-wrap";

    const searchBox = document.createElement("input");
    searchBox.type = "text";
    searchBox.className = "tab-switcher-search";
    searchBox.placeholder = "Search tabs by title or URL...";
    searchBox.autocomplete = "off";

    // Back button (shown only in recent mode)
    const backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.className = "recent-back-btn";
    backBtn.title = "Back to Active Tabs";
    backBtn.textContent = "←";
    backBtn.addEventListener("click", () => switchToActive());

    // Recently closed button (UI)
    const recentBtn = document.createElement("button");
    recentBtn.className = "recently-closed-btn";
    recentBtn.type = "button";
    recentBtn.textContent = "Recently closed tabs";
    recentBtn.addEventListener("click", () => switchToRecent());
    const searchIcon = document.createElement("div");
    searchIcon.className = "search-icon";
    searchIcon.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';

    searchWrap.appendChild(backBtn);
    searchWrap.appendChild(searchIcon);
    searchWrap.appendChild(searchBox);
    searchRow.appendChild(searchWrap);
    searchRow.appendChild(recentBtn);
    container.appendChild(searchRow);

    // Grid container with virtual scrolling support
    const grid = document.createElement("div");
    grid.className = "tab-switcher-grid";
    grid.id = "tab-switcher-grid";
    grid.style.transform = "translate3d(0, 0, 0)"; // GPU acceleration
    container.appendChild(grid);

    // Help text
    const helpText = document.createElement("div");
    helpText.className = "tab-switcher-help";
    helpText.innerHTML = `
       <span><kbd>Alt+Q</kbd> Navigate</span>
       <span><kbd>Enter</kbd> Switch</span>
       <span><kbd>Delete</kbd> Close</span>
       <span><kbd>.</kbd> Recent Tabs</span>
       <span><kbd>Esc</kbd> Exit</span>
     `;
    container.appendChild(helpText);

    overlay.appendChild(container);

    // Event listeners with improved debounce/throttle strategy
    // Use different strategies for small vs large tab sets
    searchBox.addEventListener("input", createSmartSearchHandler());
    searchBox.addEventListener("keydown", handleSearchKeydown);
    backdrop.addEventListener("click", closeOverlay);

    // Event delegation for tab clicks (single listener)
    grid.addEventListener("click", handleGridClick);

    // Cache DOM references
    state.overlay = overlay;
    state.domCache = {
      grid,
      searchBox,
      container,
      searchWrap,
      backBtn,
      recentBtn,
      helpText,
    };

    shadowRoot.appendChild(overlay);

    console.log(
      "[PERF] Overlay created with GPU acceleration and event delegation"
    );
  }

  // ============================================================================
  // SHOW TAB SWITCHER
  // ============================================================================
  function showTabSwitcher(tabs, activeTabId) {
    const startTime = performance.now();

    console.log(`[TAB SWITCHER] Opening with ${tabs.length} tabs`);

    if (state.isOverlayVisible) return;

    createOverlay();
    state.activeTabs = tabs;
    state.currentTabs = tabs;
    state.filteredTabs = tabs;
    setViewMode("active");

    // Find active tab index
    state.selectedIndex = tabs.findIndex((tab) => tab.id === activeTabId);
    if (state.selectedIndex === -1) state.selectedIndex = 0;

    // Determine rendering strategy based on tab count
    if (tabs.length > 50) {
      console.log("[PERF] Using virtual scrolling for", tabs.length, "tabs");
      renderTabsVirtual(tabs);
    } else {
      renderTabsStandard(tabs);
    }

    // Show overlay with GPU-accelerated fade-in
    requestAnimationFrame(() => {
      state.overlay.style.display = "flex";
      state.overlay.style.opacity = "0";

      requestAnimationFrame(() => {
        state.overlay.style.opacity = "1";
        state.isOverlayVisible = true;

        // Focus search box AFTER overlay is visible (critical for auto-focus)
        setTimeout(() => {
          state.domCache.searchBox.value = "";
          state.domCache.searchBox.focus();
        }, 50); // Small delay ensures overlay is fully rendered
      });
    });

    // Add keyboard listeners
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);

    // Aggressive Focus Enforcement: Prevent page from stealing focus or receiving keys
    document.addEventListener("focus", handleGlobalFocus, true);
    document.addEventListener("keydown", handleGlobalKeydown, true);
    document.addEventListener("keypress", handleGlobalKeydown, true);
    document.addEventListener("keyup", handleGlobalKeydown, true);

    const duration = performance.now() - startTime;
    console.log(
      `[PERF] Overlay rendered in ${duration.toFixed(
        2
      )}ms (Target: <16ms for 60fps)`
    );
  }

  // ============================================================================
  // VIEW MODES: ACTIVE TABS vs RECENTLY CLOSED
  // ============================================================================
  function setViewMode(mode) {
    state.viewMode = mode;
    if (state.domCache?.backBtn) {
      state.domCache.backBtn.style.display =
        mode === "recent" ? "flex" : "none";
    }
    if (state.domCache?.recentBtn) {
      state.domCache.recentBtn.style.display =
        mode === "recent" ? "none" : "inline-flex";
    }
    if (state.domCache?.searchBox) {
      state.domCache.searchBox.placeholder =
        mode === "recent"
          ? "Search recently closed tabs..."
          : "Search tabs by title or URL...";
    }

    // Update help text based on mode
    if (state.domCache?.helpText) {
      if (mode === "recent") {
        state.domCache.helpText.innerHTML = `
          <span><kbd>Alt+Q</kbd> Navigate</span>
          <span><kbd>Enter</kbd> Restore</span>
          <span><kbd>Backspace</kbd> Active Tabs</span>
          <span><kbd>Esc</kbd> Exit</span>
        `;
      } else {
        state.domCache.helpText.innerHTML = `
          <span><kbd>Alt+Q</kbd> Navigate</span>
          <span><kbd>Enter</kbd> Switch</span>
          <span><kbd>Delete</kbd> Close</span>
          <span><kbd>.</kbd> Recent Tabs</span>
          <span><kbd>Esc</kbd> Exit</span>
        `;
      }
    }
  }

  async function switchToRecent() {
    if (state.viewMode === "recent") return;
    setViewMode("recent");
    // Fetch recently closed list from background
    let items = [];
    try {
      items = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { action: "getRecentlyClosed", maxResults: 10 },
          (res) => {
            if (res && res.success) resolve(res.items || []);
            else resolve([]);
          }
        );
      });
    } catch (e) {
      console.error("[TAB SWITCHER] Failed to load recently closed:", e);
    }
    // Map to renderable items (no screenshots)
    state.recentItems = items.map((it, idx) => ({
      id: null,
      title: it.title,
      url: it.url,
      favIconUrl: it.favIconUrl,
      screenshot: null,
      sessionId: it.sessionId,
      index: idx,
    }));
    state.currentTabs = state.recentItems;
    state.filteredTabs = state.recentItems;
    state.selectedIndex = 0;
    renderTabsStandard(state.filteredTabs);
    // Refocus search
    state.domCache.searchBox.focus();
  }

  function switchToActive() {
    if (state.viewMode === "active") return;
    setViewMode("active");
    state.currentTabs = state.activeTabs || [];
    state.filteredTabs = state.currentTabs;
    state.selectedIndex = 0;
    if (state.filteredTabs.length > 50) {
      renderTabsVirtual(state.filteredTabs);
    } else {
      renderTabsStandard(state.filteredTabs);
    }
    state.domCache.searchBox.value = "";
    state.domCache.searchBox.focus();
  }

  // ============================================================================
  // RENDERING - STANDARD (< 50 tabs)
  // ============================================================================
  function renderTabsStandard(tabs) {
    const startTime = performance.now();
    const grid = state.domCache.grid;

    // Clear grid
    grid.innerHTML = "";

    if (tabs.length === 0) {
      const emptyMsg = document.createElement("div");
      emptyMsg.className = "tab-switcher-empty";
      emptyMsg.textContent = "No tabs found";
      grid.appendChild(emptyMsg);
      return;
    }

    // Use DocumentFragment for batched DOM updates
    const fragment = document.createDocumentFragment();

    tabs.forEach((tab, index) => {
      const tabCard = createTabCard(tab, index);
      tabCard.dataset.tabIndex = index;
      fragment.appendChild(tabCard);
    });

    // Single DOM update
    grid.appendChild(fragment);
    // After rendering, ensure only one card is selected in DOM
    enforceSingleSelection(false);

    const duration = performance.now() - startTime;
    console.log(
      `[PERF] Rendered ${tabs.length} tabs in ${duration.toFixed(2)}ms`
    );
  }

  // ============================================================================
  // RENDERING - VIRTUAL SCROLLING (50+ tabs)
  // ============================================================================
  function renderTabsVirtual(tabs) {
    const startTime = performance.now();
    const grid = state.domCache.grid;

    // Clear grid
    grid.innerHTML = "";

    if (tabs.length === 0) {
      const emptyMsg = document.createElement("div");
      emptyMsg.className = "tab-switcher-empty";
      emptyMsg.textContent = "No tabs found";
      grid.appendChild(emptyMsg);
      return;
    }

    // Calculate visible range
    const visibleCount = state.virtualScroll.visibleCount;
    const bufferCount = state.virtualScroll.bufferCount;
    const startIndex = Math.max(0, state.selectedIndex - bufferCount);
    const endIndex = Math.min(
      tabs.length,
      state.selectedIndex + visibleCount + bufferCount
    );

    state.virtualScroll.startIndex = startIndex;
    state.virtualScroll.endIndex = endIndex;

    // Create placeholder for scrolling
    const totalHeight = tabs.length * 180; // Approximate card height
    grid.style.minHeight = `${totalHeight}px`;

    // Render only visible tabs
    const fragment = document.createDocumentFragment();

    for (let i = startIndex; i < endIndex; i++) {
      const tab = tabs[i];
      const tabCard = createTabCard(tab, i);

      // Position absolutely for virtual scrolling
      tabCard.style.position = "relative";
      tabCard.style.top = `${i * 180}px`;

      fragment.appendChild(tabCard);
    }

    grid.appendChild(fragment);

    // Setup intersection observer for lazy loading
    setupIntersectionObserver();
    enforceSingleSelection(false);

    const duration = performance.now() - startTime;
    console.log(
      `[PERF] Virtual rendered ${endIndex - startIndex} of ${
        tabs.length
      } tabs in ${duration.toFixed(2)}ms`
    );
  }

  // ============================================================================
  // CREATE TAB CARD
  // ============================================================================
  function createTabCard(tab, index) {
    const tabCard = document.createElement("div");
    tabCard.className = "tab-card";
    if (tab && typeof tab.id === "number") {
      tabCard.dataset.tabId = tab.id;
    }
    if (tab && tab.sessionId) {
      tabCard.dataset.sessionId = tab.sessionId;
      tabCard.dataset.recent = "1";
    }
    tabCard.dataset.tabIndex = index;
    tabCard.setAttribute("role", "button");
    tabCard.tabIndex = 0; // Make card focusable for accessibility
    tabCard.style.transform = "translate3d(0, 0, 0)"; // GPU acceleration

    // Determine if we should show screenshot or favicon
    const hasValidScreenshot =
      tab.screenshot &&
      typeof tab.screenshot === "string" &&
      tab.screenshot.length > 0;

    // Add classes
    if (hasValidScreenshot) {
      tabCard.classList.add("has-screenshot");
    } else {
      tabCard.classList.add("has-favicon");
    }

    if (index === state.selectedIndex) {
      tabCard.classList.add("selected");
    }

    if (tab.pinned) {
      tabCard.classList.add("pinned");
    }

    // Thumbnail
    const thumbnail = document.createElement("div");
    thumbnail.className = "tab-thumbnail";

    if (tab.sessionId) {
      // Recent item: always show favicon tile (compact row)
      tabCard.classList.add("recent-item");
      const faviconTile = createFaviconTile(tab);
      thumbnail.appendChild(faviconTile);
    } else if (hasValidScreenshot) {
      // Show screenshot only if it's valid
      const img = document.createElement("img");
      img.className = "screenshot-img";
      img.dataset.src = tab.screenshot; // Lazy loading
      img.alt = tab.title;

      // Load immediately if in viewport, otherwise lazy load
      if (Math.abs(index - state.selectedIndex) < 10) {
        img.src = tab.screenshot;
      }

      thumbnail.appendChild(img);
    } else {
      // Show favicon tile for inactive tabs without screenshots
      const faviconTile = createFaviconTile(tab);
      thumbnail.appendChild(faviconTile);
    }

    tabCard.appendChild(thumbnail);

    // Info section
    const info = document.createElement("div");
    info.className = "tab-info";

    // Header with favicon and title
    const header = document.createElement("div");
    header.className = "tab-header";

    // Show favicon in header only if we have a screenshot (so it appears with URL)
    if (tab.favIconUrl && hasValidScreenshot) {
      const favicon = document.createElement("img");
      favicon.src = tab.favIconUrl;
      favicon.className = "tab-favicon";
      favicon.onerror = () => (favicon.style.display = "none");
      header.appendChild(favicon);
    }

    const title = document.createElement("div");
    title.className = "tab-title";
    title.textContent = tab.title;
    title.title = tab.title;
    header.appendChild(title);

    info.appendChild(header);

    // URL (only for screenshots)
    if (hasValidScreenshot) {
      const url = document.createElement("div");
      url.className = "tab-url";
      url.textContent = tab.url;
      url.title = tab.url;
      info.appendChild(url);
    }

    tabCard.appendChild(info);

    // Close button (only for active tabs view)
    if (!tab.sessionId) {
      const closeBtn = document.createElement("button");
      closeBtn.className = "tab-close-btn";
      closeBtn.innerHTML = "×";
      closeBtn.title = "Close tab";
      closeBtn.dataset.action = "close";
      if (tab.id) closeBtn.dataset.tabId = tab.id;
      tabCard.appendChild(closeBtn);
    }

    return tabCard;
  }

  // Create favicon tile
  function createFaviconTile(tab) {
    const faviconTile = document.createElement("div");
    faviconTile.className = "favicon-tile";

    if (tab.favIconUrl) {
      const favicon = document.createElement("img");
      favicon.src = tab.favIconUrl;
      favicon.className = "favicon-large";
      favicon.onerror = () => {
        favicon.style.display = "none";
        const letter = document.createElement("div");
        letter.className = "favicon-letter";
        letter.textContent = (tab.title || "T")[0].toUpperCase();
        faviconTile.appendChild(letter);
      };
      faviconTile.appendChild(favicon);
    } else {
      const letter = document.createElement("div");
      letter.className = "favicon-letter";
      letter.textContent = (tab.title || "T")[0].toUpperCase();
      faviconTile.appendChild(letter);
    }

    return faviconTile;
  }

  // ============================================================================
  // EVENT DELEGATION - GRID CLICKS
  // ============================================================================
  function handleGridClick(e) {
    try {
      const target = e.target;

      // Handle close button
      if (
        target.dataset.action === "close" ||
        target.classList.contains("tab-close-btn")
      ) {
        e.stopPropagation();
        const tabId = parseInt(
          target.dataset.tabId || target.parentElement.dataset.tabId
        );
        const index = parseInt(
          target.dataset.tabIndex || target.parentElement.dataset.tabIndex
        );

        if (tabId && !isNaN(tabId)) {
          closeTab(tabId, index);
        } else {
          console.error(
            "[TAB SWITCHER] Invalid tab ID in close button:",
            target
          );
        }
        return;
      }

      // Handle tab card click
      const tabCard = target.closest(".tab-card");
      if (tabCard) {
        if (state.viewMode === "recent" || tabCard.dataset.recent === "1") {
          const sessionId = tabCard.dataset.sessionId;
          if (sessionId) {
            restoreSession(sessionId);
          }
          return;
        }
        const tabId = parseInt(tabCard.dataset.tabId);
        if (tabId && !isNaN(tabId)) {
          switchToTab(tabId);
        } else {
          console.error("[TAB SWITCHER] Invalid tab ID in card:", tabCard);
        }
      }
    } catch (error) {
      console.error("[TAB SWITCHER] Error in handleGridClick:", error);
    }
  }

  // ============================================================================
  // KEYBOARD NAVIGATION (THROTTLED)
  // ============================================================================
  function handleKeyDown(e) {
    if (!state.isOverlayVisible) return;

    const isInSearchBox = e.target === state.domCache.searchBox;

    // Avoid double-handling when typing in the search box; allow Escape to bubble here
    if (isInSearchBox && e.key !== "Escape") {
      return;
    }

    // Throttle to ~60fps for repeated nav keys
    const now = performance.now();
    if (now - state.lastKeyTime < state.keyThrottleMs) {
      e.preventDefault();
      return;
    }
    state.lastKeyTime = now;

    try {
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          closeOverlay();
          break;

        case "Enter":
          e.preventDefault();
          if (
            state.filteredTabs.length > 0 &&
            state.selectedIndex >= 0 &&
            state.selectedIndex < state.filteredTabs.length
          ) {
            const selectedTab = state.filteredTabs[state.selectedIndex];
            if (selectedTab) {
              if (state.viewMode === "recent" && selectedTab.sessionId) {
                restoreSession(selectedTab.sessionId);
              } else if (selectedTab.id) {
                switchToTab(selectedTab.id);
              }
            }
          }
          break;

        case "Tab":
          e.preventDefault();
          if (e.shiftKey) {
            selectUp();
          } else {
            selectDown();
          }
          break;

        case "ArrowRight":
          e.preventDefault();
          selectRight();
          break;

        case "ArrowLeft":
          e.preventDefault();
          selectLeft();
          break;

        case "ArrowDown":
          e.preventDefault();
          selectDown();
          break;

        case "ArrowUp":
          e.preventDefault();
          selectUp();
          break;

        case "Delete":
          // Delete only applies to active tabs view
          if (
            state.viewMode !== "recent" &&
            state.filteredTabs.length > 0 &&
            state.selectedIndex >= 0 &&
            state.selectedIndex < state.filteredTabs.length
          ) {
            e.preventDefault();
            const tab = state.filteredTabs[state.selectedIndex];
            if (tab && tab.id) {
              closeTab(tab.id, state.selectedIndex);
            }
          }
          break;
      }
    } catch (error) {
      console.error("[TAB SWITCHER] Error in handleKeyDown:", error);
    }
  }

  function handleKeyUp(e) {
    // Reserved for future use
  }

  // ============================================================================
  // SEARCH HANDLING
  // ============================================================================

  // Create smart search handler with combined throttle + debounce
  function createSmartSearchHandler() {
    let debounceTimer = null;
    let lastSearchTime = 0;
    const THROTTLE_MS = 100; // Immediate feedback for small tab sets
    const DEBOUNCE_MS = 300; // Wait for user to finish typing on large sets
    const LARGE_TAB_THRESHOLD = 50;

    return function (e) {
      const now = performance.now();
      const timeSinceLastSearch = now - lastSearchTime;
      const isLargeTabSet = state.currentTabs.length >= LARGE_TAB_THRESHOLD;

      // Clear any pending debounce
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      // For small tab sets: throttle only (immediate feedback)
      if (!isLargeTabSet && timeSinceLastSearch >= THROTTLE_MS) {
        lastSearchTime = now;
        handleSearch(e);
      }
      // For large tab sets: debounce (wait for user to finish typing)
      else {
        debounceTimer = setTimeout(
          () => {
            lastSearchTime = performance.now();
            handleSearch(e);
          },
          isLargeTabSet ? DEBOUNCE_MS : THROTTLE_MS
        );
      }
    };
  }

  // Fuzzy match scoring
  function fuzzyMatch(text, query) {
    // Simple "characters in order" matcher with scoring
    // Returns { match: boolean, score: number }

    if (!text) return { match: false, score: 0 };

    const t = text.toLowerCase();
    const q = query.toLowerCase();

    if (q.length === 0) return { match: true, score: 1 };
    if (t === q) return { match: true, score: 100 };

    // Exact substring matches get high priority
    if (t.startsWith(q))
      return { match: true, score: 80 + (q.length / t.length) * 10 };
    if (t.includes(q))
      return { match: true, score: 50 + (q.length / t.length) * 10 };

    let tIdx = 0;
    let qIdx = 0;
    let score = 0;
    let consecutive = 0;
    let firstMatchIdx = -1;

    while (tIdx < t.length && qIdx < q.length) {
      if (t[tIdx] === q[qIdx]) {
        if (firstMatchIdx === -1) firstMatchIdx = tIdx;

        // Base score for match
        let charScore = 1;

        // Bonus for consecutive matches
        if (consecutive > 0) {
          charScore += 2 + consecutive; // Increasing bonus for longer runs
        }

        // Bonus for start of word (after space or start of string)
        if (
          tIdx === 0 ||
          t[tIdx - 1] === " " ||
          t[tIdx - 1] === "." ||
          t[tIdx - 1] === "/" ||
          t[tIdx - 1] === "-"
        ) {
          charScore += 3;
        }

        score += charScore;
        consecutive++;
        qIdx++;
      } else {
        consecutive = 0;
      }
      tIdx++;
    }

    // Must match all characters in query
    if (qIdx < q.length) return { match: false, score: 0 };

    // Penalty for total length difference (prefer shorter matches)
    score -= (t.length - q.length) * 0.1;

    // Penalty for late start
    if (firstMatchIdx > 0) score -= firstMatchIdx * 0.5;

    return { match: true, score: Math.max(1, score) };
  }

  function handleSearch(e) {
    try {
      const rawVal =
        e && e.target && typeof e.target.value === "string"
          ? e.target.value
          : state.domCache?.searchBox?.value ?? "";
      const query = String(rawVal).trim();

      // '.' quick toggle
      const isDeleteBackward = !!(
        e &&
        typeof e.inputType === "string" &&
        e.inputType === "deleteContentBackward"
      );
      if (query === "." && !isDeleteBackward) {
        // clear and toggle view
        state.domCache.searchBox.value = "";
        if (state.viewMode === "recent") {
          switchToActive();
        } else {
          switchToRecent();
        }
        return;
      }

      if (!query) {
        state.filteredTabs = state.currentTabs;
        state.selectedIndex = 0;

        if (state.currentTabs.length > 50) {
          renderTabsVirtual(state.currentTabs);
        } else {
          renderTabsStandard(state.currentTabs);
        }
        return;
      }

      // Filter and Sort tabs using fuzzy match
      const scoredTabs = state.currentTabs.map((tab) => {
        const titleMatch = fuzzyMatch(tab.title, query);
        const urlMatch = fuzzyMatch(tab.url, query);

        // Take the best match
        const bestMatch =
          titleMatch.score > urlMatch.score ? titleMatch : urlMatch;

        return {
          tab,
          match: bestMatch.match,
          score: bestMatch.score,
        };
      });

      const filtered = scoredTabs
        .filter((item) => item.match)
        .sort((a, b) => b.score - a.score)
        .map((item) => item.tab);

      state.filteredTabs = filtered;
      state.selectedIndex = 0;

      if (filtered.length > 50) {
        renderTabsVirtual(filtered);
      } else {
        renderTabsStandard(filtered);
      }
    } catch (error) {
      console.error("[TAB SWITCHER] Error in handleSearch:", error);
      // Fallback to showing all tabs
      state.filteredTabs = state.currentTabs;
      state.selectedIndex = 0;
      renderTabsStandard(state.currentTabs);
    }
  }

  function handleSearchKeydown(e) {
    try {
      // Throttle navigation keys to ~60fps similar to global handler
      const navKeys = [
        "Delete",
        "Tab",
        "ArrowDown",
        "ArrowUp",
        "ArrowRight",
        "ArrowLeft",
        "Enter",
      ];
      if (navKeys.includes(e.key)) {
        const now = performance.now();
        if (now - state.lastKeyTime < state.keyThrottleMs) {
          e.preventDefault();
          return;
        }
        state.lastKeyTime = now;
      }
      // '.' toggles between Active and Recently Closed when input empty
      if (e.key === ".") {
        const val = e.target.value || "";
        if (val.length === 0) {
          e.preventDefault();
          if (state.viewMode === "recent") {
            switchToActive();
          } else {
            switchToRecent();
          }
          return;
        }
      }
      // Backspace: if empty in recent mode, go back to active
      if (e.key === "Backspace") {
        const val = e.target.value || "";
        if (val.length === 0 && state.viewMode === "recent") {
          e.preventDefault();
          switchToActive();
          return;
        }
        // else allow default deletion
        return;
      }

      // Delete key: Close selected tab even from search box
      if (e.key === "Delete") {
        e.preventDefault();
        if (
          state.viewMode !== "recent" &&
          state.filteredTabs.length > 0 &&
          state.selectedIndex >= 0 &&
          state.selectedIndex < state.filteredTabs.length
        ) {
          const tab = state.filteredTabs[state.selectedIndex];
          if (tab && tab.id) closeTab(tab.id, state.selectedIndex);
        }
        return;
      }

      // Tab key: Navigate down (Shift+Tab goes backward/up)
      if (e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) {
          // Shift+Tab: Move to previous (up)
          selectUp();
        } else {
          // Tab: Move to next (down)
          selectDown();
        }
        return;
      }

      // Arrow Down: Move to next row (down)
      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectDown();
        return;
      }

      // Arrow Up: Move to previous row (up)
      if (e.key === "ArrowUp") {
        e.preventDefault();
        selectUp();
        return;
      }

      // Arrow Right: Move to right in grid
      if (e.key === "ArrowRight") {
        e.preventDefault();
        selectRight();
        return;
      }

      // Arrow Left: Move to left in grid
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        selectLeft();
        return;
      }

      // Enter: Switch/restore selected item
      if (e.key === "Enter") {
        e.preventDefault();
        if (
          state.filteredTabs.length > 0 &&
          state.selectedIndex >= 0 &&
          state.selectedIndex < state.filteredTabs.length
        ) {
          const selectedTab = state.filteredTabs[state.selectedIndex];
          if (
            state.viewMode === "recent" &&
            selectedTab &&
            selectedTab.sessionId
          ) {
            restoreSession(selectedTab.sessionId);
          } else if (selectedTab && selectedTab.id) {
            switchToTab(selectedTab.id);
          }
        }
        return;
      }
    } catch (error) {
      console.error("[TAB SWITCHER] Error in handleSearchKeydown:", error);
    }
  }

  // ============================================================================
  // FOCUS & EVENT CAPTURE (PREVENT TYPING ON PAGE)
  // ============================================================================

  function handleGlobalFocus(e) {
    if (!state.isOverlayVisible) return;

    // If focus moves to something other than our host (shadow host), force it back.
    // When focus is inside Shadow DOM, document.activeElement is the host.
    // If e.target is NOT the host, it means focus went to a page element.
    if (e.target !== state.host) {
      e.stopPropagation();
      e.preventDefault();
      if (state.domCache && state.domCache.searchBox) {
        state.domCache.searchBox.focus();
      }
    }
  }

  function handleGlobalKeydown(e) {
    if (!state.isOverlayVisible) return;

    // If the event target is NOT inside our shadow root (or is the host),
    // it means the event is targeting the page body/inputs.
    // We must stop it from reaching the page, but allow it if it's bubbling up from our shadow DOM.

    // However, since we are capturing at window level:
    // If we stop propagation here, it won't reach our shadow DOM either if we are not careful.
    // BUT, if focus is correctly on our search box, the event path starts at search box.
    // The capture phase goes Window -> ... -> Host -> SearchBox.
    // If we stop at Window Capture, we kill it for everyone.

    // Strategy: Only stop if the target is NOT our host/shadow content.
    // But at Window Capture, e.target is the *intended* target.
    // If focus is on the page input, e.target is the page input. We want to BLOCK that.
    // If focus is on our search box, e.target is our host (from document perspective) or search box (from shadow perspective).
    // Actually, for events originating in Shadow DOM, e.target is retargeted to the host.

    if (e.target !== state.host) {
      // Target is outside our extension. Block it.
      e.stopPropagation();
      e.preventDefault();

      // Redirect key to our search box if it's a printable char or nav key?
      // Better: Just enforce focus. The user will have to type again, but at least it won't type on the page.
      if (state.domCache && state.domCache.searchBox) {
        state.domCache.searchBox.focus();
      }
    }
  }

  // ============================================================================
  // SELECTION MANAGEMENT
  // ============================================================================
  function getGridColumns() {
    // Compute columns from actual card width and grid gap for accuracy
    if (!state.domCache.grid) return 1;
    const grid = state.domCache.grid;
    const cards = grid.querySelectorAll(".tab-card");
    if (cards.length === 0) return 1;
    const style = window.getComputedStyle(grid);
    const gap = parseFloat(style.columnGap) || 0;
    const gridWidth = grid.clientWidth || grid.offsetWidth || 0;
    const cardWidth = cards[0].clientWidth || cards[0].offsetWidth || 0;
    if (!gridWidth || !cardWidth) return 1;
    const cols = Math.max(1, Math.floor((gridWidth + gap) / (cardWidth + gap)));
    return cols;
  }

  function selectNext() {
    try {
      // Get current filtered tabs count
      if (!state.filteredTabs || state.filteredTabs.length === 0) {
        console.warn("[TAB SWITCHER] No tabs available for navigation");
        return;
      }

      // Ensure selectedIndex is within valid range
      if (
        state.selectedIndex < 0 ||
        state.selectedIndex >= state.filteredTabs.length
      ) {
        state.selectedIndex = 0;
      } else {
        state.selectedIndex = state.selectedIndex + 1;
        if (state.selectedIndex >= state.filteredTabs.length) {
          state.selectedIndex = 0; // Wrap around to first tab
        }
      }
      updateSelection();
    } catch (error) {
      console.error("[TAB SWITCHER] Error in selectNext:", error);
    }
  }

  function selectPrevious() {
    try {
      // Get current filtered tabs count
      if (!state.filteredTabs || state.filteredTabs.length === 0) {
        console.warn("[TAB SWITCHER] No tabs available for navigation");
        return;
      }

      // Ensure selectedIndex is within valid range
      if (
        state.selectedIndex < 0 ||
        state.selectedIndex >= state.filteredTabs.length
      ) {
        state.selectedIndex = state.filteredTabs.length - 1;
      } else {
        state.selectedIndex = state.selectedIndex - 1;
        if (state.selectedIndex < 0) {
          state.selectedIndex = state.filteredTabs.length - 1; // Wrap around to last tab
        }
      }
      updateSelection();
    } catch (error) {
      console.error("[TAB SWITCHER] Error in selectPrevious:", error);
    }
  }

  function selectRight() {
    try {
      if (!state.filteredTabs || state.filteredTabs.length === 0) {
        console.warn("[TAB SWITCHER] No tabs available for navigation");
        return;
      }

      const columnCount = getGridColumns();
      const newIndex = state.selectedIndex + 1;

      // If moving right would keep us in the same row, move right
      if (
        Math.floor(newIndex / columnCount) ===
        Math.floor(state.selectedIndex / columnCount)
      ) {
        if (newIndex < state.filteredTabs.length) {
          state.selectedIndex = newIndex;
        } else {
          // At the end of the row, wrap to first column
          const rowStart =
            Math.floor(state.selectedIndex / columnCount) * columnCount;
          state.selectedIndex = rowStart; // Go to start of current row
        }
      } else {
        // Would move to next row, wrap to beginning of current row instead
        const rowStart =
          Math.floor(state.selectedIndex / columnCount) * columnCount;
        state.selectedIndex = rowStart;
      }

      updateSelection();
    } catch (error) {
      console.error("[TAB SWITCHER] Error in selectRight:", error);
    }
  }

  function selectLeft() {
    try {
      if (!state.filteredTabs || state.filteredTabs.length === 0) {
        console.warn("[TAB SWITCHER] No tabs available for navigation");
        return;
      }

      const columnCount = getGridColumns();
      const rowStart =
        Math.floor(state.selectedIndex / columnCount) * columnCount;
      const colInRow = state.selectedIndex - rowStart;

      if (colInRow > 0) {
        // Not at the start of row, move left within the row
        state.selectedIndex = state.selectedIndex - 1;
      } else {
        // At the start of row, wrap to end of row
        const rowEnd = Math.min(
          rowStart + columnCount - 1,
          state.filteredTabs.length - 1
        );
        state.selectedIndex = rowEnd;
      }

      updateSelection();
    } catch (error) {
      console.error("[TAB SWITCHER] Error in selectLeft:", error);
    }
  }

  function selectDown() {
    try {
      if (!state.filteredTabs || state.filteredTabs.length === 0) {
        console.warn("[TAB SWITCHER] No tabs available for navigation");
        return;
      }

      const columnCount = getGridColumns();
      const currentRow = Math.floor(state.selectedIndex / columnCount);
      const colInRow = state.selectedIndex - currentRow * columnCount;
      const nextIndex = (currentRow + 1) * columnCount + colInRow;

      if (nextIndex < state.filteredTabs.length) {
        state.selectedIndex = nextIndex;
      } else {
        // Wrap to first item
        state.selectedIndex = 0;
      }

      updateSelection();
    } catch (error) {
      console.error("[TAB SWITCHER] Error in selectDown:", error);
    }
  }

  function selectUp() {
    try {
      if (!state.filteredTabs || state.filteredTabs.length === 0) {
        console.warn("[TAB SWITCHER] No tabs available for navigation");
        return;
      }

      const columnCount = getGridColumns();
      const currentRow = Math.floor(state.selectedIndex / columnCount);
      const colInRow = state.selectedIndex - currentRow * columnCount;

      if (currentRow > 0) {
        // Move to previous row, same column
        state.selectedIndex = (currentRow - 1) * columnCount + colInRow;
      } else {
        // Wrap to last row, same column
        const totalRows = Math.ceil(state.filteredTabs.length / columnCount);
        const lastRowIndex = (totalRows - 1) * columnCount + colInRow;
        state.selectedIndex = Math.min(
          lastRowIndex,
          state.filteredTabs.length - 1
        );
      }

      updateSelection();
    } catch (error) {
      console.error("[TAB SWITCHER] Error in selectUp:", error);
    }
  }

  function enforceSingleSelection(scrollIntoView) {
    try {
      const grid = state.domCache.grid;
      if (!grid) return;
      // Remove any stale selections currently in DOM
      const selectedEls = grid.querySelectorAll(".tab-card.selected");
      selectedEls.forEach((el) => el.classList.remove("selected"));
      // Apply selection to the current index if present in DOM
      const target = grid.querySelector(
        `.tab-card[data-tab-index="${state.selectedIndex}"]`
      );
      if (!target) return;
      target.classList.add("selected");
      if (scrollIntoView) {
        requestAnimationFrame(() => {
          target.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "nearest",
          });
        });
      }
    } catch (error) {
      console.error("[TAB SWITCHER] Error enforcing selection:", error);
    }
  }

  function updateSelection() {
    try {
      if (!state.domCache.grid) return;
      // Re-render window if virtual and out of range
      const isVirtual = state.filteredTabs && state.filteredTabs.length > 50;
      if (isVirtual) {
        const { startIndex, endIndex } = state.virtualScroll;
        if (
          state.selectedIndex < startIndex ||
          state.selectedIndex >= endIndex
        ) {
          renderTabsVirtual(state.filteredTabs);
        }
      }
      enforceSingleSelection(true);
    } catch (error) {
      console.error("[TAB SWITCHER] Error in updateSelection:", error);
    }
  }

  // ============================================================================
  // TAB ACTIONS
  // ============================================================================
  function switchToTab(tabId) {
    try {
      if (!tabId || typeof tabId !== "number") {
        console.error("[TAB SWITCHER] Invalid tab ID:", tabId);
        return;
      }

      // Fire-and-forget to avoid message port errors if the service worker sleeps
      try {
        chrome.runtime.sendMessage({ action: "switchToTab", tabId });
      } catch (msgErr) {
        // Silently ignore; background may be restarting
        console.debug(
          "[TAB SWITCHER] sendMessage warn:",
          msgErr?.message || msgErr
        );
      }
      // Close immediately; background will perform the switch
      closeOverlay();
    } catch (error) {
      console.error("[TAB SWITCHER] Exception in switchToTab:", error);
      closeOverlay();
    }
  }

  function restoreSession(sessionId) {
    try {
      if (!sessionId) return;
      try {
        chrome.runtime.sendMessage({ action: "restoreSession", sessionId });
      } catch (msgErr) {
        console.debug(
          "[TAB SWITCHER] sendMessage warn:",
          msgErr?.message || msgErr
        );
      }
      closeOverlay();
    } catch (error) {
      console.error("[TAB SWITCHER] Exception in restoreSession:", error);
      closeOverlay();
    }
  }

  function closeTab(tabId, index) {
    try {
      if (!tabId || typeof tabId !== "number") {
        console.error("[TAB SWITCHER] Invalid tab ID for closing:", tabId);
        return;
      }

      // Validate that the tab exists in our current list
      const tabExists = state.currentTabs.some(
        (tab) => tab && tab.id === tabId
      );
      if (!tabExists) {
        console.warn("[TAB SWITCHER] Tab no longer exists:", tabId);
        // Refresh the tab list
        state.filteredTabs = state.filteredTabs.filter(
          (tab) => tab && tab.id !== tabId
        );
        state.currentTabs = state.currentTabs.filter(
          (tab) => tab && tab.id !== tabId
        );

        // Adjust selected index
        if (state.selectedIndex >= state.filteredTabs.length) {
          state.selectedIndex = Math.max(0, state.filteredTabs.length - 1);
        }

        // Re-render
        if (state.filteredTabs.length > 0) {
          if (state.filteredTabs.length > 50) {
            renderTabsVirtual(state.filteredTabs);
          } else {
            renderTabsStandard(state.filteredTabs);
          }
        } else {
          closeOverlay();
        }
        return;
      }

      chrome.runtime.sendMessage(
        {
          action: "closeTab",
          tabId: tabId,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              "[TAB SWITCHER] Error closing tab:",
              chrome.runtime.lastError.message
            );
            return;
          }

          if (response && response.success) {
            // Remove from current list
            state.currentTabs = state.currentTabs.filter(
              (tab) => tab && tab.id !== tabId
            );
            state.filteredTabs = state.filteredTabs.filter(
              (tab) => tab && tab.id !== tabId
            );

            // Adjust selected index
            if (state.filteredTabs.length > 0) {
              if (state.selectedIndex >= state.filteredTabs.length) {
                state.selectedIndex = Math.max(
                  0,
                  state.filteredTabs.length - 1
                );
              }

              // Re-render
              if (state.filteredTabs.length > 50) {
                renderTabsVirtual(state.filteredTabs);
              } else {
                renderTabsStandard(state.filteredTabs);
              }

              // Refocus search box to allow continued typing
              if (state.domCache.searchBox) {
                state.domCache.searchBox.focus();
              }
            } else {
              // Close overlay if no tabs left
              closeOverlay();
            }
          }
        }
      );
    } catch (error) {
      console.error("[TAB SWITCHER] Exception in closeTab:", error);
    }
  }

  // ============================================================================
  // CLOSE OVERLAY
  // ============================================================================
  function closeOverlay() {
    try {
      if (!state.isOverlayVisible) return;

      // GPU-accelerated fade-out
      requestAnimationFrame(() => {
        if (state.overlay) {
          state.overlay.style.opacity = "0";
        }

        setTimeout(() => {
          if (state.overlay) {
            state.overlay.style.display = "none";
          }
          state.isOverlayVisible = false;

          // Cleanup
          document.removeEventListener("keydown", handleKeyDown);
          document.removeEventListener("keyup", handleKeyUp);

          // Remove focus enforcement listeners
          document.removeEventListener("focus", handleGlobalFocus, true);
          document.removeEventListener("keydown", handleGlobalKeydown, true);
          document.removeEventListener("keypress", handleGlobalKeydown, true);
          document.removeEventListener("keyup", handleGlobalKeydown, true);

          if (state.intersectionObserver) {
            state.intersectionObserver.disconnect();
            state.intersectionObserver = null;
          }
        }, 200); // Match CSS transition
      });
    } catch (error) {
      console.error("[TAB SWITCHER] Error in closeOverlay:", error);
      // Force cleanup even on error
      state.isOverlayVisible = false;
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
      document.removeEventListener("focus", handleGlobalFocus, true);
      document.removeEventListener("keydown", handleGlobalKeydown, true);
      document.removeEventListener("keypress", handleGlobalKeydown, true);
      document.removeEventListener("keyup", handleGlobalKeydown, true);
    }
  }

  // ============================================================================
  // INTERSECTION OBSERVER (LAZY LOADING)
  // ============================================================================
  function setupIntersectionObserver() {
    if (state.intersectionObserver) {
      state.intersectionObserver.disconnect();
    }

    state.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src && !img.src) {
              img.src = img.dataset.src;
              state.intersectionObserver.unobserve(img);
            }
          }
        });
      },
      {
        rootMargin: "100px", // Load images 100px before they enter viewport
      }
    );

    // Observe all lazy-load images
    const images = state.domCache.grid.querySelectorAll("img[data-src]");
    images.forEach((img) => state.intersectionObserver.observe(img));
  }

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  // Throttle function for performance
  function throttle(func, wait) {
    let timeout = null;
    let previous = 0;

    return function (...args) {
      const now = Date.now();
      const remaining = wait - (now - previous);

      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        func.apply(this, args);
      } else if (!timeout) {
        timeout = setTimeout(() => {
          previous = Date.now();
          timeout = null;
          func.apply(this, args);
        }, remaining);
      }
    };
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  console.log("═══════════════════════════════════════════════════════");
  console.log("Visual Tab Switcher - Content Script Loaded");
  console.log(
    "Features: Virtual Scrolling, Event Delegation, GPU Acceleration"
  );
  console.log("Target: <16ms interactions, 60fps, lazy loading");
  console.log("═══════════════════════════════════════════════════════");

  // ===============================
  // VIEW MODE HELPERS
  // ===============================
  function setViewMode(mode) {
    state.viewMode = mode;
    if (state.domCache && state.domCache.backBtn) {
      state.domCache.backBtn.style.display =
        mode === "recent" ? "flex" : "none";
    }
    if (state.domCache && state.domCache.recentBtn) {
      state.domCache.recentBtn.style.display =
        mode === "recent" ? "none" : "inline-flex";
    }
    // Placeholder text
    if (state.domCache && state.domCache.searchBox) {
      state.domCache.searchBox.placeholder =
        mode === "recent"
          ? "Search recently closed tabs..."
          : "Search tabs by title or URL...";
    }
  }

  async function switchToRecent() {
    try {
      setViewMode("recent");
      // Fetch recently closed items
      const items = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { action: "getRecentlyClosed", maxResults: 10 },
          (res) => {
            if (!res || !res.success) return resolve([]);
            resolve(res.items || []);
          }
        );
      });
      state.recentItems = items;
      state.currentTabs = items; // reuse pipeline
      state.filteredTabs = items;
      state.selectedIndex = 0;
      if (state.domCache.grid) state.domCache.grid.classList.add("recent-mode");
      renderTabsStandard(items);
      // focus search
      state.domCache.searchBox.focus();
    } catch (e) {
      console.error("[TAB SWITCHER] Failed to load recently closed:", e);
    }
  }

  function switchToActive() {
    setViewMode("active");
    state.currentTabs = state.activeTabs || [];
    state.filteredTabs = state.currentTabs;
    state.selectedIndex = 0;
    if (state.domCache.grid)
      state.domCache.grid.classList.remove("recent-mode");
    if (state.currentTabs.length > 50) {
      renderTabsVirtual(state.currentTabs);
    } else {
      renderTabsStandard(state.currentTabs);
    }
    state.domCache.searchBox.focus();
  }
})();
