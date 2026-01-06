(function(){(function(){console.log("[TAB SWITCHER] Content script messaging module loaded");const e={overlay:null,currentTabs:[],activeTabs:[],filteredTabs:[],selectedIndex:0,isOverlayVisible:!1,viewMode:"active",recentItems:[],groups:[],collapsedGroups:new Set,host:null,shadowRoot:null,styleElement:null,lastFullscreenElement:null,domCache:{grid:null,searchBox:null,container:null,searchWrap:null,sectionTitle:null,tabHint:null},virtualScroll:{startIndex:0,endIndex:0,visibleCount:20,bufferCount:5},lastKeyTime:0,keyThrottleMs:16,resizeObserver:null,intersectionObserver:null,focusInterval:null,closeTimeout:null,isClosing:!1,pageLock:null,history:{active:!1,backEls:[],forwardEls:[],column:"back",index:0},webSearch:{active:!1}},F="tab-switcher-host",ae=`/* Visual Tab Switcher - Modern Glass UI 2.0 */
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
  --bg-overlay: rgba(0, 0, 0, 0.3);
  --bg-surface: #181818;
  --bg-glass: #303030;
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
  --card-bg: #282828;
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
  
  --shadow-xl: 0 40px 100px -12px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.08);
  --shadow-card: 0 8px 24px rgba(0, 0, 0, 0.35);
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
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  animation: backdropFadeIn 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.tab-switcher-container {
  position: relative;
  width: 750px;
  max-width: 94vw;
  max-height: 68vh;
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
  padding: 10px 16px 2px 16px;
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
  flex-shrink: 0;
}

.tab-switcher-grid.list-view .tab-card:hover .tab-close-btn {
  opacity: 1;
}

.tab-switcher-grid.list-view .tab-media-controls {
  position: relative;
  bottom: auto;
  right: auto;
  opacity: 1;
  display: flex;
  margin-right: 8px;
  flex-shrink: 0;
}

.tab-switcher-grid.list-view .tab-play-btn,
.tab-switcher-grid.list-view .tab-mute-btn {
  opacity: 0.6;
}

.tab-switcher-grid.list-view .tab-card:hover .tab-play-btn,
.tab-switcher-grid.list-view .tab-card:hover .tab-mute-btn,
.tab-switcher-grid.list-view .tab-play-btn.playing,
.tab-switcher-grid.list-view .tab-play-btn.visible,
.tab-switcher-grid.list-view .tab-mute-btn.muted,
.tab-switcher-grid.list-view .tab-mute-btn.visible,
.tab-switcher-grid.list-view .tab-card.has-media .tab-play-btn,
.tab-switcher-grid.list-view .tab-card.has-media .tab-mute-btn,
.tab-switcher-grid.list-view .tab-card.is-audible .tab-play-btn,
.tab-switcher-grid.list-view .tab-card.is-audible .tab-mute-btn,
.tab-switcher-grid.list-view .tab-card.is-muted .tab-mute-btn {
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

.tab-switcher-grid.recent-mode .tab-media-controls,
.tab-switcher-grid.search-mode .tab-media-controls {
  position: relative;
  bottom: auto;
  right: auto;
  opacity: 1;
  display: flex;
  margin-right: 8px;
  flex-shrink: 0;
}

.tab-switcher-grid.recent-mode .tab-play-btn,
.tab-switcher-grid.recent-mode .tab-mute-btn,
.tab-switcher-grid.search-mode .tab-play-btn,
.tab-switcher-grid.search-mode .tab-mute-btn {
  opacity: 0.6;
}

.tab-switcher-grid.recent-mode .tab-card:hover .tab-play-btn,
.tab-switcher-grid.recent-mode .tab-card:hover .tab-mute-btn,
.tab-switcher-grid.search-mode .tab-card:hover .tab-play-btn,
.tab-switcher-grid.search-mode .tab-card:hover .tab-mute-btn,
.tab-switcher-grid.recent-mode .tab-card.has-media .tab-play-btn,
.tab-switcher-grid.recent-mode .tab-card.has-media .tab-mute-btn,
.tab-switcher-grid.search-mode .tab-card.has-media .tab-play-btn,
.tab-switcher-grid.search-mode .tab-card.has-media .tab-mute-btn,
.tab-switcher-grid.recent-mode .tab-card.is-audible .tab-play-btn,
.tab-switcher-grid.recent-mode .tab-card.is-audible .tab-mute-btn,
.tab-switcher-grid.search-mode .tab-card.is-audible .tab-play-btn,
.tab-switcher-grid.search-mode .tab-card.is-audible .tab-mute-btn {
  opacity: 1;
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

.tab-mute-btn.muted {
  color: #ff5252;
  background: rgba(0, 0, 0, 0.8);
}

/* Media Controls Container */
.tab-media-controls {
  position: absolute;
  bottom: 58px; /* Positioned above the info section in grid view */
  right: 12px;
  display: flex;
  gap: 8px;
  z-index: 10;
}

/* Play/Pause Button */
.tab-play-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  opacity: 0;
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

/* Show play button on hover, or when playing, or when marked visible */
.tab-card:hover .tab-play-btn,
.tab-play-btn.playing,
.tab-play-btn.visible {
  opacity: 0.9;
}

/* Persistent visibility for tabs with media */
.tab-card.has-media .tab-play-btn,
.tab-card.is-audible .tab-play-btn {
  opacity: 0.85;
}

.tab-play-btn:hover {
  background: var(--bg-surface);
  color: var(--text-primary);
  transform: scale(1.1);
  opacity: 1;
}

.tab-play-btn svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

.tab-play-btn.playing {
  background: rgba(0, 0, 0, 0.8);
}

.tab-mute-btn {
  position: relative;
  bottom: auto;
  right: auto;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  opacity: 0;
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

/* Show mute button on hover, or when muted, or when marked visible */
.tab-card:hover .tab-mute-btn,
.tab-mute-btn.muted,
.tab-mute-btn.visible {
  opacity: 0.9;
}

/* Persistent visibility for tabs with media/audio */
.tab-card.has-media .tab-mute-btn,
.tab-card.is-audible .tab-mute-btn,
.tab-card.is-muted .tab-mute-btn {
  opacity: 0.85;
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
`;function x(t){const r=performance.now(),a=e.domCache.grid;if(!a)return;if(a.innerHTML="",a.classList.remove("virtual-list"),a.style.minHeight="",t.length===0){const o=document.createElement("div");o.className="tab-switcher-empty",o.textContent="No tabs found",a.appendChild(o);return}const n=document.createDocumentFragment();t.forEach((o,c)=>{const s=Q(o,c);o.isGroupHeader&&(s.dataset.isHeader="true"),s.dataset.tabIndex=String(c),n.appendChild(s)}),a.appendChild(n),A(!1);const i=performance.now()-r;console.log(`[PERF] Rendered ${t.length} tabs in ${i.toFixed(2)}ms`)}function T(t){const r=performance.now(),a=e.domCache.grid;if(!a)return;if(a.innerHTML="",a.classList.add("virtual-list"),t.length===0){const p=document.createElement("div");p.className="tab-switcher-empty",p.textContent="No tabs found",a.appendChild(p);return}const n=68,i=e.virtualScroll.visibleCount,o=e.virtualScroll.bufferCount,c=Math.max(0,e.selectedIndex-o),s=Math.min(t.length,e.selectedIndex+i+o);e.virtualScroll.startIndex=c,e.virtualScroll.endIndex=s;const h=t.length*n;a.style.minHeight=`${h}px`;const d=document.createDocumentFragment();for(let p=c;p<s;p++){const y=t[p],l=Q(y,p);l.style.position="absolute",l.style.top=`${p*n}px`,l.style.left="0",l.style.right="0",d.appendChild(l)}a.appendChild(d),ie(),A(!1);const b=performance.now()-r;console.log(`[PERF] Virtual rendered ${s-c} of ${t.length} tabs in ${b.toFixed(2)}ms`)}function Q(t,r){const a=document.createElement("div");a.className="tab-card",t&&typeof t.id=="number"&&(a.dataset.tabId=String(t.id)),t?.sessionId&&(a.dataset.sessionId=t.sessionId,a.dataset.recent="1"),t?.isWebSearch&&(a.dataset.webSearch="1",a.dataset.searchQuery=t.searchQuery),a.dataset.tabIndex=String(r),a.setAttribute("role","option"),a.setAttribute("aria-selected",r===e.selectedIndex?"true":"false");const n=t.title??"Untitled",i=t.url??"";a.setAttribute("aria-label",`${n} - ${i}`),a.tabIndex=-1,a.style.transform="translate3d(0, 0, 0)";const o=typeof t.screenshot=="string"&&t.screenshot.length>0?t.screenshot:null,c=!!o;if(c?a.classList.add("has-screenshot"):a.classList.add("has-favicon"),r===e.selectedIndex&&a.classList.add("selected"),t.pinned&&a.classList.add("pinned"),t.groupId&&t.groupId!==-1&&e.groups){const l=e.groups.find(u=>u.id===t.groupId);if(l){const u=se(l.color),f=l.title||"Group";a.dataset.groupId=String(l.id),a.style.borderLeft=`6px solid ${u}`,a.style.background=`linear-gradient(to right, ${u}15, rgba(255,255,255,0.02))`,t._groupColor=u,t._groupTitle=f}}const s=document.createElement("div");if(s.className="tab-thumbnail",t.sessionId){a.classList.add("recent-item");const l=G(t);s.appendChild(l)}else if(o){const l=document.createElement("img");l.className="screenshot-img",l.dataset.src=o,l.alt=n,Math.abs(r-e.selectedIndex)<10&&(l.src=o),s.appendChild(l)}else{const l=G(t);s.appendChild(l)}a.appendChild(s);const h=document.createElement("div");h.className="tab-info";const d=document.createElement("div");if(d.className="tab-header",c){let l=t.favIconUrl;if(!l&&t.url)try{const u=new URL(chrome.runtime.getURL("/_favicon/"));u.searchParams.set("pageUrl",t.url),u.searchParams.set("size","16"),l=u.toString()}catch{}if(l){const u=document.createElement("img");u.src=l,u.className="tab-favicon",u.onerror=()=>{u.style.display="none"},d.appendChild(u)}}const b=document.createElement("div");b.className="tab-title",b.textContent=n,b.title=n,d.appendChild(b);const p=t._groupColor,y=t._groupTitle;if(p){const l=document.createElement("span");l.className="group-pill",l.textContent=y||"",l.style.backgroundColor=p,l.style.opacity="0.4",l.style.color="white",l.style.fontSize="10px",l.style.fontWeight="700",l.style.padding="2px 6px",l.style.borderRadius="40px",l.style.marginLeft="8px",l.style.alignSelf="center",l.style.whiteSpace="nowrap",d.appendChild(l)}if(h.appendChild(d),c){const l=document.createElement("div");l.className="tab-url",l.textContent=i,l.title=i,h.appendChild(l)}if(a.appendChild(h),!t.sessionId&&!t.isWebSearch){const l=t.hasMedia||!1,u=t.audible||!1,f=t.mutedInfo?.muted||!1,k=l||u||f;l&&a.classList.add("has-media"),u&&a.classList.add("is-audible"),f&&a.classList.add("is-muted");const C=document.createElement("div");C.className="tab-media-controls";const v=document.createElement("button");v.className="tab-play-btn",v.dataset.action="play-pause",v.dataset.tabId=String(t.id),k?(u?(v.classList.add("playing"),v.title="Pause tab",v.innerHTML='<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>'):(v.title="Play tab",v.innerHTML='<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>'),v.classList.add("visible")):v.style.display="none";const g=document.createElement("button");g.className="tab-mute-btn",g.title=f?"Unmute tab":"Mute tab",g.dataset.action="mute",g.dataset.tabId=String(t.id),f?(g.classList.add("muted"),g.classList.add("visible"),g.innerHTML='<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>'):(g.innerHTML='<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',k&&g.classList.add("visible")),C.appendChild(v),C.appendChild(g),a.appendChild(C)}if(!t.sessionId&&!t.isWebSearch){const l=document.createElement("button");l.className="tab-close-btn",l.innerHTML="×",l.title="Close tab",l.dataset.action="close",t.id&&(l.dataset.tabId=String(t.id)),a.appendChild(l)}return a}function G(t){const r=document.createElement("div");r.className="favicon-tile";let a=t.favIconUrl;if(!a&&t.url)try{const n=new URL(chrome.runtime.getURL("/_favicon/"));n.searchParams.set("pageUrl",t.url),n.searchParams.set("size","32"),a=n.toString()}catch{}if(a){const n=document.createElement("img");n.src=a,n.className="favicon-large",n.onerror=()=>{n.style.display="none";const i=document.createElement("div");i.className="favicon-letter",i.textContent=(t.title||"T")[0].toUpperCase(),r.appendChild(i)},r.appendChild(n)}else{const n=document.createElement("div");n.className="favicon-letter",n.textContent=(t.title||"T")[0].toUpperCase(),r.appendChild(n)}return r}function A(t){try{const r=e.domCache.grid;if(!r)return;r.querySelectorAll(".tab-card.selected").forEach(i=>{i.classList.remove("selected"),i.setAttribute("aria-selected","false")});const n=r.querySelector(`.tab-card[data-tab-index="${e.selectedIndex}"]`);if(!n)return;n.classList.add("selected"),n.setAttribute("aria-selected","true"),r.setAttribute("aria-activedescendant",n.id||`tab-card-${e.selectedIndex}`),n.id||(n.id=`tab-card-${e.selectedIndex}`),t&&requestAnimationFrame(()=>{n.scrollIntoView({behavior:"smooth",block:"nearest",inline:"nearest"})})}catch(r){console.error("[TAB SWITCHER] Error enforcing selection:",r)}}function Y(){try{if(!e.domCache.grid)return;if(e.filteredTabs&&e.filteredTabs.length>50){const{startIndex:r,endIndex:a}=e.virtualScroll;(e.selectedIndex<r||e.selectedIndex>=a)&&T(e.filteredTabs)}A(!0)}catch(t){console.error("[TAB SWITCHER] Error in updateSelection:",t)}}function ie(){e.intersectionObserver&&e.intersectionObserver.disconnect();const t=new IntersectionObserver(n=>{n.forEach(i=>{if(!i.isIntersecting)return;const o=i.target;o instanceof HTMLImageElement&&o.dataset.src&&!o.src&&(o.src=o.dataset.src,t.unobserve(o))})},{rootMargin:"100px"});e.intersectionObserver=t;const r=e.domCache.grid;if(!r)return;r.querySelectorAll("img[data-src]").forEach(n=>t.observe(n))}function ne(t){const r=e.domCache.grid;if(!r)return;r.innerHTML="",r.className="tab-switcher-grid search-mode";const a=document.createElement("div");a.className="history-view",e.history.active=!0,e.history.backEls=[],e.history.forwardEls=[];const n=document.createElement("div");n.className="history-column";const i=document.createElement("div");if(i.className="history-column-header",i.textContent="← BACK",n.appendChild(i),t.back&&t.back.length>0){const s=document.createElement("div");s.className="history-items-container",t.back.forEach((h,d)=>{const b=K(h,-(d+1));b.dataset.column="back",b.dataset.index=String(d),s.appendChild(b),e.history.backEls.push(b)}),n.appendChild(s)}else{const s=document.createElement("div");s.className="tab-switcher-empty",s.textContent="No back history",s.style.padding="20px",s.style.textAlign="center",s.style.color="var(--text-muted)",n.appendChild(s)}const o=document.createElement("div");o.className="history-column";const c=document.createElement("div");if(c.className="history-column-header",c.textContent="FORWARD →",o.appendChild(c),t.forward&&t.forward.length>0){const s=document.createElement("div");s.className="history-items-container",t.forward.forEach((h,d)=>{const b=K(h,d+1);b.dataset.column="forward",b.dataset.index=String(d),s.appendChild(b),e.history.forwardEls.push(b)}),o.appendChild(s)}else{const s=document.createElement("div");s.className="tab-switcher-empty",s.textContent="No forward history",s.style.padding="20px",s.style.textAlign="center",s.style.color="var(--text-muted)",o.appendChild(s)}a.appendChild(n),a.appendChild(o),r.appendChild(a),e.history.backEls.length>0?(e.history.column="back",e.history.index=0):e.history.forwardEls.length>0&&(e.history.column="forward",e.history.index=0),H()}function K(t,r){const a=typeof t=="string"?t:t.url,n=typeof t=="string"?t:t.title||t.url,i=document.createElement("div");i.className="history-item",i.tabIndex=0,i.dataset.delta=String(r),i.onclick=()=>{window.history.go(r),m()},i.onkeydown=d=>{(d.key==="Enter"||d.key===" ")&&(d.preventDefault(),window.history.go(r),m())};const o=document.createElement("img");o.className="history-favicon";try{const d=new URL(chrome.runtime.getURL("/_favicon/"));d.searchParams.set("pageUrl",a),d.searchParams.set("size","16"),o.src=d.toString()}catch{}const c=document.createElement("div");c.className="history-item-content";const s=document.createElement("div");s.className="history-item-title",s.textContent=n,s.title=n;const h=document.createElement("div");h.className="history-item-url";try{const d=new URL(a);h.textContent=d.hostname+d.pathname}catch{h.textContent=a}return h.title=a,c.appendChild(s),c.appendChild(h),i.appendChild(o),i.appendChild(c),i}function H(){const t=e.history.backEls||[],r=e.history.forwardEls||[];for(const o of t)o.classList.remove("selected");for(const o of r)o.classList.remove("selected");const a=e.history.column==="forward"?r:t;if(!a.length)return;const n=Math.min(Math.max(0,e.history.index),a.length-1);e.history.index=n;const i=a[n];i&&(i.classList.add("selected"),i.scrollIntoView({block:"nearest"}))}function oe(){const t=e.history.backEls||[],r=e.history.forwardEls||[],n=(e.history.column==="forward"?r:t)[e.history.index];if(!n)return;const i=Number(n.dataset.delta);Number.isFinite(i)&&(window.history.go(i),m())}function se(t){return{grey:"#bdc1c6",blue:"#8ab4f8",red:"#f28b82",yellow:"#fdd663",green:"#81c995",pink:"#ff8bcb",purple:"#c58af9",cyan:"#78d9ec",orange:"#fcad70"}[t]||t}function ce(t){try{const r=t.target;if(r.dataset.action==="close"||r.classList.contains("tab-close-btn")){t.stopPropagation();const i=parseInt(r.dataset.tabId||r.parentElement.dataset.tabId||"0"),o=parseInt(r.dataset.tabIndex||r.parentElement.dataset.tabIndex||"0");i&&!Number.isNaN(i)&&U(i,o);return}if(r.dataset.action==="mute"||r.closest(".tab-mute-btn")){t.stopPropagation();const i=r.closest(".tab-mute-btn"),o=parseInt(i.dataset.tabId||"0");o&&!Number.isNaN(o)&&ue(o,i);return}if(r.dataset.action==="play-pause"||r.closest(".tab-play-btn")){t.stopPropagation();const i=r.closest(".tab-play-btn"),o=parseInt(i.dataset.tabId||"0");o&&!Number.isNaN(o)&&be(o,i);return}const a=r.closest(".tab-card");if(!a)return;if(e.viewMode==="recent"||a.dataset.recent==="1"){const i=a.dataset.sessionId;i&&O(i);return}if(a.dataset.webSearch==="1"){const i=a.dataset.searchQuery;i&&(window.open(`https://www.google.com/search?q=${encodeURIComponent(i)}`,"_blank"),m());return}const n=parseInt(a.dataset.tabId||"0");n&&!Number.isNaN(n)?W(n):console.error("[TAB SWITCHER] Invalid tab ID in card:",a)}catch(r){console.error("[TAB SWITCHER] Error in handleGridClick:",r)}}function J(){return((e.domCache?.searchBox&&typeof e.domCache.searchBox.value=="string"?e.domCache.searchBox.value:"")||"").trim().startsWith(";")}function N(t){if(!e.isOverlayVisible)return;if(t.key==="Escape"){t.preventDefault(),t.stopPropagation(),typeof t.stopImmediatePropagation=="function"&&t.stopImmediatePropagation(),m();return}const r=t.target===e.domCache.searchBox||t.composedPath&&e.domCache.searchBox&&t.composedPath().includes(e.domCache.searchBox),a=J()&&e.history.active,i=a&&["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Enter"].includes(t.key);if(r&&!i)return;const o=performance.now();if(o-e.lastKeyTime<e.keyThrottleMs){t.preventDefault();return}e.lastKeyTime=o;try{if(a)switch(t.key){case"Enter":t.preventDefault(),oe();return;case"ArrowDown":{t.preventDefault();const c=e.history.column==="forward"?e.history.forwardEls:e.history.backEls;c.length&&(e.history.index=Math.min(e.history.index+1,c.length-1),H());return}case"ArrowUp":{t.preventDefault(),(e.history.column==="forward"?e.history.forwardEls:e.history.backEls).length&&(e.history.index=Math.max(e.history.index-1,0),H());return}case"ArrowLeft":{t.preventDefault(),e.history.column==="forward"&&e.history.backEls.length&&(e.history.column="back",e.history.index=Math.min(e.history.index,e.history.backEls.length-1),H());return}case"ArrowRight":{t.preventDefault(),e.history.column==="back"&&e.history.forwardEls.length&&(e.history.column="forward",e.history.index=Math.min(e.history.index,e.history.forwardEls.length-1),H());return}}switch(t.key){case"Enter":if(t.preventDefault(),e.filteredTabs.length>0&&e.selectedIndex>=0&&e.selectedIndex<e.filteredTabs.length){const c=e.filteredTabs[e.selectedIndex];if(c)if(c.isWebSearch){const s=(c.searchQuery||"").trim();s&&(window.open(`https://www.google.com/search?q=${encodeURIComponent(s)}`,"_blank"),m())}else e.viewMode==="recent"&&c.sessionId?O(c.sessionId):c.id&&W(c.id)}break;case"Tab":if(t.preventDefault(),e.domCache?.searchBox){const c=e.domCache.searchBox.value.trim();t.shiftKey?I():e.viewMode==="recent"?w():c.length===0?(e.webSearch.active=!e.webSearch.active,e.domCache.searchBox.dispatchEvent(new Event("input",{bubbles:!0})),e.domCache.searchBox.focus()):c.startsWith(";")?w():(window.open(`https://www.google.com/search?q=${encodeURIComponent(c)}`,"_blank"),m())}else t.shiftKey?I():w();break;case"ArrowRight":t.preventDefault(),X();break;case"ArrowLeft":t.preventDefault(),Z();break;case"ArrowDown":t.preventDefault(),w();break;case"ArrowUp":t.preventDefault(),I();break;case"Delete":if(e.viewMode!=="recent"&&e.filteredTabs.length>0&&e.selectedIndex>=0&&e.selectedIndex<e.filteredTabs.length){t.preventDefault();const c=e.filteredTabs[e.selectedIndex];c?.id&&U(c.id,e.selectedIndex)}break;case"g":case"G":if(t.altKey&&(t.preventDefault(),e.viewMode!=="recent"&&e.filteredTabs.length>0&&e.selectedIndex>=0&&e.selectedIndex<e.filteredTabs.length)){const c=e.filteredTabs[e.selectedIndex];c?.id&&pe(c.id)}break}}catch(c){console.error("[TAB SWITCHER] Error in handleKeyDown:",c)}}function z(){}function le(t){try{if(J()&&e.history.active&&["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Enter"].includes(t.key)){t.preventDefault();return}if(["Delete","Tab","ArrowDown","ArrowUp","ArrowRight","ArrowLeft","Enter"].includes(t.key)){const i=performance.now();if(i-e.lastKeyTime<e.keyThrottleMs){t.preventDefault();return}e.lastKeyTime=i}if(t.key==="."&&(t.target.value||"").length===0){t.preventDefault(),e.viewMode==="recent"?D():te();return}if(t.key==="Backspace"){const i=t.target.value||"";if(i.length===0&&e.webSearch.active){t.preventDefault(),e.webSearch.active=!1,e.domCache?.searchBox&&e.domCache.searchBox.dispatchEvent(new Event("input",{bubbles:!0}));return}if(i.length===0&&e.viewMode==="recent"){t.preventDefault(),D();return}return}if(t.key==="Delete"){if(t.preventDefault(),e.viewMode!=="recent"&&e.filteredTabs.length>0&&e.selectedIndex>=0&&e.selectedIndex<e.filteredTabs.length){const i=e.filteredTabs[e.selectedIndex];i?.id&&U(i.id,e.selectedIndex)}return}if(t.key==="Tab"){t.preventDefault();const o=(t.target.value||"").trim();t.shiftKey?I():e.viewMode==="recent"?w():o.length===0?(e.webSearch.active=!e.webSearch.active,e.domCache?.searchBox&&e.domCache.searchBox.dispatchEvent(new Event("input",{bubbles:!0}))):o.startsWith(";")?w():(window.open(`https://www.google.com/search?q=${encodeURIComponent(o)}`,"_blank"),m());return}if(t.key==="ArrowDown"){t.preventDefault(),w();return}if(t.key==="ArrowUp"){t.preventDefault(),I();return}if(t.key==="ArrowRight"){t.preventDefault(),X();return}if(t.key==="ArrowLeft"){t.preventDefault(),Z();return}if(t.key==="Enter"){if(t.preventDefault(),e.filteredTabs.length>0&&e.selectedIndex>=0&&e.selectedIndex<e.filteredTabs.length){const i=e.filteredTabs[e.selectedIndex];e.viewMode==="recent"&&i?.sessionId?O(i.sessionId):i?.isWebSearch?(window.open(`https://www.google.com/search?q=${encodeURIComponent(i.searchQuery)}`,"_blank"),m()):i?.id&&i.id>=0&&W(i.id)}return}}catch(r){console.error("[TAB SWITCHER] Error in handleSearchKeydown:",r)}}function w(){!e.filteredTabs||e.filteredTabs.length===0||(e.selectedIndex++,e.selectedIndex>=e.filteredTabs.length&&(e.selectedIndex=0),Y())}function I(){!e.filteredTabs||e.filteredTabs.length===0||(e.selectedIndex--,e.selectedIndex<0&&(e.selectedIndex=e.filteredTabs.length-1),Y())}function X(){w()}function Z(){I()}function de(){if(e.pageLock)return;const t=document.body;if(!t)return;const r="inert"in t;e.pageLock={bodyPointerEvents:t.style.pointerEvents,bodyUserSelect:t.style.userSelect,bodyInert:r?!!t.inert:!1};try{r&&(t.inert=!0)}catch{}t.style.pointerEvents="none",t.style.userSelect="none"}function $(){if(!e.pageLock)return;const t=document.body;if(!t){e.pageLock=null;return}const r="inert"in t;try{r&&(t.inert=e.pageLock.bodyInert)}catch{}t.style.pointerEvents=e.pageLock.bodyPointerEvents,t.style.userSelect=e.pageLock.bodyUserSelect,e.pageLock=null}function he(){try{if(document.activeElement&&document.activeElement!==document.body&&document.activeElement!==e.host){const r=document.activeElement;r instanceof HTMLElement&&r.blur()}document.querySelectorAll("iframe").forEach(r=>{try{const a=r.contentDocument?.activeElement;a instanceof HTMLElement&&a.blur()}catch{}})}catch(t){console.debug("[TAB SWITCHER] Error blurring page elements:",t)}}function E(t){return t.target===e.host?!0:(t.composedPath?t.composedPath():[]).some(a=>a===e.host||a===e.shadowRoot||a===e.overlay)}function P(t){e.isOverlayVisible&&(E(t)||(t.stopPropagation(),t.stopImmediatePropagation(),t.preventDefault(),t.target instanceof HTMLElement&&t.target.blur(),e.domCache?.searchBox&&e.domCache.searchBox.focus()))}function S(t){if(e.isOverlayVisible&&!E(t)){if(t.stopPropagation(),t.stopImmediatePropagation(),t.preventDefault(),e.domCache?.searchBox&&(e.domCache.searchBox.focus(),t.key&&t.key.length===1&&!t.ctrlKey&&!t.altKey&&!t.metaKey)){const r=e.domCache.searchBox,a=r.selectionStart||0,n=r.selectionEnd||0,i=r.value;r.value=i.slice(0,a)+t.key+i.slice(n),r.setSelectionRange(a+1,a+1),r.dispatchEvent(new Event("input",{bubbles:!0}))}return}}function L(t){if(e.isOverlayVisible&&!E(t))if(t.stopPropagation(),t.stopImmediatePropagation(),t.preventDefault(),t instanceof InputEvent&&t.type==="beforeinput"&&typeof t.data=="string"&&e.domCache?.searchBox){const r=e.domCache.searchBox;r.focus();const a=r.selectionStart||0,n=r.selectionEnd||0,i=r.value;r.value=i.slice(0,a)+t.data+i.slice(n),r.setSelectionRange(a+t.data.length,a+t.data.length),r.dispatchEvent(new Event("input",{bubbles:!0}))}else e.domCache?.searchBox&&e.domCache.searchBox.focus()}function M(t){e.isOverlayVisible&&(E(t)||(t.stopPropagation(),t.stopImmediatePropagation(),t.preventDefault()))}function ee(t){e.isOverlayVisible&&(E(t)||(t.stopPropagation(),t.stopImmediatePropagation(),t.preventDefault(),t.target instanceof HTMLElement&&t.target.blur(),e.domCache?.searchBox&&e.domCache.searchBox.focus()))}function R(t){e.isOverlayVisible&&(E(t)||(t.stopPropagation(),t.stopImmediatePropagation(),t.preventDefault()))}function m(){try{if(!e.isOverlayVisible||e.isClosing)return;e.isClosing=!0,$(),requestAnimationFrame(()=>{e.overlay&&(e.overlay.style.opacity="0"),e.closeTimeout&&clearTimeout(e.closeTimeout),e.closeTimeout=setTimeout(()=>{e.closeTimeout=null,e.isClosing=!1,e.overlay&&(e.overlay.style.display="none"),e.isOverlayVisible=!1,e.focusInterval&&(clearInterval(e.focusInterval),e.focusInterval=null),e.lastFullscreenElement=null,document.removeEventListener("keydown",N,!0),document.removeEventListener("keyup",z,!0),document.removeEventListener("focus",P,!0),document.removeEventListener("focusin",ee,!0),document.removeEventListener("keydown",S,!0),document.removeEventListener("keypress",S,!0),document.removeEventListener("keyup",S,!0),document.removeEventListener("input",L,!0),document.removeEventListener("beforeinput",L,!0),document.removeEventListener("textInput",L,!0),document.removeEventListener("click",R,!0),document.removeEventListener("mousedown",R,!0),document.removeEventListener("compositionstart",M,!0),document.removeEventListener("compositionupdate",M,!0),document.removeEventListener("compositionend",M,!0),e.intersectionObserver&&(e.intersectionObserver.disconnect(),e.intersectionObserver=null)},200)})}catch(t){console.error("[TAB SWITCHER] Error in closeOverlay:",t),e.isOverlayVisible=!1,e.isClosing=!1,$(),e.focusInterval&&(clearInterval(e.focusInterval),e.focusInterval=null);try{document.removeEventListener("keydown",N,!0),document.removeEventListener("keyup",z,!0),document.removeEventListener("focus",P,!0)}catch{}}}function W(t){try{if(!t||typeof t!="number"){console.error("[TAB SWITCHER] Invalid tab ID:",t);return}try{chrome.runtime.sendMessage({action:"switchToTab",tabId:t},()=>{chrome.runtime.lastError&&console.debug("[TAB SWITCHER] SW not ready:",chrome.runtime.lastError.message)})}catch(r){console.debug("[TAB SWITCHER] sendMessage warn:",r?.message||r)}m()}catch(r){console.error("[TAB SWITCHER] Exception in switchToTab:",r),m()}}function O(t){try{if(!t)return;try{chrome.runtime.sendMessage({action:"restoreSession",sessionId:t},()=>{chrome.runtime.lastError&&console.debug("[TAB SWITCHER] SW not ready (restoreSession):",chrome.runtime.lastError.message)})}catch(r){console.debug("[TAB SWITCHER] sendMessage warn:",r?.message||r)}m()}catch(r){console.error("[TAB SWITCHER] Exception in restoreSession:",r),m()}}function U(t,r){try{if(!t||typeof t!="number"){console.error("[TAB SWITCHER] Invalid tab ID for closing:",t);return}if(!e.currentTabs.some(n=>n&&n.id===t)){console.warn("[TAB SWITCHER] Tab no longer exists:",t),e.filteredTabs=e.filteredTabs.filter(n=>n&&n.id!==t),e.currentTabs=e.currentTabs.filter(n=>n&&n.id!==t),e.selectedIndex>=e.filteredTabs.length&&(e.selectedIndex=Math.max(0,e.filteredTabs.length-1)),e.filteredTabs.length>0?e.filteredTabs.length>50?T(e.filteredTabs):x(e.filteredTabs):m();return}chrome.runtime.sendMessage({action:"closeTab",tabId:t},n=>{if(chrome.runtime.lastError){console.error("[TAB SWITCHER] Error closing tab:",chrome.runtime.lastError.message);return}n?.success&&(e.currentTabs=e.currentTabs.filter(i=>i&&i.id!==t),e.filteredTabs=e.filteredTabs.filter(i=>i&&i.id!==t),e.filteredTabs.length>0?(e.selectedIndex>=e.filteredTabs.length&&(e.selectedIndex=Math.max(0,e.filteredTabs.length-1)),e.filteredTabs.length>50?T(e.filteredTabs):x(e.filteredTabs),e.domCache.searchBox&&e.domCache.searchBox.focus()):m())})}catch(a){console.error("[TAB SWITCHER] Exception in closeTab:",a)}}function ue(t,r){try{if(!t)return;chrome.runtime.sendMessage({action:"toggleMute",tabId:t},a=>{if(chrome.runtime.lastError){console.error("[TAB SWITCHER] Error toggling mute:",chrome.runtime.lastError);return}if(a&&a.success){const n=a.muted;n?(r.classList.add("muted"),r.title="Unmute tab",r.innerHTML='<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>'):(r.classList.remove("muted"),r.title="Mute tab",r.innerHTML='<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>');const i=e.currentTabs.find(o=>o.id===t);i&&(i.mutedInfo||(i.mutedInfo={muted:!1}),i.mutedInfo.muted=n)}})}catch(a){console.error("[TAB SWITCHER] Exception in toggleMute:",a)}}function be(t,r){try{if(!t)return;chrome.runtime.sendMessage({action:"togglePlayPause",tabId:t},a=>{if(chrome.runtime.lastError){console.error("[TAB SWITCHER] Error toggling play/pause:",chrome.runtime.lastError);return}if(a&&a.success){const n=a.playing;n?(r.classList.add("playing"),r.title="Pause tab",r.innerHTML='<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>'):(r.classList.remove("playing"),r.title="Play tab",r.innerHTML='<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>');const i=e.currentTabs.find(o=>o.id===t);i&&(i.isPlaying=n,i.audible=n)}})}catch(a){console.error("[TAB SWITCHER] Exception in togglePlayPause:",a)}}function V(t){e.viewMode=t,e.domCache?.searchBox&&(e.domCache.searchBox.placeholder=t==="recent"?"Search recently closed tabs...":"Search tabs by title or URL..."),e.domCache?.sectionTitle&&(e.domCache.sectionTitle.textContent=t==="recent"?"Recently Closed":"Opened Tabs"),e.domCache?.tabHint&&e.domCache.tabHint.classList.toggle("hidden",t==="recent"),e.domCache?.helpText&&(t==="recent"?e.domCache.helpText.innerHTML=`
        <span><kbd>Alt+Q</kbd> <kbd>↑↓</kbd> Navigate</span>
        <span><kbd>Enter</kbd> Restore</span>
        <span><kbd>Backspace</kbd> Active Tabs</span>
        <span><kbd>Esc</kbd> Exit</span>
      `:e.domCache.helpText.innerHTML=`
        <span><kbd>Alt+Q</kbd> <kbd>↑↓</kbd> Navigate</span>
        <span><kbd>Enter</kbd> Switch Tab</span>
        <span><kbd>Delete</kbd> Close</span>
        <span><kbd>.</kbd> Recent Tabs</span>
        <span><kbd>;</kbd> Tab History</span>
        <span><kbd>Esc</kbd> Exit</span>
      `)}function pe(t){try{if(!t||typeof t!="number")return;chrome.runtime.sendMessage({action:"createGroup",tabId:t},r=>{if(chrome.runtime.lastError){console.error("[TAB SWITCHER] Error creating group:",chrome.runtime.lastError.message);return}r?.success&&m()})}catch(r){console.error("[TAB SWITCHER] Exception in createGroup:",r)}}function D(){if(e.viewMode==="active")return;V("active"),e.currentTabs=e.activeTabs||[];const t=e.currentTabs;e.filteredTabs=t,e.selectedIndex=0,e.domCache.grid&&(e.domCache.grid.classList.remove("recent-mode"),e.domCache.grid.classList.remove("search-mode")),e.filteredTabs.length>50?T(e.filteredTabs):x(e.filteredTabs),e.domCache.searchBox&&(e.domCache.searchBox.value="",e.domCache.searchBox.focus())}async function te(){if(e.viewMode==="recent")return;V("recent");let t=[];try{t=await new Promise(r=>{try{chrome.runtime.sendMessage({action:"getRecentlyClosed",maxResults:10},a=>{if(chrome.runtime.lastError){console.debug("[TAB SWITCHER] Runtime error:",chrome.runtime.lastError.message),r([]);return}a?.success?r(a.items||[]):r([])})}catch{r([])}})}catch(r){console.debug("[TAB SWITCHER] Failed to load recently closed:",r)}e.recentItems=t.map((r,a)=>({id:void 0,title:r.title,url:r.url,favIconUrl:r.favIconUrl,screenshot:null,sessionId:r.sessionId,index:a})),e.currentTabs=e.recentItems,e.filteredTabs=e.recentItems,e.selectedIndex=0,e.domCache.grid&&e.domCache.grid.classList.add("recent-mode"),x(e.filteredTabs),e.domCache.searchBox&&e.domCache.searchBox.focus()}function me(){try{if(!window.navigation||typeof window.navigation.entries!="function")return console.log("[TAB SWITCHER] Navigation API not available"),{back:[],forward:[]};const t=window.navigation.entries(),r=window.navigation.currentEntry;if(!t||t.length===0||!r)return console.log("[TAB SWITCHER] No navigation entries available"),{back:[],forward:[]};const a=r.index;console.log("[TAB SWITCHER] Navigation entries:",t.length,"Current index:",a);const n=[];for(let o=a-1;o>=0;o--){const c=t[o];c&&c.url&&n.push({url:c.url,title:_(c.url)})}const i=[];for(let o=a+1;o<t.length;o++){const c=t[o];c&&c.url&&i.push({url:c.url,title:_(c.url)})}return console.log("[TAB SWITCHER] Back entries:",n.length,"Forward entries:",i.length),{back:n,forward:i}}catch(t){return console.error("[TAB SWITCHER] Error getting navigation history:",t),{back:[],forward:[]}}}function _(t){try{const r=new URL(t);let a=r.hostname;if(a.startsWith("www.")&&(a=a.substring(4)),r.pathname&&r.pathname!=="/"){const n=r.pathname.split("/").filter(i=>i).pop();n&&n.length<50&&(a+=" - "+decodeURIComponent(n).replace(/[-_]/g," "))}return a}catch{return t}}function fe(){let t=null,r=0;const a=100,n=300,i=50;return o=>{const c=performance.now(),s=c-r,h=e.currentTabs.length>=i;t&&clearTimeout(t),!h&&s>=a?(r=c,j(o)):t=setTimeout(()=>{r=performance.now(),j(o)},h?n:a)}}function j(t){try{const r=t.target,a=r instanceof HTMLInputElement?r.value:e.domCache?.searchBox?.value??"",n=String(a).trim();if(e.domCache?.tabHint){const s=n.length>0||e.viewMode==="recent"||e.webSearch.active;e.domCache.tabHint.classList.toggle("hidden",s)}if(n.startsWith(";")){e.webSearch.active=!1,e.history.active=!0,e.domCache.grid&&(e.domCache.grid.classList.add("search-mode"),e.domCache.grid.classList.remove("recent-mode")),e.domCache.sectionTitle&&(e.domCache.sectionTitle.textContent="Tab History"),e.domCache.helpText&&(e.domCache.helpText.innerHTML=`
            <span><kbd>;</kbd> History Mode</span>
            <span><kbd>←→</kbd> Switch Column</span>
            <span><kbd>↑↓</kbd> Navigate</span>
            <span><kbd>Enter</kbd> Go</span>
            <span><kbd>Backspace</kbd> Exit</span>
            <span><kbd>Esc</kbd> Close</span>
          `);const s=me();console.log("[TAB SWITCHER] Navigation API history:",s),ne(s);return}if(e.history.active=!1,e.history.backEls=[],e.history.forwardEls=[],e.viewMode!=="recent"&&e.webSearch.active){const s=n,h={title:s?`Search Web for "${s}"`:"Type to search web...",url:s?`https://www.google.com/search?q=${encodeURIComponent(s)}`:"",favIconUrl:"https://www.google.com/favicon.ico",isWebSearch:!0,searchQuery:s};e.filteredTabs=[h],e.selectedIndex=0,e.domCache.grid&&(e.domCache.grid.classList.add("search-mode"),e.domCache.grid.classList.remove("recent-mode")),e.domCache.sectionTitle&&(e.domCache.sectionTitle.textContent="Web Search"),x(e.filteredTabs);return}e.domCache.grid&&e.domCache.grid.classList.remove("search-mode"),e.domCache.sectionTitle&&(e.domCache.sectionTitle.textContent=e.viewMode==="recent"?"Recently Closed":"Opened Tabs");const i=t instanceof InputEvent&&t.inputType==="deleteContentBackward";if(n==="."&&!i){const s=e.domCache?.searchBox;s&&(s.value=""),e.viewMode==="recent"?D():te();return}if(!n){e.filteredTabs=e.currentTabs,e.selectedIndex=0,e.currentTabs.length>50?T(e.currentTabs):x(e.currentTabs);return}const c=e.currentTabs.map(s=>{const h=q(s.title,n),d=q(s.url,n),b=h.score>d.score?h:d;return{tab:s,match:b.match,score:b.score}}).filter(s=>s.match).sort((s,h)=>h.score-s.score).map(s=>s.tab);e.filteredTabs=c,e.selectedIndex=0,c.length>50?T(c):x(c)}catch(r){console.error("[TAB SWITCHER] Error in handleSearch:",r),e.filteredTabs=e.currentTabs,e.selectedIndex=0,x(e.currentTabs)}}function q(t,r){if(!t)return{match:!1,score:0};const a=String(t).toLowerCase(),n=String(r??"").toLowerCase();if(n.length===0)return{match:!0,score:1};if(a===n)return{match:!0,score:100};if(a.startsWith(n))return{match:!0,score:80+n.length/a.length*10};if(a.includes(n))return{match:!0,score:50+n.length/a.length*10};let i=0,o=0,c=0,s=0,h=-1;for(;i<a.length&&o<n.length;){if(a[i]===n[o]){h===-1&&(h=i);let d=1;s>0&&(d+=2+s),(i===0||a[i-1]===" "||a[i-1]==="."||a[i-1]==="/"||a[i-1]==="-")&&(d+=3),c+=d,s++,o++}else s=0;i++}return o<n.length?{match:!1,score:0}:(c-=(a.length-n.length)*.1,h>0&&(c-=h*.5),{match:!0,score:Math.max(1,c)})}function ge(t){const r="__tabSwitcherEventGuardsInstalled";if(t[r])return;t[r]=!0;const a=i=>{e.isOverlayVisible&&E(i)&&(i.stopPropagation(),typeof i.stopImmediatePropagation=="function"&&i.stopImmediatePropagation())},n=["keydown","keyup","keypress","beforeinput","input","textInput","compositionstart","compositionupdate","compositionend","click","mousedown","mouseup","pointerdown","pointerup","contextmenu"];for(const i of n)t.addEventListener(i,a)}function ve(){const t=document,r=document.fullscreenElement||t.webkitFullscreenElement;return r?r.tagName==="VIDEO"?r.parentElement||null:r:null}function re(){if(!e.host)return;const r=ve()||document.documentElement||document.body;if(r)try{e.host.parentNode,r.appendChild(e.host)}catch{}}function xe(){try{if(!e.host||!e.host.isConnected){e.shadowRoot=null,e.styleElement=null;const t=document.getElementById(F);if(t)e.host=t;else{const r=document.createElement("tab-switcher-mount");r.id=F,r.style.cssText=`
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
      `,(document.documentElement||document.body).appendChild(r),e.host=r}}if(re(),e.shadowRoot||(e.host.shadowRoot?e.shadowRoot=e.host.shadowRoot:e.shadowRoot=e.host.attachShadow({mode:"open"})),!e.styleElement||!e.shadowRoot.contains(e.styleElement)){const t=document.createElement("style");t.textContent=ae,e.shadowRoot.appendChild(t),e.styleElement=t}return ge(e.shadowRoot),e.shadowRoot}catch(t){return console.error("[TAB SWITCHER] Failed to initialize shadow root:",t),null}}function we(){if(e.overlay)return;const t=xe();if(!t)return;const r=document.createElement("div");r.id="visual-tab-switcher-overlay",r.className="tab-switcher-overlay",r.style.willChange="opacity";const a=document.createElement("div");a.className="tab-switcher-backdrop",r.appendChild(a);const n=document.createElement("div");n.className="tab-switcher-container",n.style.transform="translate3d(0, 0, 0)";const i=document.createElement("div");i.className="tab-switcher-search-row";const o=document.createElement("div");o.className="tab-switcher-search-wrap";const c=document.createElement("input");c.type="text",c.className="tab-switcher-search",c.placeholder="Search tabs by title or URL...",c.autocomplete="off";const s=document.createElement("div");s.className="search-icon",s.innerHTML=`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"></rect>
    <rect x="14" y="3" width="7" height="7" rx="1"></rect>
    <rect x="3" y="14" width="7" height="7" rx="1"></rect>
    <rect x="14" y="14" width="7" height="7" rx="1"></rect>
  </svg>`;const h=document.createElement("div");h.className="search-tab-hint",h.innerHTML="<kbd>Tab</kbd> Search Google",o.appendChild(s),o.appendChild(c),o.appendChild(h),i.appendChild(o),n.appendChild(i);const d=document.createElement("div");d.className="tab-switcher-section-header";const b=document.createElement("span");b.className="tab-switcher-section-title",b.textContent="Opened Tabs";const p=document.createElement("div");p.className="tab-switcher-view-toggle";const y=localStorage.getItem("tabSwitcherViewMode")||"grid",l=document.createElement("button");l.type="button",l.className=`view-toggle-btn ${y==="grid"?"active":""}`,l.dataset.view="grid",l.title="Grid View",l.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="3" y="3" width="7" height="7" rx="1"></rect>
    <rect x="14" y="3" width="7" height="7" rx="1"></rect>
    <rect x="3" y="14" width="7" height="7" rx="1"></rect>
    <rect x="14" y="14" width="7" height="7" rx="1"></rect>
  </svg>`;const u=document.createElement("button");u.type="button",u.className=`view-toggle-btn ${y==="list"?"active":""}`,u.dataset.view="list",u.title="List View",u.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="3" y1="6" x2="21" y2="6"></line>
    <line x1="3" y1="12" x2="21" y2="12"></line>
    <line x1="3" y1="18" x2="21" y2="18"></line>
  </svg>`,p.appendChild(l),p.appendChild(u),d.appendChild(b),d.appendChild(p),n.appendChild(d);const f=document.createElement("div");f.className=`tab-switcher-grid ${y==="list"?"list-view":""}`,f.id="tab-switcher-grid",f.setAttribute("role","listbox"),f.setAttribute("aria-label","Open tabs"),f.style.transform="translate3d(0, 0, 0)",n.appendChild(f);const k=document.createElement("div");k.className="tab-switcher-help",k.innerHTML=`
      <span><kbd>Alt+Q</kbd> <kbd>↑↓</kbd> Navigate</span>
     <span><kbd>↵</kbd>Switch</span>
     <span><kbd>Del</kbd>Close</span>
     <span><kbd>.</kbd>Recent</span>
     <span><kbd>;</kbd>History</span>
     <span><kbd>Esc</kbd>Exit</span>
   `,n.appendChild(k),r.appendChild(n),c.addEventListener("input",fe()),c.addEventListener("keydown",le),a.addEventListener("click",m),f.addEventListener("click",ce),p.addEventListener("click",C=>{const v=C.target.closest(".view-toggle-btn");if(!v)return;const g=v.dataset.view;g&&(l.classList.toggle("active",g==="grid"),u.classList.toggle("active",g==="list"),f.classList.toggle("list-view",g==="list"),localStorage.setItem("tabSwitcherViewMode",g))}),e.overlay=r,e.domCache={grid:f,searchBox:c,container:n,searchWrap:o,helpText:k,sectionTitle:b,tabHint:h},t.appendChild(r),console.log("[PERF] Overlay created with GPU acceleration and event delegation")}function ye(t,r,a=[]){performance.now(),console.log(`[TAB SWITCHER] Opening with ${t.length} tabs and ${a.length} groups`);const n=document;if(e.lastFullscreenElement=document.fullscreenElement||n.webkitFullscreenElement||null,e.isOverlayVisible&&!e.isClosing)return;if(e.closeTimeout&&(clearTimeout(e.closeTimeout),e.closeTimeout=null),e.isClosing=!1,e.isOverlayVisible=!0,e.webSearch.active=!1,e.history.active=!1,we(),!e.overlay){e.isOverlayVisible=!1;return}const i=e.overlay;re(),i.style.display="flex",i.style.opacity="0",e.activeTabs=t,e.currentTabs=t,e.groups=a,e.filteredTabs=t,V("active"),e.domCache?.grid&&(e.domCache.grid.classList.remove("search-mode"),e.domCache.grid.classList.remove("recent-mode"));const o=t.findIndex(c=>c.id===r);t.length>1&&o===0?e.selectedIndex=1:(o>0,e.selectedIndex=0),e.filteredTabs.length>50?(console.log("[PERF] Using virtual scrolling for",e.filteredTabs.length,"tabs"),T(e.filteredTabs)):x(e.filteredTabs),i.style.display="flex",i.style.opacity="0",e.isOverlayVisible=!0,de(),he(),e.domCache.searchBox&&(e.domCache.searchBox.value="",e.domCache.searchBox.focus()),e.domCache.grid&&(e.domCache.grid.scrollTop=0),requestAnimationFrame(()=>{requestAnimationFrame(()=>{e.overlay&&(e.overlay.style.opacity="1")})}),document.addEventListener("keydown",N,!0),document.addEventListener("keyup",z,!0),document.addEventListener("focus",P,!0),document.addEventListener("focusin",ee,!0),document.addEventListener("keydown",S,!0),document.addEventListener("keypress",S,!0),document.addEventListener("keyup",S,!0),document.addEventListener("input",L,!0),document.addEventListener("beforeinput",L,!0),document.addEventListener("textInput",L,!0),document.addEventListener("click",R,!0),document.addEventListener("mousedown",R,!0),document.addEventListener("compositionstart",M,!0),document.addEventListener("compositionupdate",M,!0),document.addEventListener("compositionend",M,!0),e.focusInterval&&clearInterval(e.focusInterval),e.focusInterval=setInterval(()=>{e.isOverlayVisible&&e.domCache.searchBox&&document.activeElement!==e.domCache.searchBox&&e.domCache.searchBox.focus()},100)}console.log("═══════════════════════════════════════════════════════");console.log("Visual Tab Switcher - Content Script Loaded");console.log("Features: Virtual Scrolling, Event Delegation, GPU Acceleration");console.log("Target: <16ms interactions, 60fps, lazy loading");console.log("═══════════════════════════════════════════════════════");function B(){try{const t=document.querySelectorAll("video, audio"),r=t.length>0;let a=!1;if(r){for(const n of t)if(!n.paused&&!n.ended&&n.readyState>2){a=!0;break}}r&&chrome.runtime.sendMessage({action:"reportMediaPresence",hasMedia:!0,isPlaying:a},()=>{chrome.runtime.lastError})}catch{}}function ke(){try{document.addEventListener("play",()=>B(),!0),document.addEventListener("pause",()=>B(),!0),document.addEventListener("ended",()=>B(),!0)}catch{}}ke();document.readyState==="complete"?B():window.addEventListener("load",B);const Te=new MutationObserver(t=>{for(const r of t)if(r.addedNodes.length){B();break}});try{Te.observe(document.body,{childList:!0,subtree:!0})}catch{}chrome.runtime.onMessage.addListener((t,r,a)=>{if(t.action==="showTabSwitcher"){if(e.isOverlayVisible)return w(),A(!0),a({success:!0,advanced:!0}),!0;ye(t.tabs,t.activeTabId,t.groups),a({success:!0})}return!0});
})()
})()
