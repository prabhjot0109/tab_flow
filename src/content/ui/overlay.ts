import { state } from "../state";
import { SHADOW_CSS, SHADOW_HOST_ID } from "./styles";
import {
  closeOverlay,
  switchToActive,
  switchToRecent,
  setViewMode,
} from "../actions";
import { createSmartSearchHandler } from "../input/search";
import {
  handleSearchKeydown,
  handleGridClick,
  handleKeyDown,
  handleKeyUp,
} from "../input/keyboard";
import {
  renderTabsStandard,
  renderTabsVirtual,
  enforceSingleSelection,
  applyGroupViewTransformation,
} from "./rendering";
import * as focus from "../input/focus";

export function ensureShadowRoot() {
  try {
    if (!state.host || !state.host.isConnected) {
      state.shadowRoot = null;
      state.styleElement = null;
      const existingHost = document.getElementById(SHADOW_HOST_ID);
      if (existingHost) {
        state.host = existingHost;
      } else {
        const host = document.createElement("tab-switcher-mount");
        host.id = SHADOW_HOST_ID;
        // CRITICAL: Complete isolation from host page
        host.style.cssText = `
        all: initial !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 0 !important;
        height: 0 !important;
        min-width: 0 !important;
        min-height: 0 !important;
        max-width: 0 !important;
        max-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
        overflow: visible !important;
        z-index: 2147483647 !important;
        pointer-events: none !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        contain: layout style !important;
        isolation: isolate !important;
      `;
        (document.body || document.documentElement).appendChild(host);
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
    if (!state.styleElement || !state.shadowRoot.contains(state.styleElement)) {
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

export function createOverlay() {
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
  grid.setAttribute("role", "listbox");
  grid.setAttribute("aria-label", "Open tabs");
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
     <span><kbd>/</kbd> History</span>
     <span><kbd>?</kbd> Web Search</span>
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

export function showTabSwitcher(tabs, activeTabId, groups = []) {
  const startTime = performance.now();

  console.log(
    `[TAB SWITCHER] Opening with ${tabs.length} tabs and ${groups.length} groups`
  );

  if (state.isOverlayVisible && !state.isClosing) return;

  // Cancel any pending close
  if (state.closeTimeout) {
    clearTimeout(state.closeTimeout);
    state.closeTimeout = null;
  }
  state.isClosing = false;
  state.isOverlayVisible = true;

  createOverlay();

  // Ensure visual state is correct immediately
  if (state.overlay) {
    state.overlay.style.display = "flex";
    // Force a reflow or just assume RAF handles the transition reset?
    // If we are fading out (opacity 0.5 -> 0), we want to snap back to 1 or fade in?
    // Use RAF to ensure it transitions nicely if possible, or just snap if it feels faster.
    // Snapping to 1 is safer for "instant" feel if user mashed the key.

    // But let's keep the fade-in animation logic from below, just ensure we start from current opacity if possible.
    // Actually, standard logic below sets opacity to 0 then 1.
    // If we are "rescuing" a closing overlay, we might just want to set opacity 1.

    // Let's assume standard flow:
    // If we are recovering, we might want to skip the "set opacity 0" step if it's already visible?
    // No, let's keep it simple: Reset to 0 then animate to 1 ensures consistency, BUT causes flicker if it was at 0.5.

    // Better:
    // If it was closing, we want to reverse the fade (0 -> 1).
    // If it was already visible (but closing), opacity is animating to 0.
    // We set it to computed style opacity?
    // state.overlay.style.opacity = "0" was set in closeOverlay.
    // So it is fading to 0.

    // Let's just reset the animation.
    state.overlay.style.opacity = "0";
  }

  state.activeTabs = tabs;
  state.currentTabs = tabs;
  state.filteredTabs = applyGroupViewTransformation(tabs);
  state.groups = groups;
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

  // Make visible immediately to allow focus and event trapping
  state.overlay.style.display = "flex";
  state.overlay.style.opacity = "0";
  state.isOverlayVisible = true;

  // Blur page and focus search immediately
  focus.blurPageElements();
  if (state.domCache.searchBox) {
    state.domCache.searchBox.value = "";
    state.domCache.searchBox.focus();
  }

  // Animate opacity using RAF
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (state.overlay) {
        state.overlay.style.opacity = "1";
      }
    });
  });

  // Add keyboard listeners
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("keyup", handleKeyUp);

  // Aggressive Focus Enforcement: Prevent page from stealing focus or receiving keys
  // Using capture phase (true) to intercept events before they reach page elements
  document.addEventListener("focus", focus.handleGlobalFocus, true);
  document.addEventListener("focusin", focus.handleGlobalFocusIn, true);
  document.addEventListener("keydown", focus.handleGlobalKeydown, true);
  document.addEventListener("keypress", focus.handleGlobalKeydown, true);
  document.addEventListener("keyup", focus.handleGlobalKeydown, true);
  document.addEventListener("input", focus.handleGlobalInput, true);
  document.addEventListener("beforeinput", focus.handleGlobalInput, true);
  document.addEventListener("textInput", focus.handleGlobalInput, true);
  document.addEventListener("click", focus.handleGlobalClick, true);
  document.addEventListener("mousedown", focus.handleGlobalClick, true);

  // Block composition events
  document.addEventListener(
    "compositionstart",
    focus.handleGlobalComposition,
    true
  );
  document.addEventListener(
    "compositionupdate",
    focus.handleGlobalComposition,
    true
  );
  document.addEventListener(
    "compositionend",
    focus.handleGlobalComposition,
    true
  );

  // Periodic focus check
  if (state.focusInterval) clearInterval(state.focusInterval);
  state.focusInterval = setInterval(() => {
    if (state.isOverlayVisible && state.domCache.searchBox) {
      if (document.activeElement !== state.domCache.searchBox) {
        state.domCache.searchBox.focus();
      }
    }
  }, 100);
}
