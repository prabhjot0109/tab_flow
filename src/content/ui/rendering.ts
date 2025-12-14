import { state, Tab, Group } from "../state";
import {
  closeOverlay,
  switchToTab,
  toggleMute,
  restoreSession,
  closeTab,
  toggleGroupCollapse, // We will add this to actions.ts
} from "../actions";

// ============================================================================
// RENDERING - STANDARD (< 50 tabs)
// ============================================================================
export function renderTabsStandard(tabs: Tab[]) {
  const startTime = performance.now();
  const grid = state.domCache.grid;
  if (!grid) return;

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
  // Adjust height based on whether items are headers or cards?
  // For simplicity, assume uniform height or close enough.
  // TODO: Headers might be smaller, but sticking to 180px for now avoids complex offset math.
  const totalHeight = tabs.length * 180;
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
export function createTabCard(tab: Tab, index: number) {
  // SPECIAL HANDLE: GROUP HEADER
  if (tab.isGroupHeader) {
    return createGroupHeaderCard(tab, index);
  }

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
  tabCard.setAttribute("aria-label", `${tab.title} - ${tab.url}`);
  tabCard.tabIndex = -1; // Managed focus
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

  // Tab Groups Support (Visuals for item)
  let groupColor = null;
  let groupTitle = "";
  if (tab.groupId && tab.groupId !== -1 && state.groups) {
    const group = state.groups.find((g) => g.id === tab.groupId);
    if (group) {
      groupColor = getGroupColor(group.color);
      groupTitle = group.title || "Group";
      tabCard.dataset.groupId = String(group.id);
      // We still show the border for members even if grouped, for clarity
      tabCard.style.borderLeft = `4px solid ${groupColor}`;
    }
  }

  // Thumbnail
  const thumbnail = document.createElement("div");
  thumbnail.className = "tab-thumbnail";

  // Audio/Mute Button
  if (!tab.sessionId && !tab.isWebSearch) {
    const muteBtn = document.createElement("button");
    muteBtn.className = "tab-mute-btn";
    muteBtn.title = tab.mutedInfo?.muted ? "Unmute tab" : "Mute tab";
    muteBtn.dataset.action = "mute";
    muteBtn.dataset.tabId = String(tab.id);

    if (tab.mutedInfo?.muted) {
      muteBtn.classList.add("muted");
      muteBtn.innerHTML =
        '<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>';
    } else {
      muteBtn.innerHTML =
        '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
      // Only show persistently if audible
      if (tab.audible) {
        muteBtn.style.opacity = "0.9";
      }
    }

    thumbnail.appendChild(muteBtn);
  }

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
    // Show favicon OR Smart Placeholder
    const placeholder = getDomainPlaceholder(tab);
    if (placeholder) {
      thumbnail.appendChild(placeholder);
      tabCard.classList.add("has-placeholder");
    } else {
      const faviconTile = createFaviconTile(tab);
      thumbnail.appendChild(faviconTile);
    }
  }

  tabCard.appendChild(thumbnail);

  // Info section
  const info = document.createElement("div");
  info.className = "tab-info";

  // Header with favicon and title
  const header = document.createElement("div");
  header.className = "tab-header";

  // Show favicon in header only if we have a screenshot or placeholder (so it appears with URL)
  if (
    tab.favIconUrl &&
    (hasValidScreenshot || tabCard.classList.contains("has-placeholder"))
  ) {
    const favicon = document.createElement("img");
    favicon.src = tab.favIconUrl;
    favicon.className = "tab-favicon";
    favicon.onerror = () => {
      favicon.style.display = "none";
    };
    header.appendChild(favicon);
  }

  const title = document.createElement("div");
  title.className = "tab-title";
  title.textContent = tab.title;
  title.title = tab.title;
  header.appendChild(title);

  // Note: We deliberately do NOT show the group pill here anymore if we have headers,
  // to reduce clutter, OR we allow it as a secondary indicator.
  // Let's keep it for now as it's useful context if headers are scrolled away.
  if (groupColor) {
    const pill = document.createElement("span");
    pill.className = "group-pill";
    pill.textContent = groupTitle;
    pill.style.backgroundColor = groupColor;
    pill.style.opacity = "0.3";
    pill.style.color = "#202124";
    pill.style.fontSize = "10px";
    pill.style.fontWeight = "600";
    pill.style.padding = "2px 6px";
    pill.style.borderRadius = "4px";
    pill.style.marginLeft = "8px";
    pill.style.alignSelf = "center";
    pill.style.whiteSpace = "nowrap";
    header.appendChild(pill);
  }

  info.appendChild(header);

  // URL (only for screenshots or placeholders)
  if (hasValidScreenshot || tabCard.classList.contains("has-placeholder")) {
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
    if (tab.id) closeBtn.dataset.tabId = String(tab.id);
    tabCard.appendChild(closeBtn);
  }

  return tabCard;
}

