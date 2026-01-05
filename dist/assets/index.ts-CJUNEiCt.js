(function(){(function(){console.log("[TAB SWITCHER] Content script messaging module loaded");const e={overlay:null,currentTabs:[],activeTabs:[],filteredTabs:[],selectedIndex:0,isOverlayVisible:!1,viewMode:"active",recentItems:[],groups:[],collapsedGroups:new Set,host:null,shadowRoot:null,styleElement:null,lastFullscreenElement:null,domCache:{grid:null,searchBox:null,container:null,searchWrap:null,backBtn:null,sectionTitle:null,tabHint:null},virtualScroll:{startIndex:0,endIndex:0,visibleCount:20,bufferCount:5},lastKeyTime:0,keyThrottleMs:16,resizeObserver:null,intersectionObserver:null,focusInterval:null,closeTimeout:null,isClosing:!1,pageLock:null,history:{active:!1,backEls:[],forwardEls:[],column:"back",index:0},webSearch:{active:!1}},V="tab-switcher-host",ae=`/* Visual Tab Switcher - Modern Glass UI 2.0 */
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
  
  /* CSS Custom Properties - Monochrome Theme (White/Grey/Black) */
  --bg-overlay: rgba(0, 0, 0, 0.6);
  --bg-surface: #1c1c1c;
  --bg-glass: #2a2a2a;
  --bg-glass-hover: #333333;
  --border-subtle: rgba(255, 255, 255, 0.1);
  --border-hover: rgba(255, 255, 255, 0.15);
  --border-active: rgba(255, 255, 255, 0.25);
  --text-primary: #ffffff;
  --text-secondary: #a0a0a0;
  --text-muted: #666666;
  --accent: #ffffff;
  --accent-light: #e0e0e0;
  --accent-glow: rgba(255, 255, 255, 0.1);
  --card-bg: #252525;
  --card-hover: #2f2f2f;
  --card-selected: #3a3a3a;
  --danger: #ff6b6b;
  --success: #59d499;
  
  /* Raycast-style Shape - Subtle Rounded */
  --radius-3xl: 12px;
  --radius-2xl: 10px;
  --radius-xl: 8px;
  --radius-lg: 8px;
  --radius-md: 6px;
  --radius-sm: 5px;
  --radius-xs: 4px;
  --radius-full: 9999px;
  
  --shadow-xl: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.06);
  --shadow-card: 0 4px 12px rgba(0, 0, 0, 0.25);
  --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif;
  --transition-fast: 0.1s ease;
  --transition-smooth: 0.15s cubic-bezier(0.2, 0, 0, 1);
}

@media (prefers-color-scheme: light) {
  :host {
    /* Monochrome Light Theme */
    --bg-overlay: rgba(0, 0, 0, 0.25);
    --bg-surface: #ffffff;
    --bg-glass: #f5f5f5;
    --bg-glass-hover: #ebebeb;
    --border-subtle: rgba(0, 0, 0, 0.1);
    --border-hover: rgba(0, 0, 0, 0.15);
    --border-active: rgba(0, 0, 0, 0.25);
    --text-primary: #000000;
    --text-secondary: #666666;
    --text-muted: #999999;
    --accent: #000000;
    --accent-light: #333333;
    --accent-glow: rgba(0, 0, 0, 0.08);
    --card-bg: #f8f8f8;
    --card-hover: #f0f0f0;
    --card-selected: #e5e5e5;
    --shadow-xl: 0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.06);
    --shadow-card: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
}

/* Overlay */
.tab-switcher-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: none;
  align-items: center;
  justify-content: center;
  padding: 20px;
  font-family: var(--font-family);
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  /* Enable pointer events on the overlay when visible */
  pointer-events: auto;
  /* Prevent scroll chaining to the host page */
  overscroll-behavior: contain;
}

.tab-switcher-backdrop {
  position: absolute;
  inset: 0;
  background: var(--bg-overlay);
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  animation: backdropFadeIn 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.tab-switcher-container {
  position: relative;
  width: 750px;
  max-width: 94vw;
  max-height: 75vh;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-3xl);
  box-shadow: var(--shadow-xl);
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
  animation: containerSlideIn 0.2s cubic-bezier(0.2, 0, 0, 1);
}

/* Search Header - Raycast-style Navigation Bar */
.tab-switcher-search-row {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border-subtle);
  background: transparent;
}

.tab-switcher-search-wrap {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}

.tab-switcher-search {
  width: 100%;
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 22px 24px 22px 56px;
  font-size: 17px;
  font-weight: 400;
  color: var(--text-primary);
  outline: none;
  transition: none;
  letter-spacing: -0.01em;
  caret-color: var(--accent);
}

.tab-switcher-search:focus {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
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
  transition: color var(--transition-fast);
}

.tab-switcher-search:focus ~ .search-icon,
.tab-switcher-search-wrap:focus-within .search-icon {
  color: var(--text-muted);
  transform: none;
}

/* Tab hint on right side of search bar */
.search-tab-hint {
  position: absolute;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
  font-size: 12px;
  pointer-events: none;
  opacity: 1;
  transition: opacity var(--transition-fast);
}

.search-tab-hint kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 20px;
  padding: 0 6px;
  background: var(--bg-glass);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xs);
  font-size: 11px;
  font-weight: 500;
  font-family: inherit;
  color: var(--text-secondary);
}

.search-tab-hint.hidden {
  opacity: 0;
}

/* Section Header with View Toggle */
.tab-switcher-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 16px;
  flex-shrink: 0;
}

.tab-switcher-section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.tab-switcher-view-toggle {
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--bg-glass);
  border-radius: var(--radius-sm);
  padding: 2px;
}

.view-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  border-radius: var(--radius-xs);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.view-toggle-btn:hover {
  color: var(--text-secondary);
  background: var(--bg-glass-hover);
}

.view-toggle-btn.active {
  background: var(--bg-glass-hover);
  color: var(--text-primary);
}

.view-toggle-btn svg {
  width: 14px;
  height: 14px;
}

/* Buttons */
.recent-back-btn {
  position: absolute;
  left: 8px;
  z-index: 10;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 16px;
  transition: all var(--transition-fast);
}

.recent-back-btn:hover {
  background: var(--bg-glass-hover);
  color: var(--text-primary);
  transform: none;
}

/* Grid - Active Tabs */
.tab-switcher-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
  overflow-y: auto;
  overflow-x: hidden;
  /* Extra vertical padding to allow space for the "selection lift/scale" without cropping */
  padding: 12px 12px;
  min-height: 180px;
  scroll-behavior: smooth;
  overscroll-behavior: contain;
}

/* List View Mode */
.tab-switcher-grid.list-view {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tab-switcher-grid.list-view .tab-card {
  width: 100%;
  height: auto;
  min-height: 52px;
  flex-direction: row;
  align-items: center;
  padding: 10px 14px;
  gap: 12px;
}

.tab-switcher-grid.list-view .tab-card:hover {
  transform: none;
}

.tab-switcher-grid.list-view .tab-card.selected {
  transform: none !important;
}

.tab-switcher-grid.list-view .tab-thumbnail {
  flex: 0 0 36px;
  height: 36px;
  width: 36px;
  min-height: 36px;
  border-radius: var(--radius-sm);
}

.tab-switcher-grid.list-view .tab-info {
  flex: 1;
  padding: 0;
  min-width: 0;
}

.tab-switcher-grid.list-view .tab-title {
  font-size: 14px;
}

.tab-switcher-grid.list-view .tab-url {
  padding-left: 0;
  font-size: 12px;
}

.tab-switcher-grid.list-view .tab-close-btn {
  position: relative;
  top: auto;
  right: auto;
  opacity: 0;
  width: 24px;
  height: 24px;
}

.tab-switcher-grid.list-view .tab-card:hover .tab-close-btn {
  opacity: 1;
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
  border-radius: var(--radius-lg);
  overflow: hidden;
  cursor: pointer;
  position: relative;
  display: flex;
  flex-direction: column;
  height: 160px;
  transition: all var(--transition-fast);
  box-shadow: none;
}

.tab-card:hover {
  transform: translateY(-2px);
  border-color: var(--border-hover);
  background: var(--card-hover);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.tab-card.selected {
  border-color: var(--accent) !important;
  border-width: 2px !important;
  background: var(--card-selected) !important;
  /* Raycast-style subtle glow */
  box-shadow: 0 0 0 2px var(--accent-glow), 0 4px 12px rgba(0, 0, 0, 0.2) !important;
  /* Slight lift */
  transform: translateY(-3px) !important;
  z-index: 50 !important;
}

.tab-card.selected::before {
  content: '';
  position: absolute;
  inset: 0;
  /* Subtle inner highlight */
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, transparent 100%);
  pointer-events: none;
  z-index: 0;
  animation: none;
}

@keyframes selection-pulse {
  from { opacity: 0.4; }
  to { opacity: 0.8; }
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

.tab-card:hover .screenshot-img,
.tab-card.selected .screenshot-img {
  opacity: 1;
  transform: scale(1.04);
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

.tab-card:hover .favicon-letter,
.tab-card.selected .favicon-letter {
  transform: scale(1.08);
  border-color: var(--accent);
  background: var(--bg-glass-hover);
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
  color: var(--text-primary);
  font-weight: 700;
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

/* Footer/Help - Raycast-style Action Bar */
.tab-switcher-help {
  display: flex;
  align-items: center;
  gap: 0;
  margin-top: 0;
  padding: 10px 16px;
  border-top: 1px solid var(--border-subtle);
  color: var(--text-muted);
  font-size: 12px;
  justify-content: center;
  flex-wrap: nowrap;
  flex-shrink: 0;
  background: var(--bg-surface);
  min-height: 40px;
}

.tab-switcher-help span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 12px;
  white-space: nowrap;
  border-right: 1px solid var(--border-subtle);
  font-size: 11px;
  color: var(--text-muted);
}

.tab-switcher-help span:last-child {
  border-right: none;
}

kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: var(--bg-glass);
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
  box-shadow: none;
  transition: none;
  margin-right: 3px;
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
    backdrop-filter: blur(20px) saturate(150%);
  }
}

@keyframes containerSlideIn {
  from { 
    opacity: 0;
    transform: translateY(-8px) scale(0.98);
  }
  to { 
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes cardFadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
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
  min-height: 52px;
  flex-direction: row;
  align-items: center;
  padding: 10px 14px;
  gap: 12px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  box-shadow: none;
}

.tab-switcher-grid.recent-mode .tab-card:hover {
  transform: none;
  border-color: var(--border-hover);
  box-shadow: none;
}

.tab-switcher-grid.recent-mode .tab-card.selected {
  border-color: var(--accent);
  background: var(--card-selected);
  transform: none !important;
  box-shadow: 0 0 0 2px var(--accent-glow) !important;
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
  min-height: 52px;
  flex-direction: row;
  align-items: center;
  padding: 10px 14px;
  gap: 12px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  box-shadow: none;
}

.tab-switcher-grid.search-mode .tab-card:hover {
  transform: none;
  border-color: var(--border-hover);
  box-shadow: none;
}

.tab-switcher-grid.search-mode .tab-card.selected {
  border-color: var(--accent);
  background: var(--card-selected);
  transform: none !important;
  box-shadow: 0 0 0 2px var(--accent-glow) !important;
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
    padding: 0;
    max-width: 98vw;
    max-height: 90vh;
  }
  
  .tab-switcher-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 8px;
    padding: 10px;
  }
  
  .tab-card {
    height: 140px;
  }
  
  .tab-switcher-help {
    gap: 0;
    font-size: 10px;
    padding: 6px 10px;
  }
  
  .tab-switcher-help span {
    padding: 0 6px;
  }
  
  kbd {
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    font-size: 9px;
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

/* GROUP HEADER CARD styles removed - headers are no longer used */
`;function g(t){const r=performance.now(),a=e.domCache.grid;if(!a)return;if(a.innerHTML="",a.classList.remove("virtual-list"),a.style.minHeight="",t.length===0){const s=document.createElement("div");s.className="tab-switcher-empty",s.textContent="No tabs found",a.appendChild(s);return}const o=document.createDocumentFragment();t.forEach((s,i)=>{const l=q(s,i);s.isGroupHeader&&(l.dataset.isHeader="true"),l.dataset.tabIndex=String(i),o.appendChild(l)}),a.appendChild(o),M(!1);const n=performance.now()-r;console.log(`[PERF] Rendered ${t.length} tabs in ${n.toFixed(2)}ms`)}function y(t){const r=performance.now(),a=e.domCache.grid;if(!a)return;if(a.innerHTML="",a.classList.add("virtual-list"),t.length===0){const h=document.createElement("div");h.className="tab-switcher-empty",h.textContent="No tabs found",a.appendChild(h);return}const o=68,n=e.virtualScroll.visibleCount,s=e.virtualScroll.bufferCount,i=Math.max(0,e.selectedIndex-s),l=Math.min(t.length,e.selectedIndex+n+s);e.virtualScroll.startIndex=i,e.virtualScroll.endIndex=l;const u=t.length*o;a.style.minHeight=`${u}px`;const d=document.createDocumentFragment();for(let h=i;h<l;h++){const m=t[h],b=q(m,h);b.style.position="absolute",b.style.top=`${h*o}px`,b.style.left="0",b.style.right="0",d.appendChild(b)}a.appendChild(d),ne(),M(!1);const c=performance.now()-r;console.log(`[PERF] Virtual rendered ${l-i} of ${t.length} tabs in ${c.toFixed(2)}ms`)}function q(t,r){const a=document.createElement("div");a.className="tab-card",t&&typeof t.id=="number"&&(a.dataset.tabId=String(t.id)),t?.sessionId&&(a.dataset.sessionId=t.sessionId,a.dataset.recent="1"),t?.isWebSearch&&(a.dataset.webSearch="1",a.dataset.searchQuery=t.searchQuery),a.dataset.tabIndex=String(r),a.setAttribute("role","option"),a.setAttribute("aria-selected",r===e.selectedIndex?"true":"false"),a.setAttribute("aria-label",`${t.title} - ${t.url}`),a.tabIndex=-1,a.style.transform="translate3d(0, 0, 0)";const o=t.screenshot&&typeof t.screenshot=="string"&&t.screenshot.length>0;if(o?a.classList.add("has-screenshot"):a.classList.add("has-favicon"),r===e.selectedIndex&&a.classList.add("selected"),t.pinned&&a.classList.add("pinned"),t.groupId&&t.groupId!==-1&&e.groups){const c=e.groups.find(h=>h.id===t.groupId);if(c){const h=se(c.color),m=c.title||"Group";a.dataset.groupId=String(c.id),a.style.borderLeft=`6px solid ${h}`,a.style.background=`linear-gradient(to right, ${h}15, rgba(255,255,255,0.02))`,t._groupColor=h,t._groupTitle=m}}const n=document.createElement("div");if(n.className="tab-thumbnail",!t.sessionId&&!t.isWebSearch){const c=document.createElement("button");c.className="tab-mute-btn",c.title=t.mutedInfo?.muted?"Unmute tab":"Mute tab",c.dataset.action="mute",c.dataset.tabId=String(t.id),t.mutedInfo?.muted?(c.classList.add("muted"),c.innerHTML='<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>'):(c.innerHTML='<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',t.audible&&(c.style.opacity="0.9")),n.appendChild(c)}if(t.sessionId){a.classList.add("recent-item");const c=F(t);n.appendChild(c)}else if(o){const c=document.createElement("img");c.className="screenshot-img",c.dataset.src=t.screenshot,c.alt=t.title,Math.abs(r-e.selectedIndex)<10&&(c.src=t.screenshot),n.appendChild(c)}else{const c=F(t);n.appendChild(c)}a.appendChild(n);const s=document.createElement("div");s.className="tab-info";const i=document.createElement("div");if(i.className="tab-header",o){let c=t.favIconUrl;if(!c&&t.url)try{const h=new URL(chrome.runtime.getURL("/_favicon/"));h.searchParams.set("pageUrl",t.url),h.searchParams.set("size","16"),c=h.toString()}catch{}if(c){const h=document.createElement("img");h.src=c,h.className="tab-favicon",h.onerror=()=>{h.style.display="none"},i.appendChild(h)}}const l=document.createElement("div");l.className="tab-title",l.textContent=t.title,l.title=t.title,i.appendChild(l);const u=t._groupColor,d=t._groupTitle;if(u){const c=document.createElement("span");c.className="group-pill",c.textContent=d,c.style.backgroundColor=u,c.style.opacity="0.4",c.style.color="white",c.style.fontSize="10px",c.style.fontWeight="700",c.style.padding="2px 6px",c.style.borderRadius="40px",c.style.marginLeft="8px",c.style.alignSelf="center",c.style.whiteSpace="nowrap",i.appendChild(c)}if(s.appendChild(i),o){const c=document.createElement("div");c.className="tab-url",c.textContent=t.url,c.title=t.url,s.appendChild(c)}if(a.appendChild(s),!t.sessionId&&!t.isWebSearch){const c=document.createElement("button");c.className="tab-close-btn",c.innerHTML="×",c.title="Close tab",c.dataset.action="close",t.id&&(c.dataset.tabId=String(t.id)),a.appendChild(c)}return a}function F(t){const r=document.createElement("div");r.className="favicon-tile";let a=t.favIconUrl;if(!a&&t.url)try{const o=new URL(chrome.runtime.getURL("/_favicon/"));o.searchParams.set("pageUrl",t.url),o.searchParams.set("size","32"),a=o.toString()}catch{}if(a){const o=document.createElement("img");o.src=a,o.className="favicon-large",o.onerror=()=>{o.style.display="none";const n=document.createElement("div");n.className="favicon-letter",n.textContent=(t.title||"T")[0].toUpperCase(),r.appendChild(n)},r.appendChild(o)}else{const o=document.createElement("div");o.className="favicon-letter",o.textContent=(t.title||"T")[0].toUpperCase(),r.appendChild(o)}return r}function M(t){try{const r=e.domCache.grid;if(!r)return;r.querySelectorAll(".tab-card.selected").forEach(n=>{n.classList.remove("selected"),n.setAttribute("aria-selected","false")});const o=r.querySelector(`.tab-card[data-tab-index="${e.selectedIndex}"]`);if(!o)return;o.classList.add("selected"),o.setAttribute("aria-selected","true"),r.setAttribute("aria-activedescendant",o.id||`tab-card-${e.selectedIndex}`),o.id||(o.id=`tab-card-${e.selectedIndex}`),t&&requestAnimationFrame(()=>{o.scrollIntoView({behavior:"smooth",block:"nearest",inline:"nearest"})})}catch(r){console.error("[TAB SWITCHER] Error enforcing selection:",r)}}function Q(){try{if(!e.domCache.grid)return;if(e.filteredTabs&&e.filteredTabs.length>50){const{startIndex:r,endIndex:a}=e.virtualScroll;(e.selectedIndex<r||e.selectedIndex>=a)&&y(e.filteredTabs)}M(!0)}catch(t){console.error("[TAB SWITCHER] Error in updateSelection:",t)}}function ne(){e.intersectionObserver&&e.intersectionObserver.disconnect(),e.intersectionObserver=new IntersectionObserver(r=>{r.forEach(a=>{if(a.isIntersecting){const o=a.target;o.dataset.src&&!o.src&&(o.src=o.dataset.src,e.intersectionObserver.unobserve(o))}})},{rootMargin:"100px"}),e.domCache.grid.querySelectorAll("img[data-src]").forEach(r=>{e.intersectionObserver.observe(r)})}function oe(t){const r=e.domCache.grid;if(!r)return;r.innerHTML="",r.className="tab-switcher-grid search-mode";const a=document.createElement("div");a.className="history-view",e.history.active=!0,e.history.backEls=[],e.history.forwardEls=[];const o=document.createElement("div");o.className="history-column";const n=document.createElement("div");if(n.className="history-column-header",n.textContent="← BACK",o.appendChild(n),t.back&&t.back.length>0){const l=document.createElement("div");l.className="history-items-container",t.back.forEach((u,d)=>{const c=G(u,-(d+1));c.dataset.column="back",c.dataset.index=String(d),l.appendChild(c),e.history.backEls.push(c)}),o.appendChild(l)}else{const l=document.createElement("div");l.className="tab-switcher-empty",l.textContent="No back history",l.style.padding="20px",l.style.textAlign="center",l.style.color="var(--text-muted)",o.appendChild(l)}const s=document.createElement("div");s.className="history-column";const i=document.createElement("div");if(i.className="history-column-header",i.textContent="FORWARD →",s.appendChild(i),t.forward&&t.forward.length>0){const l=document.createElement("div");l.className="history-items-container",t.forward.forEach((u,d)=>{const c=G(u,d+1);c.dataset.column="forward",c.dataset.index=String(d),l.appendChild(c),e.history.forwardEls.push(c)}),s.appendChild(l)}else{const l=document.createElement("div");l.className="tab-switcher-empty",l.textContent="No forward history",l.style.padding="20px",l.style.textAlign="center",l.style.color="var(--text-muted)",s.appendChild(l)}a.appendChild(o),a.appendChild(s),r.appendChild(a),e.history.backEls.length>0?(e.history.column="back",e.history.index=0):e.history.forwardEls.length>0&&(e.history.column="forward",e.history.index=0),L()}function G(t,r){const a=typeof t=="string"?t:t.url,o=typeof t=="string"?t:t.title||t.url,n=document.createElement("div");n.className="history-item",n.tabIndex=0,n.dataset.delta=r,n.onclick=()=>{window.history.go(r),p()},n.onkeydown=d=>{(d.key==="Enter"||d.key===" ")&&(d.preventDefault(),window.history.go(r),p())};const s=document.createElement("img");s.className="history-favicon";try{const d=new URL(chrome.runtime.getURL("/_favicon/"));d.searchParams.set("pageUrl",a),d.searchParams.set("size","16"),s.src=d.toString()}catch{}const i=document.createElement("div");i.className="history-item-content";const l=document.createElement("div");l.className="history-item-title",l.textContent=o,l.title=o;const u=document.createElement("div");u.className="history-item-url";try{const d=new URL(a);u.textContent=d.hostname+d.pathname}catch{u.textContent=a}return u.title=a,i.appendChild(l),i.appendChild(u),n.appendChild(s),n.appendChild(i),n}function L(){const t=e.history.backEls||[],r=e.history.forwardEls||[];for(const s of t)s.classList.remove("selected");for(const s of r)s.classList.remove("selected");const a=e.history.column==="forward"?r:t;if(!a.length)return;const o=Math.min(Math.max(0,e.history.index),a.length-1);e.history.index=o;const n=a[o];n&&(n.classList.add("selected"),n.scrollIntoView({block:"nearest"}))}function ie(){const t=e.history.backEls||[],r=e.history.forwardEls||[],o=(e.history.column==="forward"?r:t)[e.history.index];if(!o)return;const n=Number(o.dataset.delta);Number.isFinite(n)&&(window.history.go(n),p())}function se(t){return{grey:"#bdc1c6",blue:"#8ab4f8",red:"#f28b82",yellow:"#fdd663",green:"#81c995",pink:"#ff8bcb",purple:"#c58af9",cyan:"#78d9ec",orange:"#fcad70"}[t]||t}function ce(t){try{const r=t.target;if(r.dataset.action==="close"||r.classList.contains("tab-close-btn")){t.stopPropagation();const n=parseInt(r.dataset.tabId||r.parentElement.dataset.tabId||"0"),s=parseInt(r.dataset.tabIndex||r.parentElement.dataset.tabIndex||"0");n&&!Number.isNaN(n)&&O(n,s);return}if(r.dataset.action==="mute"||r.closest(".tab-mute-btn")){t.stopPropagation();const n=r.closest(".tab-mute-btn"),s=parseInt(n.dataset.tabId||"0");s&&!Number.isNaN(s)&&ue(s,n);return}const a=r.closest(".tab-card");if(!a)return;if(e.viewMode==="recent"||a.dataset.recent==="1"){const n=a.dataset.sessionId;n&&W(n);return}if(a.dataset.webSearch==="1"){const n=a.dataset.searchQuery;n&&(window.open(`https://www.google.com/search?q=${encodeURIComponent(n)}`,"_blank"),p());return}const o=parseInt(a.dataset.tabId||"0");o&&!Number.isNaN(o)?D(o):console.error("[TAB SWITCHER] Invalid tab ID in card:",a)}catch(r){console.error("[TAB SWITCHER] Error in handleGridClick:",r)}}function Y(){return((e.domCache?.searchBox&&typeof e.domCache.searchBox.value=="string"?e.domCache.searchBox.value:"")||"").trim().startsWith(",")}function H(t){if(!e.isOverlayVisible)return;if(t.key==="Escape"){t.preventDefault(),t.stopPropagation(),typeof t.stopImmediatePropagation=="function"&&t.stopImmediatePropagation(),p();return}const r=t.target===e.domCache.searchBox||t.composedPath&&e.domCache.searchBox&&t.composedPath().includes(e.domCache.searchBox),a=Y()&&e.history.active,n=a&&["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Enter"].includes(t.key);if(r&&!n)return;const s=performance.now();if(s-e.lastKeyTime<e.keyThrottleMs){t.preventDefault();return}e.lastKeyTime=s;try{if(a)switch(t.key){case"Enter":t.preventDefault(),ie();return;case"ArrowDown":{t.preventDefault();const i=e.history.column==="forward"?e.history.forwardEls:e.history.backEls;i.length&&(e.history.index=Math.min(e.history.index+1,i.length-1),L());return}case"ArrowUp":{t.preventDefault(),(e.history.column==="forward"?e.history.forwardEls:e.history.backEls).length&&(e.history.index=Math.max(e.history.index-1,0),L());return}case"ArrowLeft":{t.preventDefault(),e.history.column==="forward"&&e.history.backEls.length&&(e.history.column="back",e.history.index=Math.min(e.history.index,e.history.backEls.length-1),L());return}case"ArrowRight":{t.preventDefault(),e.history.column==="back"&&e.history.forwardEls.length&&(e.history.column="forward",e.history.index=Math.min(e.history.index,e.history.forwardEls.length-1),L());return}}switch(t.key){case"Enter":if(t.preventDefault(),e.filteredTabs.length>0&&e.selectedIndex>=0&&e.selectedIndex<e.filteredTabs.length){const i=e.filteredTabs[e.selectedIndex];if(i)if(i.isWebSearch){const l=(i.searchQuery||"").trim();l&&(window.open(`https://www.google.com/search?q=${encodeURIComponent(l)}`,"_blank"),p())}else e.viewMode==="recent"&&i.sessionId?W(i.sessionId):i.id&&D(i.id)}break;case"Tab":if(t.preventDefault(),e.domCache?.searchBox){const i=e.domCache.searchBox.value.trim();t.shiftKey?T():e.viewMode==="recent"?v():i.length===0?(e.webSearch.active=!e.webSearch.active,e.domCache.searchBox.dispatchEvent(new Event("input",{bubbles:!0})),e.domCache.searchBox.focus()):i.startsWith(",")?v():(window.open(`https://www.google.com/search?q=${encodeURIComponent(i)}`,"_blank"),p())}else t.shiftKey?T():v();break;case"ArrowRight":t.preventDefault(),J();break;case"ArrowLeft":t.preventDefault(),X();break;case"ArrowDown":t.preventDefault(),v();break;case"ArrowUp":t.preventDefault(),T();break;case"Delete":if(e.viewMode!=="recent"&&e.filteredTabs.length>0&&e.selectedIndex>=0&&e.selectedIndex<e.filteredTabs.length){t.preventDefault();const i=e.filteredTabs[e.selectedIndex];i?.id&&O(i.id,e.selectedIndex)}break;case"g":case"G":if(t.altKey&&(t.preventDefault(),e.viewMode!=="recent"&&e.filteredTabs.length>0&&e.selectedIndex>=0&&e.selectedIndex<e.filteredTabs.length)){const i=e.filteredTabs[e.selectedIndex];i?.id&&pe(i.id)}break}}catch(i){console.error("[TAB SWITCHER] Error in handleKeyDown:",i)}}function N(){}function le(t){try{if(Y()&&e.history.active&&["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Enter"].includes(t.key)){t.preventDefault();return}if(["Delete","Tab","ArrowDown","ArrowUp","ArrowRight","ArrowLeft","Enter"].includes(t.key)){const n=performance.now();if(n-e.lastKeyTime<e.keyThrottleMs){t.preventDefault();return}e.lastKeyTime=n}if(t.key==="."&&(t.target.value||"").length===0){t.preventDefault(),e.viewMode==="recent"?A():ee();return}if(t.key==="Backspace"){const n=t.target.value||"";if(n.length===0&&e.webSearch.active){t.preventDefault(),e.webSearch.active=!1,e.domCache?.searchBox&&e.domCache.searchBox.dispatchEvent(new Event("input",{bubbles:!0}));return}if(n.length===0&&e.viewMode==="recent"){t.preventDefault(),A();return}return}if(t.key==="Delete"){if(t.preventDefault(),e.viewMode!=="recent"&&e.filteredTabs.length>0&&e.selectedIndex>=0&&e.selectedIndex<e.filteredTabs.length){const n=e.filteredTabs[e.selectedIndex];n?.id&&O(n.id,e.selectedIndex)}return}if(t.key==="Tab"){t.preventDefault();const s=(t.target.value||"").trim();t.shiftKey?T():e.viewMode==="recent"?v():s.length===0?(e.webSearch.active=!e.webSearch.active,e.domCache?.searchBox&&e.domCache.searchBox.dispatchEvent(new Event("input",{bubbles:!0}))):s.startsWith(",")?v():(window.open(`https://www.google.com/search?q=${encodeURIComponent(s)}`,"_blank"),p());return}if(t.key==="ArrowDown"){t.preventDefault(),v();return}if(t.key==="ArrowUp"){t.preventDefault(),T();return}if(t.key==="ArrowRight"){t.preventDefault(),J();return}if(t.key==="ArrowLeft"){t.preventDefault(),X();return}if(t.key==="Enter"){if(t.preventDefault(),e.filteredTabs.length>0&&e.selectedIndex>=0&&e.selectedIndex<e.filteredTabs.length){const n=e.filteredTabs[e.selectedIndex];e.viewMode==="recent"&&n?.sessionId?W(n.sessionId):n?.isWebSearch?(window.open(`https://www.google.com/search?q=${encodeURIComponent(n.searchQuery)}`,"_blank"),p()):n?.id&&n.id>=0&&D(n.id)}return}}catch(r){console.error("[TAB SWITCHER] Error in handleSearchKeydown:",r)}}function v(){!e.filteredTabs||e.filteredTabs.length===0||(e.selectedIndex++,e.selectedIndex>=e.filteredTabs.length&&(e.selectedIndex=0),Q())}function T(){!e.filteredTabs||e.filteredTabs.length===0||(e.selectedIndex--,e.selectedIndex<0&&(e.selectedIndex=e.filteredTabs.length-1),Q())}function J(){v()}function X(){T()}function de(){if(e.pageLock)return;const t=document.body;if(!t)return;const r="inert"in t;e.pageLock={bodyPointerEvents:t.style.pointerEvents,bodyUserSelect:t.style.userSelect,bodyInert:r?!!t.inert:!1};try{r&&(t.inert=!0)}catch{}t.style.pointerEvents="none",t.style.userSelect="none"}function K(){if(!e.pageLock)return;const t=document.body;if(!t){e.pageLock=null;return}const r="inert"in t;try{r&&(t.inert=e.pageLock.bodyInert)}catch{}t.style.pointerEvents=e.pageLock.bodyPointerEvents,t.style.userSelect=e.pageLock.bodyUserSelect,e.pageLock=null}function he(){try{document.activeElement&&document.activeElement!==document.body&&document.activeElement!==e.host&&document.activeElement.blur(),document.querySelectorAll("iframe").forEach(r=>{try{r.contentDocument?.activeElement&&r.contentDocument.activeElement.blur()}catch{}})}catch(t){console.debug("[TAB SWITCHER] Error blurring page elements:",t)}}function k(t){return t.target===e.host?!0:(t.composedPath?t.composedPath():[]).some(a=>a===e.host||a===e.shadowRoot||a===e.overlay)}function z(t){e.isOverlayVisible&&(k(t)||(t.stopPropagation(),t.stopImmediatePropagation(),t.preventDefault(),t.target&&typeof t.target.blur=="function"&&t.target.blur(),e.domCache?.searchBox&&e.domCache.searchBox.focus()))}function C(t){if(e.isOverlayVisible&&!k(t)){if(t.stopPropagation(),t.stopImmediatePropagation(),t.preventDefault(),e.domCache?.searchBox&&(e.domCache.searchBox.focus(),t.key&&t.key.length===1&&!t.ctrlKey&&!t.altKey&&!t.metaKey)){const r=e.domCache.searchBox,a=r.selectionStart||0,o=r.selectionEnd||0,n=r.value;r.value=n.slice(0,a)+t.key+n.slice(o),r.setSelectionRange(a+1,a+1),r.dispatchEvent(new Event("input",{bubbles:!0}))}return}}function E(t){if(e.isOverlayVisible&&!k(t))if(t.stopPropagation(),t.stopImmediatePropagation(),t.preventDefault(),t.type==="beforeinput"&&t.data&&e.domCache?.searchBox){const r=e.domCache.searchBox;r.focus();const a=r.selectionStart||0,o=r.selectionEnd||0,n=r.value;r.value=n.slice(0,a)+t.data+n.slice(o),r.setSelectionRange(a+t.data.length,a+t.data.length),r.dispatchEvent(new Event("input",{bubbles:!0}))}else e.domCache?.searchBox&&e.domCache.searchBox.focus()}function I(t){e.isOverlayVisible&&(k(t)||(t.stopPropagation(),t.stopImmediatePropagation(),t.preventDefault()))}function Z(t){e.isOverlayVisible&&(k(t)||(t.stopPropagation(),t.stopImmediatePropagation(),t.preventDefault(),t.target&&typeof t.target.blur=="function"&&t.target.blur(),e.domCache?.searchBox&&e.domCache.searchBox.focus()))}function R(t){e.isOverlayVisible&&(k(t)||(t.stopPropagation(),t.stopImmediatePropagation(),t.preventDefault()))}function p(){try{if(!e.isOverlayVisible||e.isClosing)return;e.isClosing=!0,K(),requestAnimationFrame(()=>{e.overlay&&(e.overlay.style.opacity="0"),e.closeTimeout&&clearTimeout(e.closeTimeout),e.closeTimeout=setTimeout(()=>{e.closeTimeout=null,e.isClosing=!1,e.overlay&&(e.overlay.style.display="none"),e.isOverlayVisible=!1,e.focusInterval&&(clearInterval(e.focusInterval),e.focusInterval=null),e.lastFullscreenElement=null,document.removeEventListener("keydown",H,!0),document.removeEventListener("keyup",N,!0),document.removeEventListener("focus",z,!0),document.removeEventListener("focusin",Z,!0),document.removeEventListener("keydown",C,!0),document.removeEventListener("keypress",C,!0),document.removeEventListener("keyup",C,!0),document.removeEventListener("input",E,!0),document.removeEventListener("beforeinput",E,!0),document.removeEventListener("textInput",E,!0),document.removeEventListener("click",R,!0),document.removeEventListener("mousedown",R,!0),document.removeEventListener("compositionstart",I,!0),document.removeEventListener("compositionupdate",I,!0),document.removeEventListener("compositionend",I,!0),e.intersectionObserver&&(e.intersectionObserver.disconnect(),e.intersectionObserver=null)},200)})}catch(t){console.error("[TAB SWITCHER] Error in closeOverlay:",t),e.isOverlayVisible=!1,e.isClosing=!1,K(),e.focusInterval&&(clearInterval(e.focusInterval),e.focusInterval=null);try{document.removeEventListener("keydown",H,!0),document.removeEventListener("keyup",N,!0),document.removeEventListener("focus",z,!0)}catch{}}}function D(t){try{if(!t||typeof t!="number"){console.error("[TAB SWITCHER] Invalid tab ID:",t);return}try{chrome.runtime.sendMessage({action:"switchToTab",tabId:t},()=>{chrome.runtime.lastError&&console.debug("[TAB SWITCHER] SW not ready:",chrome.runtime.lastError.message)})}catch(r){console.debug("[TAB SWITCHER] sendMessage warn:",r?.message||r)}p()}catch(r){console.error("[TAB SWITCHER] Exception in switchToTab:",r),p()}}function W(t){try{if(!t)return;try{chrome.runtime.sendMessage({action:"restoreSession",sessionId:t},()=>{chrome.runtime.lastError&&console.debug("[TAB SWITCHER] SW not ready (restoreSession):",chrome.runtime.lastError.message)})}catch(r){console.debug("[TAB SWITCHER] sendMessage warn:",r?.message||r)}p()}catch(r){console.error("[TAB SWITCHER] Exception in restoreSession:",r),p()}}function O(t,r){try{if(!t||typeof t!="number"){console.error("[TAB SWITCHER] Invalid tab ID for closing:",t);return}if(!e.currentTabs.some(o=>o&&o.id===t)){console.warn("[TAB SWITCHER] Tab no longer exists:",t),e.filteredTabs=e.filteredTabs.filter(o=>o&&o.id!==t),e.currentTabs=e.currentTabs.filter(o=>o&&o.id!==t),e.selectedIndex>=e.filteredTabs.length&&(e.selectedIndex=Math.max(0,e.filteredTabs.length-1)),e.filteredTabs.length>0?e.filteredTabs.length>50?y(e.filteredTabs):g(e.filteredTabs):p();return}chrome.runtime.sendMessage({action:"closeTab",tabId:t},o=>{if(chrome.runtime.lastError){console.error("[TAB SWITCHER] Error closing tab:",chrome.runtime.lastError.message);return}o?.success&&(e.currentTabs=e.currentTabs.filter(n=>n&&n.id!==t),e.filteredTabs=e.filteredTabs.filter(n=>n&&n.id!==t),e.filteredTabs.length>0?(e.selectedIndex>=e.filteredTabs.length&&(e.selectedIndex=Math.max(0,e.filteredTabs.length-1)),e.filteredTabs.length>50?y(e.filteredTabs):g(e.filteredTabs),e.domCache.searchBox&&e.domCache.searchBox.focus()):p())})}catch(a){console.error("[TAB SWITCHER] Exception in closeTab:",a)}}function ue(t,r){try{if(!t)return;chrome.runtime.sendMessage({action:"toggleMute",tabId:t},a=>{if(chrome.runtime.lastError){console.error("[TAB SWITCHER] Error toggling mute:",chrome.runtime.lastError);return}if(a&&a.success){const o=a.muted;o?(r.classList.add("muted"),r.title="Unmute tab",r.innerHTML='<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>'):(r.classList.remove("muted"),r.title="Mute tab",r.innerHTML='<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>');const n=e.currentTabs.find(s=>s.id===t);n&&(n.mutedInfo||(n.mutedInfo={muted:!1}),n.mutedInfo.muted=o)}})}catch(a){console.error("[TAB SWITCHER] Exception in toggleMute:",a)}}function P(t){e.viewMode=t,e.domCache?.backBtn&&(e.domCache.backBtn.style.display=t==="recent"?"flex":"none"),e.domCache?.recentBtn&&(e.domCache.recentBtn.style.display=t==="recent"?"none":"inline-flex"),e.domCache?.searchBox&&(e.domCache.searchBox.placeholder=t==="recent"?"Search recently closed tabs...":"Search tabs by title or URL..."),e.domCache?.sectionTitle&&(e.domCache.sectionTitle.textContent=t==="recent"?"Recently Closed":"Opened Tabs"),e.domCache?.tabHint&&e.domCache.tabHint.classList.toggle("hidden",t==="recent"),e.domCache?.helpText&&(t==="recent"?e.domCache.helpText.innerHTML=`
        <span><kbd>Alt+Q</kbd> <kbd>↑↓</kbd> Navigate</span>
        <span><kbd>Enter</kbd> Restore</span>
        <span><kbd>Backspace</kbd> Active Tabs</span>
        <span><kbd>Esc</kbd> Exit</span>
      `:e.domCache.helpText.innerHTML=`
        <span><kbd>Alt+Q</kbd> <kbd>↑↓</kbd> Navigate</span>
        <span><kbd>Enter</kbd> Switch</span>
        <span><kbd>Delete</kbd> Close</span>
        <span><kbd>.</kbd> Recent Tabs</span>
        <span><kbd>,</kbd> History</span>
        <span><kbd>Esc</kbd> Exit</span>
      `)}function pe(t){try{if(!t||typeof t!="number")return;chrome.runtime.sendMessage({action:"createGroup",tabId:t},r=>{if(chrome.runtime.lastError){console.error("[TAB SWITCHER] Error creating group:",chrome.runtime.lastError.message);return}r?.success&&p()})}catch(r){console.error("[TAB SWITCHER] Exception in createGroup:",r)}}function A(){if(e.viewMode==="active")return;P("active"),e.currentTabs=e.activeTabs||[];const t=e.currentTabs;e.filteredTabs=t,e.selectedIndex=0,e.domCache.grid&&(e.domCache.grid.classList.remove("recent-mode"),e.domCache.grid.classList.remove("search-mode")),e.filteredTabs.length>50?y(e.filteredTabs):g(e.filteredTabs),e.domCache.searchBox&&(e.domCache.searchBox.value="",e.domCache.searchBox.focus())}async function ee(){if(e.viewMode==="recent")return;P("recent");let t=[];try{t=await new Promise(r=>{try{chrome.runtime.sendMessage({action:"getRecentlyClosed",maxResults:10},a=>{if(chrome.runtime.lastError){console.debug("[TAB SWITCHER] Runtime error:",chrome.runtime.lastError.message),r([]);return}a?.success?r(a.items||[]):r([])})}catch{r([])}})}catch(r){console.debug("[TAB SWITCHER] Failed to load recently closed:",r)}e.recentItems=t.map((r,a)=>({id:void 0,title:r.title,url:r.url,favIconUrl:r.favIconUrl,screenshot:null,sessionId:r.sessionId,index:a})),e.currentTabs=e.recentItems,e.filteredTabs=e.recentItems,e.selectedIndex=0,e.domCache.grid&&e.domCache.grid.classList.add("recent-mode"),g(e.filteredTabs),e.domCache.searchBox&&e.domCache.searchBox.focus()}function me(){try{if(!window.navigation||typeof window.navigation.entries!="function")return console.log("[TAB SWITCHER] Navigation API not available"),{back:[],forward:[]};const t=window.navigation.entries(),r=window.navigation.currentEntry;if(!t||t.length===0||!r)return console.log("[TAB SWITCHER] No navigation entries available"),{back:[],forward:[]};const a=r.index;console.log("[TAB SWITCHER] Navigation entries:",t.length,"Current index:",a);const o=[];for(let s=a-1;s>=0;s--){const i=t[s];i&&i.url&&o.push({url:i.url,title:$(i.url)})}const n=[];for(let s=a+1;s<t.length;s++){const i=t[s];i&&i.url&&n.push({url:i.url,title:$(i.url)})}return console.log("[TAB SWITCHER] Back entries:",o.length,"Forward entries:",n.length),{back:o,forward:n}}catch(t){return console.error("[TAB SWITCHER] Error getting navigation history:",t),{back:[],forward:[]}}}function $(t){try{const r=new URL(t);let a=r.hostname;if(a.startsWith("www.")&&(a=a.substring(4)),r.pathname&&r.pathname!=="/"){const o=r.pathname.split("/").filter(n=>n).pop();o&&o.length<50&&(a+=" - "+decodeURIComponent(o).replace(/[-_]/g," "))}return a}catch{return t}}function be(){let t=null,r=0;const a=100,o=300,n=50;return s=>{const i=performance.now(),l=i-r,u=e.currentTabs.length>=n;t&&clearTimeout(t),!u&&l>=a?(r=i,_(s)):t=setTimeout(()=>{r=performance.now(),_(s)},u?o:a)}}function _(t){try{const r=t?.target?.value&&typeof t.target.value=="string"?t.target.value:e.domCache?.searchBox?.value??"",a=String(r).trim();if(e.domCache?.tabHint){const i=a.length>0||e.viewMode==="recent"||e.webSearch.active;e.domCache.tabHint.classList.toggle("hidden",i)}if(a.startsWith(",")){e.webSearch.active=!1,e.history.active=!0,e.domCache.grid&&(e.domCache.grid.classList.add("search-mode"),e.domCache.grid.classList.remove("recent-mode")),e.domCache.sectionTitle&&(e.domCache.sectionTitle.textContent="Tab History"),e.domCache.helpText&&(e.domCache.helpText.innerHTML=`
            <span><kbd>,</kbd> History Mode</span>
            <span><kbd>←→</kbd> Switch Column</span>
            <span><kbd>↑↓</kbd> Navigate</span>
            <span><kbd>Enter</kbd> Go</span>
            <span><kbd>Backspace</kbd> Exit</span>
            <span><kbd>Esc</kbd> Close</span>
          `);const i=me();console.log("[TAB SWITCHER] Navigation API history:",i),oe(i);return}if(e.history.active=!1,e.history.backEls=[],e.history.forwardEls=[],e.viewMode!=="recent"&&e.webSearch.active){const i=a,l={title:i?`Search Web for "${i}"`:"Type to search web...",url:i?`https://www.google.com/search?q=${encodeURIComponent(i)}`:"",favIconUrl:"https://www.google.com/favicon.ico",isWebSearch:!0,searchQuery:i};e.filteredTabs=[l],e.selectedIndex=0,e.domCache.grid&&(e.domCache.grid.classList.add("search-mode"),e.domCache.grid.classList.remove("recent-mode")),e.domCache.sectionTitle&&(e.domCache.sectionTitle.textContent="Web Search"),g(e.filteredTabs);return}e.domCache.grid&&e.domCache.grid.classList.remove("search-mode"),e.domCache.sectionTitle&&(e.domCache.sectionTitle.textContent=e.viewMode==="recent"?"Recently Closed":"Opened Tabs");const o=!!(t&&typeof t.inputType=="string"&&t.inputType==="deleteContentBackward");if(a==="."&&!o){e.domCache.searchBox.value="",e.viewMode==="recent"?A():ee();return}if(!a){e.filteredTabs=e.currentTabs,e.selectedIndex=0,e.currentTabs.length>50?y(e.currentTabs):g(e.currentTabs);return}const s=e.currentTabs.map(i=>{const l=j(i.title,a),u=j(i.url,a),d=l.score>u.score?l:u;return{tab:i,match:d.match,score:d.score}}).filter(i=>i.match).sort((i,l)=>l.score-i.score).map(i=>i.tab);e.filteredTabs=s,e.selectedIndex=0,s.length>50?y(s):g(s)}catch(r){console.error("[TAB SWITCHER] Error in handleSearch:",r),e.filteredTabs=e.currentTabs,e.selectedIndex=0,g(e.currentTabs)}}function j(t,r){if(!t)return{match:!1,score:0};const a=t.toLowerCase(),o=r.toLowerCase();if(o.length===0)return{match:!0,score:1};if(a===o)return{match:!0,score:100};if(a.startsWith(o))return{match:!0,score:80+o.length/a.length*10};if(a.includes(o))return{match:!0,score:50+o.length/a.length*10};let n=0,s=0,i=0,l=0,u=-1;for(;n<a.length&&s<o.length;){if(a[n]===o[s]){u===-1&&(u=n);let d=1;l>0&&(d+=2+l),(n===0||a[n-1]===" "||a[n-1]==="."||a[n-1]==="/"||a[n-1]==="-")&&(d+=3),i+=d,l++,s++}else l=0;n++}return s<o.length?{match:!1,score:0}:(i-=(a.length-o.length)*.1,u>0&&(i-=u*.5),{match:!0,score:Math.max(1,i)})}function fe(t){const r="__tabSwitcherEventGuardsInstalled";if(t[r])return;t[r]=!0;const a=n=>{e.isOverlayVisible&&k(n)&&(n.stopPropagation(),typeof n.stopImmediatePropagation=="function"&&n.stopImmediatePropagation())},o=["keydown","keyup","keypress","beforeinput","input","textInput","compositionstart","compositionupdate","compositionend","click","mousedown","mouseup","pointerdown","pointerup","contextmenu"];for(const n of o)t.addEventListener(n,a)}function ge(){const t=document,r=document.fullscreenElement||t.webkitFullscreenElement;return r?r.tagName==="VIDEO"?r.parentElement||null:r:null}function te(){if(!e.host)return;const r=ge()||document.documentElement||document.body;if(r)try{e.host.parentNode,r.appendChild(e.host)}catch{}}function ve(){try{if(!e.host||!e.host.isConnected){e.shadowRoot=null,e.styleElement=null;const t=document.getElementById(V);if(t)e.host=t;else{const r=document.createElement("tab-switcher-mount");r.id=V,r.style.cssText=`
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
        pointer-events: auto !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        contain: layout style !important;
        isolation: isolate !important;
      `,(document.documentElement||document.body).appendChild(r),e.host=r}}if(te(),e.shadowRoot||(e.host.shadowRoot?e.shadowRoot=e.host.shadowRoot:e.shadowRoot=e.host.attachShadow({mode:"open"})),!e.styleElement||!e.shadowRoot.contains(e.styleElement)){const t=document.createElement("style");t.textContent=ae,e.shadowRoot.appendChild(t),e.styleElement=t}return fe(e.shadowRoot),e.shadowRoot}catch(t){return console.error("[TAB SWITCHER] Failed to initialize shadow root:",t),null}}function xe(){if(e.overlay)return;const t=ve();if(!t)return;const r=document.createElement("div");r.id="visual-tab-switcher-overlay",r.className="tab-switcher-overlay",r.style.willChange="opacity";const a=document.createElement("div");a.className="tab-switcher-backdrop",r.appendChild(a);const o=document.createElement("div");o.className="tab-switcher-container",o.style.transform="translate3d(0, 0, 0)";const n=document.createElement("div");n.className="tab-switcher-search-row";const s=document.createElement("div");s.className="tab-switcher-search-wrap";const i=document.createElement("input");i.type="text",i.className="tab-switcher-search",i.placeholder="Search tabs by title or URL...",i.autocomplete="off";const l=document.createElement("button");l.type="button",l.className="recent-back-btn",l.title="Back to Active Tabs",l.textContent="←",l.addEventListener("click",()=>A());const u=document.createElement("div");u.className="search-icon",u.innerHTML=`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"></rect>
    <rect x="14" y="3" width="7" height="7" rx="1"></rect>
    <rect x="3" y="14" width="7" height="7" rx="1"></rect>
    <rect x="14" y="14" width="7" height="7" rx="1"></rect>
  </svg>`;const d=document.createElement("div");d.className="search-tab-hint",d.innerHTML="<kbd>Tab</kbd> Search Google",s.appendChild(l),s.appendChild(u),s.appendChild(i),s.appendChild(d),n.appendChild(s),o.appendChild(n);const c=document.createElement("div");c.className="tab-switcher-section-header";const h=document.createElement("span");h.className="tab-switcher-section-title",h.textContent="Opened Tabs";const m=document.createElement("div");m.className="tab-switcher-view-toggle";const b=localStorage.getItem("tabSwitcherViewMode")||"grid",x=document.createElement("button");x.type="button",x.className=`view-toggle-btn ${b==="grid"?"active":""}`,x.dataset.view="grid",x.title="Grid View",x.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="3" y="3" width="7" height="7" rx="1"></rect>
    <rect x="14" y="3" width="7" height="7" rx="1"></rect>
    <rect x="3" y="14" width="7" height="7" rx="1"></rect>
    <rect x="14" y="14" width="7" height="7" rx="1"></rect>
  </svg>`;const w=document.createElement("button");w.type="button",w.className=`view-toggle-btn ${b==="list"?"active":""}`,w.dataset.view="list",w.title="List View",w.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="3" y1="6" x2="21" y2="6"></line>
    <line x1="3" y1="12" x2="21" y2="12"></line>
    <line x1="3" y1="18" x2="21" y2="18"></line>
  </svg>`,m.appendChild(x),m.appendChild(w),c.appendChild(h),c.appendChild(m),o.appendChild(c);const f=document.createElement("div");f.className=`tab-switcher-grid ${b==="list"?"list-view":""}`,f.id="tab-switcher-grid",f.setAttribute("role","listbox"),f.setAttribute("aria-label","Open tabs"),f.style.transform="translate3d(0, 0, 0)",o.appendChild(f);const B=document.createElement("div");B.className="tab-switcher-help",B.innerHTML=`
      <span><kbd>Alt+Q</kbd> <kbd>↑↓</kbd> Navigate</span>
     <span><kbd>↵</kbd>Switch</span>
     <span><kbd>Del</kbd>Close</span>
     <span><kbd>.</kbd>Recent</span>
     <span><kbd>,</kbd>History</span>
     <span><kbd>Esc</kbd>Exit</span>
   `,o.appendChild(B),r.appendChild(o),i.addEventListener("input",be()),i.addEventListener("keydown",le),a.addEventListener("click",p),f.addEventListener("click",ce),m.addEventListener("click",re=>{const U=re.target.closest(".view-toggle-btn");if(!U)return;const S=U.dataset.view;S&&(x.classList.toggle("active",S==="grid"),w.classList.toggle("active",S==="list"),f.classList.toggle("list-view",S==="list"),localStorage.setItem("tabSwitcherViewMode",S))}),e.overlay=r,e.domCache={grid:f,searchBox:i,container:o,searchWrap:s,backBtn:l,helpText:B,sectionTitle:h,tabHint:d},t.appendChild(r),console.log("[PERF] Overlay created with GPU acceleration and event delegation")}function we(t,r,a=[]){performance.now(),console.log(`[TAB SWITCHER] Opening with ${t.length} tabs and ${a.length} groups`);const o=document;if(e.lastFullscreenElement=document.fullscreenElement||o.webkitFullscreenElement||null,e.isOverlayVisible&&!e.isClosing)return;if(e.closeTimeout&&(clearTimeout(e.closeTimeout),e.closeTimeout=null),e.isClosing=!1,e.isOverlayVisible=!0,e.webSearch.active=!1,e.history.active=!1,xe(),!e.overlay){e.isOverlayVisible=!1;return}const n=e.overlay;te(),n.style.display="flex",n.style.opacity="0",e.activeTabs=t,e.currentTabs=t,e.groups=a,e.filteredTabs=t,P("active"),e.domCache?.grid&&(e.domCache.grid.classList.remove("search-mode"),e.domCache.grid.classList.remove("recent-mode"));const s=t.findIndex(i=>i.id===r);t.length>1&&s===0?e.selectedIndex=1:(s>0,e.selectedIndex=0),e.filteredTabs.length>50?(console.log("[PERF] Using virtual scrolling for",e.filteredTabs.length,"tabs"),y(e.filteredTabs)):g(e.filteredTabs),n.style.display="flex",n.style.opacity="0",e.isOverlayVisible=!0,de(),he(),e.domCache.searchBox&&(e.domCache.searchBox.value="",e.domCache.searchBox.focus()),e.domCache.grid&&(e.domCache.grid.scrollTop=0),requestAnimationFrame(()=>{requestAnimationFrame(()=>{e.overlay&&(e.overlay.style.opacity="1")})}),document.addEventListener("keydown",H,!0),document.addEventListener("keyup",N,!0),document.addEventListener("focus",z,!0),document.addEventListener("focusin",Z,!0),document.addEventListener("keydown",C,!0),document.addEventListener("keypress",C,!0),document.addEventListener("keyup",C,!0),document.addEventListener("input",E,!0),document.addEventListener("beforeinput",E,!0),document.addEventListener("textInput",E,!0),document.addEventListener("click",R,!0),document.addEventListener("mousedown",R,!0),document.addEventListener("compositionstart",I,!0),document.addEventListener("compositionupdate",I,!0),document.addEventListener("compositionend",I,!0),e.focusInterval&&clearInterval(e.focusInterval),e.focusInterval=setInterval(()=>{e.isOverlayVisible&&e.domCache.searchBox&&document.activeElement!==e.domCache.searchBox&&e.domCache.searchBox.focus()},100)}console.log("═══════════════════════════════════════════════════════");console.log("Visual Tab Switcher - Content Script Loaded");console.log("Features: Virtual Scrolling, Event Delegation, GPU Acceleration");console.log("Target: <16ms interactions, 60fps, lazy loading");console.log("═══════════════════════════════════════════════════════");chrome.runtime.onMessage.addListener((t,r,a)=>{if(t.action==="showTabSwitcher"){if(e.isOverlayVisible)return v(),M(!0),a({success:!0,advanced:!0}),!0;we(t.tabs,t.activeTabId,t.groups),a({success:!0})}return!0});
})()
})()
