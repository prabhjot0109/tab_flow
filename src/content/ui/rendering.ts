import { state, Tab, Group } from "../state";
import {
  closeOverlay,
  switchToTab,
  toggleMute,
  togglePlayPause,
  restoreSession,
  closeTab,
} from "../actions";

const DEBUG_LOGGING = false;
const log = (...args: unknown[]) => {
  if (DEBUG_LOGGING) {
    console.log(...args);
  }
};

const VIRTUAL_RENDER_THRESHOLD = 50;

function isListLayout(): boolean {
  const grid = state.domCache.grid;
  if (!grid) return false;
  return (
    grid.classList.contains("list-view") ||
    grid.classList.contains("search-mode") ||
    grid.classList.contains("recent-mode")
  );
}

export function shouldUseVirtualRendering(tabCount: number): boolean {
  return tabCount > VIRTUAL_RENDER_THRESHOLD && isListLayout();
}

// ============================================================================
// TAB CARD TEMPLATE (Performance Optimization)
// Template cloning is ~3x faster than creating elements individually
// ============================================================================
const TAB_CARD_TEMPLATE = document.createElement("template");
TAB_CARD_TEMPLATE.innerHTML = `
  <div class="tab-card" role="option" tabindex="-1" style="transform: translate3d(0, 0, 0);">
    <div class="tab-thumbnail"></div>
    <div class="tab-info">
      <div class="tab-header">
        <img class="tab-favicon" loading="lazy" decoding="async" style="display: none;">
        <div class="tab-title"></div>
      </div>
      <div class="tab-url" style="display: none;"></div>
    </div>
    <div class="tab-media-controls"></div>
    <button class="tab-close-btn" data-action="close" title="Close tab">×</button>
  </div>
`;

// ============================================================================
// SVG ICON TEMPLATES (DOM-based for security - no innerHTML)
// Using template elements with cloneNode instead of innerHTML for SVG icons
// ============================================================================
const SVG_NS = "http://www.w3.org/2000/svg";

function createSVGTemplate(pathD: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", pathD);
  svg.appendChild(path);
  return svg;
}

// Pre-create SVG templates for cloning (faster than innerHTML)
const SVG_PLAY_TEMPLATE = createSVGTemplate("M8 5v14l11-7z");
const SVG_PAUSE_TEMPLATE = createSVGTemplate("M6 19h4V5H6v14zm8-14v14h4V5h-4z");
const SVG_MUTE_TEMPLATE = createSVGTemplate(
  "M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"
);
const SVG_UNMUTE_TEMPLATE = createSVGTemplate(
  "M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"
);

// Helper to clone SVG template (safer than innerHTML)
function cloneSVG(template: SVGSVGElement): SVGSVGElement {
  return template.cloneNode(true) as SVGSVGElement;
}

// Create media control button with DOM API (no innerHTML)
function createMediaButton(
  className: string,
  action: string,
  svgTemplate: SVGSVGElement,
  title: string
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = className;
  btn.dataset.action = action;
  btn.title = title;
  btn.appendChild(cloneSVG(svgTemplate));
  return btn;
}

// ============================================================================
// RENDERING - STANDARD (< 50 tabs)
// ============================================================================
export function renderTabsStandard(tabs: Tab[]) {
  const startTime = performance.now();
  const grid = state.domCache.grid;
  if (!grid) return;

  // Clear grid and reset virtual list mode
  grid.innerHTML = "";
  grid.classList.remove("virtual-list");
  grid.style.minHeight = "";

  // ARIA accessibility: set listbox role for screen readers
  grid.setAttribute("role", "listbox");
  grid.setAttribute("aria-label", "Open tabs");

  if (tabs.length === 0) {
    const emptyMsg = document.createElement("div");
    emptyMsg.className = "tab-flow-empty";
    emptyMsg.textContent = "No tabs found";
    grid.appendChild(emptyMsg);
    return;
  }

  // Use DocumentFragment for batched DOM updates
  const fragment = document.createDocumentFragment();

  tabs.forEach((tab: Tab, index: number) => {
    const tabCard = createTabCard(tab, index);
    if (tab.isGroupHeader) {
      tabCard.dataset.isHeader = "true";
      // Ensure headers are not selectable in the same way, or handled differently
      // But for grid usage, they occupy a slot.
    }
    tabCard.dataset.tabIndex = String(index);
    fragment.appendChild(tabCard);
  });

  // Single DOM update
  grid.appendChild(fragment);
  // After rendering, ensure only one card is selected in DOM
  enforceSingleSelection(false);

  const duration = performance.now() - startTime;
  log(`[PERF] Rendered ${tabs.length} tabs in ${duration.toFixed(2)}ms`);
}

