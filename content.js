// Content script for Visual Tab Switcher overlay
// ============================================================================
// PERFORMANCE-OPTIMIZED IMPLEMENTATION
// Virtual scrolling, event delegation, GPU acceleration, throttling
// Target: <16ms interactions, 60fps animations, <50MB memory
// ============================================================================

(function () {
  "use strict";

  const SHADOW_HOST_ID = "tab-switcher-host";
  const SHADOW_CSS = `/* Visual Tab Switcher - Modern Glass UI 2.0 */

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:host {
  all: initial;
  
  /* Dark Theme - Black & Gray */
  --bg-overlay: rgba(0, 0, 0, 0.85);
  --bg-surface: #121212;
  --bg-glass: #1a1a1a;
  --bg-glass-hover: #222222;
  --border-subtle: #2a2a2a;
  --border-hover: #3a3a3a;
  --border-active: #4a4a4a;
  --text-primary: #f0f0f0;
  --text-secondary: #999999;
  --text-muted: #666666;
  --accent: #ffffff;
  --accent-light: #cccccc;
  --accent-glow: rgba(255, 255, 255, 0.1);
  --card-bg: #1e1e1e;
  --card-hover: #282828;
  --card-selected: #2a2a2a;
  --danger: #e53935;
  --success: #43a047;
  --radius-2xl: 14px;
  --radius-xl: 12px;
  --radius-lg: 10px;
  --radius-md: 8px;
  --radius-sm: 4px;
  --shadow-xl: 0 20px 40px rgba(0, 0, 0, 0.5);
  --shadow-card: 0 2px 6px rgba(0, 0, 0, 0.3);
  --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --transition-fast: 0.1s ease;
  --transition-smooth: 0.15s ease;
}

@media (prefers-color-scheme: light) {
  :host {
    /* Light Theme - White & Gray */
    --bg-overlay: rgba(100, 100, 100, 0.5);
    --bg-surface: #ffffff;
    --bg-glass: #f8f8f8;
    --bg-glass-hover: #f0f0f0;
    --border-subtle: #e0e0e0;
    --border-hover: #d0d0d0;
    --border-active: #b0b0b0;
    --text-primary: #1a1a1a;
    --text-secondary: #666666;
    --text-muted: #999999;
    --accent: #1a1a1a;
    --accent-light: #444444;
    --accent-glow: rgba(0, 0, 0, 0.08);
    --card-bg: #f5f5f5;
    --card-hover: #eeeeee;
    --card-selected: #e8e8e8;
    --shadow-xl: 0 20px 40px rgba(0, 0, 0, 0.12);
    --shadow-card: 0 1px 3px rgba(0, 0, 0, 0.08);
  }
}

/* Overlay */
.tab-switcher-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: none;
  align-items: flex-start;
  justify-content: center;
  padding-top: 6vh;
  font-family: var(--font-family);
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.tab-switcher-backdrop {
  position: absolute;
  inset: 0;
  background: var(--bg-overlay);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  animation: backdropFadeIn 0.2s ease-out;
}

.tab-switcher-container {
  position: relative;
  width: 880px;
  max-width: 94vw;
  max-height: 80vh;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-xl);
  display: flex;
  flex-direction: column;
  padding: 20px;
  overflow: hidden;
  animation: containerSlideIn 0.2s ease-out;
}

/* Search Header */
.tab-switcher-search-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  flex-shrink: 0;
}

.tab-switcher-search-wrap {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}

.tab-switcher-search {
  width: 100%;
  background: var(--bg-glass);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 14px 18px 14px 52px;
  font-size: 15px;
  font-weight: 400;
  color: var(--text-primary);
  outline: none;
  transition: all var(--transition-smooth);
  letter-spacing: -0.01em;
}

.tab-switcher-search:focus {
  background: var(--bg-glass-hover);
  border-color: var(--accent);
  box-shadow: 0 0 0 4px var(--accent-glow), var(--shadow-card);
}

.tab-switcher-search::placeholder {
  color: var(--text-muted);
  font-weight: 400;
}

.search-icon {
  position: absolute;
  left: 18px;
  color: var(--text-muted);
  pointer-events: none;
  display: flex;
  align-items: center;
  transition: all var(--transition-fast);
}

.tab-switcher-search:focus ~ .search-icon,
.tab-switcher-search-wrap:focus-within .search-icon {
  color: var(--accent);
  transform: scale(1.05);
}

/* Buttons */
.recently-closed-btn {
  background: var(--bg-glass);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  padding: 0 20px;
  border-radius: var(--radius-lg);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-smooth);
  white-space: nowrap;
  height: 50px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  letter-spacing: -0.01em;
}

.recently-closed-btn:hover {
  background: var(--bg-glass-hover);
  border-color: var(--border-hover);
  color: var(--text-primary);
  transform: translateY(-1px);
}

.recently-closed-btn:active {
  transform: translateY(0);
}

.recent-back-btn {
  position: absolute;
  left: 10px;
  z-index: 10;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: var(--bg-glass-hover);
  color: var(--text-primary);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 18px;
  transition: all var(--transition-fast);
}

.recent-back-btn:hover {
  background: var(--accent);
  color: white;
  transform: scale(1.05);
}

/* Grid - Active Tabs */
.tab-switcher-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px;
  padding-right: 8px;
  min-height: 200px;
  scroll-behavior: smooth;
}

/* Recent Mode & Search Mode - Column Layout */
.tab-switcher-grid.recent-mode,
.tab-switcher-grid.search-mode {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tab-switcher-grid::-webkit-scrollbar {
  width: 6px;
}

.tab-switcher-grid::-webkit-scrollbar-track {
  background: transparent;
}

.tab-switcher-grid::-webkit-scrollbar-thumb {
  background: var(--border-subtle);
  border-radius: 3px;
}

.tab-switcher-grid::-webkit-scrollbar-thumb:hover {
  background: var(--border-hover);
}

/* Empty State */
.tab-switcher-empty {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  color: var(--text-muted);
  font-size: 14px;
  text-align: center;
}

/* Tab Card */
.tab-card {
  background: var(--card-bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  overflow: hidden;
  cursor: pointer;
  position: relative;
  display: flex;
  flex-direction: column;
  height: 160px;
  transition: all var(--transition-smooth);
}

.tab-card:hover {
  transform: translateY(-2px);
  border-color: var(--border-hover);
  background: var(--card-hover);
}

.tab-card.selected {
  border-color: var(--accent);
  background: var(--card-selected);
  box-shadow: 0 0 0 1px var(--border-active);
}

.tab-card.selected::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--accent-glow);
  pointer-events: none;
  z-index: 0;
}

/* Pinned indicator */
.tab-card.pinned::after {
  content: '📌';
  position: absolute;
  top: 8px;
  left: 8px;
  font-size: 12px;
  z-index: 5;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));
}

/* Web Search Card */
.tab-card[data-web-search="1"] {
  width: 100% !important;
  height: 60px !important;
  flex-direction: row !important;
  align-items: center !important;
  padding: 0 18px !important;
  gap: 14px !important;
}

.tab-card[data-web-search="1"]:hover {
  transform: translateY(-2px);
}

/* Thumbnail Area */
.tab-thumbnail {
  flex: 1;
  min-height: 0;
  background: linear-gradient(180deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.08) 100%);
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tab-card[data-web-search="1"] .tab-thumbnail {
  flex: 0 0 36px;
  height: 36px;
  width: 36px;
  border-radius: var(--radius-md);
  background: var(--bg-glass);
}

.screenshot-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top center;
  opacity: 0.95;
  transition: all var(--transition-smooth);
}

.tab-card:hover .screenshot-img {
  opacity: 1;
  transform: scale(1.02);
}

/* Favicon Tile */
.favicon-tile {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--bg-glass) 0%, transparent 100%);
}

.tab-card[data-web-search="1"] .favicon-tile {
  background: transparent;
}

.favicon-large {
  width: 44px;
  height: 44px;
  object-fit: contain;
  border-radius: var(--radius-sm);
  transition: transform var(--transition-smooth);
}

.tab-card:hover .favicon-large {
  transform: scale(1.08);
}

.tab-card[data-web-search="1"] .favicon-large {
  width: 26px;
  height: 26px;
}

.favicon-letter {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background: var(--bg-glass-hover);
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.02em;
  transition: all var(--transition-smooth);
}

.tab-card:hover .favicon-letter {
  transform: scale(1.05);
  border-color: var(--border-hover);
}

/* Tab Info */
.tab-info {
  padding: 12px 14px;
  background: transparent;
  position: relative;
  z-index: 1;
}

.tab-card[data-web-search="1"] .tab-info {
  flex: 1 !important;
  padding: 0 !important;
  display: flex !important;
  align-items: center !important;
}

.tab-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}

.tab-card[data-web-search="1"] .tab-header {
  margin: 0 !important;
  width: 100% !important;
}

.tab-favicon {
  width: 16px;
  height: 16px;
  opacity: 0.85;
  border-radius: 3px;
  flex-shrink: 0;
}

.tab-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  letter-spacing: -0.01em;
}

.tab-card.selected .tab-title {
  color: var(--accent-light);
}

.tab-card[data-web-search="1"] .tab-title {
  font-size: 15px;
  font-weight: 500;
}

.tab-url {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-left: 26px;
  letter-spacing: -0.01em;
}

.tab-card[data-web-search="1"] .tab-url {
  display: none;
}

/* Close Button */
.tab-close-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 26px;
  height: 26px;
  border-radius: var(--radius-md);
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: white;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 300;
  opacity: 0;
  transform: scale(0.8);
  transition: all var(--transition-fast);
  cursor: pointer;
  z-index: 10;
}

.tab-card:hover .tab-close-btn {
  opacity: 1;
  transform: scale(1);
}

.tab-close-btn:hover {
  background: var(--danger);
  transform: scale(1.1);
}

.tab-close-btn:active {
  transform: scale(0.95);
}

/* Footer/Help */
.tab-switcher-help {
  display: flex;
  gap: 20px;
  margin-top: 20px;
  padding-top: 18px;
  border-top: 1px solid var(--border-subtle);
  color: var(--text-muted);
  font-size: 12px;
  justify-content: center;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.tab-switcher-help span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 7px;
  background: var(--bg-glass);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  font-family: "SF Mono", "Fira Code", monospace;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  transition: all var(--transition-fast);
}

kbd:hover {
  background: var(--bg-glass-hover);
  border-color: var(--border-hover);
  color: var(--text-primary);
}

/* Animations */
@keyframes backdropFadeIn {
  from { 
    opacity: 0;
    backdrop-filter: blur(0);
  }
  to { 
    opacity: 1;
    backdrop-filter: blur(24px) saturate(180%);
  }
}

@keyframes containerSlideIn {
  from { 
    opacity: 0;
    transform: translateY(-20px) scale(0.96);
  }
  to { 
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes cardFadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Recent mode styles - Column Layout */
.tab-switcher-grid.recent-mode .tab-card {
  width: 100%;
  height: auto;
  min-height: 56px;
  flex-direction: row;
  align-items: center;
  padding: 12px 16px;
  gap: 14px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
}

.tab-switcher-grid.recent-mode .tab-card:hover {
  transform: none;
  border-color: var(--border-hover);
}

.tab-switcher-grid.recent-mode .tab-card.selected {
  border-color: var(--accent);
  background: var(--card-selected);
}

.tab-switcher-grid.recent-mode .tab-thumbnail {
  flex: 0 0 36px;
  height: 36px;
  width: 36px;
  min-height: 36px;
  border-radius: var(--radius-sm);
  background: var(--bg-glass);
}

.tab-switcher-grid.recent-mode .favicon-tile {
  border-radius: var(--radius-sm);
}

.tab-switcher-grid.recent-mode .favicon-large {
  width: 24px;
  height: 24px;
}

.tab-switcher-grid.recent-mode .favicon-letter {
  width: 36px;
  height: 36px;
  font-size: 16px;
  border-radius: var(--radius-sm);
}

.tab-switcher-grid.recent-mode .tab-info {
  flex: 1;
  padding: 0;
  min-width: 0;
}

.tab-switcher-grid.recent-mode .tab-header {
  margin-bottom: 2px;
}

.tab-switcher-grid.recent-mode .tab-title {
  font-size: 14px;
}

.tab-switcher-grid.recent-mode .tab-url {
  padding-left: 0;
  font-size: 12px;
}

.tab-switcher-grid.recent-mode .tab-close-btn {
  display: none;
}

/* Search mode styles - Column Layout (same as recent) */
.tab-switcher-grid.search-mode .tab-card {
  width: 100%;
  height: auto;
  min-height: 56px;
  flex-direction: row;
  align-items: center;
  padding: 12px 16px;
  gap: 14px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
}

.tab-switcher-grid.search-mode .tab-card:hover {
  transform: none;
  border-color: var(--border-hover);
}

.tab-switcher-grid.search-mode .tab-card.selected {
  border-color: var(--accent);
  background: var(--card-selected);
}

.tab-switcher-grid.search-mode .tab-thumbnail {
  flex: 0 0 36px;
  height: 36px;
  width: 36px;
  min-height: 36px;
  border-radius: var(--radius-sm);
  background: var(--bg-glass);
}

.tab-switcher-grid.search-mode .tab-info {
  flex: 1;
  padding: 0;
  min-width: 0;
}

.tab-switcher-grid.search-mode .tab-title {
  font-size: 14px;
}

.tab-switcher-grid.search-mode .tab-url {
  padding-left: 0;
  font-size: 12px;
  display: block;
}

/* Responsive */
@media (max-width: 768px) {
  .tab-switcher-container {
    padding: 16px;
    max-width: 98vw;
    max-height: 90vh;
  }
  
  .tab-switcher-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 10px;
  }
  
  .tab-card {
    height: 150px;
  }
  
  .tab-switcher-help {
    gap: 12px;
    font-size: 11px;
  }
  
  .recently-closed-btn {
    padding: 0 12px;
    font-size: 12px;
  }
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

    // Start selection at the second tab (most recently used that isn't current)
    // This mimics Alt+Tab behavior where pressing the shortcut once shows the previous tab
    const activeIndex = tabs.findIndex((tab) => tab.id === activeTabId);
    if (tabs.length > 1 && activeIndex === 0) {
      // Current tab is first (most recent), select the second one
      state.selectedIndex = 1;
    } else if (activeIndex > 0) {
      // Current tab is not first, select the first one (most recent)
      state.selectedIndex = 0;
    } else {
      state.selectedIndex = 0;
    }

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
        try {
          chrome.runtime.sendMessage(
            { action: "getRecentlyClosed", maxResults: 10 },
            (res) => {
              // Check for runtime errors
              if (chrome.runtime.lastError) {
                console.debug("[TAB SWITCHER] Runtime error:", chrome.runtime.lastError.message);
                resolve([]);
                return;
              }
              if (res && res.success) resolve(res.items || []);
              else resolve([]);
            }
          );
        } catch (err) {
          resolve([]);
        }
      });
    } catch (e) {
      console.debug("[TAB SWITCHER] Failed to load recently closed:", e);
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
    // Add recent-mode class for column layout
    if (state.domCache.grid) state.domCache.grid.classList.add("recent-mode");
    renderTabsStandard(state.filteredTabs);
    // Refocus search
    if (state.domCache.searchBox) state.domCache.searchBox.focus();
  }

  function switchToActive() {
    if (state.viewMode === "active") return;
    setViewMode("active");
    state.currentTabs = state.activeTabs || [];
    state.filteredTabs = state.currentTabs;
    state.selectedIndex = 0;
    // Remove recent-mode and search-mode classes for grid layout
    if (state.domCache.grid) {
      state.domCache.grid.classList.remove("recent-mode");
      state.domCache.grid.classList.remove("search-mode");
    }
    if (state.filteredTabs.length > 50) {
      renderTabsVirtual(state.filteredTabs);
    } else {
      renderTabsStandard(state.filteredTabs);
    }
    if (state.domCache.searchBox) {
      state.domCache.searchBox.value = "";
      state.domCache.searchBox.focus();
    }
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
    if (tab && tab.isWebSearch) {
      tabCard.dataset.webSearch = "1";
      tabCard.dataset.searchQuery = tab.searchQuery;
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

    // Close button (only for active tabs view and not web search)
    if (!tab.sessionId && !tab.isWebSearch) {
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
        if (tabCard.dataset.webSearch === "1") {
          const query = tabCard.dataset.searchQuery;
          if (query) {
            window.open(
              `https://www.google.com/search?q=${encodeURIComponent(query)}`,
              "_blank"
            );
            closeOverlay();
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

      // Web Search Mode: starts with ?
      if (query.startsWith("?")) {
        const searchQuery = query.substring(1).trim();
        const webSearchTab = {
          id: "web-search",
          title: searchQuery
            ? `Search Web for "${searchQuery}"`
            : "Type to search web...",
          url: searchQuery
            ? `https://www.google.com/search?q=${encodeURIComponent(
                searchQuery
              )}`
            : "",
          favIconUrl: "https://www.google.com/favicon.ico",
          isWebSearch: true,
          searchQuery: searchQuery,
        };
        state.filteredTabs = [webSearchTab];
        state.selectedIndex = 0;
        // Add search-mode class for column layout
        if (state.domCache.grid) {
          state.domCache.grid.classList.add("search-mode");
          state.domCache.grid.classList.remove("recent-mode");
        }
        renderTabsStandard(state.filteredTabs);
        return;
      }
      
      // Remove search-mode class when not in web search
      if (state.domCache.grid) {
        state.domCache.grid.classList.remove("search-mode");
      }

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
          } else if (selectedTab && selectedTab.isWebSearch) {
            window.open(
              `https://www.google.com/search?q=${encodeURIComponent(
                selectedTab.searchQuery
              )}`,
              "_blank"
            );
            closeOverlay();
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
        try {
          chrome.runtime.sendMessage(
            { action: "getRecentlyClosed", maxResults: 10 },
            (res) => {
              if (chrome.runtime.lastError) {
                console.debug("[TAB SWITCHER] Runtime error:", chrome.runtime.lastError.message);
                resolve([]);
                return;
              }
              if (!res || !res.success) return resolve([]);
              resolve(res.items || []);
            }
          );
        } catch (err) {
          resolve([]);
        }
      });
      state.recentItems = items;
      state.currentTabs = items; // reuse pipeline
      state.filteredTabs = items;
      state.selectedIndex = 0;
      if (state.domCache.grid) state.domCache.grid.classList.add("recent-mode");
      renderTabsStandard(items);
      // focus search
      if (state.domCache.searchBox) state.domCache.searchBox.focus();
    } catch (e) {
      console.debug("[TAB SWITCHER] Failed to load recently closed:", e);
    }
  }

  function switchToActive() {
    setViewMode("active");
    state.currentTabs = state.activeTabs || [];
    state.filteredTabs = state.currentTabs;
    state.selectedIndex = 0;
    if (state.domCache.grid) {
      state.domCache.grid.classList.remove("recent-mode");
      state.domCache.grid.classList.remove("search-mode");
    }
    if (state.currentTabs.length > 50) {
      renderTabsVirtual(state.currentTabs);
    } else {
      renderTabsStandard(state.currentTabs);
    }
    state.domCache.searchBox.focus();
  }
})();
