import { state, Tab, Group } from "../state";
import {
  closeOverlay,
  switchToTab,
  toggleMute,
  togglePlayPause,
  restoreSession,
  closeTab,
} from "../actions";

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

  if (tabs.length === 0) {
    const emptyMsg = document.createElement("div");
    emptyMsg.className = "tab-switcher-empty";
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
  console.log(
    `[PERF] Rendered ${tabs.length} tabs in ${duration.toFixed(2)}ms`
  );
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

  if (tabs.length === 0) {
    const emptyMsg = document.createElement("div");
    emptyMsg.className = "tab-switcher-empty";
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
  console.log(
    `[PERF] Virtual rendered ${endIndex - startIndex} of ${
      tabs.length
    } tabs in ${duration.toFixed(2)}ms`
  );
}

// ============================================================================
// CREATE TAB CARD
// ============================================================================
export function createTabCard(tab: Tab, index: number) {
  const tabCard = document.createElement("div");
  tabCard.className = "tab-card";
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
  tabCard.setAttribute("role", "option");
  tabCard.setAttribute(
    "aria-selected",
    index === state.selectedIndex ? "true" : "false"
  );

  const tabTitle = tab.title ?? "Untitled";
  const tabUrl = tab.url ?? "";
  tabCard.setAttribute("aria-label", `${tabTitle} - ${tabUrl}`);
  tabCard.tabIndex = -1; // Managed focus
  tabCard.style.transform = "translate3d(0, 0, 0)"; // GPU acceleration

  // Determine if we should show screenshot or favicon
  const screenshot =
    typeof tab.screenshot === "string" && tab.screenshot.length > 0
      ? tab.screenshot
      : null;
  const hasValidScreenshot = Boolean(screenshot);

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

  // Tab Groups Support (Visuals for item)
  if (tab.groupId && tab.groupId !== -1 && state.groups) {
    const group = state.groups.find((g) => g.id === tab.groupId);
    if (group) {
      const groupColor = getGroupColor(group.color);
      const groupTitle = group.title || "Group";
      tabCard.dataset.groupId = String(group.id);

      // More prominent group indicator: thicker border and subtle background tint
      tabCard.style.borderLeft = `6px solid ${groupColor}`;
      // Add a very subtle gradient that fades from the group color
      tabCard.style.background = `linear-gradient(to right, ${groupColor}15, rgba(255,255,255,0.02))`;

      // Store group info for later if needed (though we'll use it in header.appendChild(pill) below)
      (tab as any)._groupColor = groupColor;
      (tab as any)._groupTitle = groupTitle;
    }
  }

  // Thumbnail
  const thumbnail = document.createElement("div");
  thumbnail.className = "tab-thumbnail";

  if (tab.sessionId) {
    // Recent item: always show favicon tile (compact row)
    tabCard.classList.add("recent-item");
    const faviconTile = createFaviconTile(tab);
    thumbnail.appendChild(faviconTile);
  } else if (screenshot) {
    // Show screenshot only if it's valid
    const img = document.createElement("img");
    img.className = "screenshot-img";
    img.dataset.src = screenshot; // Lazy loading
    img.alt = tabTitle;

    // Load immediately if in viewport, otherwise lazy load
    if (Math.abs(index - state.selectedIndex) < 10) {
      img.src = screenshot;
    }

    thumbnail.appendChild(img);
  } else {
    // Show favicon tile - simple and consistent
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

  // Show favicon in header if we have a screenshot (favicon already shown in tile otherwise)
  if (hasValidScreenshot) {
    // Get favicon URL - use Chrome's favicon API if favIconUrl not available
    let faviconUrl = tab.favIconUrl;
    if (!faviconUrl && tab.url) {
      try {
        const favUrl = new URL(chrome.runtime.getURL("/_favicon/"));
        favUrl.searchParams.set("pageUrl", tab.url);
        favUrl.searchParams.set("size", "16");
        faviconUrl = favUrl.toString();
      } catch {
        // Ignore URL parsing errors
      }
    }

    if (faviconUrl) {
      const favicon = document.createElement("img");
      favicon.src = faviconUrl;
      favicon.className = "tab-favicon";
      favicon.onerror = () => {
        favicon.style.display = "none";
      };
      header.appendChild(favicon);
    }
  }

  const title = document.createElement("div");
  title.className = "tab-title";
  title.textContent = tabTitle;
  title.title = tabTitle;
  header.appendChild(title);

  // Secondary group indicator: small pill in the header
  const gColor = tab._groupColor;
  const gTitle = tab._groupTitle;
  if (gColor) {
    const pill = document.createElement("span");
    pill.className = "group-pill";
    pill.textContent = gTitle || "";
    pill.style.backgroundColor = gColor;
    pill.style.opacity = "0.4"; // Slightly more opaque
    pill.style.color = "white"; // White text for better contrast on colors
    pill.style.fontSize = "10px";
    pill.style.fontWeight = "700"; // Bolder
    pill.style.padding = "2px 6px";
    pill.style.borderRadius = "40px"; // Pill shape
    pill.style.marginLeft = "8px";
    pill.style.alignSelf = "center";
    pill.style.whiteSpace = "nowrap";
    header.appendChild(pill);
  }

  info.appendChild(header);

  // URL (only for screenshots where we display more detail)
  if (hasValidScreenshot) {
    const url = document.createElement("div");
    url.className = "tab-url";
    url.textContent = tabUrl;
    url.title = tabUrl;
    info.appendChild(url);
  }

  tabCard.appendChild(info);

  // Audio/Mute/Play Buttons - Moved to card level for list view compatibility
  if (!tab.sessionId && !tab.isWebSearch) {
    // Determine media state - more comprehensive check
    const hasMediaElements = tab.hasMedia || false;
    const isAudible = tab.audible || false;
    const isMuted = tab.mutedInfo?.muted || false;
    const showMediaControls = hasMediaElements || isAudible || isMuted;

    // Add classes to tabCard for CSS styling
    if (hasMediaElements) tabCard.classList.add("has-media");
    if (isAudible) tabCard.classList.add("is-audible");
    if (isMuted) tabCard.classList.add("is-muted");

    const mediaControls = document.createElement("div");
    mediaControls.className = "tab-media-controls";

    // Play/Pause Button - show if tab has media or is audible
    const playBtn = document.createElement("button");
    playBtn.className = "tab-play-btn";
    playBtn.dataset.action = "play-pause";
    playBtn.dataset.tabId = String(tab.id);

    if (showMediaControls) {
      if (isAudible) {
        playBtn.classList.add("playing");
        playBtn.title = "Pause tab";
        playBtn.innerHTML =
          '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
      } else {
        playBtn.title = "Play tab";
        playBtn.innerHTML =
          '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
      }
      // Make visible since we have media
      playBtn.classList.add("visible");
    } else {
      // Hide if no media detected
      playBtn.style.display = "none";
    }

    // Mute Button - show if tab has media, is audible, or is muted
    const muteBtn = document.createElement("button");
    muteBtn.className = "tab-mute-btn";
    muteBtn.title = isMuted ? "Unmute tab" : "Mute tab";
    muteBtn.dataset.action = "mute";
    muteBtn.dataset.tabId = String(tab.id);

    if (isMuted) {
      muteBtn.classList.add("muted");
      muteBtn.classList.add("visible");
      muteBtn.innerHTML =
        '<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>';
    } else {
      muteBtn.innerHTML =
        '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
      // Show persistently if tab has media or is audible
      if (showMediaControls) {
        muteBtn.classList.add("visible");
      }
    }

    mediaControls.appendChild(playBtn);
    mediaControls.appendChild(muteBtn);
    tabCard.appendChild(mediaControls);
  }

  // Close button (only for active tabs view and not web search)
  if (!tab.sessionId && !tab.isWebSearch) {
    const closeBtn = document.createElement("button");
    closeBtn.className = "tab-close-btn";
    closeBtn.innerHTML = "×";
    closeBtn.title = "Close tab";
    closeBtn.dataset.action = "close";
    if (tab.id) closeBtn.dataset.tabId = String(tab.id);
    tabCard.appendChild(closeBtn);
  }

  return tabCard;
}

// createGroupHeaderCard removed as it's no longer used

// Create favicon tile - simple approach using Chrome's favicon API
export function createFaviconTile(tab: Tab) {
  const faviconTile = document.createElement("div");
  faviconTile.className = "favicon-tile";

  // Use Chrome's favicon API if we have a URL
  let faviconUrl = tab.favIconUrl;
  if (!faviconUrl && tab.url) {
    try {
      const favUrl = new URL(chrome.runtime.getURL("/_favicon/"));
      favUrl.searchParams.set("pageUrl", tab.url);
      favUrl.searchParams.set("size", "32");
      faviconUrl = favUrl.toString();
    } catch {
      // Ignore URL parsing errors
    }
  }

  if (faviconUrl) {
    const favicon = document.createElement("img");
    favicon.src = faviconUrl;
    favicon.className = "favicon-large";
    favicon.onerror = () => {
      // Simple letter fallback - no gradients
      favicon.style.display = "none";
      const letter = document.createElement("div");
      letter.className = "favicon-letter";
      letter.textContent = (tab.title || "T")[0].toUpperCase();
      faviconTile.appendChild(letter);
    };
    faviconTile.appendChild(favicon);
  } else {
    // Simple letter fallback - no gradients
    const letter = document.createElement("div");
    letter.className = "favicon-letter";
    letter.textContent = (tab.title || "T")[0].toUpperCase();
    faviconTile.appendChild(letter);
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
    console.error("[TAB SWITCHER] Error enforcing selection:", error);
  }
}

export function updateSelection() {
  try {
    if (!state.domCache.grid) return;
    // Re-render window if virtual and out of range
    const isVirtual = state.filteredTabs && state.filteredTabs.length > 50;
    if (isVirtual) {
      const { startIndex, endIndex } = state.virtualScroll;
      if (state.selectedIndex < startIndex || state.selectedIndex >= endIndex) {
        renderTabsVirtual(state.filteredTabs);
      }
    }
    enforceSingleSelection(true);
  } catch (error) {
    console.error("[TAB SWITCHER] Error in updateSelection:", error);
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
  images.forEach((img) => observer.observe(img));
}

// History Views
export function renderHistoryView(historyData: {
  back: Array<{ url: string; title: string }>;
  forward: Array<{ url: string; title: string }>;
}) {
  const grid = state.domCache.grid;
  if (!grid) return;

  grid.innerHTML = "";
  grid.className = "tab-switcher-grid search-mode"; // Reuse search-mode for column layout

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
    empty.className = "tab-switcher-empty";
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
    empty.className = "tab-switcher-empty";
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