// ============================================================================
// RENDERING - VIRTUAL SCROLLING (50+ tabs)
// ============================================================================
export function renderTabsVirtual(tabs: Tab[]) {
  const startTime = performance.now();
  const grid = state.domCache.grid;
  if (!grid) return;

  // Clear grid and set virtual list mode
  grid.innerHTML = "";
  grid.classList.add("virtual-list");

  // ARIA accessibility: set listbox role for screen readers
  grid.setAttribute("role", "listbox");
  grid.setAttribute("aria-label", "Open tabs");

  if (tabs.length === 0) {
    const emptyMsg = document.createElement("div");
    emptyMsg.className = "tab-flow-empty";
    emptyMsg.textContent = "No tabs found";
    grid.appendChild(emptyMsg);
    return;
  }

  // Calculate visible range
  const itemHeight = 68; // 60px height + 8px margin
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
  const totalHeight = tabs.length * itemHeight;
  grid.style.minHeight = `${totalHeight}px`;

  // Render only visible tabs
  const fragment = document.createDocumentFragment();

  for (let i = startIndex; i < endIndex; i++) {
    const tab = tabs[i];
    const tabCard = createTabCard(tab, i);

    // Position absolutely for virtual scrolling
    tabCard.style.position = "absolute";
    tabCard.style.top = `${i * itemHeight}px`;
    tabCard.style.left = "0";
    tabCard.style.right = "0";

    fragment.appendChild(tabCard);
  }

  grid.appendChild(fragment);

  // Setup intersection observer for lazy loading
  setupIntersectionObserver();
  enforceSingleSelection(false);

  const duration = performance.now() - startTime;
  log(
    `[PERF] Virtual rendered ${endIndex - startIndex} of ${
      tabs.length
    } tabs in ${duration.toFixed(2)}ms`
  );
}

