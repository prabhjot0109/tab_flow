import "./utils/messaging.js";
import { state } from "./state";
import { showTabSwitcher } from "./ui/overlay";
import { selectNext } from "./input/keyboard";
import { enforceSingleSelection } from "./ui/rendering";

console.log("═══════════════════════════════════════════════════════");
console.log("Visual Tab Switcher - Content Script Loaded");
console.log("Features: Virtual Scrolling, Event Delegation, GPU Acceleration");
console.log("Target: <16ms interactions, 60fps, lazy loading");
console.log("═══════════════════════════════════════════════════════");

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

// Check on load
if (document.readyState === "complete") {
  detectMedia();
} else {
  window.addEventListener("load", detectMedia);
}

// Also check when elements are added
const mediaObserver = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.addedNodes.length) {
      detectMedia();
      break;
    }
  }
});

try {
  mediaObserver.observe(document.body, { childList: true, subtree: true });
} catch (e) {
  // Ignore if body not ready
}

chrome.runtime.onMessage.addListener((request, _, sendResponse) => {
  if (request.action === "showTabSwitcher") {
    // If overlay already visible, treat repeated Alt+Q as cycle-next
    if (state.isOverlayVisible) {
      selectNext();
      // Ensure only one selection is highlighted
      enforceSingleSelection(true);
      sendResponse({ success: true, advanced: true });
      return true;
    }
    showTabSwitcher(request.tabs, request.activeTabId, request.groups);
    sendResponse({ success: true });
  }
  return true;
});
