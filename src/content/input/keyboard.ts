import { state } from "../state";
import {
  closeOverlay,
  switchToTab,
  toggleMute,
  togglePlayPause,
  restoreSession,
  closeTab,
  switchToActive,
  switchToRecent,
  createGroup,
} from "../actions";
import {
  updateSelection,
  updateHistorySelection,
  activateSelectedHistoryItem,
} from "../ui/rendering";

export function handleGridClick(e: MouseEvent) {
  try {
    const target = e.target as HTMLElement;

    // Handle close button
    if (
      target.dataset.action === "close" ||
      target.classList.contains("tab-close-btn")
    ) {
      e.stopPropagation();
      const tabId = parseInt(
        target.dataset.tabId || target.parentElement!.dataset.tabId || "0"
      );
      const index = parseInt(
        target.dataset.tabIndex || target.parentElement!.dataset.tabIndex || "0"
      );

      if (tabId && !Number.isNaN(tabId)) {
        closeTab(tabId, index);
      }
      return;
    }

    // Handle mute button
    if (target.dataset.action === "mute" || target.closest(".tab-mute-btn")) {
      e.stopPropagation();
      const btn = target.closest(".tab-mute-btn") as HTMLElement;
      const tabId = parseInt(btn.dataset.tabId || "0");

      if (tabId && !Number.isNaN(tabId)) {
        toggleMute(tabId, btn);
      }
      return;
    }

    // Handle play button
    if (
      target.dataset.action === "play-pause" ||
      target.closest(".tab-play-btn")
    ) {
      e.stopPropagation();
      const btn = target.closest(".tab-play-btn") as HTMLElement;
      const tabId = parseInt(btn.dataset.tabId || "0");

      if (tabId && !Number.isNaN(tabId)) {
        togglePlayPause(tabId, btn);
      }
      return;
    }

    // Handle tab card click
    const tabCard = target.closest(".tab-card") as HTMLElement;
    if (!tabCard) return;

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

    const tabId = parseInt(tabCard.dataset.tabId || "0");
    if (tabId && !Number.isNaN(tabId)) {
      switchToTab(tabId);
    } else {
      console.error("[Tab Flow] Invalid tab ID in card:", tabCard);
    }
  } catch (error) {
    console.error("[Tab Flow] Error in handleGridClick:", error);
  }
}

function isHistoryModeActive() {
  const v =
    (state.domCache?.searchBox &&
    typeof state.domCache.searchBox.value === "string"
      ? state.domCache.searchBox.value
      : "") || "";
  return v.trim().startsWith(";");
}

export function handleKeyDown(e: KeyboardEvent) {
  if (!state.isOverlayVisible) return;

  // Escape closes the extension overlay.
  // Note: Browsers may still exit fullscreen on Escape.
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    if (typeof (e as any).stopImmediatePropagation === "function") {
      (e as any).stopImmediatePropagation();
    }
    closeOverlay();
    return;
  }

  const isInSearchBox =
    e.target === state.domCache.searchBox ||
    (e.composedPath &&
      state.domCache.searchBox &&
      e.composedPath().includes(state.domCache.searchBox));
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

  // Avoid double-handling when typing in the search box; allow history nav keys through
  if (isInSearchBox && !isHistoryNavKey) {
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
      case "Enter":
        e.preventDefault();
        if (
          state.filteredTabs.length > 0 &&
          state.selectedIndex >= 0 &&
          state.selectedIndex < state.filteredTabs.length
        ) {
          const selectedTab = state.filteredTabs[state.selectedIndex];
          if (selectedTab) {
            if (selectedTab.isWebSearch) {
              const q = (selectedTab.searchQuery || "").trim();
              if (q) {
                window.open(
                  `https://www.google.com/search?q=${encodeURIComponent(q)}`,
                  "_blank"
                );
                closeOverlay();
              }
            } else if (state.viewMode === "recent" && selectedTab.sessionId) {
              restoreSession(selectedTab.sessionId);
            } else if (selectedTab.id) {
              switchToTab(selectedTab.id);
            }
          }
        }
        break;

      case "Tab":
        e.preventDefault();
        // Tab key: web search (no '?' prefix)
        if (state.domCache?.searchBox) {
          const val = state.domCache.searchBox.value.trim();
          if (e.shiftKey) {
            selectPrevious();
          } else if (state.viewMode === "recent") {
            selectNext();
          } else if (val.length === 0) {
            // Empty: toggle web search mode on/off
            state.webSearch.active = !state.webSearch.active;
            state.domCache.searchBox.dispatchEvent(
              new Event("input", { bubbles: true })
            );
            state.domCache.searchBox.focus();
          } else if (!val.startsWith(";")) {
            // Has text (normal mode): search Google directly
            window.open(
              `https://www.google.com/search?q=${encodeURIComponent(val)}`,
              "_blank"
            );
            closeOverlay();
          } else {
            selectNext();
          }
        } else {
          if (e.shiftKey) {
            selectPrevious();
          } else {
            selectNext();
          }
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
        selectNext();
        break;

      case "ArrowUp":
        e.preventDefault();
        selectPrevious();
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

      case "g":
      case "G":
        if (e.altKey) {
          e.preventDefault();
          if (
            state.viewMode !== "recent" &&
            state.filteredTabs.length > 0 &&
            state.selectedIndex >= 0 &&
            state.selectedIndex < state.filteredTabs.length
          ) {
            const tab = state.filteredTabs[state.selectedIndex];
            if (tab?.id) {
              createGroup(tab.id);
            }
          }
        }
        break;
    }
  } catch (error) {
    console.error("[Tab Flow] Error in handleKeyDown:", error);
  }
}