// ============================================================================
// CREATE TAB CARD (Template-based for ~3x faster rendering)
// ============================================================================
export function createTabCard(tab: Tab, index: number): HTMLElement {
  // Clone template (much faster than creating elements individually)
  const fragment = TAB_CARD_TEMPLATE.content.cloneNode(
    true
  ) as DocumentFragment;
  const tabCard = fragment.firstElementChild as HTMLElement;

  // Set data attributes
  if (tab && typeof tab.id === "number") {
    tabCard.dataset.tabId = String(tab.id);
  }
  if (tab?.sessionId) {
    tabCard.dataset.sessionId = tab.sessionId;
    tabCard.dataset.recent = "1";
  }
  if (tab?.isWebSearch) {
    tabCard.dataset.webSearch = "1";
    tabCard.dataset.searchQuery = tab.searchQuery;
  }
  tabCard.dataset.tabIndex = String(index);

  const tabTitle = tab.title ?? "Untitled";
  const tabUrl = tab.url ?? "";
  tabCard.setAttribute(
    "aria-selected",
    index === state.selectedIndex ? "true" : "false"
  );
  tabCard.setAttribute("aria-label", `${tabTitle} - ${tabUrl}`);

  // Determine if we should show screenshot or favicon
  const screenshot =
    typeof tab.screenshot === "string" && tab.screenshot.length > 0
      ? tab.screenshot
      : null;
  const hasValidScreenshot = Boolean(screenshot);

  // Add classes efficiently
  const classList = tabCard.classList;
  classList.add(hasValidScreenshot ? "has-screenshot" : "has-favicon");
  if (index === state.selectedIndex) classList.add("selected");
  if (tab.pinned) classList.add("pinned");
  if (tab.sessionId) classList.add("recent-item");

  // Tab Groups Support
  let groupColor: string | null = null;
  let groupTitle: string | null = null;
  if (tab.groupId && tab.groupId !== -1 && state.groups) {
    const group = state.groups.find((g) => g.id === tab.groupId);
    if (group) {
      groupColor = getGroupColor(group.color);
      groupTitle = group.title || "Group";
      tabCard.dataset.groupId = String(group.id);
      tabCard.style.borderLeft = `6px solid ${groupColor}`;
      tabCard.style.background = `linear-gradient(to right, ${groupColor}15, rgba(255,255,255,0.02))`;
    }
  }

  // Get cached DOM elements from template
  const thumbnail = tabCard.querySelector(".tab-thumbnail") as HTMLElement;
  const titleEl = tabCard.querySelector(".tab-title") as HTMLElement;
  const urlEl = tabCard.querySelector(".tab-url") as HTMLElement;
  const faviconEl = tabCard.querySelector(".tab-favicon") as HTMLImageElement;
  const mediaControls = tabCard.querySelector(
    ".tab-media-controls"
  ) as HTMLElement;
  const closeBtn = tabCard.querySelector(".tab-close-btn") as HTMLButtonElement;

  // Set title
  titleEl.textContent = tabTitle;
  titleEl.title = tabTitle;

  // Thumbnail content
  if (tab.sessionId || !screenshot) {
    // Show favicon tile
    const faviconTile = createFaviconTile(tab);
    thumbnail.appendChild(faviconTile);
  } else if (screenshot) {
    // Show screenshot
    const img = document.createElement("img");
    img.className = "screenshot-img";
    img.alt = tabTitle;
    img.loading = "lazy"; // Native lazy loading
    img.decoding = "async";
    // Load immediately if in viewport, otherwise lazy
    if (Math.abs(index - state.selectedIndex) < 10) {
      img.src = screenshot;
    } else {
      img.dataset.src = screenshot;
    }
    thumbnail.appendChild(img);
  }

  // Header favicon (only for screenshots)
  if (hasValidScreenshot) {
    let faviconUrl = tab.favIconUrl;
    if (!faviconUrl && tab.url) {
      try {
        const favUrl = new URL(chrome.runtime.getURL("/_favicon/"));
        favUrl.searchParams.set("pageUrl", tab.url);
        favUrl.searchParams.set("size", "16");
        faviconUrl = favUrl.toString();
      } catch {
        /* ignore */
      }
    }
    if (faviconUrl) {
      faviconEl.src = faviconUrl;
      faviconEl.style.display = "";
      faviconEl.onerror = () => {
        faviconEl.style.display = "none";
      };
    }

    // Show URL
    urlEl.textContent = tabUrl;
    urlEl.title = tabUrl;
    urlEl.style.display = "";
  }

  // Group pill
  if (groupColor && groupTitle) {
    const header = tabCard.querySelector(".tab-header") as HTMLElement;
    const pill = document.createElement("span");
    pill.className = "group-pill";
    pill.textContent = groupTitle;
    pill.style.cssText = `background-color:${groupColor};opacity:0.4;color:white;font-size:10px;font-weight:700;padding:2px 6px;border-radius:40px;margin-left:8px;white-space:nowrap;`;
    header.appendChild(pill);
  }

  // Media controls - create buttons dynamically with DOM API (no innerHTML for security)
  if (!tab.sessionId && !tab.isWebSearch) {
    const hasMediaElements = tab.hasMedia || false;
    const isAudible = tab.audible || false;
    const isMuted = tab.mutedInfo?.muted || false;
    const showMediaControls = hasMediaElements || isAudible || isMuted;

    if (hasMediaElements) classList.add("has-media");
    if (isAudible) classList.add("is-audible");
    if (isMuted) classList.add("is-muted");

    closeBtn.dataset.tabId = String(tab.id);

    if (showMediaControls) {
      // Create play/pause button with cloned SVG (no innerHTML)
      const playBtn = createMediaButton(
        "tab-play-btn visible",
        "play-pause",
        isAudible ? SVG_PAUSE_TEMPLATE : SVG_PLAY_TEMPLATE,
        isAudible ? "Pause tab" : "Play tab"
      );
      playBtn.dataset.tabId = String(tab.id);
      if (isAudible) playBtn.classList.add("playing");
      mediaControls.appendChild(playBtn);

      // Create mute button with cloned SVG (no innerHTML)
      const muteBtn = createMediaButton(
        "tab-mute-btn visible",
        "mute",
        isMuted ? SVG_MUTE_TEMPLATE : SVG_UNMUTE_TEMPLATE,
        isMuted ? "Unmute tab" : "Mute tab"
      );
      muteBtn.dataset.tabId = String(tab.id);
      if (isMuted) muteBtn.classList.add("muted");
      mediaControls.appendChild(muteBtn);
    }
  } else {
    // Hide media controls and close button for session/web search items
    mediaControls.style.display = "none";
    closeBtn.style.display = "none";
  }

  return tabCard;
}

