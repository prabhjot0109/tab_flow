import { state } from "./state";
import {
  showTabFlow,
  showQuickSwitch,
  closeQuickSwitch,
  advanceQuickSwitchSelection,
} from "./ui/overlay";
import { selectNext } from "./input/keyboard";
import { enforceSingleSelection } from "./ui/rendering";
import { closeOverlay } from "./actions";

// Media detection to report to background
function detectMedia() {
  try {
    const mediaElements = document.querySelectorAll(
      "video, audio"
    ) as NodeListOf<HTMLMediaElement>;
    const hasMedia = mediaElements.length > 0;

    // Check if any media is currently playing
    let isPlaying = false;
    if (hasMedia) {
      for (const media of mediaElements) {
        if (!media.paused && !media.ended && media.readyState > 2) {
          isPlaying = true;
          break;
        }
      }
    }

    if (hasMedia) {
      chrome.runtime.sendMessage(
        { action: "reportMediaPresence", hasMedia: true, isPlaying },
        () => {
          if (chrome.runtime.lastError) {
            // Ignore
          }
        }
      );
    }
  } catch (e) {
    // Ignore
  }
}

// Also detect media state changes (play/pause events)
function setupMediaEventListeners() {
  try {
    document.addEventListener("play", () => detectMedia(), true);
    document.addEventListener("pause", () => detectMedia(), true);
    document.addEventListener("ended", () => detectMedia(), true);
  } catch (e) {
    // Ignore
  }
}

setupMediaEventListeners();

function scheduleInitialMediaDetection() {
  const schedule = () => detectMedia();
  if ("requestIdleCallback" in window) {
    (window as any).requestIdleCallback(schedule, { timeout: 2000 });
  } else {
    setTimeout(schedule, 1000);
  }
}

// Check on load (deferred for lower overhead)
if (document.readyState === "complete") {
  scheduleInitialMediaDetection();
} else {
  window.addEventListener("load", scheduleInitialMediaDetection, { once: true });
}

// ============================================================================
// AUTO-CLOSE ON FOCUS / VISIBILITY CHANGE
// Close the overlay as soon as the page loses focus (e.g. user switches apps)
// or the document becomes hidden (user switches tabs). This keeps the
// extension "fresh" when returning to the page.
// ============================================================================
const closeAnyOverlayIfOpen = () => {
  if (state.isOverlayVisible) closeOverlay();
  if (state.isQuickSwitchVisible) closeQuickSwitch();
};

window.addEventListener("blur", closeAnyOverlayIfOpen);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) closeAnyOverlayIfOpen();
});

chrome.runtime.onMessage.addListener((request, _, sendResponse) => {
  if (request.action === "showTabFlow") {
    // If overlay already visible, treat repeated Alt+W as cycle-next
    if (state.isOverlayVisible) {
      selectNext();
      // Ensure only one selection is highlighted
      enforceSingleSelection(true);
      sendResponse({ success: true, advanced: true });
      return true;
    }
    showTabFlow(request.tabs, request.activeTabId, request.groups);
    sendResponse({ success: true });
  } else if (request.action === "showQuickSwitch") {
    // Quick switch (Alt+Q) - Alt+Tab style without search bar
    if (state.isQuickSwitchVisible) {
      // Cycle to next tab
      advanceQuickSwitchSelection(1);
      sendResponse({ success: true, advanced: true });
      return true;
    }
    showQuickSwitch(request.tabs, request.activeTabId);
    sendResponse({ success: true });
  } else if (request.action === "quickSwitchCycleIfOpen") {
    if (!state.isQuickSwitchVisible) {
      sendResponse({ success: true, advanced: false });
      return true;
    }
    advanceQuickSwitchSelection(1);
    sendResponse({ success: true, advanced: true });
    return true;
  }
  return true;
});
