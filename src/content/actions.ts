import { state, Tab } from "./state";
import * as handlers from "./input/keyboard";
import * as focus from "./input/focus";
import {
  renderTabsStandard,
  renderTabsVirtual,
  applyGroupViewTransformation,
} from "./ui/rendering";

export function closeOverlay() {
  try {
    if (!state.isOverlayVisible) return;

    // If already closing, don't restart logic, but ensure we don't break
    if (state.isClosing) return;

    state.isClosing = true;

    // Immediately restore page interaction, even while we fade out.
    focus.unlockPageInteraction();

    // GPU-accelerated fade-out
    requestAnimationFrame(() => {
      if (state.overlay) {
        state.overlay.style.opacity = "0";
      }

      if (state.closeTimeout) clearTimeout(state.closeTimeout);

      state.closeTimeout = setTimeout(() => {
        state.closeTimeout = null;
        state.isClosing = false;

        if (state.overlay) {
          state.overlay.style.display = "none";
        }
        state.isOverlayVisible = false;

        // Clear focus enforcement interval
        if (state.focusInterval) {
          clearInterval(state.focusInterval);
          state.focusInterval = null;
        }

        // Cleanup
        state.lastFullscreenElement = null;
        document.removeEventListener("keydown", handlers.handleKeyDown, true);
        document.removeEventListener("keyup", handlers.handleKeyUp, true);

        // Remove focus enforcement listeners
        document.removeEventListener("focus", focus.handleGlobalFocus, true);
        document.removeEventListener(
          "focusin",
          focus.handleGlobalFocusIn,
          true
        );
        document.removeEventListener(
          "keydown",
          focus.handleGlobalKeydown,
          true
        );
        document.removeEventListener(
          "keypress",
          focus.handleGlobalKeydown,
          true
        );
        document.removeEventListener("keyup", focus.handleGlobalKeydown, true);
        document.removeEventListener("input", focus.handleGlobalInput, true);
        document.removeEventListener(
          "beforeinput",
          focus.handleGlobalInput,
          true
        );
        document.removeEventListener(
          "textInput",
          focus.handleGlobalInput,
          true
        );
        document.removeEventListener("click", focus.handleGlobalClick, true);
        document.removeEventListener(
          "mousedown",
          focus.handleGlobalClick,
          true
        );

        // Remove composition event listeners
        document.removeEventListener(
          "compositionstart",
          focus.handleGlobalComposition,
          true
        );
        document.removeEventListener(
          "compositionupdate",
          focus.handleGlobalComposition,
          true
        );
        document.removeEventListener(
          "compositionend",
          focus.handleGlobalComposition,
          true
        );

        if (state.intersectionObserver) {
          state.intersectionObserver.disconnect();
          state.intersectionObserver = null;
        }

        // Clean up resize observer
        if (state.resizeObserver) {
          state.resizeObserver.disconnect();
          state.resizeObserver = null;
        }
      }, 200); // Match CSS transition
    });
  } catch (error) {
    console.error("[Tab Flow] Error in closeOverlay:", error);
    // Force cleanup even on error
    state.isOverlayVisible = false;
    state.isClosing = false;
    focus.unlockPageInteraction();
    if (state.focusInterval) {
      clearInterval(state.focusInterval);
      state.focusInterval = null;
    }
    // Try to remove listeners anyway
    try {
      document.removeEventListener("keydown", handlers.handleKeyDown, true);
      document.removeEventListener("keyup", handlers.handleKeyUp, true);
      document.removeEventListener("focus", focus.handleGlobalFocus, true);
      // ... assume others are removed or acceptable leak in error state
    } catch {}
  }
}

export function switchToTab(tabId: number) {
  try {
    if (!tabId || typeof tabId !== "number") {
      console.error("[Tab Flow] Invalid tab ID:", tabId);
      return;
    }

    try {
      chrome.runtime.sendMessage({ action: "switchToTab", tabId }, () => {
        if (chrome.runtime.lastError) {
          console.debug(
            "[Tab Flow] SW not ready:",
            chrome.runtime.lastError.message
          );
        }
      });
    } catch (msgErr: any) {
      console.debug(
        "[Tab Flow] sendMessage warn:",
        msgErr?.message || msgErr
      );
    }
    closeOverlay();
  } catch (error) {
    console.error("[Tab Flow] Exception in switchToTab:", error);
    closeOverlay();
  }
}