export function handleKeyUp() {
  // Reserved for future use
}

export function handleSearchKeydown(e: KeyboardEvent) {
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
      // But prevent default to stop cursor movement in input
      e.preventDefault();
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
      const val = (e.target as HTMLInputElement).value || "";
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
      const val = (e.target as HTMLInputElement).value || "";
      if (val.length === 0 && state.webSearch.active) {
        e.preventDefault();
        state.webSearch.active = false;
        if (state.domCache?.searchBox) {
          state.domCache.searchBox.dispatchEvent(
            new Event("input", { bubbles: true })
          );
        }
        return;
      }
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

    // Tab key: Google search functionality
    if (e.key === "Tab") {
      e.preventDefault();
      const val = (e.target as HTMLInputElement).value || "";
      const trimmedVal = val.trim();

      if (e.shiftKey) {
        // Shift+Tab: navigate backward
        selectPrevious();
      } else if (state.viewMode === "recent") {
        selectNext();
      } else if (trimmedVal.length === 0) {
        // Empty search: toggle web search mode on/off
        state.webSearch.active = !state.webSearch.active;
        if (state.domCache?.searchBox) {
          state.domCache.searchBox.dispatchEvent(
            new Event("input", { bubbles: true })
          );
        }
      } else if (!trimmedVal.startsWith(";")) {
        // Has text and not in history mode: search Google directly
        window.open(
          `https://www.google.com/search?q=${encodeURIComponent(trimmedVal)}`,
          "_blank"
        );
        closeOverlay();
      } else {
        // Already in special mode: just navigate
        selectNext();
      }
      return;
    }

    // Arrow Down: Move to next item
    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectNext();
      return;
    }

    // Arrow Up: Move to previous item
    if (e.key === "ArrowUp") {
      e.preventDefault();
      selectPrevious();
      return;
    }

    // Arrow Right: Move to next item
    if (e.key === "ArrowRight") {
      e.preventDefault();
      selectRight();
      return;
    }

    // Arrow Left: Move to previous item
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
              selectedTab.searchQuery!
            )}`,
            "_blank"
          );
          closeOverlay();
        } else if (selectedTab?.id && selectedTab.id >= 0) {
          switchToTab(selectedTab.id);
        }
      }
      return;
    }
  } catch (error) {
    console.error("[Tab Flow] Error in handleSearchKeydown:", error);
  }
}

// Simple linear navigation - next item
export function selectNext() {
  if (!state.filteredTabs || state.filteredTabs.length === 0) return;
  state.selectedIndex++;
  if (state.selectedIndex >= state.filteredTabs.length) {
    state.selectedIndex = 0;
  }
  updateSelection();
}

// Simple linear navigation - previous item
export function selectPrevious() {
  if (!state.filteredTabs || state.filteredTabs.length === 0) return;
  state.selectedIndex--;
  if (state.selectedIndex < 0) {
    state.selectedIndex = state.filteredTabs.length - 1;
  }
  updateSelection();
}

function selectRight() {
  selectNext();
}

function selectLeft() {
  selectPrevious();
}