function createGroupHeaderCard(tab: Tab, index: number) {
  const container = document.createElement("div");
  container.className = "tab-card group-header-card";
  container.dataset.groupId = String(tab.groupId);
  container.dataset.tabIndex = String(index);
  container.dataset.collapsed = state.collapsedGroups.has(tab.groupId)
    ? "true"
    : "false";

  // Style properties
  container.style.borderLeft = `6px solid ${tab.groupColor}`;
  container.style.background = `linear-gradient(to right, ${tab.groupColor}11, transparent)`; // Subtle tint

  if (index === state.selectedIndex) {
    container.classList.add("selected");
  }

  const content = document.createElement("div");
  content.className = "group-header-content";
  content.style.display = "flex";
  content.style.alignItems = "center";
  content.style.justifyContent = "space-between";
  content.style.width = "100%";
  content.style.padding = "0 16px";

  const left = document.createElement("div");
  left.style.display = "flex";
  left.style.alignItems = "center";
  left.style.gap = "12px";

  const title = document.createElement("span");
  title.textContent = tab.groupTitle || "Untitled Group";
  title.style.fontWeight = "600";
  title.style.fontSize = "14px";
  title.style.color = "var(--text-primary, #e8eaed)";

  const countBadge = document.createElement("span");
  // Find count - expensive search?
  const count = state.currentTabs.filter(
    (t) => t.groupId === tab.groupId
  ).length;
  countBadge.textContent = `${count} tabs`;
  countBadge.style.fontSize = "12px";
  countBadge.style.opacity = "0.7";

  left.appendChild(title);
  left.appendChild(countBadge);

  const right = document.createElement("div");
  const chevron = document.createElement("span");
  chevron.innerHTML = state.collapsedGroups.has(tab.groupId)
    ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>' // Checkpoint/Down? Actually Right if collapsed?
    : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"></polyline></svg>';

  // Actually standard UX: Chevron Right = Collapsed, Chevron Down = Expanded.
  // Let's swap
  if (state.collapsedGroups.has(tab.groupId)) {
    // Collapsed -> Show Right Chevron?
    // Usually headers simply toggle.
    chevron.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>'; // Right
  } else {
    chevron.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>'; // Down
  }

  right.appendChild(chevron);

  content.appendChild(left);
  content.appendChild(right);
  container.appendChild(content);

  // Click handler
  container.onclick = (e) => {
    e.stopPropagation();
    toggleGroupCollapse(tab.groupId);
  };

  return container;
}