export function restoreSession(sessionId: string) {
  try {
    if (!sessionId) return;
    try {
      chrome.runtime.sendMessage(
        { action: "restoreSession", sessionId },
        () => {
          if (chrome.runtime.lastError) {
            console.debug(
              "[Tab Flow] SW not ready (restoreSession):",
              chrome.runtime.lastError.message
            );
          }
        }
      );
    } catch (msgErr: any) {
      console.debug(
        "[Tab Flow] sendMessage warn:",
        msgErr?.message || msgErr
      );
    }
    closeOverlay();
  } catch (error) {
    console.error("[Tab Flow] Exception in restoreSession:", error);
    closeOverlay();
  }
}

export function closeTab(tabId: number, index: number) {
  try {
    if (!tabId || typeof tabId !== "number") {
      console.error("[Tab Flow] Invalid tab ID for closing:", tabId);
      return;
    }

    const tabExists = state.currentTabs.some((tab) => tab && tab.id === tabId);
    if (!tabExists) {
      console.warn("[Tab Flow] Tab no longer exists:", tabId);
      state.filteredTabs = state.filteredTabs.filter(
        (tab) => tab && tab.id !== tabId
      );
      state.currentTabs = state.currentTabs.filter(
        (tab) => tab && tab.id !== tabId
      );

      if (state.selectedIndex >= state.filteredTabs.length) {
        state.selectedIndex = Math.max(0, state.filteredTabs.length - 1);
      }

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
            "[Tab Flow] Error closing tab:",
            chrome.runtime.lastError.message
          );
          return;
        }

        if (response?.success) {
          state.currentTabs = state.currentTabs.filter(
            (tab) => tab && tab.id !== tabId
          );
          state.filteredTabs = state.filteredTabs.filter(
            (tab) => tab && tab.id !== tabId
          );

          if (state.filteredTabs.length > 0) {
            if (state.selectedIndex >= state.filteredTabs.length) {
              state.selectedIndex = Math.max(0, state.filteredTabs.length - 1);
            }

            if (state.filteredTabs.length > 50) {
              renderTabsVirtual(state.filteredTabs);
            } else {
              renderTabsStandard(state.filteredTabs);
            }

            if (state.domCache.searchBox) {
              state.domCache.searchBox.focus();
            }
          } else {
            closeOverlay();
          }
        }
      }
    );
  } catch (error) {
    console.error("[Tab Flow] Exception in closeTab:", error);
  }
}

export function toggleMute(tabId: number, btnElement: HTMLElement) {
  try {
    if (!tabId) return;

    chrome.runtime.sendMessage({ action: "toggleMute", tabId }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          "[Tab Flow] Error toggling mute:",
          chrome.runtime.lastError
        );
        return;
      }

      if (response && response.success) {
        const isMuted = response.muted;

        if (isMuted) {
          btnElement.classList.add("muted");
          btnElement.title = "Unmute tab";
          btnElement.innerHTML =
            '<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>';
        } else {
          btnElement.classList.remove("muted");
          btnElement.title = "Mute tab";
          btnElement.innerHTML =
            '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
        }

        const tab = state.currentTabs.find((t) => t.id === tabId);
        if (tab) {
          if (!tab.mutedInfo) tab.mutedInfo = { muted: false };
          tab.mutedInfo.muted = isMuted;
        }
      }
    });
  } catch (error) {
    console.error("[Tab Flow] Exception in toggleMute:", error);
  }
}

export function togglePlayPause(tabId: number, btnElement: HTMLElement) {
  try {
    if (!tabId) return;

    chrome.runtime.sendMessage(
      { action: "togglePlayPause", tabId },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "[Tab Flow] Error toggling play/pause:",
            chrome.runtime.lastError
          );
          return;
        }

        if (response && response.success) {
          const isPlaying = response.playing;

          if (isPlaying) {
            btnElement.classList.add("playing");
            btnElement.title = "Pause tab";
            btnElement.innerHTML =
              '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
          } else {
            btnElement.classList.remove("playing");
            btnElement.title = "Play tab";
            btnElement.innerHTML =
              '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
          }

          const tab = state.currentTabs.find((t) => t.id === tabId);
          if (tab) {
            (tab as any).isPlaying = isPlaying;
            // Also update audible status if we have it
            tab.audible = isPlaying;
          }
        }
      }
    );
  } catch (error) {
    console.error("[Tab Flow] Exception in togglePlayPause:", error);
  }
}

