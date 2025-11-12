// Content script for Visual Tab Switcher overlay
// ============================================================================
// PERFORMANCE-OPTIMIZED IMPLEMENTATION
// Virtual scrolling, event delegation, GPU acceleration, throttling
// Target: <16ms interactions, 60fps animations, <50MB memory
// ============================================================================

(function() {
  'use strict';
  
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  const state = {
    overlay: null,
    currentTabs: [],
    filteredTabs: [],
    selectedIndex: 0,
    isOverlayVisible: false,
    
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
  function createOverlay() {
    if (state.overlay) return;
    
    // Use DocumentFragment for efficient DOM construction
    const fragment = document.createDocumentFragment();
    
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
      <span><kbd>↑</kbd> <kbd>↓</kbd> <kbd>Tab</kbd> Navigate</span>
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
    
    document.body.appendChild(overlay);
    
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
    
    // Allow Backspace to work normally in search box (text deletion)
    // Only intercept Backspace when NOT in search box
    const isInSearchBox = e.target === state.domCache.searchBox;
    
    if (e.key === 'Backspace' && isInSearchBox) {
      // Let Backspace work normally for text editing in search box
      return;
    }
    
    // Throttle to 60fps
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
            // Shift+Tab: Navigate backwards (like Arrow Up/Left)
            selectPrevious();
          } else {
            // Tab: Navigate forwards (like Arrow Down/Right)
            selectNext();
          }
          break;
          
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          selectNext(); // Same as Tab
          break;
          
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          selectPrevious(); // Same as Shift+Tab
          break;
          
        case 'Delete':
          // Only close tab with Delete key, and only when NOT typing in search box
          if (!isInSearchBox && state.filteredTabs.length > 0 && state.selectedIndex >= 0 && state.selectedIndex < state.filteredTabs.length) {
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
      
      // Arrow Down or Tab: Move to next tab
      if (e.key === 'ArrowDown' || e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          // Shift+Tab: Move to previous tab
          selectPrevious();
        } else {
          // Tab or Arrow Down: Move to next tab
          selectNext();
        }
      } 
      // Arrow Up: Move to previous tab
      else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectPrevious();
      }
      // Enter: Switch to selected tab
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (state.filteredTabs.length > 0 && state.selectedIndex >= 0 && state.selectedIndex < state.filteredTabs.length) {
          const selectedTab = state.filteredTabs[state.selectedIndex];
          if (selectedTab && selectedTab.id) {
            switchToTab(selectedTab.id);
          }
        }
      }
    } catch (error) {
      console.error('[TAB SWITCHER] Error in handleSearchKeydown:', error);
    }
  }
  
  // ============================================================================
  // SELECTION MANAGEMENT
  // ============================================================================
  function selectNext() {
    try {
      // Get current filtered tabs count
      if (!state.filteredTabs || state.filteredTabs.length === 0) {
        console.warn('[TAB SWITCHER] No tabs available for navigation');
        return;
      }
      
      state.selectedIndex = (state.selectedIndex + 1) % state.filteredTabs.length;
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
      
      state.selectedIndex = (state.selectedIndex - 1 + state.filteredTabs.length) % state.filteredTabs.length;
      updateSelection();
    } catch (error) {
      console.error('[TAB SWITCHER] Error in selectPrevious:', error);
    }
  }
  
  function updateSelection() {
    try {
      if (!state.domCache.grid) {
        console.warn('[TAB SWITCHER] Grid not available for selection update');
        return;
      }
      
      const cards = state.domCache.grid.querySelectorAll('.tab-card');
      
      if (cards.length === 0) {
        console.warn('[TAB SWITCHER] No tab cards available');
        return;
      }
      
      // Batch DOM updates with requestAnimationFrame
      requestAnimationFrame(() => {
        cards.forEach((card, index) => {
          if (index === state.selectedIndex) {
            card.classList.add('selected');
            card.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'nearest',
              inline: 'nearest'
            });
          } else {
            card.classList.remove('selected');
          }
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