// ============================================================================
// CREATE FAVICON TILE (Template-based)
// ============================================================================
const FAVICON_TILE_TEMPLATE = document.createElement("template");
FAVICON_TILE_TEMPLATE.innerHTML = `<div class="favicon-tile"><img class="favicon-large" loading="lazy" decoding="async"><div class="favicon-letter" style="display:none;"></div></div>`;

export function createFaviconTile(tab: Tab): HTMLElement {
  const fragment = FAVICON_TILE_TEMPLATE.content.cloneNode(
    true
  ) as DocumentFragment;
  const faviconTile = fragment.firstElementChild as HTMLElement;
  const favicon = faviconTile.querySelector(
    ".favicon-large"
  ) as HTMLImageElement;
  const letter = faviconTile.querySelector(".favicon-letter") as HTMLElement;

  // Use Chrome's favicon API if we have a URL
  let faviconUrl = tab.favIconUrl;
  if (!faviconUrl && tab.url) {
    try {
      const favUrl = new URL(chrome.runtime.getURL("/_favicon/"));
      favUrl.searchParams.set("pageUrl", tab.url);
      favUrl.searchParams.set("size", "32");
      faviconUrl = favUrl.toString();
    } catch {
      /* ignore */
    }
  }

  if (faviconUrl) {
    favicon.src = faviconUrl;
    favicon.onerror = () => {
      favicon.style.display = "none";
      letter.textContent = (tab.title || "T")[0].toUpperCase();
      letter.style.display = "";
    };
  } else {
    favicon.style.display = "none";
    letter.textContent = (tab.title || "T")[0].toUpperCase();
    letter.style.display = "";
  }

  return faviconTile;
}

export function applyGroupViewTransformation(tabs: Tab[]): Tab[] {
  // We no longer cluster tabs by group, as the user wants the MRU order from the background
  // script to be preserved ("listed as per recent opened").
  // Group colors are still rendered on the individual tab cards.
  return tabs;
}

export function enforceSingleSelection(scrollIntoView: boolean) {
  try {
    const grid = state.domCache.grid;
    if (!grid) return;
    // Remove any stale selections currently in DOM
    const selectedEls = grid.querySelectorAll(".tab-card.selected");
    selectedEls.forEach((el) => {
      el.classList.remove("selected");
      el.setAttribute("aria-selected", "false");
    });
    // Apply selection to the current index if present in DOM
    const target = grid.querySelector(
      `.tab-card[data-tab-index="${state.selectedIndex}"]`
    );
    if (!target) return;
    target.classList.add("selected");
    target.setAttribute("aria-selected", "true");

    // Update active descendant for screen readers
    grid.setAttribute(
      "aria-activedescendant",
      target.id || `tab-card-${state.selectedIndex}`
    );
    if (!target.id) target.id = `tab-card-${state.selectedIndex}`;

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
    console.error("[Tab Flow] Error enforcing selection:", error);
  }
}

