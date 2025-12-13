// Content script for Visual Tab Switcher overlay
// ============================================================================
// PERFORMANCE-OPTIMIZED IMPLEMENTATION
// Virtual scrolling, event delegation, GPU acceleration, throttling
// Target: <16ms interactions, 60fps animations, <50MB memory
// ============================================================================

(() => {
  const SHADOW_HOST_ID = "tab-switcher-host";

  // Report top-level page navigations to the background service worker.
  // MV3 service workers can miss webNavigation events when asleep; content scripts
  // run on every page load, so this makes tab history reliable.
  (function reportPageNavigation() {
    try {
      // Only report for the top frame.
      if (window.top !== window) return;

      let lastReportedUrl = "";
      let lastNavType = "";

      const sendNavigation = (forcedNavType) => {
        try {
          const url = String(location.href || "");
          if (!url) return;

          const navType =
            forcedNavType ||
            (() => {
              // Try PerformanceNavigationTiming first (most reliable)
              const navEntries = performance.getEntriesByType?.("navigation");
              const navEntry = Array.isArray(navEntries) ? navEntries[0] : null;
              if (navEntry && typeof navEntry.type === "string") {
                return navEntry.type;
              }
              // Fallback to deprecated API
              if (performance?.navigation) {
                const legacy = performance.navigation.type;
                if (legacy === 1) return "reload";
                if (legacy === 2) return "back_forward";
              }
              return "navigate";
            })();

          // De-dupe noisy SPA signals (pushState + hashchange). Always report back/forward.
          if (
            navType !== "back_forward" &&
            url === lastReportedUrl &&
            navType === lastNavType
          )
            return;
          lastReportedUrl = url;
          lastNavType = navType;

          chrome.runtime.sendMessage(
            {
              action: "REPORT_NAVIGATION",
              url,
              title: typeof document.title === "string" ? document.title : "",
              navType,
            },
            () => {
              // Ignore errors (e.g., extension reloading).
            }
          );
        } catch {
          // Ignore
        }
      };

      // Initial report for this document.
      sendNavigation();

      // Also report when document title changes (for better history titles)
      const titleObserver = new MutationObserver(() => {
        if (document.title && lastReportedUrl === location.href) {
          chrome.runtime.sendMessage(
            {
              action: "REPORT_NAVIGATION",
              url: location.href,
              title: document.title,
              navType: "title_update",
            },
            () => {}
          );
        }
      });

      const titleElement = document.querySelector("title");
      if (titleElement) {
        titleObserver.observe(titleElement, {
          childList: true,
          characterData: true,
          subtree: true,
        });
      }

      // Back/forward with BFCache often fires pageshow with persisted=true.
      window.addEventListener("pageshow", (ev) => {
        if (ev?.persisted) {
          sendNavigation("back_forward");
        }
      });

      // Back/forward within same document lifecycle.
      window.addEventListener("popstate", () => {
        sendNavigation("back_forward");
      });

      // Hash navigation.
      window.addEventListener("hashchange", () => {
        sendNavigation("navigate");
      });

      // SPA navigation.
      try {
        const wrapHistoryMethod = (methodName) => {
          const original = history[methodName];
          if (typeof original !== "function") return;
          history[methodName] = function (...args) {
            const ret = original.apply(this, args);
            queueMicrotask(() => sendNavigation("navigate"));
            return ret;
          };
        };
        wrapHistoryMethod("pushState");
        wrapHistoryMethod("replaceState");
      } catch {
        // Ignore
      }
    } catch {
      // Ignore
    }
  })();
  const SHADOW_CSS = `/* Visual Tab Switcher - Modern Glass UI 2.0 */
/* ============================================================================
 * SHADOW DOM ENCAPSULATED STYLES
 * These styles are completely isolated from the host page.
 * The :host selector resets all inherited styles to prevent any leakage.
 * ============================================================================ */

/* Reset only within shadow DOM - does NOT affect host page */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:host {
  /* Reset ALL inherited properties to prevent host page styles from leaking in */
  all: initial !important;
  
  /* Ensure host doesn't affect page layout */
  display: contents !important;
  
  /* CSS Custom Properties - Material 3 Dark Theme (Lighter) */
  --bg-overlay: rgba(76, 76, 80, 0.8);
  --bg-surface: #202020;
  --bg-glass: #282830;
  --bg-glass-hover: #32323c;
  --border-subtle: #3a3a45;
  --border-hover: #4a4a58;
  --border-active: #5a5a6a;
  --text-primary: #f4f4f8;
  --text-secondary: #c0c0cc;
  --text-muted: #888899;
  --accent: #e8e8f0;
  --accent-light: #d0d0dc;
  --accent-glow: rgba(255, 255, 255, 0.12);
  --card-bg: #262630;
  --card-hover: #30303c;
  --card-selected: #383848;
  --danger: #ffb4ab;
  --success: #a8dab5;
  
  /* Material 3 Shape - Extra Rounded */
  --radius-3xl: 32px;
  --radius-2xl: 28px;
  --radius-xl: 24px;
  --radius-lg: 20px;
  --radius-md: 16px;
  --radius-sm: 12px;
  --radius-xs: 8px;
  --radius-full: 9999px;
  
  --shadow-xl: 0 24px 48px rgba(0, 0, 0, 0.4);
  --shadow-card: 0 4px 12px rgba(0, 0, 0, 0.25);
  --font-family: "Google Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --transition-fast: 0.1s ease;
  --transition-smooth: 0.2s cubic-bezier(0.2, 0, 0, 1);
}

@media (prefers-color-scheme: light) {
  :host {
    /* Material 3 Light Theme - Clean & Bright */
    --bg-overlay: rgba(100, 100, 110, 0.45);
    --bg-surface: #fafafc;
    --bg-glass: #f2f2f6;
    --bg-glass-hover: #e8e8ee;
    --border-subtle: #d8d8e0;
    --border-hover: #c8c8d2;
    --border-active: #b0b0bc;
    --text-primary: #1a1a22;
    --text-secondary: #4a4a58;
    --text-muted: #7a7a8a;
    --accent: #202030;
    --accent-light: #404055;
    --accent-glow: rgba(0, 0, 0, 0.06);
    --card-bg: #f0f0f6;
    --card-hover: #e6e6ee;
    --card-selected: #dcdce6;
    --shadow-xl: 0 24px 48px rgba(0, 0, 0, 0.1);
    --shadow-card: 0 2px 8px rgba(0, 0, 0, 0.06);
  }
}

/* Overlay */
.tab-switcher-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: none;
  align-items: flex-start;
  justify-content: center;
  padding-top: 6vh;
  font-family: var(--font-family);
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  /* Enable pointer events on the overlay when visible */
  pointer-events: auto;
}

.tab-switcher-backdrop {
  position: absolute;
  inset: 0;
  background: var(--bg-overlay);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  animation: backdropFadeIn 0.25s cubic-bezier(0.2, 0, 0, 1);
}

.tab-switcher-container {
  position: relative;
  width: 900px;
  max-width: 94vw;
  max-height: 80vh;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-3xl);
  box-shadow: var(--shadow-xl);
  display: flex;
  flex-direction: column;
  padding: 24px;
  overflow: hidden;
  animation: containerSlideIn 0.25s cubic-bezier(0.2, 0, 0, 1);
}

/* Search Header */
.tab-switcher-search-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  flex-shrink: 0;
}

.tab-switcher-search-wrap {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}

.tab-switcher-search {
  width: 100%;
  background: var(--bg-glass);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  padding: 16px 20px 16px 54px;
  font-size: 15px;
  font-weight: 400;
  color: var(--text-primary);
  outline: none;
  transition: all var(--transition-smooth);
  letter-spacing: -0.01em;
}

.tab-switcher-search:focus {
  background: var(--bg-glass-hover);
  border-color: var(--accent);
  box-shadow: 0 0 0 4px var(--accent-glow), var(--shadow-card);
}

.tab-switcher-search::placeholder {
  color: var(--text-muted);
  font-weight: 400;
}

.search-icon {
  position: absolute;
  left: 18px;
  color: var(--text-muted);
  pointer-events: none;
  display: flex;
  align-items: center;
  transition: all var(--transition-fast);
}

.tab-switcher-search:focus ~ .search-icon,
.tab-switcher-search-wrap:focus-within .search-icon {
  color: var(--accent);
  transform: scale(1.05);
}

/* Buttons */
.recently-closed-btn {
  background: var(--bg-glass);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  padding: 0 24px;
  border-radius: var(--radius-xl);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-smooth);
  white-space: nowrap;
  height: 54px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  letter-spacing: -0.01em;
}

.recently-closed-btn:hover {
  background: var(--bg-glass-hover);
  border-color: var(--border-hover);
  color: var(--text-primary);
  transform: translateY(-1px);
}

.recently-closed-btn:active {
  transform: translateY(0);
}

.recent-back-btn {
  position: absolute;
  left: 10px;
  z-index: 10;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: var(--bg-glass-hover);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 18px;
  transition: all var(--transition-smooth);
}

.recent-back-btn:hover {
  background: var(--accent);
  color: white;
  transform: scale(1.08);
}

/* Grid - Active Tabs */
.tab-switcher-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 14px;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px;
  padding-right: 8px;
  min-height: 200px;
  scroll-behavior: smooth;
}

/* Recent Mode & Search Mode - Column Layout */
.tab-switcher-grid.recent-mode,
.tab-switcher-grid.search-mode {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: auto;
}

.tab-switcher-grid::-webkit-scrollbar {
  width: 6px;
}

.tab-switcher-grid::-webkit-scrollbar-track {
  background: transparent;
  margin: 4px 0;
}

.tab-switcher-grid::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 100px;
  transition: background 0.2s ease;
}

.tab-switcher-grid::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.25);
}

.tab-switcher-grid::-webkit-scrollbar-thumb:active {
  background: rgba(255, 255, 255, 0.35);
}

/* Firefox modern scrollbar */
.tab-switcher-grid {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
}

@media (prefers-color-scheme: light) {
  .tab-switcher-grid::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.12);
  }
  
  .tab-switcher-grid::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.2);
  }
  
  .tab-switcher-grid::-webkit-scrollbar-thumb:active {
    background: rgba(0, 0, 0, 0.3);
  }
  
  .tab-switcher-grid {
    scrollbar-color: rgba(0, 0, 0, 0.12) transparent;
  }
}

/* Empty State */
.tab-switcher-empty {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  color: var(--text-muted);
  font-size: 14px;
  text-align: center;
}

/* Tab Card */
.tab-card {
  background: var(--card-bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  overflow: hidden;
  cursor: pointer;
  position: relative;
  display: flex;
  flex-direction: column;
  height: 170px;
  transition: all var(--transition-smooth);
  box-shadow: var(--shadow-card);
}

.tab-card:hover {
  transform: translateY(-3px);
  border-color: var(--border-hover);
  background: var(--card-hover);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}

.tab-card.selected {
  border-color: var(--accent);
  background: var(--card-selected);
  box-shadow: 0 0 0 2px var(--accent-glow), 0 4px 16px rgba(0, 0, 0, 0.2);
}

.tab-card.selected::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--accent-glow);
  pointer-events: none;
  z-index: 0;
}

/* Pinned indicator */
.tab-card.pinned::after {
  content: '📌';
  position: absolute;
  top: 8px;
  left: 8px;
  font-size: 12px;
  z-index: 5;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));
}

/* Audio indicator */
.tab-audio-indicator {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  z-index: 5;
  opacity: 0.9;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.tab-audio-indicator svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

.tab-audio-indicator.muted {
  color: #ff5252;
}

/* Web Search Card */
.tab-card[data-web-search="1"] {
  width: 100% !important;
  height: 60px !important;
  flex-direction: row !important;
  align-items: center !important;
  padding: 0 18px !important;
  gap: 14px !important;
}

.tab-card[data-web-search="1"]:hover {
  transform: translateY(-2px);
}

/* Thumbnail Area */
.tab-thumbnail {
  flex: 1;
  min-height: 0;
  background: linear-gradient(180deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.08) 100%);
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tab-card[data-web-search="1"] .tab-thumbnail {
  flex: 0 0 36px;
  height: 36px;
  width: 36px;
  border-radius: var(--radius-md);
  background: var(--bg-glass);
}

.screenshot-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top center;
  opacity: 0.95;
  transition: all var(--transition-smooth);
}

.tab-card:hover .screenshot-img {
  opacity: 1;
  transform: scale(1.02);
}

/* Favicon Tile */
.favicon-tile {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--bg-glass) 0%, transparent 100%);
}

.tab-card[data-web-search="1"] .favicon-tile {
  background: transparent;
}

.favicon-large {
  width: 44px;
  height: 44px;
  object-fit: contain;
  border-radius: var(--radius-sm);
  transition: transform var(--transition-smooth);
}

.tab-card:hover .favicon-large {
  transform: scale(1.08);
}

.tab-card[data-web-search="1"] .favicon-large {
  width: 26px;
  height: 26px;
}

.favicon-letter {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background: var(--bg-glass-hover);
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.02em;
  transition: all var(--transition-smooth);
}

.tab-card:hover .favicon-letter {
  transform: scale(1.05);
  border-color: var(--border-hover);
}

/* Tab Info */
.tab-info {
  padding: 12px 14px;
  background: transparent;
  position: relative;
  z-index: 1;
}

.tab-card[data-web-search="1"] .tab-info {
  flex: 1 !important;
  padding: 0 !important;
  display: flex !important;
  align-items: center !important;
}

.tab-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}

.tab-card[data-web-search="1"] .tab-header {
  margin: 0 !important;
  width: 100% !important;
}

.tab-favicon {
  width: 16px;
  height: 16px;
  opacity: 0.85;
  border-radius: 3px;
  flex-shrink: 0;
}

.tab-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  letter-spacing: -0.01em;
}

.tab-card.selected .tab-title {
  color: var(--accent-light);
}

.tab-card[data-web-search="1"] .tab-title {
  font-size: 15px;
  font-weight: 500;
}

.tab-url {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-left: 26px;
  letter-spacing: -0.01em;
}

.tab-card[data-web-search="1"] .tab-url {
  display: none;
}

/* Close Button */
.tab-close-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: white;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 300;
  opacity: 0;
  transform: scale(0.8);
  transition: all var(--transition-smooth);
  cursor: pointer;
  z-index: 10;
}

.tab-card:hover .tab-close-btn {
  opacity: 1;
  transform: scale(1);
}

.tab-close-btn:hover {
  background: var(--danger);
  transform: scale(1.1);
}

.tab-close-btn:active {
  transform: scale(0.95);
}

/* Mute Button */
.tab-mute-btn {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  z-index: 10;
  opacity: 0;
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.tab-card:hover .tab-mute-btn,
.tab-mute-btn.muted {
  opacity: 0.9;
}

.tab-mute-btn:hover {
  background: var(--bg-surface);
  color: var(--text-primary);
  transform: scale(1.1);
  opacity: 1;
}

.tab-mute-btn svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

.tab-mute-btn.muted {
  color: #ff5252;
  background: rgba(0, 0, 0, 0.8);
}

/* Footer/Help */
.tab-switcher-help {
  display: flex;
  gap: 24px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--border-subtle);
  color: var(--text-muted);
  font-size: 12px;
  justify-content: center;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.tab-switcher-help span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 8px;
  background: var(--bg-glass);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xs);
  font-family: "SF Mono", "Fira Code", monospace;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all var(--transition-smooth);
}

kbd:hover {
  background: var(--bg-glass-hover);
  border-color: var(--border-hover);
  color: var(--text-primary);
}

/* Animations */
@keyframes backdropFadeIn {
  from { 
    opacity: 0;
    backdrop-filter: blur(0);
  }
  to { 
    opacity: 1;
    backdrop-filter: blur(24px) saturate(180%);
  }
}

@keyframes containerSlideIn {
  from { 
    opacity: 0;
    transform: translateY(-20px) scale(0.96);
  }
  to { 
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes cardFadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Recent mode styles - Column Layout */
.tab-switcher-grid.recent-mode .tab-card {
  width: 100%;
  height: auto;
  min-height: 60px;
  flex-direction: row;
  align-items: center;
  padding: 14px 18px;
  gap: 16px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: none;
}

.tab-switcher-grid.recent-mode .tab-card:hover {
  transform: none;
  border-color: var(--border-hover);
  box-shadow: var(--shadow-card);
}

.tab-switcher-grid.recent-mode .tab-card.selected {
  border-color: var(--accent);
  background: var(--card-selected);
}

.tab-switcher-grid.recent-mode .tab-thumbnail {
  flex: 0 0 40px;
  height: 40px;
  width: 40px;
  min-height: 40px;
  border-radius: var(--radius-sm);
  background: var(--bg-glass);
}

.tab-switcher-grid.recent-mode .favicon-tile {
  border-radius: var(--radius-sm);
}

.tab-switcher-grid.recent-mode .favicon-large {
  width: 26px;
  height: 26px;
}

.tab-switcher-grid.recent-mode .favicon-letter {
  width: 40px;
  height: 40px;
  font-size: 17px;
  border-radius: var(--radius-sm);
}

.tab-switcher-grid.recent-mode .tab-info {
  flex: 1;
  padding: 0;
  min-width: 0;
}

.tab-switcher-grid.recent-mode .tab-header {
  margin-bottom: 3px;
}

.tab-switcher-grid.recent-mode .tab-title {
  font-size: 14px;
}

.tab-switcher-grid.recent-mode .tab-url {
  padding-left: 0;
  font-size: 12px;
}

.tab-switcher-grid.recent-mode .tab-close-btn {
  display: none;
}

/* Search mode styles - Column Layout (same as recent) */
.tab-switcher-grid.search-mode .tab-card {
  width: 100%;
  height: auto;
  min-height: 60px;
  flex-direction: row;
  align-items: center;
  padding: 14px 18px;
  gap: 16px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: none;
}

.tab-switcher-grid.search-mode .tab-card:hover {
  transform: none;
  border-color: var(--border-hover);
  box-shadow: var(--shadow-card);
}

.tab-switcher-grid.search-mode .tab-card.selected {
  border-color: var(--accent);
  background: var(--card-selected);
}

.tab-switcher-grid.search-mode .tab-thumbnail {
  flex: 0 0 36px;
  height: 36px;
  width: 36px;
  min-height: 36px;
  border-radius: var(--radius-sm);
  background: var(--bg-glass);
}

.tab-switcher-grid.search-mode .tab-info {
  flex: 1;
  padding: 0;
  min-width: 0;
}

.tab-switcher-grid.search-mode .tab-title {
  font-size: 14px;
}

.tab-switcher-grid.search-mode .tab-url {
  padding-left: 0;
  font-size: 12px;
  display: block;
}

/* Responsive */
@media (max-width: 768px) {
  .tab-switcher-container {
    padding: 16px;
    max-width: 98vw;
    max-height: 90vh;
  }
  
  .tab-switcher-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 10px;
  }
  
  .tab-card {
    height: 150px;
  }
  
  .tab-switcher-help {
    gap: 12px;
    font-size: 11px;
  }
  
  .recently-closed-btn {
    padding: 0 12px;
    font-size: 12px;
  }
}

/* History View */
.history-view {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    height: 100%;
    overflow: hidden;
    padding: 0 12px;
}

.history-column {
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
    padding-right: 4px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
}

.history-column::-webkit-scrollbar {
    width: 5px;
}

.history-column::-webkit-scrollbar-track {
    background: transparent;
    margin: 4px 0;
}

.history-column::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 100px;
    transition: background 0.2s ease;
}

.history-column::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.25);
}

.history-column::-webkit-scrollbar-thumb:active {
    background: rgba(255, 255, 255, 0.35);
}

@media (prefers-color-scheme: light) {
    .history-column {
        scrollbar-color: rgba(0, 0, 0, 0.12) transparent;
    }
    
    .history-column::-webkit-scrollbar-thumb {
        background: rgba(0, 0, 0, 0.12);
    }
    
    .history-column::-webkit-scrollbar-thumb:hover {
        background: rgba(0, 0, 0, 0.2);
    }
    
    .history-column::-webkit-scrollbar-thumb:active {
        background: rgba(0, 0, 0, 0.3);
    }
}

.history-column-header {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-muted);
    margin-bottom: 8px;
    padding-left: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    position: sticky;
    top: 0;
    background: var(--bg-surface);
    z-index: 10;
    padding-top: 8px;
    padding-bottom: 8px;
}

.history-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: var(--radius-lg);
    background: var(--card-bg);
    border: 1px solid transparent;
    cursor: pointer;
    transition: all var(--transition-fast);
}

.history-favicon {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  flex-shrink: 0;
}

.history-item:hover {
    background: var(--card-hover);
    border-color: var(--border-hover);
}

.history-item.selected {
    background: var(--card-selected);
    border-color: var(--accent);
}

.history-item-content {
    flex: 1;
    min-width: 0;
}

.history-item-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 2px;
}

.history-item-url {
    font-size: 12px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* History items container */
.history-items-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
`;

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  const state = {
    overlay: null,
    currentTabs: [],
    activeTabs: [],
    filteredTabs: [],
    selectedIndex: 0,
    isOverlayVisible: false,
    viewMode: "active",
    recentItems: [],
    host: null,
    shadowRoot: null,
    styleElement: null,

    // DOM cache
    domCache: {
      grid: null,
      searchBox: null,
      container: null,
      searchWrap: null,
      backBtn: null,
      recentBtn: null,
    },

    // Virtual scrolling
    virtualScroll: {
      startIndex: 0,
      endIndex: 0,
      visibleCount: 20, // Render 20 tabs at a time
      bufferCount: 5, // Buffer above/below viewport
    },

    // Performance
    lastKeyTime: 0,
    keyThrottleMs: 16, // ~60fps
    resizeObserver: null,
    intersectionObserver: null,
    focusInterval: null, // For periodic focus enforcement
  };

  // History view selection state
  state.history = {
    active: false,
    backEls: [],
    forwardEls: [],
    column: "back",
    index: 0,
  };

  // WeakMap for tab metadata (automatic garbage collection)

  // ============================================================================
  // MESSAGE LISTENER
  // ============================================================================
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
      showTabSwitcher(request.tabs, request.activeTabId);
      sendResponse({ success: true });
    }
    return true;
  });

  // ============================================================================
  // OVERLAY CREATION
  // ============================================================================
  function ensureShadowRoot() {
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
          // The host element must be completely out of document flow and invisible
          // to prevent any impact on the host page's layout
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
      if (
        !state.styleElement ||
        !state.shadowRoot.contains(state.styleElement)
      ) {
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

  function createOverlay() {
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

  // ============================================================================
  // SHOW TAB SWITCHER
  // ============================================================================
  function showTabSwitcher(tabs, activeTabId) {
    const startTime = performance.now();

    console.log(`[TAB SWITCHER] Opening with ${tabs.length} tabs`);

    if (state.isOverlayVisible) return;

    createOverlay();
    state.activeTabs = tabs;
    state.currentTabs = tabs;
    state.filteredTabs = tabs;
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
    // CRITICAL: We must set display:flex synchronously so focus() works
    // and set isOverlayVisible=true so handleGlobalKeydown blocks events immediately.
    state.overlay.style.display = "flex";
    state.overlay.style.opacity = "0";
    state.isOverlayVisible = true;

    // Blur page and focus search immediately
    blurPageElements();
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
    document.addEventListener("focus", handleGlobalFocus, true);
    document.addEventListener("focusin", handleGlobalFocusIn, true);
    document.addEventListener("keydown", handleGlobalKeydown, true);
    document.addEventListener("keypress", handleGlobalKeydown, true);
    document.addEventListener("keyup", handleGlobalKeydown, true);
    document.addEventListener("input", handleGlobalInput, true);
    document.addEventListener("beforeinput", handleGlobalInput, true);
    document.addEventListener("textInput", handleGlobalInput, true);
    document.addEventListener("click", handleGlobalClick, true);
    document.addEventListener("mousedown", handleGlobalClick, true);

    // Block composition events (for IME input on AI chat apps)
    document.addEventListener(
      "compositionstart",
      handleGlobalComposition,
      true
    );
    document.addEventListener(
      "compositionupdate",
      handleGlobalComposition,
      true
    );
    document.addEventListener("compositionend", handleGlobalComposition, true);

    // Periodic focus enforcement for aggressive apps that steal focus
    state.focusInterval = setInterval(() => {
      if (state.isOverlayVisible && state.domCache?.searchBox) {
        // Check if focus is not in our shadow DOM
        if (document.activeElement !== state.host) {
          state.domCache.searchBox.focus();
        }
      }
    }, 100);

    const duration = performance.now() - startTime;
    console.log(
      `[PERF] Overlay rendered in ${duration.toFixed(
        2
      )}ms (Target: <16ms for 60fps)`
    );
  }

  // ============================================================================
  // VIEW MODES: ACTIVE TABS vs RECENTLY CLOSED
  // ============================================================================
  function setViewMode(mode) {
    state.viewMode = mode;
    if (state.domCache?.backBtn) {
      state.domCache.backBtn.style.display =
        mode === "recent" ? "flex" : "none";
    }
    if (state.domCache?.recentBtn) {
      state.domCache.recentBtn.style.display =
        mode === "recent" ? "none" : "inline-flex";
    }
    if (state.domCache?.searchBox) {
      state.domCache.searchBox.placeholder =
        mode === "recent"
          ? "Search recently closed tabs..."
          : "Search tabs by title or URL...";
    }

    // Update help text based on mode
    if (state.domCache?.helpText) {
      if (mode === "recent") {
        state.domCache.helpText.innerHTML = `
          <span><kbd>Alt+Q</kbd> Navigate</span>
          <span><kbd>Enter</kbd> Restore</span>
          <span><kbd>Backspace</kbd> Active Tabs</span>
          <span><kbd>Esc</kbd> Exit</span>
        `;
      } else {
        state.domCache.helpText.innerHTML = `
          <span><kbd>Alt+Q</kbd> Navigate</span>
          <span><kbd>Enter</kbd> Switch</span>
          <span><kbd>Delete</kbd> Close</span>
          <span><kbd>.</kbd> Recent Tabs</span>
          <span><kbd>?</kbd> Web Search</span>
          <span><kbd>Esc</kbd> Exit</span>
        `;
      }
    }
  }

  async function switchToRecent() {
    if (state.viewMode === "recent") return;
    setViewMode("recent");
    // Fetch recently closed list from background
    let items = [];
    try {
      items = await new Promise((resolve) => {
        try {
          chrome.runtime.sendMessage(
            { action: "getRecentlyClosed", maxResults: 10 },
            (res) => {
              // Check for runtime errors
              if (chrome.runtime.lastError) {
                console.debug(
                  "[TAB SWITCHER] Runtime error:",
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
      console.debug("[TAB SWITCHER] Failed to load recently closed:", e);
    }
    // Map to renderable items (no screenshots)
    state.recentItems = items.map((it, idx) => ({
      id: null,
      title: it.title,
      url: it.url,
      favIconUrl: it.favIconUrl,
      screenshot: null,
      sessionId: it.sessionId,
      index: idx,
    }));
    state.currentTabs = state.recentItems;
    state.filteredTabs = state.recentItems;
    state.selectedIndex = 0;
    // Add recent-mode class for column layout
    if (state.domCache.grid) state.domCache.grid.classList.add("recent-mode");
    renderTabsStandard(state.filteredTabs);
    // Refocus search
    if (state.domCache.searchBox) state.domCache.searchBox.focus();
  }

  function switchToActive() {
    if (state.viewMode === "active") return;
    setViewMode("active");
    state.currentTabs = state.activeTabs || [];
    state.filteredTabs = state.currentTabs;
    state.selectedIndex = 0;
    // Remove recent-mode and search-mode classes for grid layout
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

  // ============================================================================
  // RENDERING - STANDARD (< 50 tabs)
  // ============================================================================
  function renderTabsStandard(tabs) {
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

    // Use DocumentFragment for batched DOM updates
    const fragment = document.createDocumentFragment();

    tabs.forEach((tab, index) => {
      const tabCard = createTabCard(tab, index);
      tabCard.dataset.tabIndex = index;
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
  function renderTabsVirtual(tabs) {
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
    const totalHeight = tabs.length * 180; // Approximate card height
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
  function createTabCard(tab, index) {
    const tabCard = document.createElement("div");
    tabCard.className = "tab-card";
    if (tab && typeof tab.id === "number") {
      tabCard.dataset.tabId = tab.id;
    }
    if (tab?.sessionId) {
      tabCard.dataset.sessionId = tab.sessionId;
      tabCard.dataset.recent = "1";
    }
    if (tab?.isWebSearch) {
      tabCard.dataset.webSearch = "1";
      tabCard.dataset.searchQuery = tab.searchQuery;
    }
    tabCard.dataset.tabIndex = index;
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

    // Thumbnail
    const thumbnail = document.createElement("div");
    thumbnail.className = "tab-thumbnail";

    // Audio/Mute Button
    // Show if audible OR muted OR if we want to allow muting (on hover)
    // We'll always add the button but hide it via CSS until hover/active
    if (!tab.sessionId && !tab.isWebSearch) {
      const muteBtn = document.createElement("button");
      muteBtn.className = "tab-mute-btn";
      muteBtn.title = tab.mutedInfo?.muted ? "Unmute tab" : "Mute tab";
      muteBtn.dataset.action = "mute";
      muteBtn.dataset.tabId = tab.id;

      if (tab.mutedInfo?.muted) {
        muteBtn.classList.add("muted");
        muteBtn.innerHTML =
          '<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>';
      } else {
        // If not muted, show volume icon if audible, otherwise show volume icon on hover
        muteBtn.innerHTML =
          '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
        // Only show persistently if audible
        if (tab.audible) {
          muteBtn.style.opacity = "0.9";
        }
      }

      // Stop propagation on click is handled in delegation
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
      // Show favicon tile for inactive tabs without screenshots
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

    // Show favicon in header only if we have a screenshot (so it appears with URL)
    if (tab.favIconUrl && hasValidScreenshot) {
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

    info.appendChild(header);

    // URL (only for screenshots)
    if (hasValidScreenshot) {
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
      if (tab.id) closeBtn.dataset.tabId = tab.id;
      tabCard.appendChild(closeBtn);
    }

    return tabCard;
  }

  // Create favicon tile
  function createFaviconTile(tab) {
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

  // ============================================================================
  // EVENT DELEGATION - GRID CLICKS
  // ============================================================================
  function handleGridClick(e) {
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

  // ============================================================================
  // KEYBOARD NAVIGATION (THROTTLED)
  // ============================================================================
  function handleKeyDown(e) {
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

  function handleKeyUp() {
    // Reserved for future use
  }

  // ============================================================================
  // SEARCH HANDLING
  // ============================================================================

  // Create smart search handler with combined throttle + debounce
  function createSmartSearchHandler() {
    let debounceTimer = null;
    let lastSearchTime = 0;
    const THROTTLE_MS = 100; // Immediate feedback for small tab sets
    const DEBOUNCE_MS = 300; // Wait for user to finish typing on large sets
    const LARGE_TAB_THRESHOLD = 50;

    return (e) => {
      const now = performance.now();
      const timeSinceLastSearch = now - lastSearchTime;
      const isLargeTabSet = state.currentTabs.length >= LARGE_TAB_THRESHOLD;

      // Clear any pending debounce
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      // For small tab sets: throttle only (immediate feedback)
      if (!isLargeTabSet && timeSinceLastSearch >= THROTTLE_MS) {
        lastSearchTime = now;
        handleSearch(e);
      }
      // For large tab sets: debounce (wait for user to finish typing)
      else {
        debounceTimer = setTimeout(
          () => {
            lastSearchTime = performance.now();
            handleSearch(e);
          },
          isLargeTabSet ? DEBOUNCE_MS : THROTTLE_MS
        );
      }
    };
  }

  // Fuzzy match scoring
  function fuzzyMatch(text, query) {
    // Simple "characters in order" matcher with scoring
    // Returns { match: boolean, score: number }

    if (!text) return { match: false, score: 0 };

    const t = text.toLowerCase();
    const q = query.toLowerCase();

    if (q.length === 0) return { match: true, score: 1 };
    if (t === q) return { match: true, score: 100 };

    // Exact substring matches get high priority
    if (t.startsWith(q))
      return { match: true, score: 80 + (q.length / t.length) * 10 };
    if (t.includes(q))
      return { match: true, score: 50 + (q.length / t.length) * 10 };

    let tIdx = 0;
    let qIdx = 0;
    let score = 0;
    let consecutive = 0;
    let firstMatchIdx = -1;

    while (tIdx < t.length && qIdx < q.length) {
      if (t[tIdx] === q[qIdx]) {
        if (firstMatchIdx === -1) firstMatchIdx = tIdx;

        // Base score for match
        let charScore = 1;

        // Bonus for consecutive matches
        if (consecutive > 0) {
          charScore += 2 + consecutive; // Increasing bonus for longer runs
        }

        // Bonus for start of word (after space or start of string)
        if (
          tIdx === 0 ||
          t[tIdx - 1] === " " ||
          t[tIdx - 1] === "." ||
          t[tIdx - 1] === "/" ||
          t[tIdx - 1] === "-"
        ) {
          charScore += 3;
        }

        score += charScore;
        consecutive++;
        qIdx++;
      } else {
        consecutive = 0;
      }
      tIdx++;
    }

    // Must match all characters in query
    if (qIdx < q.length) return { match: false, score: 0 };

    // Penalty for total length difference (prefer shorter matches)
    score -= (t.length - q.length) * 0.1;

    // Penalty for late start
    if (firstMatchIdx > 0) score -= firstMatchIdx * 0.5;

    return { match: true, score: Math.max(1, score) };
  }

  function renderHistoryView(historyData) {
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

  function createHistoryItem(entry, delta) {
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

  function isHistoryModeActive() {
    const v =
      (state.domCache?.searchBox &&
      typeof state.domCache.searchBox.value === "string"
        ? state.domCache.searchBox.value
        : "") || "";
    return v.trim().startsWith("/");
  }

  function updateHistorySelection() {
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

  function activateSelectedHistoryItem() {
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

  function handleSearch(e) {
    try {
      const rawVal =
        e?.target?.value && typeof e.target.value === "string"
          ? e.target.value
          : state.domCache?.searchBox?.value ?? "";
      const query = String(rawVal).trim();

      // History Mode: starts with /
      if (query.startsWith("/")) {
        state.history.active = true;
        if (state.domCache.grid) {
          state.domCache.grid.classList.add("search-mode");
          state.domCache.grid.classList.remove("recent-mode");
        }

        // Update help text for history mode
        if (state.domCache.helpText) {
          state.domCache.helpText.innerHTML = `
						<span><kbd>/</kbd> History Mode</span>
						<span><kbd>Click</kbd> Navigate</span>
						<span><kbd>Backspace</kbd> Exit History</span>
						<span><kbd>Esc</kbd> Close</span>
					`;
        }

        chrome.runtime.sendMessage(
          { action: "GET_TAB_HISTORY" },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error(
                "[TAB SWITCHER] History error:",
                chrome.runtime.lastError
              );
              return;
            }
            console.log("[TAB SWITCHER] Received history:", response);
            renderHistoryView(response || { back: [], forward: [] });
          }
        );
        return;
      }

      // Leaving history mode
      state.history.active = false;
      state.history.backEls = [];
      state.history.forwardEls = [];

      // Web Search Mode: starts with ?
      if (query.startsWith("?")) {
        const searchQuery = query.substring(1).trim();
        const webSearchTab = {
          id: "web-search",
          title: searchQuery
            ? `Search Web for "${searchQuery}"`
            : "Type to search web...",
          url: searchQuery
            ? `https://www.google.com/search?q=${encodeURIComponent(
                searchQuery
              )}`
            : "",
          favIconUrl: "https://www.google.com/favicon.ico",
          isWebSearch: true,
          searchQuery: searchQuery,
        };
        state.filteredTabs = [webSearchTab];
        state.selectedIndex = 0;
        // Add search-mode class for column layout
        if (state.domCache.grid) {
          state.domCache.grid.classList.add("search-mode");
          state.domCache.grid.classList.remove("recent-mode");
        }
        renderTabsStandard(state.filteredTabs);
        return;
      }

      // Remove search-mode class when not in web search
      if (state.domCache.grid) {
        state.domCache.grid.classList.remove("search-mode");
      }

      // '.' quick toggle
      const isDeleteBackward = !!(
        e &&
        typeof e.inputType === "string" &&
        e.inputType === "deleteContentBackward"
      );
      if (query === "." && !isDeleteBackward) {
        // clear and toggle view
        state.domCache.searchBox.value = "";
        if (state.viewMode === "recent") {
          switchToActive();
        } else {
          switchToRecent();
        }
        return;
      }

      if (!query) {
        state.filteredTabs = state.currentTabs;
        state.selectedIndex = 0;

        if (state.currentTabs.length > 50) {
          renderTabsVirtual(state.currentTabs);
        } else {
          renderTabsStandard(state.currentTabs);
        }
        return;
      }

      // Filter and Sort tabs using fuzzy match
      const scoredTabs = state.currentTabs.map((tab) => {
        const titleMatch = fuzzyMatch(tab.title, query);
        const urlMatch = fuzzyMatch(tab.url, query);

        // Take the best match
        const bestMatch =
          titleMatch.score > urlMatch.score ? titleMatch : urlMatch;

        return {
          tab,
          match: bestMatch.match,
          score: bestMatch.score,
        };
      });

      const filtered = scoredTabs
        .filter((item) => item.match)
        .sort((a, b) => b.score - a.score)
        .map((item) => item.tab);

      state.filteredTabs = filtered;
      state.selectedIndex = 0;

      if (filtered.length > 50) {
        renderTabsVirtual(filtered);
      } else {
        renderTabsStandard(filtered);
      }
    } catch (error) {
      console.error("[TAB SWITCHER] Error in handleSearch:", error);
      // Fallback to showing all tabs
      state.filteredTabs = state.currentTabs;
      state.selectedIndex = 0;
      renderTabsStandard(state.currentTabs);
    }
  }

  function handleSearchKeydown(e) {
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

  // ============================================================================
  // FOCUS & EVENT CAPTURE (PREVENT TYPING ON PAGE)
  // ============================================================================

  // Blur all focusable elements on the page to prevent them from receiving input
  function blurPageElements() {
    try {
      // Blur the currently focused element if it's not our extension
      if (
        document.activeElement &&
        document.activeElement !== document.body &&
        document.activeElement !== state.host
      ) {
        document.activeElement.blur();
      }

      // Also try to blur any iframes' active elements
      const iframes = document.querySelectorAll("iframe");
      iframes.forEach((iframe) => {
        try {
          if (iframe.contentDocument?.activeElement) {
            iframe.contentDocument.activeElement.blur();
          }
        } catch {
          // Cross-origin iframe, can't access
        }
      });
    } catch (error) {
      console.debug("[TAB SWITCHER] Error blurring page elements:", error);
    }
  }

  // Check if an event target is inside our shadow DOM
  function isEventFromOurExtension(e) {
    // Check if the target is our shadow host
    if (e.target === state.host) return true;

    // Check if target is inside our shadow root using composedPath
    const path = e.composedPath ? e.composedPath() : [];
    return path.some(
      (el) =>
        el === state.host || el === state.shadowRoot || el === state.overlay
    );
  }

  function handleGlobalFocus(e) {
    if (!state.isOverlayVisible) return;

    // If focus moves to something other than our host (shadow host), force it back.
    // When focus is inside Shadow DOM, document.activeElement is the host.
    // If e.target is NOT the host, it means focus went to a page element.
    if (!isEventFromOurExtension(e)) {
      e.stopPropagation();
      e.stopImmediatePropagation();
      e.preventDefault();

      // Blur the element that tried to steal focus
      if (e.target && typeof e.target.blur === "function") {
        e.target.blur();
      }

      if (state.domCache?.searchBox) {
        state.domCache.searchBox.focus();
      }
    }
  }

  function handleGlobalKeydown(e) {
    if (!state.isOverlayVisible) return;

    // Always block events that don't originate from our extension
    if (!isEventFromOurExtension(e)) {
      // Target is outside our extension. Block it completely.
      e.stopPropagation();
      e.stopImmediatePropagation();
      e.preventDefault();

      // Force focus back to our search box
      if (state.domCache?.searchBox) {
        state.domCache.searchBox.focus();

        // For printable characters, manually add them to the search box
        // This prevents losing the keystroke when focus wasn't on our input
        if (
          e.key &&
          e.key.length === 1 &&
          !e.ctrlKey &&
          !e.altKey &&
          !e.metaKey
        ) {
          const searchBox = state.domCache.searchBox;
          const start = searchBox.selectionStart || 0;
          const end = searchBox.selectionEnd || 0;
          const value = searchBox.value;
          searchBox.value = value.slice(0, start) + e.key + value.slice(end);
          searchBox.setSelectionRange(start + 1, start + 1);
          // Trigger input event so search updates
          searchBox.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
      return;
    }
  }

  // Block input/beforeinput/textInput events that target page elements
  function handleGlobalInput(e) {
    if (!state.isOverlayVisible) return;

    if (!isEventFromOurExtension(e)) {
      e.stopPropagation();
      e.stopImmediatePropagation();
      e.preventDefault();

      // For beforeinput events, we may need to insert the data into our search box
      if (e.type === "beforeinput" && e.data && state.domCache?.searchBox) {
        const searchBox = state.domCache.searchBox;
        searchBox.focus();
        const start = searchBox.selectionStart || 0;
        const end = searchBox.selectionEnd || 0;
        const value = searchBox.value;
        searchBox.value = value.slice(0, start) + e.data + value.slice(end);
        searchBox.setSelectionRange(
          start + e.data.length,
          start + e.data.length
        );
        searchBox.dispatchEvent(new Event("input", { bubbles: true }));
      } else if (state.domCache?.searchBox) {
        state.domCache.searchBox.focus();
      }
    }
  }

  // Block composition events (for IME input)
  function handleGlobalComposition(e) {
    if (!state.isOverlayVisible) return;

    if (!isEventFromOurExtension(e)) {
      e.stopPropagation();
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  }

  // Block focus attempts on page elements
  function handleGlobalFocusIn(e) {
    if (!state.isOverlayVisible) return;

    if (!isEventFromOurExtension(e)) {
      e.stopPropagation();
      e.stopImmediatePropagation();
      e.preventDefault();

      // Blur the element that received focus
      if (e.target && typeof e.target.blur === "function") {
        e.target.blur();
      }

      if (state.domCache?.searchBox) {
        state.domCache.searchBox.focus();
      }
    }
  }

  // Block click events on page elements when overlay is visible
  function handleGlobalClick(e) {
    if (!state.isOverlayVisible) return;

    if (!isEventFromOurExtension(e)) {
      e.stopPropagation();
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  }

  // ============================================================================
  // SELECTION MANAGEMENT
  // ============================================================================
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

  function selectNext() {
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

  function enforceSingleSelection(scrollIntoView) {
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

  function updateSelection() {
    try {
      if (!state.domCache.grid) return;
      // Re-render window if virtual and out of range
      const isVirtual = state.filteredTabs && state.filteredTabs.length > 50;
      if (isVirtual) {
        const { startIndex, endIndex } = state.virtualScroll;
        if (
          state.selectedIndex < startIndex ||
          state.selectedIndex >= endIndex
        ) {
          renderTabsVirtual(state.filteredTabs);
        }
      }
      enforceSingleSelection(true);
    } catch (error) {
      console.error("[TAB SWITCHER] Error in updateSelection:", error);
    }
  }

  // ============================================================================
  // TAB ACTIONS
  // ============================================================================
  function switchToTab(tabId) {
    try {
      if (!tabId || typeof tabId !== "number") {
        console.error("[TAB SWITCHER] Invalid tab ID:", tabId);
        return;
      }

      // Fire-and-forget to avoid message port errors if the service worker sleeps
      try {
        chrome.runtime.sendMessage({ action: "switchToTab", tabId }, () => {
          // Check for lastError to suppress "Unchecked runtime.lastError"
          if (chrome.runtime.lastError) {
            console.debug(
              "[TAB SWITCHER] SW not ready:",
              chrome.runtime.lastError.message
            );
          }
        });
      } catch (msgErr) {
        // Silently ignore; background may be restarting
        console.debug(
          "[TAB SWITCHER] sendMessage warn:",
          msgErr?.message || msgErr
        );
      }
      // Close immediately; background will perform the switch
      closeOverlay();
    } catch (error) {
      console.error("[TAB SWITCHER] Exception in switchToTab:", error);
      closeOverlay();
    }
  }

  function restoreSession(sessionId) {
    try {
      if (!sessionId) return;
      try {
        chrome.runtime.sendMessage(
          { action: "restoreSession", sessionId },
          () => {
            if (chrome.runtime.lastError) {
              console.debug(
                "[TAB SWITCHER] SW not ready (restoreSession):",
                chrome.runtime.lastError.message
              );
            }
          }
        );
      } catch (msgErr) {
        console.debug(
          "[TAB SWITCHER] sendMessage warn:",
          msgErr?.message || msgErr
        );
      }
      closeOverlay();
    } catch (error) {
      console.error("[TAB SWITCHER] Exception in restoreSession:", error);
      closeOverlay();
    }
  }

  function closeTab(tabId, index) {
    try {
      if (!tabId || typeof tabId !== "number") {
        console.error("[TAB SWITCHER] Invalid tab ID for closing:", tabId);
        return;
      }

      // Validate that the tab exists in our current list
      const tabExists = state.currentTabs.some(
        (tab) => tab && tab.id === tabId
      );
      if (!tabExists) {
        console.warn("[TAB SWITCHER] Tab no longer exists:", tabId);
        // Refresh the tab list
        state.filteredTabs = state.filteredTabs.filter(
          (tab) => tab && tab.id !== tabId
        );
        state.currentTabs = state.currentTabs.filter(
          (tab) => tab && tab.id !== tabId
        );

        // Adjust selected index
        if (state.selectedIndex >= state.filteredTabs.length) {
          state.selectedIndex = Math.max(0, state.filteredTabs.length - 1);
        }

        // Re-render
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
              "[TAB SWITCHER] Error closing tab:",
              chrome.runtime.lastError.message
            );
            return;
          }

          if (response?.success) {
            // Remove from current list
            state.currentTabs = state.currentTabs.filter(
              (tab) => tab && tab.id !== tabId
            );
            state.filteredTabs = state.filteredTabs.filter(
              (tab) => tab && tab.id !== tabId
            );

            // Adjust selected index
            if (state.filteredTabs.length > 0) {
              if (state.selectedIndex >= state.filteredTabs.length) {
                state.selectedIndex = Math.max(
                  0,
                  state.filteredTabs.length - 1
                );
              }

              // Re-render
              if (state.filteredTabs.length > 50) {
                renderTabsVirtual(state.filteredTabs);
              } else {
                renderTabsStandard(state.filteredTabs);
              }

              // Refocus search box to allow continued typing
              if (state.domCache.searchBox) {
                state.domCache.searchBox.focus();
              }
            } else {
              // Close overlay if no tabs left
              closeOverlay();
            }
          }
        }
      );
    } catch (error) {
      console.error("[TAB SWITCHER] Exception in closeTab:", error);
    }
  }

  function toggleMute(tabId, btnElement) {
    try {
      if (!tabId) return;

      chrome.runtime.sendMessage(
        { action: "toggleMute", tabId },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              "[TAB SWITCHER] Error toggling mute:",
              chrome.runtime.lastError
            );
            return;
          }

          if (response && response.success) {
            // Update UI immediately
            const isMuted = response.muted;

            // Update button state
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

            // Update internal state
            const tab = state.currentTabs.find((t) => t.id === tabId);
            if (tab) {
              if (!tab.mutedInfo) tab.mutedInfo = {};
              tab.mutedInfo.muted = isMuted;
            }
          }
        }
      );
    } catch (error) {
      console.error("[TAB SWITCHER] Exception in toggleMute:", error);
    }
  }

  // ============================================================================
  // CLOSE OVERLAY
  // ============================================================================
  function closeOverlay() {
    try {
      if (!state.isOverlayVisible) return;

      // GPU-accelerated fade-out
      requestAnimationFrame(() => {
        if (state.overlay) {
          state.overlay.style.opacity = "0";
        }

        setTimeout(() => {
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
          document.removeEventListener("keydown", handleKeyDown);
          document.removeEventListener("keyup", handleKeyUp);

          // Remove focus enforcement listeners
          document.removeEventListener("focus", handleGlobalFocus, true);
          document.removeEventListener("focusin", handleGlobalFocusIn, true);
          document.removeEventListener("keydown", handleGlobalKeydown, true);
          document.removeEventListener("keypress", handleGlobalKeydown, true);
          document.removeEventListener("keyup", handleGlobalKeydown, true);
          document.removeEventListener("input", handleGlobalInput, true);
          document.removeEventListener("beforeinput", handleGlobalInput, true);
          document.removeEventListener("textInput", handleGlobalInput, true);
          document.removeEventListener("click", handleGlobalClick, true);
          document.removeEventListener("mousedown", handleGlobalClick, true);

          // Remove composition event listeners
          document.removeEventListener(
            "compositionstart",
            handleGlobalComposition,
            true
          );
          document.removeEventListener(
            "compositionupdate",
            handleGlobalComposition,
            true
          );
          document.removeEventListener(
            "compositionend",
            handleGlobalComposition,
            true
          );

          if (state.intersectionObserver) {
            state.intersectionObserver.disconnect();
            state.intersectionObserver = null;
          }
        }, 200); // Match CSS transition
      });
    } catch (error) {
      console.error("[TAB SWITCHER] Error in closeOverlay:", error);
      // Force cleanup even on error
      state.isOverlayVisible = false;
      if (state.focusInterval) {
        clearInterval(state.focusInterval);
        state.focusInterval = null;
      }
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
      document.removeEventListener("focus", handleGlobalFocus, true);
      document.removeEventListener("focusin", handleGlobalFocusIn, true);
      document.removeEventListener("keydown", handleGlobalKeydown, true);
      document.removeEventListener("keypress", handleGlobalKeydown, true);
      document.removeEventListener("keyup", handleGlobalKeydown, true);
      document.removeEventListener("input", handleGlobalInput, true);
      document.removeEventListener("beforeinput", handleGlobalInput, true);
      document.removeEventListener("textInput", handleGlobalInput, true);
      document.removeEventListener("click", handleGlobalClick, true);
      document.removeEventListener("mousedown", handleGlobalClick, true);
      document.removeEventListener(
        "compositionstart",
        handleGlobalComposition,
        true
      );
      document.removeEventListener(
        "compositionupdate",
        handleGlobalComposition,
        true
      );
      document.removeEventListener(
        "compositionend",
        handleGlobalComposition,
        true
      );
    }
  }

  // ============================================================================
  // INTERSECTION OBSERVER (LAZY LOADING)
  // ============================================================================
  function setupIntersectionObserver() {
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

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  console.log("═══════════════════════════════════════════════════════");
  console.log("Visual Tab Switcher - Content Script Loaded");
  console.log(
    "Features: Virtual Scrolling, Event Delegation, GPU Acceleration"
  );
  console.log("Target: <16ms interactions, 60fps, lazy loading");
  console.log("═══════════════════════════════════════════════════════");
})();