export function setViewMode(mode: "active" | "recent") {
  state.viewMode = mode;
  if (state.domCache?.searchBox) {
    state.domCache.searchBox.placeholder =
      mode === "recent"
        ? "Search recently closed tabs..."
        : "Search tabs by title or URL...";
  }

  // Update section title based on mode
  if (state.domCache?.sectionTitle) {
    state.domCache.sectionTitle.textContent =
      mode === "recent" ? "Recently Closed" : "Opened Tabs";
  }

  // Update tab hint visibility
  if (state.domCache?.tabHint) {
    state.domCache.tabHint.classList.toggle("hidden", mode === "recent");
  }

  if (state.domCache?.helpText) {
    if (mode === "recent") {
      state.domCache.helpText.innerHTML = `
        <span><kbd>Alt+Q</kbd> <kbd>↑↓</kbd> Navigate</span>
        <span><kbd>Enter</kbd> Restore</span>
        <span><kbd>Backspace</kbd> Active Tabs</span>
        <span><kbd>Esc</kbd> Exit</span>
      `;
    } else {
      state.domCache.helpText.innerHTML = `
        <span><kbd>Alt+Q</kbd> <kbd>↑↓</kbd> Navigate</span>
        <span><kbd>Enter</kbd> Switch Tab</span>
        <span><kbd>Delete</kbd> Close</span>
        <span><kbd>.</kbd> Recent Tabs</span>
        <span><kbd>;</kbd> Tab History</span>
        <span><kbd>Esc</kbd> Exit</span>
      `;
    }
  }
}

export function createGroup(tabId: number) {
  try {
    if (!tabId || typeof tabId !== "number") return;

    chrome.runtime.sendMessage({ action: "createGroup", tabId }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          "[Tab Flow] Error creating group:",
          chrome.runtime.lastError.message
        );
        return;
      }
      if (response?.success) {
        closeOverlay();
      }
    });
  } catch (error) {
    console.error("[Tab Flow] Exception in createGroup:", error);
  }
}

export function switchToActive() {
  if (state.viewMode === "active") return;
  setViewMode("active");
  state.currentTabs = state.activeTabs || [];
  // IMPORTANT: For active view, we might want to re-apply grouping if it's the filtered view?
  // Basically reset to full active list (which implies active recency sort).
  // AND apply group transformation to show headers.

  // We apply transformation here
  const transformed = applyGroupViewTransformation(state.currentTabs);
  state.filteredTabs = transformed;

  state.selectedIndex = 0;
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

export async function switchToRecent() {
  if (state.viewMode === "recent") return;
  setViewMode("recent");
  let items: any[] = [];
  try {
    items = await new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          { action: "getRecentlyClosed", maxResults: 10 },
          (res) => {
            if (chrome.runtime.lastError) {
              console.debug(
                "[Tab Flow] Runtime error:",
                chrome.runtime.lastError.message
              );
              resolve([]);
              return;
            }
            if (res?.success) resolve(res.items || []);
            else resolve([]);
          }
        );
      } catch {
        resolve([]);
      }
    });
  } catch (e) {
    console.debug("[Tab Flow] Failed to load recently closed:", e);
  }
  state.recentItems = items.map((it, idx) => ({
    id: undefined, // Recent items don't have tab IDs
    title: it.title,
    url: it.url,
    favIconUrl: it.favIconUrl,
    screenshot: null,
    sessionId: it.sessionId,
    index: idx,
  }));
  state.currentTabs = state.recentItems;
  state.filteredTabs = state.recentItems; // No grouping for recent items usually
  state.selectedIndex = 0;
  if (state.domCache.grid) state.domCache.grid.classList.add("recent-mode");
  renderTabsStandard(state.filteredTabs);
  if (state.domCache.searchBox) state.domCache.searchBox.focus();
}

// toggleGroupCollapse removed as headers/collapsing are no longer used