export function updateSelection() {
  try {
    if (!state.domCache.grid) return;
    // Re-render window if virtual and out of range
    const isVirtual = shouldUseVirtualRendering(state.filteredTabs.length);
    if (isVirtual) {
      const { startIndex, endIndex } = state.virtualScroll;
      if (state.selectedIndex < startIndex || state.selectedIndex >= endIndex) {
        renderTabsVirtual(state.filteredTabs);
      }
    }
    enforceSingleSelection(true);
  } catch (error) {
    console.error("[Tab Flow] Error in updateSelection:", error);
  }
}

export function setupIntersectionObserver() {
  if (state.intersectionObserver) {
    state.intersectionObserver.disconnect();
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const img = entry.target;
        if (!(img instanceof HTMLImageElement)) return;

        if (img.dataset.src && !img.src) {
          img.src = img.dataset.src;
          observer.unobserve(img);
        }
      });
    },
    {
      rootMargin: "100px", // Load images 100px before they enter viewport
    }
  );

  state.intersectionObserver = observer;

  // Observe all lazy-load images
  const grid = state.domCache.grid;
  if (!grid) return;

  const images = grid.querySelectorAll("img[data-src]");
  images.forEach((img) => {
    observer.observe(img);
  });
}

// History Views
export function renderHistoryView(historyData: {
  back: Array<{ url: string; title: string }>;
  forward: Array<{ url: string; title: string }>;
}) {
  const grid = state.domCache.grid;
  if (!grid) return;

  grid.innerHTML = "";
  grid.className = "tab-flow-grid search-mode"; // Reuse search-mode for column layout

  const container = document.createElement("div");
  container.className = "history-view";

  // Reset history selection caches
  state.history.active = true;
  state.history.backEls = [];
  state.history.forwardEls = [];

  // Back Column
  const backCol = document.createElement("div");
  backCol.className = "history-column";

  const backHeader = document.createElement("div");
  backHeader.className = "history-column-header";
  backHeader.textContent = "← BACK";
  backCol.appendChild(backHeader);

  if (historyData.back && historyData.back.length > 0) {
    // Create container for history items
    const backItemsContainer = document.createElement("div");
    backItemsContainer.className = "history-items-container";

    historyData.back.forEach((entry, index) => {
      // Back history is reversed (most recent first), so index 0 is -1
      const item = createHistoryItem(entry, -(index + 1));
      item.dataset.column = "back";
      item.dataset.index = String(index);
      backItemsContainer.appendChild(item);
      state.history.backEls.push(item);
    });

    backCol.appendChild(backItemsContainer);
  } else {
    const empty = document.createElement("div");
    empty.className = "tab-flow-empty";
    empty.textContent = "No back history";
    empty.style.padding = "20px";
    empty.style.textAlign = "center";
    empty.style.color = "var(--text-muted)";
    backCol.appendChild(empty);
  }

  // Forward Column
  const fwdCol = document.createElement("div");
  fwdCol.className = "history-column";

  const fwdHeader = document.createElement("div");
  fwdHeader.className = "history-column-header";
  fwdHeader.textContent = "FORWARD →";
  fwdCol.appendChild(fwdHeader);

  if (historyData.forward && historyData.forward.length > 0) {
    // Create container for history items
    const fwdItemsContainer = document.createElement("div");
    fwdItemsContainer.className = "history-items-container";

    historyData.forward.forEach((entry, index) => {
      const item = createHistoryItem(entry, index + 1); // +1, +2, ...
      item.dataset.column = "forward";
      item.dataset.index = String(index);
      fwdItemsContainer.appendChild(item);
      state.history.forwardEls.push(item);
    });

    fwdCol.appendChild(fwdItemsContainer);
  } else {
    const empty = document.createElement("div");
    empty.className = "tab-flow-empty";
    empty.textContent = "No forward history";
    empty.style.padding = "20px";
    empty.style.textAlign = "center";
    empty.style.color = "var(--text-muted)";
    fwdCol.appendChild(empty);
  }

  container.appendChild(backCol);
  container.appendChild(fwdCol);
  grid.appendChild(container);

  // Choose a default selection
  if (state.history.backEls.length > 0) {
    state.history.column = "back";
    state.history.index = 0;
  } else if (state.history.forwardEls.length > 0) {
    state.history.column = "forward";
    state.history.index = 0;
  }
  updateHistorySelection();
}

