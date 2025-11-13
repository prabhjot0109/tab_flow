// Content script for Visual Tab Switcher overlay
// ============================================================================
// PERFORMANCE-OPTIMIZED IMPLEMENTATION
// Virtual scrolling, event delegation, GPU acceleration, throttling
// Target: <16ms interactions, 60fps animations, <50MB memory
// ============================================================================

(function() {
  'use strict';
  
  const SHADOW_HOST_ID = 'tab-switcher-host';
  const SHADOW_CSS = `/* Visual Tab Switcher Overlay Styles */
/* ============================================================================ */
/* PERFORMANCE-OPTIMIZED with GPU ACCELERATION */
/* All animations use transform3d for hardware acceleration */
/* will-change hints for critical animation elements */
/* Target: 60fps animations, zero jank */
/* ============================================================================ */

/* Remove default focus outlines - we use custom selection styles */
.tab-switcher-overlay *:focus {
  outline: none;
}

/* Overlay container - GPU accelerated */
.tab-switcher-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2147483647;
  display: none;
  align-items: center;
  justify-content: center;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  animation: fadeIn 0.2s ease-out;
  will-change: opacity;
  transform: translate3d(0, 0, 0);
}

/* Backdrop - GPU accelerated blur */
.tab-switcher-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(5px);
  will-change: opacity;
  transform: translate3d(0, 0, 0);
}

/* Main container - GPU accelerated transform */
.tab-switcher-container {
  position: relative;
  background: #1e1e1e;
  border-radius: 12px;
  padding: 24px;
  max-width: 90vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  animation: slideIn 0.3s ease-out;
  will-change: transform, opacity;
  transform: translate3d(0, 0, 0);
}

/* Search box */
.tab-switcher-search {
  width: 100%;
  padding: 12px 16px;
  margin-bottom: 20px;
  background: #2d2d2d;
  border: 2px solid #404040;
  border-radius: 8px;
  color: #ffffff;
  font-size: 16px;
  outline: none;
  transition: border-color 0.2s;
}

.tab-switcher-search:focus {
  border-color: #007acc;
  outline: none;
}

.tab-switcher-search::placeholder {
  color: #888;
}

/* Grid container */
.tab-switcher-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  max-height: 60vh;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px;
  margin: 0 -8px;
  outline: none;
}

.tab-switcher-grid:focus {
  outline: none;
}

/* Scrollbar styling */
.tab-switcher-grid::-webkit-scrollbar {
  width: 10px;
}

.tab-switcher-grid::-webkit-scrollbar-track {
  background: #2d2d2d;
  border-radius: 5px;
}

.tab-switcher-grid::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 5px;
}

.tab-switcher-grid::-webkit-scrollbar-thumb:hover {
  background: #666;
}

/* Tab card - GPU accelerated hover effects */
.tab-card {
  background: #2d2d2d;
  border: 2px solid #404040;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  will-change: transform, box-shadow;
  transform: translate3d(0, 0, 0);
}

.tab-card:hover {
  transform: translate3d(0, -4px, 0);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
  border-color: #555;
}

.tab-card.selected {
  border-color: #007acc;
  box-shadow: 0 0 0 3px rgba(0, 122, 204, 0.3);
  transform: translate3d(0, -4px, 0);
}

/* Visual distinction for favicon tiles */
.tab-card.has-favicon {
  border-style: dashed;
  border-color: #505050;
}

.tab-card.has-favicon:hover {
  border-color: #606060;
}

.tab-card.has-favicon.selected {
  border-style: solid;
  border-color: #007acc;
}

.tab-card.pinned::before {
  content: '📌';
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 10;
  font-size: 16px;
  background: rgba(0, 0, 0, 0.6);
  padding: 4px 8px;
  border-radius: 4px;
}

/* Thumbnail */
.tab-thumbnail {
  width: 100%;
  height: 160px;
  background: #1a1a1a;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}

.tab-thumbnail img.screenshot-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: opacity 0.3s ease;
}

/* Favicon tile styling */
.favicon-tile {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%);
  position: relative;
}

/* Large favicon display - GPU accelerated scale */
.favicon-large {
  width: 64px;
  height: 64px;
  object-fit: contain;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3));
  transition: transform 0.2s ease;
  will-change: transform;
  transform: translate3d(0, 0, 0);
}

.tab-card:hover .favicon-large {
  transform: translate3d(0, 0, 0) scale(1.1);
}

/* Letter fallback for missing favicons - GPU accelerated */
.favicon-letter {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #007acc 0%, #005a9e 100%);
  border-radius: 50%;
  font-size: 40px;
  font-weight: bold;
  color: #ffffff;
  text-transform: uppercase;
  box-shadow: 0 4px 12px rgba(0, 122, 204, 0.4);
  transition: transform 0.2s ease;
  will-change: transform;
  transform: translate3d(0, 0, 0);
}

.tab-card:hover .favicon-letter {
  transform: translate3d(0, 0, 0) scale(1.1);
}

.tab-thumbnail .no-screenshot {
  color: #888;
  font-size: 14px;
  text-align: center;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.placeholder-icon {
  font-size: 48px;
  opacity: 0.5;
  margin-bottom: 8px;
}

.placeholder-text {
  font-size: 13px;
  font-weight: 500;
  color: #aaa;
}

.placeholder-hint {
  font-size: 11px;
  color: #666;
  line-height: 1.4;
  max-width: 200px;
}

/* Tab info */
.tab-info {
  padding: 12px;
}

/* Adjust padding for favicon tiles (more space for title) */
.tab-card.has-favicon .tab-info {
  padding: 16px 12px;
}

.tab-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

/* Enlarge title for favicon tiles */
.tab-card.has-favicon .tab-header {
  justify-content: center;
  margin-bottom: 0;
}

.tab-favicon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.tab-title {
  color: #ffffff;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

/* Larger, centered title for favicon tiles */
.tab-card.has-favicon .tab-title {
  font-size: 15px;
  font-weight: 600;
  text-align: center;
  flex: none;
  max-width: 100%;
}

.tab-url {
  color: #888;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Close button - GPU accelerated */
.tab-close-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  background: rgba(0, 0, 0, 0.7);
  border: none;
  border-radius: 50%;
  color: #ffffff;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s, transform 0.2s, background-color 0.2s;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  will-change: transform, opacity;
  transform: translate3d(0, 0, 0);
}

.tab-card:hover .tab-close-btn,
.tab-card.selected .tab-close-btn {
  opacity: 1;
}

.tab-close-btn:hover {
  background: #e74c3c;
  transform: translate3d(0, 0, 0) scale(1.1);
}

/* Help text */
.tab-switcher-help {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #404040;
  display: flex;
  gap: 24px;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  color: #aaa;
  font-size: 13px;
}

.tab-switcher-help span {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tab-switcher-help kbd {
  background: linear-gradient(180deg, #3a3a3a 0%, #2d2d2d 100%);
  border: 1px solid #555;
  border-bottom: 2px solid #666;
  border-radius: 4px;
  padding: 4px 8px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', monospace;
  font-size: 12px;
  font-weight: 500;
  color: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  min-width: 24px;
  text-align: center;
}

.tab-switcher-help .help-note {
  color: #666;
  font-size: 11px;
  font-style: italic;
}

/* Animations - GPU accelerated */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translate3d(0, 0, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes slideIn {
  from {
    transform: translate3d(0, 0, 0) scale(0.9);
    opacity: 0;
  }
  to {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: 1;
  }
}

/* Responsive design */
@media (max-width: 1200px) {
  .tab-switcher-grid {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  }
}

@media (max-width: 768px) {
  .tab-switcher-grid {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
  }
  
  .tab-switcher-container {
    padding: 16px;
  }
  
  .tab-thumbnail {
    height: 120px;
  }
}

@media (max-width: 480px) {
  .tab-switcher-grid {
    grid-template-columns: 1fr;
  }
  
  .tab-switcher-help {
    font-size: 11px;
    gap: 10px;
  }
}

/* Handle multiple windows */
.tab-window-separator {
  grid-column: 1 / -1;
  padding: 12px 0;
  color: #888;
  font-size: 14px;
  font-weight: 600;
  border-top: 1px solid #404040;
  margin-top: 8px;
}`;
  
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  const state = {
    overlay: null,
    currentTabs: [],
    filteredTabs: [],
    selectedIndex: 0,
    isOverlayVisible: false,
    host: null,
    shadowRoot: null,
    styleElement: null,
    
    // DOM cache
    domCache: {
      grid: null,
      searchBox: null,
      container: null
    },
    
    // Virtual scrolling
    virtualScroll: {
      startIndex: 0,
      endIndex: 0,
      visibleCount: 20, // Render 20 tabs at a time
      bufferCount: 5    // Buffer above/below viewport
    },
    
    // Performance
    lastKeyTime: 0,
    keyThrottleMs: 16, // ~60fps
    resizeObserver: null,
    intersectionObserver: null
  };
  
  // WeakMap for tab metadata (automatic garbage collection)
  const tabMetadata = new WeakMap();
  
  // ============================================================================
  // MESSAGE LISTENER
  // ============================================================================
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "showTabSwitcher") {
      showTabSwitcher(request.tabs, request.activeTabId);
      sendResponse({ success: true });
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
          const host = document.createElement('div');
          host.id = SHADOW_HOST_ID;
          document.body.appendChild(host);
          state.host = host;
        }
      }
      if (!state.shadowRoot) {
        if (state.host.shadowRoot) {
          state.shadowRoot = state.host.shadowRoot;
        } else {
          state.shadowRoot = state.host.attachShadow({ mode: 'open' });
        }
      }
      if (!state.styleElement || !state.shadowRoot.contains(state.styleElement)) {
        const style = document.createElement('style');
        style.textContent = SHADOW_CSS;
        state.shadowRoot.appendChild(style);
        state.styleElement = style;
      }
      return state.shadowRoot;
    } catch (error) {
      console.error('[TAB SWITCHER] Failed to initialize shadow root:', error);
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
    const overlay = document.createElement('div');
    overlay.id = 'visual-tab-switcher-overlay';
    overlay.className = 'tab-switcher-overlay';
    overlay.style.willChange = 'opacity'; // GPU hint
    
    // Create backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'tab-switcher-backdrop';
    overlay.appendChild(backdrop);
    
    // Create main container
    const container = document.createElement('div');
    container.className = 'tab-switcher-container';
    container.style.transform = 'translate3d(0, 0, 0)'; // GPU acceleration
    
    // Search box
    const searchBox = document.createElement('input');
    searchBox.type = 'text';
    searchBox.className = 'tab-switcher-search';
    searchBox.placeholder = 'Search tabs by title or URL...';
    searchBox.autocomplete = 'off';
    container.appendChild(searchBox);
    
    // Grid container with virtual scrolling support
    const grid = document.createElement('div');
    grid.className = 'tab-switcher-grid';
    grid.id = 'tab-switcher-grid';
    grid.style.transform = 'translate3d(0, 0, 0)'; // GPU acceleration
    container.appendChild(grid);
    
     // Help text
     const helpText = document.createElement('div');
     helpText.className = 'tab-switcher-help';
     helpText.innerHTML = `
       <span><kbd>↑</kbd> <kbd>↓</kbd> Navigate Rows</span>
       <span><kbd>←</kbd> <kbd>→</kbd> Navigate Columns</span>
       <span><kbd>Tab</kbd> Down | <kbd>Shift+Tab</kbd> Up</span>
       <span><kbd>Enter</kbd> Switch</span>
       <span><kbd>Delete</kbd> Close Tab</span>
       <span><kbd>Esc</kbd> Exit</span>
     `;
     container.appendChild(helpText);
    
    overlay.appendChild(container);
    
    // Event listeners with throttling
    searchBox.addEventListener('input', throttle(handleSearch, 100));
    searchBox.addEventListener('keydown', handleSearchKeydown);
    backdrop.addEventListener('click', closeOverlay);
    
    // Event delegation for tab clicks (single listener)
    grid.addEventListener('click', handleGridClick);
    
    // Cache DOM references
    state.overlay = overlay;
    state.domCache = { grid, searchBox, container };
    
    shadowRoot.appendChild(overlay);
    
    console.log('[PERF] Overlay created with GPU acceleration and event delegation');
  }
  
  // ============================================================================
  // SHOW TAB SWITCHER
  // ============================================================================
  function showTabSwitcher(tabs, activeTabId) {
    const startTime = performance.now();
    
    console.log(`[TAB SWITCHER] Opening with ${tabs.length} tabs`);
    
    if (state.isOverlayVisible) return;
    
    createOverlay();
    state.currentTabs = tabs;
    state.filteredTabs = tabs;
    
    // Find active tab index
    state.selectedIndex = tabs.findIndex(tab => tab.id === activeTabId);
    if (state.selectedIndex === -1) state.selectedIndex = 0;
    
    // Determine rendering strategy based on tab count
    if (tabs.length > 50) {
      console.log('[PERF] Using virtual scrolling for', tabs.length, 'tabs');
      renderTabsVirtual(tabs);
    } else {
      renderTabsStandard(tabs);
    }
    
    // Show overlay with GPU-accelerated fade-in
    requestAnimationFrame(() => {
      state.overlay.style.display = 'flex';
      state.overlay.style.opacity = '0';
      
      requestAnimationFrame(() => {
        state.overlay.style.opacity = '1';
        state.isOverlayVisible = true;
        
        // Focus search box AFTER overlay is visible (critical for auto-focus)
        setTimeout(() => {
          state.domCache.searchBox.value = '';
          state.domCache.searchBox.focus();
        }, 50); // Small delay ensures overlay is fully rendered
      });
    });
    
    // Add keyboard listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    const duration = performance.now() - startTime;
    console.log(`[PERF] Overlay rendered in ${duration.toFixed(2)}ms (Target: <16ms for 60fps)`);
  }
  
  // ============================================================================
  // RENDERING - STANDARD (< 50 tabs)
  // ============================================================================
  function renderTabsStandard(tabs) {
    const startTime = performance.now();
    const grid = state.domCache.grid;
    
    // Clear grid
    grid.innerHTML = '';
    
    if (tabs.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'tab-switcher-empty';
      emptyMsg.textContent = 'No tabs found';
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
    
    const duration = performance.now() - startTime;
    console.log(`[PERF] Rendered ${tabs.length} tabs in ${duration.toFixed(2)}ms`);
  }
  
  // ============================================================================
  // RENDERING - VIRTUAL SCROLLING (50+ tabs)
  // ============================================================================
  function renderTabsVirtual(tabs) {
    const startTime = performance.now();
    const grid = state.domCache.grid;
    
    // Clear grid
    grid.innerHTML = '';
    
    if (tabs.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'tab-switcher-empty';
      emptyMsg.textContent = 'No tabs found';
      grid.appendChild(emptyMsg);
      return;
    }
    
    // Calculate visible range
    const visibleCount = state.virtualScroll.visibleCount;
    const bufferCount = state.virtualScroll.bufferCount;
    const startIndex = Math.max(0, state.selectedIndex - bufferCount);
    const endIndex = Math.min(tabs.length, state.selectedIndex + visibleCount + bufferCount);
    
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
      tabCard.style.position = 'relative';
      tabCard.style.top = `${i * 180}px`;
      
      fragment.appendChild(tabCard);
    }
    
    grid.appendChild(fragment);
    
    // Setup intersection observer for lazy loading
    setupIntersectionObserver();
    
    const duration = performance.now() - startTime;
    console.log(`[PERF] Virtual rendered ${endIndex - startIndex} of ${tabs.length} tabs in ${duration.toFixed(2)}ms`);
  }
  
  // ============================================================================
  // CREATE TAB CARD
  // ============================================================================
  function createTabCard(tab, index) {
    const tabCard = document.createElement('div');
    tabCard.className = 'tab-card';
    tabCard.dataset.tabId = tab.id;
    tabCard.dataset.tabIndex = index;
    tabCard.setAttribute('role', 'button');
    tabCard.tabIndex = 0; // Make card focusable for accessibility
    tabCard.style.transform = 'translate3d(0, 0, 0)'; // GPU acceleration
    
    // Determine if we should show screenshot or favicon
    const hasValidScreenshot = tab.screenshot && typeof tab.screenshot === 'string' && tab.screenshot.length > 0;
    
    // Add classes
    if (hasValidScreenshot) {
      tabCard.classList.add('has-screenshot');
    } else {
      tabCard.classList.add('has-favicon');
    }
    
    if (index === state.selectedIndex) {
      tabCard.classList.add('selected');
    }
    
    if (tab.pinned) {
      tabCard.classList.add('pinned');
    }
    
    // Thumbnail
    const thumbnail = document.createElement('div');
    thumbnail.className = 'tab-thumbnail';
    
    if (hasValidScreenshot) {
      // Show screenshot only if it's valid
      const img = document.createElement('img');
      img.className = 'screenshot-img';
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
    const info = document.createElement('div');
    info.className = 'tab-info';
    
    // Header with favicon and title
    const header = document.createElement('div');
    header.className = 'tab-header';
    
    // Show favicon in header only if we have a screenshot (so it appears with URL)
    if (tab.favIconUrl && hasValidScreenshot) {
      const favicon = document.createElement('img');
      favicon.src = tab.favIconUrl;
      favicon.className = 'tab-favicon';
      favicon.onerror = () => favicon.style.display = 'none';
      header.appendChild(favicon);
    }
    
    const title = document.createElement('div');
    title.className = 'tab-title';
    title.textContent = tab.title;
    title.title = tab.title;
    header.appendChild(title);
    
    info.appendChild(header);
    
    // URL (only for screenshots)
    if (hasValidScreenshot) {
      const url = document.createElement('div');
      url.className = 'tab-url';
      url.textContent = tab.url;
      url.title = tab.url;
      info.appendChild(url);
    }
    
    tabCard.appendChild(info);
    
    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-close-btn';
    closeBtn.innerHTML = '×';
    closeBtn.title = 'Close tab';
    closeBtn.dataset.action = 'close';
    closeBtn.dataset.tabId = tab.id;
    tabCard.appendChild(closeBtn);
    
    return tabCard;
  }
  
  // Create favicon tile
  function createFaviconTile(tab) {
    const faviconTile = document.createElement('div');
    faviconTile.className = 'favicon-tile';
    
    if (tab.favIconUrl) {
      const favicon = document.createElement('img');
      favicon.src = tab.favIconUrl;
      favicon.className = 'favicon-large';
      favicon.onerror = () => {
        favicon.style.display = 'none';
        const letter = document.createElement('div');
        letter.className = 'favicon-letter';
        letter.textContent = (tab.title || 'T')[0].toUpperCase();
        faviconTile.appendChild(letter);
      };
      faviconTile.appendChild(favicon);
    } else {
      const letter = document.createElement('div');
      letter.className = 'favicon-letter';
      letter.textContent = (tab.title || 'T')[0].toUpperCase();
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
      if (target.dataset.action === 'close' || target.classList.contains('tab-close-btn')) {
        e.stopPropagation();
        const tabId = parseInt(target.dataset.tabId || target.parentElement.dataset.tabId);
        const index = parseInt(target.dataset.tabIndex || target.parentElement.dataset.tabIndex);
        
        if (tabId && !isNaN(tabId)) {
          closeTab(tabId, index);
        } else {
          console.error('[TAB SWITCHER] Invalid tab ID in close button:', target);
        }
        return;
      }
      
      // Handle tab card click
      const tabCard = target.closest('.tab-card');
      if (tabCard) {
        const tabId = parseInt(tabCard.dataset.tabId);
        if (tabId && !isNaN(tabId)) {
          switchToTab(tabId);
        } else {
          console.error('[TAB SWITCHER] Invalid tab ID in card:', tabCard);
        }
      }
    } catch (error) {
      console.error('[TAB SWITCHER] Error in handleGridClick:', error);
    }
  }
  
  // ============================================================================
  // KEYBOARD NAVIGATION (THROTTLED)
  // ============================================================================
  function handleKeyDown(e) {
    if (!state.isOverlayVisible) return;
    
    const isInSearchBox = e.target === state.domCache.searchBox;
    
    // Avoid double-handling when typing in the search box; allow Escape to bubble here
    if (isInSearchBox && e.key !== 'Escape') {
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
       switch(e.key) {
        case 'Escape':
          e.preventDefault();
          closeOverlay();
          break;
          
        case 'Enter':
          e.preventDefault();
          if (state.filteredTabs.length > 0 && state.selectedIndex >= 0 && state.selectedIndex < state.filteredTabs.length) {
            const selectedTab = state.filteredTabs[state.selectedIndex];
            if (selectedTab) {
              switchToTab(selectedTab.id);
            }
          }
          break;
          
        case 'Tab':
          e.preventDefault();
          if (e.shiftKey) {
            selectUp();
          } else {
            selectDown();
          }
          break;
          
        case 'ArrowRight':
          e.preventDefault();
          selectRight();
          break;
          
        case 'ArrowLeft':
          e.preventDefault();
          selectLeft();
          break;
          
        case 'ArrowDown':
          e.preventDefault();
          selectDown();
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          selectUp();
          break;
          
        case 'Delete':
          if (state.filteredTabs.length > 0 && state.selectedIndex >= 0 && state.selectedIndex < state.filteredTabs.length) {
            e.preventDefault();
            const tab = state.filteredTabs[state.selectedIndex];
            if (tab && tab.id) {
              closeTab(tab.id, state.selectedIndex);
            }
          }
          break;
      }
    } catch (error) {
      console.error('[TAB SWITCHER] Error in handleKeyDown:', error);
    }
  }
  
  function handleKeyUp(e) {
    // Reserved for future use
  }
  
  // ============================================================================
  // SEARCH HANDLING
  // ============================================================================
  function handleSearch(e) {
    try {
      const query = e.target.value.toLowerCase().trim();
      
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
      
      // Filter tabs
      const filtered = state.currentTabs.filter(tab => 
        tab && tab.title && tab.url &&
        (tab.title.toLowerCase().includes(query) || 
         tab.url.toLowerCase().includes(query))
      );
      
      state.filteredTabs = filtered;
      state.selectedIndex = 0;
      
      if (filtered.length > 50) {
        renderTabsVirtual(filtered);
      } else {
        renderTabsStandard(filtered);
      }
    } catch (error) {
      console.error('[TAB SWITCHER] Error in handleSearch:', error);
      // Fallback to showing all tabs
      state.filteredTabs = state.currentTabs;
      state.selectedIndex = 0;
      renderTabsStandard(state.currentTabs);
    }
  }
  
    function handleSearchKeydown(e) {
      try {
        // Allow Backspace to work normally for text editing
        if (e.key === 'Backspace') {
          // Don't prevent default - let it delete text naturally
          return;
        }
        
        // Delete key: Close selected tab even from search box
        if (e.key === 'Delete') {
          e.preventDefault();
          if (state.filteredTabs.length > 0 && state.selectedIndex >= 0 && state.selectedIndex < state.filteredTabs.length) {
            const tab = state.filteredTabs[state.selectedIndex];
            if (tab && tab.id) {
              closeTab(tab.id, state.selectedIndex);
            }
          }
          return;
        }
        
        // Tab key: Navigate down (Shift+Tab goes backward/up)
        if (e.key === 'Tab') {
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
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          selectDown();
          return;
        }
        
        // Arrow Up: Move to previous row (up)
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          selectUp();
          return;
        }
        
        // Arrow Right: Move to right in grid
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          selectRight();
          return;
        }
        
        // Arrow Left: Move to left in grid
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          selectLeft();
          return;
        }
        
        // Enter: Switch to selected tab
        if (e.key === 'Enter') {
          e.preventDefault();
          if (state.filteredTabs.length > 0 && state.selectedIndex >= 0 && state.selectedIndex < state.filteredTabs.length) {
            const selectedTab = state.filteredTabs[state.selectedIndex];
            if (selectedTab && selectedTab.id) {
              switchToTab(selectedTab.id);
            }
          }
          return;
        }
      } catch (error) {
        console.error('[TAB SWITCHER] Error in handleSearchKeydown:', error);
      }
    }
  
   // ============================================================================
    // SELECTION MANAGEMENT
    // ============================================================================
    function getGridColumns() {
      // Compute columns from actual card width and grid gap for accuracy
      if (!state.domCache.grid) return 1;
      const grid = state.domCache.grid;
      const cards = grid.querySelectorAll('.tab-card');
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
          console.warn('[TAB SWITCHER] No tabs available for navigation');
          return;
        }
        
        // Ensure selectedIndex is within valid range
        if (state.selectedIndex < 0 || state.selectedIndex >= state.filteredTabs.length) {
          state.selectedIndex = 0;
        } else {
          state.selectedIndex = state.selectedIndex + 1;
          if (state.selectedIndex >= state.filteredTabs.length) {
            state.selectedIndex = 0; // Wrap around to first tab
          }
        }
        updateSelection();
      } catch (error) {
        console.error('[TAB SWITCHER] Error in selectNext:', error);
      }
    }
    
    function selectPrevious() {
      try {
        // Get current filtered tabs count
        if (!state.filteredTabs || state.filteredTabs.length === 0) {
          console.warn('[TAB SWITCHER] No tabs available for navigation');
          return;
        }
        
        // Ensure selectedIndex is within valid range
        if (state.selectedIndex < 0 || state.selectedIndex >= state.filteredTabs.length) {
          state.selectedIndex = state.filteredTabs.length - 1;
        } else {
          state.selectedIndex = state.selectedIndex - 1;
          if (state.selectedIndex < 0) {
            state.selectedIndex = state.filteredTabs.length - 1; // Wrap around to last tab
          }
        }
        updateSelection();
      } catch (error) {
        console.error('[TAB SWITCHER] Error in selectPrevious:', error);
      }
    }
    
    function selectRight() {
      try {
        if (!state.filteredTabs || state.filteredTabs.length === 0) {
          console.warn('[TAB SWITCHER] No tabs available for navigation');
          return;
        }
        
        const columnCount = getGridColumns();
        const newIndex = state.selectedIndex + 1;
        
        // If moving right would keep us in the same row, move right
        if (Math.floor(newIndex / columnCount) === Math.floor(state.selectedIndex / columnCount)) {
          if (newIndex < state.filteredTabs.length) {
            state.selectedIndex = newIndex;
          } else {
            // At the end of the row, wrap to first column
            const rowStart = Math.floor(state.selectedIndex / columnCount) * columnCount;
            state.selectedIndex = rowStart; // Go to start of current row
          }
        } else {
          // Would move to next row, wrap to beginning of current row instead
          const rowStart = Math.floor(state.selectedIndex / columnCount) * columnCount;
          state.selectedIndex = rowStart;
        }
        
        updateSelection();
      } catch (error) {
        console.error('[TAB SWITCHER] Error in selectRight:', error);
      }
    }
    
    function selectLeft() {
      try {
        if (!state.filteredTabs || state.filteredTabs.length === 0) {
          console.warn('[TAB SWITCHER] No tabs available for navigation');
          return;
        }
        
        const columnCount = getGridColumns();
        const rowStart = Math.floor(state.selectedIndex / columnCount) * columnCount;
        const colInRow = state.selectedIndex - rowStart;
        
        if (colInRow > 0) {
          // Not at the start of row, move left within the row
          state.selectedIndex = state.selectedIndex - 1;
        } else {
          // At the start of row, wrap to end of row
          const rowEnd = Math.min(rowStart + columnCount - 1, state.filteredTabs.length - 1);
          state.selectedIndex = rowEnd;
        }
        
        updateSelection();
      } catch (error) {
        console.error('[TAB SWITCHER] Error in selectLeft:', error);
      }
    }
    
    function selectDown() {
      try {
        if (!state.filteredTabs || state.filteredTabs.length === 0) {
          console.warn('[TAB SWITCHER] No tabs available for navigation');
          return;
        }
        
        const columnCount = getGridColumns();
        const currentRow = Math.floor(state.selectedIndex / columnCount);
        const colInRow = state.selectedIndex - (currentRow * columnCount);
        const nextIndex = (currentRow + 1) * columnCount + colInRow;
        
        if (nextIndex < state.filteredTabs.length) {
          state.selectedIndex = nextIndex;
        } else {
          // Wrap to first item
          state.selectedIndex = 0;
        }
        
        updateSelection();
      } catch (error) {
        console.error('[TAB SWITCHER] Error in selectDown:', error);
      }
    }
    
    function selectUp() {
      try {
        if (!state.filteredTabs || state.filteredTabs.length === 0) {
          console.warn('[TAB SWITCHER] No tabs available for navigation');
          return;
        }
        
        const columnCount = getGridColumns();
        const currentRow = Math.floor(state.selectedIndex / columnCount);
        const colInRow = state.selectedIndex - (currentRow * columnCount);
        
        if (currentRow > 0) {
          // Move to previous row, same column
          state.selectedIndex = (currentRow - 1) * columnCount + colInRow;
        } else {
          // Wrap to last row, same column
          const totalRows = Math.ceil(state.filteredTabs.length / columnCount);
          const lastRowIndex = (totalRows - 1) * columnCount + colInRow;
          state.selectedIndex = Math.min(lastRowIndex, state.filteredTabs.length - 1);
        }
        
        updateSelection();
      } catch (error) {
        console.error('[TAB SWITCHER] Error in selectUp:', error);
      }
    }
  
  function updateSelection() {
    try {
      if (!state.domCache.grid) {
        console.warn('[TAB SWITCHER] Grid not available for selection update');
        return;
      }

      // If in virtual mode and selected card is outside current window, re-render
      const isVirtual = state.filteredTabs && state.filteredTabs.length > 50;
      if (isVirtual) {
        const { startIndex, endIndex } = state.virtualScroll;
        if (state.selectedIndex < startIndex || state.selectedIndex >= endIndex) {
          renderTabsVirtual(state.filteredTabs);
        }
      }

      // Find the card matching the selected logical index
      const grid = state.domCache.grid;
      const target = grid.querySelector(`.tab-card[data-tab-index="${state.selectedIndex}"]`);

      // Clear previous selection (only current DOM subset)
      grid.querySelectorAll('.tab-card.selected').forEach(el => el.classList.remove('selected'));

      if (!target) {
        // Nothing to select in DOM yet; rendering may be pending
        return;
      }

      requestAnimationFrame(() => {
        target.classList.add('selected');
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest'
        });
      });
    } catch (error) {
      console.error('[TAB SWITCHER] Error in updateSelection:', error);
    }
  }
  
  // ============================================================================
  // TAB ACTIONS
  // ============================================================================
  function switchToTab(tabId) {
    try {
      if (!tabId || typeof tabId !== 'number') {
        console.error('[TAB SWITCHER] Invalid tab ID:', tabId);
        return;
      }
      
      chrome.runtime.sendMessage({
        action: "switchToTab",
        tabId: tabId
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[TAB SWITCHER] Error switching to tab:', chrome.runtime.lastError.message);
        }
        closeOverlay();
      });
    } catch (error) {
      console.error('[TAB SWITCHER] Exception in switchToTab:', error);
      closeOverlay();
    }
  }
  
  function closeTab(tabId, index) {
    try {
      if (!tabId || typeof tabId !== 'number') {
        console.error('[TAB SWITCHER] Invalid tab ID for closing:', tabId);
        return;
      }
      
      // Validate that the tab exists in our current list
      const tabExists = state.currentTabs.some(tab => tab && tab.id === tabId);
      if (!tabExists) {
        console.warn('[TAB SWITCHER] Tab no longer exists:', tabId);
        // Refresh the tab list
        state.filteredTabs = state.filteredTabs.filter(tab => tab && tab.id !== tabId);
        state.currentTabs = state.currentTabs.filter(tab => tab && tab.id !== tabId);
        
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
      
      chrome.runtime.sendMessage({
        action: "closeTab",
        tabId: tabId
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[TAB SWITCHER] Error closing tab:', chrome.runtime.lastError.message);
          return;
        }
        
        if (response && response.success) {
          // Remove from current list
          state.currentTabs = state.currentTabs.filter(tab => tab && tab.id !== tabId);
          state.filteredTabs = state.filteredTabs.filter(tab => tab && tab.id !== tabId);
          
          // Adjust selected index
          if (state.filteredTabs.length > 0) {
            if (state.selectedIndex >= state.filteredTabs.length) {
              state.selectedIndex = Math.max(0, state.filteredTabs.length - 1);
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
      });
    } catch (error) {
      console.error('[TAB SWITCHER] Exception in closeTab:', error);
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
          state.overlay.style.opacity = '0';
        }
        
        setTimeout(() => {
          if (state.overlay) {
            state.overlay.style.display = 'none';
          }
          state.isOverlayVisible = false;
          
          // Cleanup
          document.removeEventListener('keydown', handleKeyDown);
          document.removeEventListener('keyup', handleKeyUp);
          
          if (state.intersectionObserver) {
            state.intersectionObserver.disconnect();
            state.intersectionObserver = null;
          }
        }, 200); // Match CSS transition
      });
    } catch (error) {
      console.error('[TAB SWITCHER] Error in closeOverlay:', error);
      // Force cleanup even on error
      state.isOverlayVisible = false;
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    }
  }
  
  // ============================================================================
  // INTERSECTION OBSERVER (LAZY LOADING)
  // ============================================================================
  function setupIntersectionObserver() {
    if (state.intersectionObserver) {
      state.intersectionObserver.disconnect();
    }
    
    state.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src && !img.src) {
            img.src = img.dataset.src;
            state.intersectionObserver.unobserve(img);
          }
        }
      });
    }, {
      rootMargin: '100px' // Load images 100px before they enter viewport
    });
    
    // Observe all lazy-load images
    const images = state.domCache.grid.querySelectorAll('img[data-src]');
    images.forEach(img => state.intersectionObserver.observe(img));
  }
  
  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================
  
  // Throttle function for performance
  function throttle(func, wait) {
    let timeout = null;
    let previous = 0;
    
    return function(...args) {
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
  console.log("Features: Virtual Scrolling, Event Delegation, GPU Acceleration");
  console.log("Target: <16ms interactions, 60fps, lazy loading");
  console.log("═══════════════════════════════════════════════════════");
  
})();