// Create favicon tile
export function createFaviconTile(tab: Tab) {
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

// Generate a beautiful placeholder for restricted URLs
function getDomainPlaceholder(tab: Tab): HTMLElement | null {
  if (!tab.url) return null;

  // Check for restricted schemes or specific domains
  const protectedSchemes = [
    "chrome://",
    "edge://",
    "devtools://",
    "view-source:",
    "about:",
  ];
  const isProtected = protectedSchemes.some((s) => tab.url.startsWith(s));

  // Also optional: Check for specific domains like mail.google.com if screenshot is missing
  const urlObj = new URL(tab.url);
  const domain = urlObj.hostname;

  // Logic: If it's active tab, we shouldn't use placeholder unless we failed to capture.
  // The caller determines if we show this (e.g. if screenshot is null).

  if (!isProtected && !domain.includes("google.com")) {
    // For normal sites, let createFaviconTile handle it if we have no screenshot.
    // But user asked for "Fallback: ... generate a beautiful Placeholder ... for restricted URLs".
    // The user specifically mentioned "high-res Gmail logo... restricted URLs".
    // So I'll apply this primarily for known services and protected pages.
    return null;
  }

  const placeholder = document.createElement("div");
  placeholder.className = "tab-placeholder";
  placeholder.style.width = "100%";
  placeholder.style.height = "100%";
  placeholder.style.display = "flex";
  placeholder.style.flexDirection = "column";
  placeholder.style.alignItems = "center";
  placeholder.style.justifyContent = "center";

  // Dynamic Gradient based on domain
  let gradient = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"; // default violet
  let iconContent = domain[0].toUpperCase();
  let label = domain;

  if (tab.url.startsWith("chrome://")) {
    gradient = "linear-gradient(135deg, #2c3e50 0%, #3498db 100%)"; // Blue-Grey
    label = "Chrome System";
    iconContent = "⚙️";
  } else if (domain.includes("mail.google.com")) {
    gradient = "linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)"; // Soft Red
    iconContent = "✉️"; // Or use SVG if available
    label = "Gmail";
  } else if (domain.includes("calendar.google.com")) {
    gradient = "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"; // Cyan
    iconContent = "📅";
    label = "Calendar";
  } else if (domain.includes("docs.google.com")) {
    gradient = "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)"; // Green
    iconContent = "📝";
    label = "Docs";
  }

  placeholder.style.background = gradient;

  const icon = document.createElement("div");
  icon.textContent = iconContent;
  icon.style.fontSize = "48px";
  icon.style.marginBottom = "8px";
  icon.style.filter = "drop-shadow(0 2px 4px rgba(0,0,0,0.2))";

  const text = document.createElement("div");
  text.textContent = label;
  text.style.color = "white";
  text.style.fontFamily = "system-ui, sans-serif";
  text.style.fontWeight = "600";
  text.style.fontSize = "14px";
  text.style.textShadow = "0 1px 2px rgba(0,0,0,0.3)";

  placeholder.appendChild(icon);
  placeholder.appendChild(text);

  return placeholder;
}

export function applyGroupViewTransformation(tabs: Tab[]): Tab[] {
  if (!state.groups || state.groups.length === 0) return tabs;

  const result: Tab[] = [];
  const seenGroups = new Set<number>();

  for (const tab of tabs) {
    // If tab is in a group
    if (tab.groupId && tab.groupId !== -1) {
      if (seenGroups.has(tab.groupId)) {
        // Already processed this group
        continue;
      }

      // First time seeing this group: process it
      seenGroups.add(tab.groupId);

      const group = state.groups.find((g) => g.id === tab.groupId);
      if (!group) {
        // Group metadata missing, treat as normal
        result.push(tab);
        continue;
      }

      // 1. Add Group Header
      const header: Tab = {
        id: -1 * tab.groupId, // Negative ID to avoid collision
        isGroupHeader: true,
        groupId: tab.groupId,
        groupColor: getGroupColor(group.color),
        groupTitle: group.title,
        title: group.title, // For search logic if needed
        url: "",
        active: false,
      };
      result.push(header);

      // 2. Add Group Members (unless collapsed)
      const isCollapsed = state.collapsedGroups.has(tab.groupId);
      if (!isCollapsed) {
        // Find all members in the ORIGINAL list to preserve their data
        const members = tabs.filter((t) => t.groupId === tab.groupId);
        result.push(...members);
      }
    } else {
      // Ungrouped tab
      result.push(tab);
    }
  }

  return result;
}

export function enforceSingleSelection(scrollIntoView) {
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
  images.forEach((img) => {
    state.intersectionObserver.observe(img);
  });
}

// History Views
export function renderHistoryView(historyData) {
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

export function createHistoryItem(entry, delta) {
  // Handle both string (legacy) and object (new) formats
  const url = typeof entry === "string" ? entry : entry.url;
  const title = typeof entry === "string" ? entry : entry.title || entry.url;

  const item = document.createElement("div");
  item.className = "history-item";
  item.tabIndex = 0;
  item.dataset.delta = delta;

  item.onclick = () => {
    chrome.runtime.sendMessage({ action: "NAVIGATE_HISTORY", delta: delta });
    closeOverlay();
  };

  item.onkeydown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      chrome.runtime.sendMessage({
        action: "NAVIGATE_HISTORY",
        delta: delta,
      });
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
  chrome.runtime.sendMessage({ action: "NAVIGATE_HISTORY", delta });
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