export function createHistoryItem(
  entry: string | { url: string; title?: string },
  delta: number
) {
  // Handle both string (legacy) and object (new) formats
  const url = typeof entry === "string" ? entry : entry.url;
  const title = typeof entry === "string" ? entry : entry.title || entry.url;

  const item = document.createElement("div");
  item.className = "history-item";
  item.tabIndex = 0;
  item.dataset.delta = String(delta);

  item.onclick = () => {
    // Use browser's native history API directly for reliable navigation
    window.history.go(delta);
    closeOverlay();
  };

  item.onkeydown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      window.history.go(delta);
      closeOverlay();
    }
  };

  // Favicon
  const faviconImg = document.createElement("img");
  faviconImg.className = "history-favicon";
  try {
    const favUrl = new URL(chrome.runtime.getURL("/_favicon/"));
    favUrl.searchParams.set("pageUrl", url);
    favUrl.searchParams.set("size", "16");
    faviconImg.src = favUrl.toString();
  } catch {
    // Ignore
  }

  const content = document.createElement("div");
  content.className = "history-item-content";

  const titleDiv = document.createElement("div");
  titleDiv.className = "history-item-title";
  titleDiv.textContent = title;
  titleDiv.title = title;

  const urlDiv = document.createElement("div");
  urlDiv.className = "history-item-url";
  try {
    const urlObj = new URL(url);
    urlDiv.textContent = urlObj.hostname + urlObj.pathname;
  } catch {
    urlDiv.textContent = url;
  }
  urlDiv.title = url;

  content.appendChild(titleDiv);
  content.appendChild(urlDiv);
  item.appendChild(faviconImg);
  item.appendChild(content);

  return item;
}

export function updateHistorySelection() {
  const backEls = state.history.backEls || [];
  const forwardEls = state.history.forwardEls || [];
  for (const el of backEls) el.classList.remove("selected");
  for (const el of forwardEls) el.classList.remove("selected");

  const list = state.history.column === "forward" ? forwardEls : backEls;
  if (!list.length) return;

  const idx = Math.min(Math.max(0, state.history.index), list.length - 1);
  state.history.index = idx;
  const selected = list[idx];
  if (selected) {
    selected.classList.add("selected");
    selected.scrollIntoView({ block: "nearest" });
  }
}

export function activateSelectedHistoryItem() {
  const backEls = state.history.backEls || [];
  const forwardEls = state.history.forwardEls || [];
  const list = state.history.column === "forward" ? forwardEls : backEls;
  const el = list[state.history.index];
  if (!el) return;
  const delta = Number(el.dataset.delta);
  if (!Number.isFinite(delta)) return;
  // Use browser's native history API directly
  window.history.go(delta);
  closeOverlay();
}

function getGroupColor(colorName: string) {
  const colors: Record<string, string> = {
    grey: "#bdc1c6",
    blue: "#8ab4f8",
    red: "#f28b82",
    yellow: "#fdd663",
    green: "#81c995",
    pink: "#ff8bcb",
    purple: "#c58af9",
    cyan: "#78d9ec",
    orange: "#fcad70",
  };
  return colors[colorName] || colorName;
}
