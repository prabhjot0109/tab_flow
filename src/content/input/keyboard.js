import { state } from '../state.js';
import { closeOverlay, switchToTab, toggleMute, restoreSession, closeTab, switchToActive, switchToRecent } from '../actions.js';
import { updateSelection, updateHistorySelection, activateSelectedHistoryItem } from '../ui/rendering.js';

export function handleGridClick(e) {
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

      if (tabId && !Number.isNaN(tabId)) {
        closeTab(tabId, index);
      }
      return;
    }

    // Handle mute button
    if (target.dataset.action === "mute" || target.closest(".tab-mute-btn")) {
      e.stopPropagation();
      const btn = target.closest(".tab-mute-btn");
      const tabId = parseInt(btn.dataset.tabId);

      if (tabId && !Number.isNaN(tabId)) {
        toggleMute(tabId, btn);
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
      if (tabId && !Number.isNaN(tabId)) {
        switchToTab(tabId);
      } else {
        console.error("[TAB SWITCHER] Invalid tab ID in card:", tabCard);
      }
    }
  } catch (error) {
    console.error("[TAB SWITCHER] Error in handleGridClick:", error);
  }
}

function isHistoryModeActive() {
  const v =
    (state.domCache?.searchBox &&
    typeof state.domCache.searchBox.value === "string"
      ? state.domCache.searchBox.value
      : "") || "";
  return v.trim().startsWith(",");
}

export function handleKeyDown(e) {
  if (!state.isOverlayVisible) return;

  const isInSearchBox = e.target === state.domCache.searchBox;
  const isInHistoryMode = isHistoryModeActive() && state.history.active;

  // In history mode, allow arrow keys and Enter through even from search box
  const historyNavKeys = [
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Enter",
  ];
  const isHistoryNavKey = isInHistoryMode && historyNavKeys.includes(e.key);

  // Avoid double-handling when typing in the search box; allow Escape and history nav keys through
  if (isInSearchBox && e.key !== "Escape" && !isHistoryNavKey) {
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
    // History mode keyboard navigation
    if (isInHistoryMode) {
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          closeOverlay();
          return;

        case "Enter":
          e.preventDefault();
          activateSelectedHistoryItem();
          return;

        case "ArrowDown": {
          e.preventDefault();
          const list =
            state.history.column === "forward"
              ? state.history.forwardEls
              : state.history.backEls;
          if (list.length) {
            state.history.index = Math.min(
              state.history.index + 1,
              list.length - 1
            );
            updateHistorySelection();
          }
          return;
        }

        case "ArrowUp": {
          e.preventDefault();
          const list =
            state.history.column === "forward"
              ? state.history.forwardEls
              : state.history.backEls;
          if (list.length) {
            state.history.index = Math.max(state.history.index - 1, 0);
            updateHistorySelection();
          }
          return;
        }

        case "ArrowLeft": {
          e.preventDefault();
          if (
            state.history.column === "forward" &&
            state.history.backEls.length
          ) {
            state.history.column = "back";
            state.history.index = Math.min(
              state.history.index,
              state.history.backEls.length - 1
            );
            updateHistorySelection();
          }
          return;
        }

        case "ArrowRight": {
          e.preventDefault();
          if (
            state.history.column === "back" &&
            state.history.forwardEls.length
          ) {
            state.history.column = "forward";
            state.history.index = Math.min(
              state.history.index,
              state.history.forwardEls.length - 1
            );
            updateHistorySelection();
          }
          return;
        }
      }
    }

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
          if (tab?.id) {
            closeTab(tab.id, state.selectedIndex);
          }
        }
        break;
    }
  } catch (error) {
    console.error("[TAB SWITCHER] Error in handleKeyDown:", error);
  }
}

export function handleKeyUp() {
  // Reserved for future use
}

export function handleSearchKeydown(e) {
  try {
    // In history mode, let the main handleKeyDown deal with navigation
    const isInHistoryMode = isHistoryModeActive() && state.history.active;
    const historyNavKeys = [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Enter",
    ];
    if (isInHistoryMode && historyNavKeys.includes(e.key)) {
      // Don't handle here - let it bubble to handleKeyDown
      return;
    }

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
        if (tab?.id) closeTab(tab.id, state.selectedIndex);
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
        if (state.viewMode === "recent" && selectedTab?.sessionId) {
          restoreSession(selectedTab.sessionId);
        } else if (selectedTab?.isWebSearch) {
          window.open(
            `https://www.google.com/search?q=${encodeURIComponent(
              selectedTab.searchQuery
            )}`,
            "_blank"
          );
          closeOverlay();
        } else if (selectedTab?.id) {
          switchToTab(selectedTab.id);
        }
      }
      return;
    }
  } catch (error) {
    console.error("[TAB SWITCHER] Error in handleSearchKeydown:", error);
  }
}

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

export function selectNext() {
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
