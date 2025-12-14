// Report navigation events to background script for history tracking
function reportNavigation(type = "navigate") {
  try {
    if (document.hidden && type === "navigate") return;

    const payload = {
      action: "REPORT_NAVIGATION",
      url: window.location.href,
      title: document.title,
      navType: type,
    };

    chrome.runtime.sendMessage(payload, (response) => {
      if (chrome.runtime.lastError) {
        // Ignore errors from disconnected ports
      }
    });
  } catch (e) {
    // Ignore context invalidated errors
  }
}

// Initial report
reportNavigation();

// Listen for SPA updates
window.addEventListener("popstate", () => reportNavigation("back_forward"));
window.addEventListener("hashchange", () => reportNavigation("navigate"));

// Listen for title changes
const titleObserver = new MutationObserver(() => {
  reportNavigation("title_update");
});

const titleEl = document.querySelector("title");
if (titleEl) {
  titleObserver.observe(titleEl, {
    childList: true,
    characterData: true,
    subtree: true,
  });
} else {
  // Fallback if title element doesn't exist yet
  const docObserver = new MutationObserver((mutations) => {
    const title = document.querySelector("title");
    if (title) {
      titleObserver.observe(title, {
        childList: true,
        characterData: true,
        subtree: true,
      });
      docObserver.disconnect();
    }
  });
  docObserver.observe(document.head || document.documentElement, {
    childList: true,
    subtree: true,
  });
}

// Monkey patch pushState/replaceState to detect SPA navigation
const originalPushState = history.pushState;
history.pushState = function (...args) {
  originalPushState.apply(this, args);
  reportNavigation("navigate");
};

const originalReplaceState = history.replaceState;
history.replaceState = function (...args) {
  originalReplaceState.apply(this, args);
  reportNavigation("navigate");
};
