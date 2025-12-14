(function(){(function(){function x(t="navigate"){try{if(document.hidden&&t==="navigate")return;const o={action:"REPORT_NAVIGATION",url:window.location.href,title:document.title,navType:t};chrome.runtime.sendMessage(o,r=>{chrome.runtime.lastError})}catch{}}x();window.addEventListener("popstate",()=>x("back_forward"));window.addEventListener("hashchange",()=>x("navigate"));const G=new MutationObserver(()=>{x("title_update")}),U=document.querySelector("title");if(U)G.observe(U,{childList:!0,characterData:!0,subtree:!0});else{const t=new MutationObserver(o=>{const r=document.querySelector("title");r&&(G.observe(r,{childList:!0,characterData:!0,subtree:!0}),t.disconnect())});t.observe(document.head||document.documentElement,{childList:!0,subtree:!0})}const X=history.pushState;history.pushState=function(...t){X.apply(this,t),x("navigate")};const Z=history.replaceState;history.replaceState=function(...t){Z.apply(this,t),x("navigate")};const e={overlay:null,currentTabs:[],activeTabs:[],filteredTabs:[],selectedIndex:0,isOverlayVisible:!1,viewMode:"active",recentItems:[],groups:[],collapsedGroups:new Set,host:null,shadowRoot:null,styleElement:null,domCache:{grid:null,searchBox:null,container:null,searchWrap:null,backBtn:null,recentBtn:null},virtualScroll:{startIndex:0,endIndex:0,visibleCount:20,bufferCount:5},lastKeyTime:0,keyThrottleMs:16,resizeObserver:null,intersectionObserver:null,focusInterval:null,closeTimeout:null,isClosing:!1,history:{active:!1,backEls:[],forwardEls:[],column:"back",index:0}},V="tab-switcher-host",ee=`/* Visual Tab Switcher - Modern Glass UI 2.0 */
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
`;function m(t){const o=performance.now(),r=e.domCache.grid;if(!r)return;if(r.innerHTML="",t.length===0){const c=document.createElement("div");c.className="tab-switcher-empty",c.textContent="No tabs found",r.appendChild(c);return}const a=document.createDocumentFragment();t.forEach((c,i)=>{const l=j(c,i);c.isGroupHeader&&(l.dataset.isHeader="true"),l.dataset.tabIndex=String(i),a.appendChild(l)}),r.appendChild(a),S(!1);const n=performance.now()-o;console.log(`[PERF] Rendered ${t.length} tabs in ${n.toFixed(2)}ms`)}function f(t){const o=performance.now(),r=e.domCache.grid;if(r.innerHTML="",t.length===0){const s=document.createElement("div");s.className="tab-switcher-empty",s.textContent="No tabs found",r.appendChild(s);return}const a=e.virtualScroll.visibleCount,n=e.virtualScroll.bufferCount,c=Math.max(0,e.selectedIndex-n),i=Math.min(t.length,e.selectedIndex+a+n);e.virtualScroll.startIndex=c,e.virtualScroll.endIndex=i;const l=t.length*180;r.style.minHeight=`${l}px`;const d=document.createDocumentFragment();for(let s=c;s<i;s++){const p=t[s],M=j(p,s);M.style.position="relative",M.style.top=`${s*180}px`,d.appendChild(M)}r.appendChild(d),oe(),S(!1);const h=performance.now()-o;console.log(`[PERF] Virtual rendered ${i-c} of ${t.length} tabs in ${h.toFixed(2)}ms`)}function j(t,o){if(t.isGroupHeader)return te(t,o);const r=document.createElement("div");r.className="tab-card",t&&typeof t.id=="number"&&(r.dataset.tabId=String(t.id)),t?.sessionId&&(r.dataset.sessionId=t.sessionId,r.dataset.recent="1"),t?.isWebSearch&&(r.dataset.webSearch="1",r.dataset.searchQuery=t.searchQuery),r.dataset.tabIndex=String(o),r.setAttribute("role","option"),r.setAttribute("aria-selected",o===e.selectedIndex?"true":"false"),r.setAttribute("aria-label",`${t.title} - ${t.url}`),r.tabIndex=-1,r.style.transform="translate3d(0, 0, 0)";const a=t.screenshot&&typeof t.screenshot=="string"&&t.screenshot.length>0;a?r.classList.add("has-screenshot"):r.classList.add("has-favicon"),o===e.selectedIndex&&r.classList.add("selected"),t.pinned&&r.classList.add("pinned");let n=null,c="";if(t.groupId&&t.groupId!==-1&&e.groups){const s=e.groups.find(p=>p.id===t.groupId);s&&(n=_(s.color),c=s.title||"Group",r.dataset.groupId=String(s.id),r.style.borderLeft=`4px solid ${n}`)}const i=document.createElement("div");if(i.className="tab-thumbnail",!t.sessionId&&!t.isWebSearch){const s=document.createElement("button");s.className="tab-mute-btn",s.title=t.mutedInfo?.muted?"Unmute tab":"Mute tab",s.dataset.action="mute",s.dataset.tabId=String(t.id),t.mutedInfo?.muted?(s.classList.add("muted"),s.innerHTML='<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>'):(s.innerHTML='<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',t.audible&&(s.style.opacity="0.9")),i.appendChild(s)}if(t.sessionId){r.classList.add("recent-item");const s=P(t);i.appendChild(s)}else if(a){const s=document.createElement("img");s.className="screenshot-img",s.dataset.src=t.screenshot,s.alt=t.title,Math.abs(o-e.selectedIndex)<10&&(s.src=t.screenshot),i.appendChild(s)}else{const s=re(t);if(s)i.appendChild(s),r.classList.add("has-placeholder");else{const p=P(t);i.appendChild(p)}}r.appendChild(i);const l=document.createElement("div");l.className="tab-info";const d=document.createElement("div");if(d.className="tab-header",t.favIconUrl&&(a||r.classList.contains("has-placeholder"))){const s=document.createElement("img");s.src=t.favIconUrl,s.className="tab-favicon",s.onerror=()=>{s.style.display="none"},d.appendChild(s)}const h=document.createElement("div");if(h.className="tab-title",h.textContent=t.title,h.title=t.title,d.appendChild(h),n){const s=document.createElement("span");s.className="group-pill",s.textContent=c,s.style.backgroundColor=n,s.style.opacity="0.3",s.style.color="#202124",s.style.fontSize="10px",s.style.fontWeight="600",s.style.padding="2px 6px",s.style.borderRadius="4px",s.style.marginLeft="8px",s.style.alignSelf="center",s.style.whiteSpace="nowrap",d.appendChild(s)}if(l.appendChild(d),a||r.classList.contains("has-placeholder")){const s=document.createElement("div");s.className="tab-url",s.textContent=t.url,s.title=t.url,l.appendChild(s)}if(r.appendChild(l),!t.sessionId&&!t.isWebSearch){const s=document.createElement("button");s.className="tab-close-btn",s.innerHTML="×",s.title="Close tab",s.dataset.action="close",t.id&&(s.dataset.tabId=String(t.id)),r.appendChild(s)}return r}function te(t,o){const r=document.createElement("div");r.className="tab-card group-header-card",r.dataset.groupId=String(t.groupId),r.dataset.tabIndex=String(o),r.dataset.collapsed=e.collapsedGroups.has(t.groupId)?"true":"false",r.style.borderLeft=`6px solid ${t.groupColor}`,r.style.background=`linear-gradient(to right, ${t.groupColor}11, transparent)`,o===e.selectedIndex&&r.classList.add("selected");const a=document.createElement("div");a.className="group-header-content",a.style.display="flex",a.style.alignItems="center",a.style.justifyContent="space-between",a.style.width="100%",a.style.padding="0 16px";const n=document.createElement("div");n.style.display="flex",n.style.alignItems="center",n.style.gap="12px";const c=document.createElement("span");c.textContent=t.groupTitle||"Untitled Group",c.style.fontWeight="600",c.style.fontSize="14px",c.style.color="var(--text-primary, #e8eaed)";const i=document.createElement("span"),l=e.currentTabs.filter(s=>s.groupId===t.groupId).length;i.textContent=`${l} tabs`,i.style.fontSize="12px",i.style.opacity="0.7",n.appendChild(c),n.appendChild(i);const d=document.createElement("div"),h=document.createElement("span");return h.innerHTML=e.collapsedGroups.has(t.groupId)?'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>':'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"></polyline></svg>',e.collapsedGroups.has(t.groupId)?h.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>':h.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>',d.appendChild(h),a.appendChild(n),a.appendChild(d),r.appendChild(a),r.onclick=s=>{s.stopPropagation(),ue(t.groupId)},r}function P(t){const o=document.createElement("div");if(o.className="favicon-tile",t.favIconUrl){const r=document.createElement("img");r.src=t.favIconUrl,r.className="favicon-large",r.onerror=()=>{r.style.display="none";const a=document.createElement("div");a.className="favicon-letter",a.textContent=(t.title||"T")[0].toUpperCase(),o.appendChild(a)},o.appendChild(r)}else{const r=document.createElement("div");r.className="favicon-letter",r.textContent=(t.title||"T")[0].toUpperCase(),o.appendChild(r)}return o}function re(t){if(!t.url)return null;const r=["chrome://","edge://","devtools://","view-source:","about:"].some(p=>t.url.startsWith(p)),n=new URL(t.url).hostname;if(!r&&!n.includes("google.com"))return null;const c=document.createElement("div");c.className="tab-placeholder",c.style.width="100%",c.style.height="100%",c.style.display="flex",c.style.flexDirection="column",c.style.alignItems="center",c.style.justifyContent="center";let i="linear-gradient(135deg, #667eea 0%, #764ba2 100%)",l=n[0].toUpperCase(),d=n;t.url.startsWith("chrome://")?(i="linear-gradient(135deg, #2c3e50 0%, #3498db 100%)",d="Chrome System",l="⚙️"):n.includes("mail.google.com")?(i="linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)",l="✉️",d="Gmail"):n.includes("calendar.google.com")?(i="linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",l="📅",d="Calendar"):n.includes("docs.google.com")&&(i="linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",l="📝",d="Docs"),c.style.background=i;const h=document.createElement("div");h.textContent=l,h.style.fontSize="48px",h.style.marginBottom="8px",h.style.filter="drop-shadow(0 2px 4px rgba(0,0,0,0.2))";const s=document.createElement("div");return s.textContent=d,s.style.color="white",s.style.fontFamily="system-ui, sans-serif",s.style.fontWeight="600",s.style.fontSize="14px",s.style.textShadow="0 1px 2px rgba(0,0,0,0.3)",c.appendChild(h),c.appendChild(s),c}function H(t){if(!e.groups||e.groups.length===0)return t;const o=[],r=new Set;for(const a of t)if(a.groupId&&a.groupId!==-1){if(r.has(a.groupId))continue;r.add(a.groupId);const n=e.groups.find(l=>l.id===a.groupId);if(!n){o.push(a);continue}const c={id:-1*a.groupId,isGroupHeader:!0,groupId:a.groupId,groupColor:_(n.color),groupTitle:n.title,title:n.title,url:"",active:!1};if(o.push(c),!e.collapsedGroups.has(a.groupId)){const l=t.filter(d=>d.groupId===a.groupId);o.push(...l)}}else o.push(a);return o}function S(t){try{const o=e.domCache.grid;if(!o)return;o.querySelectorAll(".tab-card.selected").forEach(n=>{n.classList.remove("selected"),n.setAttribute("aria-selected","false")});const a=o.querySelector(`.tab-card[data-tab-index="${e.selectedIndex}"]`);if(!a)return;a.classList.add("selected"),a.setAttribute("aria-selected","true"),o.setAttribute("aria-activedescendant",a.id||`tab-card-${e.selectedIndex}`),a.id||(a.id=`tab-card-${e.selectedIndex}`),t&&requestAnimationFrame(()=>{a.scrollIntoView({behavior:"smooth",block:"nearest",inline:"nearest"})})}catch(o){console.error("[TAB SWITCHER] Error enforcing selection:",o)}}function T(){try{if(!e.domCache.grid)return;if(e.filteredTabs&&e.filteredTabs.length>50){const{startIndex:o,endIndex:r}=e.virtualScroll;(e.selectedIndex<o||e.selectedIndex>=r)&&f(e.filteredTabs)}S(!0)}catch(t){console.error("[TAB SWITCHER] Error in updateSelection:",t)}}function oe(){e.intersectionObserver&&e.intersectionObserver.disconnect(),e.intersectionObserver=new IntersectionObserver(o=>{o.forEach(r=>{if(r.isIntersecting){const a=r.target;a.dataset.src&&!a.src&&(a.src=a.dataset.src,e.intersectionObserver.unobserve(a))}})},{rootMargin:"100px"}),e.domCache.grid.querySelectorAll("img[data-src]").forEach(o=>{e.intersectionObserver.observe(o)})}function ae(t){const o=e.domCache.grid;if(!o)return;o.innerHTML="",o.className="tab-switcher-grid search-mode";const r=document.createElement("div");r.className="history-view",e.history.active=!0,e.history.backEls=[],e.history.forwardEls=[];const a=document.createElement("div");a.className="history-column";const n=document.createElement("div");if(n.className="history-column-header",n.textContent="← BACK",a.appendChild(n),t.back&&t.back.length>0){const l=document.createElement("div");l.className="history-items-container",t.back.forEach((d,h)=>{const s=F(d,-(h+1));s.dataset.column="back",s.dataset.index=String(h),l.appendChild(s),e.history.backEls.push(s)}),a.appendChild(l)}else{const l=document.createElement("div");l.className="tab-switcher-empty",l.textContent="No back history",l.style.padding="20px",l.style.textAlign="center",l.style.color="var(--text-muted)",a.appendChild(l)}const c=document.createElement("div");c.className="history-column";const i=document.createElement("div");if(i.className="history-column-header",i.textContent="FORWARD →",c.appendChild(i),t.forward&&t.forward.length>0){const l=document.createElement("div");l.className="history-items-container",t.forward.forEach((d,h)=>{const s=F(d,h+1);s.dataset.column="forward",s.dataset.index=String(h),l.appendChild(s),e.history.forwardEls.push(s)}),c.appendChild(l)}else{const l=document.createElement("div");l.className="tab-switcher-empty",l.textContent="No forward history",l.style.padding="20px",l.style.textAlign="center",l.style.color="var(--text-muted)",c.appendChild(l)}r.appendChild(a),r.appendChild(c),o.appendChild(r),e.history.backEls.length>0?(e.history.column="back",e.history.index=0):e.history.forwardEls.length>0&&(e.history.column="forward",e.history.index=0),w()}function F(t,o){const r=typeof t=="string"?t:t.url,a=typeof t=="string"?t:t.title||t.url,n=document.createElement("div");n.className="history-item",n.tabIndex=0,n.dataset.delta=o,n.onclick=()=>{chrome.runtime.sendMessage({action:"NAVIGATE_HISTORY",delta:o}),u()},n.onkeydown=h=>{(h.key==="Enter"||h.key===" ")&&(h.preventDefault(),chrome.runtime.sendMessage({action:"NAVIGATE_HISTORY",delta:o}),u())};const c=document.createElement("img");c.className="history-favicon";try{const h=new URL(chrome.runtime.getURL("/_favicon/"));h.searchParams.set("pageUrl",r),h.searchParams.set("size","16"),c.src=h.toString()}catch{}const i=document.createElement("div");i.className="history-item-content";const l=document.createElement("div");l.className="history-item-title",l.textContent=a,l.title=a;const d=document.createElement("div");d.className="history-item-url";try{const h=new URL(r);d.textContent=h.hostname+h.pathname}catch{d.textContent=r}return d.title=r,i.appendChild(l),i.appendChild(d),n.appendChild(c),n.appendChild(i),n}function w(){const t=e.history.backEls||[],o=e.history.forwardEls||[];for(const c of t)c.classList.remove("selected");for(const c of o)c.classList.remove("selected");const r=e.history.column==="forward"?o:t;if(!r.length)return;const a=Math.min(Math.max(0,e.history.index),r.length-1);e.history.index=a;const n=r[a];n&&(n.classList.add("selected"),n.scrollIntoView({block:"nearest"}))}function ne(){const t=e.history.backEls||[],o=e.history.forwardEls||[],a=(e.history.column==="forward"?o:t)[e.history.index];if(!a)return;const n=Number(a.dataset.delta);Number.isFinite(n)&&(chrome.runtime.sendMessage({action:"NAVIGATE_HISTORY",delta:n}),u())}function _(t){return{grey:"#bdc1c6",blue:"#8ab4f8",red:"#f28b82",yellow:"#fdd663",green:"#81c995",pink:"#ff8bcb",purple:"#c58af9",cyan:"#78d9ec",orange:"#fcad70"}[t]||t}function se(t){try{const o=t.target;if(o.dataset.action==="close"||o.classList.contains("tab-close-btn")){t.stopPropagation();const a=parseInt(o.dataset.tabId||o.parentElement.dataset.tabId),n=parseInt(o.dataset.tabIndex||o.parentElement.dataset.tabIndex);a&&!Number.isNaN(a)&&D(a,n);return}if(o.dataset.action==="mute"||o.closest(".tab-mute-btn")){t.stopPropagation();const a=o.closest(".tab-mute-btn"),n=parseInt(a.dataset.tabId);n&&!Number.isNaN(n)&&de(n,a);return}const r=o.closest(".tab-card");if(r){if(e.viewMode==="recent"||r.dataset.recent==="1"){const n=r.dataset.sessionId;n&&W(n);return}if(r.dataset.webSearch==="1"){const n=r.dataset.searchQuery;n&&(window.open(`https://www.google.com/search?q=${encodeURIComponent(n)}`,"_blank"),u());return}const a=parseInt(r.dataset.tabId);a&&!Number.isNaN(a)?N(a):console.error("[TAB SWITCHER] Invalid tab ID in card:",r)}}catch(o){console.error("[TAB SWITCHER] Error in handleGridClick:",o)}}function q(){return((e.domCache?.searchBox&&typeof e.domCache.searchBox.value=="string"?e.domCache.searchBox.value:"")||"").trim().startsWith(",")}function R(t){if(!e.isOverlayVisible)return;const o=t.target===e.domCache.searchBox,r=q()&&e.history.active,n=r&&["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Enter"].includes(t.key);if(o&&t.key!=="Escape"&&!n)return;const c=performance.now();if(c-e.lastKeyTime<e.keyThrottleMs){t.preventDefault();return}e.lastKeyTime=c;try{if(r)switch(t.key){case"Escape":t.preventDefault(),u();return;case"Enter":t.preventDefault(),ne();return;case"ArrowDown":{t.preventDefault();const i=e.history.column==="forward"?e.history.forwardEls:e.history.backEls;i.length&&(e.history.index=Math.min(e.history.index+1,i.length-1),w());return}case"ArrowUp":{t.preventDefault(),(e.history.column==="forward"?e.history.forwardEls:e.history.backEls).length&&(e.history.index=Math.max(e.history.index-1,0),w());return}case"ArrowLeft":{t.preventDefault(),e.history.column==="forward"&&e.history.backEls.length&&(e.history.column="back",e.history.index=Math.min(e.history.index,e.history.backEls.length-1),w());return}case"ArrowRight":{t.preventDefault(),e.history.column==="back"&&e.history.forwardEls.length&&(e.history.column="forward",e.history.index=Math.min(e.history.index,e.history.forwardEls.length-1),w());return}}switch(t.key){case"Escape":t.preventDefault(),u();break;case"Enter":if(t.preventDefault(),e.filteredTabs.length>0&&e.selectedIndex>=0&&e.selectedIndex<e.filteredTabs.length){const i=e.filteredTabs[e.selectedIndex];i&&(e.viewMode==="recent"&&i.sessionId?W(i.sessionId):i.id&&N(i.id))}break;case"Tab":t.preventDefault(),t.shiftKey?C():E();break;case"ArrowRight":t.preventDefault(),Y();break;case"ArrowLeft":t.preventDefault(),Q();break;case"ArrowDown":t.preventDefault(),E();break;case"ArrowUp":t.preventDefault(),C();break;case"Delete":if(e.viewMode!=="recent"&&e.filteredTabs.length>0&&e.selectedIndex>=0&&e.selectedIndex<e.filteredTabs.length){t.preventDefault();const i=e.filteredTabs[e.selectedIndex];i?.id&&D(i.id,e.selectedIndex)}break;case"g":case"G":if(t.altKey&&(t.preventDefault(),e.viewMode!=="recent"&&e.filteredTabs.length>0&&e.selectedIndex>=0&&e.selectedIndex<e.filteredTabs.length)){const i=e.filteredTabs[e.selectedIndex];i?.id&&he(i.id)}break}}catch(i){console.error("[TAB SWITCHER] Error in handleKeyDown:",i)}}function B(){}function ie(t){try{if(q()&&e.history.active&&["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Enter"].includes(t.key))return;if(["Delete","Tab","ArrowDown","ArrowUp","ArrowRight","ArrowLeft","Enter"].includes(t.key)){const n=performance.now();if(n-e.lastKeyTime<e.keyThrottleMs){t.preventDefault();return}e.lastKeyTime=n}if(t.key==="."&&(t.target.value||"").length===0){t.preventDefault(),e.viewMode==="recent"?I():O();return}if(t.key==="Backspace"){if((t.target.value||"").length===0&&e.viewMode==="recent"){t.preventDefault(),I();return}return}if(t.key==="Delete"){if(t.preventDefault(),e.viewMode!=="recent"&&e.filteredTabs.length>0&&e.selectedIndex>=0&&e.selectedIndex<e.filteredTabs.length){const n=e.filteredTabs[e.selectedIndex];n?.id&&D(n.id,e.selectedIndex)}return}if(t.key==="Tab"){t.preventDefault(),t.shiftKey?C():E();return}if(t.key==="ArrowDown"){t.preventDefault(),E();return}if(t.key==="ArrowUp"){t.preventDefault(),C();return}if(t.key==="ArrowRight"){t.preventDefault(),Y();return}if(t.key==="ArrowLeft"){t.preventDefault(),Q();return}if(t.key==="Enter"){if(t.preventDefault(),e.filteredTabs.length>0&&e.selectedIndex>=0&&e.selectedIndex<e.filteredTabs.length){const n=e.filteredTabs[e.selectedIndex];e.viewMode==="recent"&&n?.sessionId?W(n.sessionId):n?.isWebSearch?(window.open(`https://www.google.com/search?q=${encodeURIComponent(n.searchQuery)}`,"_blank"),u()):n?.id&&N(n.id)}return}}catch(o){console.error("[TAB SWITCHER] Error in handleSearchKeydown:",o)}}function L(){if(!e.domCache.grid)return 1;const t=e.domCache.grid,o=t.querySelectorAll(".tab-card");if(o.length===0)return 1;const r=window.getComputedStyle(t),a=parseFloat(r.columnGap)||0,n=t.clientWidth||t.offsetWidth||0,c=o[0].clientWidth||o[0].offsetWidth||0;return!n||!c?1:Math.max(1,Math.floor((n+a)/(c+a)))}function ce(){try{if(!e.filteredTabs||e.filteredTabs.length===0){console.warn("[TAB SWITCHER] No tabs available for navigation");return}e.selectedIndex<0||e.selectedIndex>=e.filteredTabs.length?e.selectedIndex=0:(e.selectedIndex=e.selectedIndex+1,e.selectedIndex>=e.filteredTabs.length&&(e.selectedIndex=0)),T()}catch(t){console.error("[TAB SWITCHER] Error in selectNext:",t)}}function Y(){try{if(!e.filteredTabs||e.filteredTabs.length===0){console.warn("[TAB SWITCHER] No tabs available for navigation");return}const t=L(),o=e.selectedIndex+1;if(Math.floor(o/t)===Math.floor(e.selectedIndex/t))if(o<e.filteredTabs.length)e.selectedIndex=o;else{const r=Math.floor(e.selectedIndex/t)*t;e.selectedIndex=r}else{const r=Math.floor(e.selectedIndex/t)*t;e.selectedIndex=r}T()}catch(t){console.error("[TAB SWITCHER] Error in selectRight:",t)}}function Q(){try{if(!e.filteredTabs||e.filteredTabs.length===0){console.warn("[TAB SWITCHER] No tabs available for navigation");return}const t=L(),o=Math.floor(e.selectedIndex/t)*t;if(e.selectedIndex-o>0)e.selectedIndex=e.selectedIndex-1;else{const a=Math.min(o+t-1,e.filteredTabs.length-1);e.selectedIndex=a}T()}catch(t){console.error("[TAB SWITCHER] Error in selectLeft:",t)}}function E(){try{if(!e.filteredTabs||e.filteredTabs.length===0){console.warn("[TAB SWITCHER] No tabs available for navigation");return}const t=L(),o=Math.floor(e.selectedIndex/t),r=e.selectedIndex-o*t,a=(o+1)*t+r;a<e.filteredTabs.length?e.selectedIndex=a:e.selectedIndex=0,T()}catch(t){console.error("[TAB SWITCHER] Error in selectDown:",t)}}function C(){try{if(!e.filteredTabs||e.filteredTabs.length===0){console.warn("[TAB SWITCHER] No tabs available for navigation");return}const t=L(),o=Math.floor(e.selectedIndex/t),r=e.selectedIndex-o*t;if(o>0)e.selectedIndex=(o-1)*t+r;else{const n=(Math.ceil(e.filteredTabs.length/t)-1)*t+r;e.selectedIndex=Math.min(n,e.filteredTabs.length-1)}T()}catch(t){console.error("[TAB SWITCHER] Error in selectUp:",t)}}function le(){try{document.activeElement&&document.activeElement!==document.body&&document.activeElement!==e.host&&document.activeElement.blur(),document.querySelectorAll("iframe").forEach(o=>{try{o.contentDocument?.activeElement&&o.contentDocument.activeElement.blur()}catch{}})}catch(t){console.debug("[TAB SWITCHER] Error blurring page elements:",t)}}function y(t){return t.target===e.host?!0:(t.composedPath?t.composedPath():[]).some(r=>r===e.host||r===e.shadowRoot||r===e.overlay)}function A(t){e.isOverlayVisible&&(y(t)||(t.stopPropagation(),t.stopImmediatePropagation(),t.preventDefault(),t.target&&typeof t.target.blur=="function"&&t.target.blur(),e.domCache?.searchBox&&e.domCache.searchBox.focus()))}function b(t){if(e.isOverlayVisible&&!y(t)){if(t.stopPropagation(),t.stopImmediatePropagation(),t.preventDefault(),e.domCache?.searchBox&&(e.domCache.searchBox.focus(),t.key&&t.key.length===1&&!t.ctrlKey&&!t.altKey&&!t.metaKey)){const o=e.domCache.searchBox,r=o.selectionStart||0,a=o.selectionEnd||0,n=o.value;o.value=n.slice(0,r)+t.key+n.slice(a),o.setSelectionRange(r+1,r+1),o.dispatchEvent(new Event("input",{bubbles:!0}))}return}}function g(t){if(e.isOverlayVisible&&!y(t))if(t.stopPropagation(),t.stopImmediatePropagation(),t.preventDefault(),t.type==="beforeinput"&&t.data&&e.domCache?.searchBox){const o=e.domCache.searchBox;o.focus();const r=o.selectionStart||0,a=o.selectionEnd||0,n=o.value;o.value=n.slice(0,r)+t.data+n.slice(a),o.setSelectionRange(r+t.data.length,r+t.data.length),o.dispatchEvent(new Event("input",{bubbles:!0}))}else e.domCache?.searchBox&&e.domCache.searchBox.focus()}function v(t){e.isOverlayVisible&&(y(t)||(t.stopPropagation(),t.stopImmediatePropagation(),t.preventDefault()))}function J(t){e.isOverlayVisible&&(y(t)||(t.stopPropagation(),t.stopImmediatePropagation(),t.preventDefault(),t.target&&typeof t.target.blur=="function"&&t.target.blur(),e.domCache?.searchBox&&e.domCache.searchBox.focus()))}function k(t){e.isOverlayVisible&&(y(t)||(t.stopPropagation(),t.stopImmediatePropagation(),t.preventDefault()))}function u(){try{if(!e.isOverlayVisible||e.isClosing)return;e.isClosing=!0,requestAnimationFrame(()=>{e.overlay&&(e.overlay.style.opacity="0"),e.closeTimeout&&clearTimeout(e.closeTimeout),e.closeTimeout=setTimeout(()=>{e.closeTimeout=null,e.isClosing=!1,e.overlay&&(e.overlay.style.display="none"),e.isOverlayVisible=!1,e.focusInterval&&(clearInterval(e.focusInterval),e.focusInterval=null),document.removeEventListener("keydown",R),document.removeEventListener("keyup",B),document.removeEventListener("focus",A,!0),document.removeEventListener("focusin",J,!0),document.removeEventListener("keydown",b,!0),document.removeEventListener("keypress",b,!0),document.removeEventListener("keyup",b,!0),document.removeEventListener("input",g,!0),document.removeEventListener("beforeinput",g,!0),document.removeEventListener("textInput",g,!0),document.removeEventListener("click",k,!0),document.removeEventListener("mousedown",k,!0),document.removeEventListener("compositionstart",v,!0),document.removeEventListener("compositionupdate",v,!0),document.removeEventListener("compositionend",v,!0),e.intersectionObserver&&(e.intersectionObserver.disconnect(),e.intersectionObserver=null)},200)})}catch(t){console.error("[TAB SWITCHER] Error in closeOverlay:",t),e.isOverlayVisible=!1,e.isClosing=!1,e.focusInterval&&(clearInterval(e.focusInterval),e.focusInterval=null);try{document.removeEventListener("keydown",R),document.removeEventListener("keyup",B),document.removeEventListener("focus",A,!0)}catch{}}}function N(t){try{if(!t||typeof t!="number"){console.error("[TAB SWITCHER] Invalid tab ID:",t);return}try{chrome.runtime.sendMessage({action:"switchToTab",tabId:t},()=>{chrome.runtime.lastError&&console.debug("[TAB SWITCHER] SW not ready:",chrome.runtime.lastError.message)})}catch(o){console.debug("[TAB SWITCHER] sendMessage warn:",o?.message||o)}u()}catch(o){console.error("[TAB SWITCHER] Exception in switchToTab:",o),u()}}function W(t){try{if(!t)return;try{chrome.runtime.sendMessage({action:"restoreSession",sessionId:t},()=>{chrome.runtime.lastError&&console.debug("[TAB SWITCHER] SW not ready (restoreSession):",chrome.runtime.lastError.message)})}catch(o){console.debug("[TAB SWITCHER] sendMessage warn:",o?.message||o)}u()}catch(o){console.error("[TAB SWITCHER] Exception in restoreSession:",o),u()}}function D(t,o){try{if(!t||typeof t!="number"){console.error("[TAB SWITCHER] Invalid tab ID for closing:",t);return}if(!e.currentTabs.some(a=>a&&a.id===t)){console.warn("[TAB SWITCHER] Tab no longer exists:",t),e.filteredTabs=e.filteredTabs.filter(a=>a&&a.id!==t),e.currentTabs=e.currentTabs.filter(a=>a&&a.id!==t),e.selectedIndex>=e.filteredTabs.length&&(e.selectedIndex=Math.max(0,e.filteredTabs.length-1)),e.filteredTabs.length>0?e.filteredTabs.length>50?f(e.filteredTabs):m(e.filteredTabs):u();return}chrome.runtime.sendMessage({action:"closeTab",tabId:t},a=>{if(chrome.runtime.lastError){console.error("[TAB SWITCHER] Error closing tab:",chrome.runtime.lastError.message);return}a?.success&&(e.currentTabs=e.currentTabs.filter(n=>n&&n.id!==t),e.filteredTabs=e.filteredTabs.filter(n=>n&&n.id!==t),e.filteredTabs.length>0?(e.selectedIndex>=e.filteredTabs.length&&(e.selectedIndex=Math.max(0,e.filteredTabs.length-1)),e.filteredTabs.length>50?f(e.filteredTabs):m(e.filteredTabs),e.domCache.searchBox&&e.domCache.searchBox.focus()):u())})}catch(r){console.error("[TAB SWITCHER] Exception in closeTab:",r)}}function de(t,o){try{if(!t)return;chrome.runtime.sendMessage({action:"toggleMute",tabId:t},r=>{if(chrome.runtime.lastError){console.error("[TAB SWITCHER] Error toggling mute:",chrome.runtime.lastError);return}if(r&&r.success){const a=r.muted;a?(o.classList.add("muted"),o.title="Unmute tab",o.innerHTML='<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>'):(o.classList.remove("muted"),o.title="Mute tab",o.innerHTML='<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>');const n=e.currentTabs.find(c=>c.id===t);n&&(n.mutedInfo||(n.mutedInfo={muted:!1}),n.mutedInfo.muted=a)}})}catch(r){console.error("[TAB SWITCHER] Exception in toggleMute:",r)}}function z(t){e.viewMode=t,e.domCache?.backBtn&&(e.domCache.backBtn.style.display=t==="recent"?"flex":"none"),e.domCache?.recentBtn&&(e.domCache.recentBtn.style.display=t==="recent"?"none":"inline-flex"),e.domCache?.searchBox&&(e.domCache.searchBox.placeholder=t==="recent"?"Search recently closed tabs...":"Search tabs by title or URL..."),e.domCache?.helpText&&(t==="recent"?e.domCache.helpText.innerHTML=`
        <span><kbd>Alt+Q</kbd> Navigate</span>
        <span><kbd>Enter</kbd> Restore</span>
        <span><kbd>Backspace</kbd> Active Tabs</span>
        <span><kbd>Esc</kbd> Exit</span>
      `:e.domCache.helpText.innerHTML=`
        <span><kbd>Alt+Q</kbd> Navigate</span>
        <span><kbd>Enter</kbd> Switch</span>
        <span><kbd>Delete</kbd> Close</span>
        <span><kbd>.</kbd> Recent Tabs</span>
        <span><kbd>/</kbd> History</span>
        <span><kbd>?</kbd> Web Search</span>
        <span><kbd>Esc</kbd> Exit</span>
      `)}function he(t){try{if(!t||typeof t!="number")return;chrome.runtime.sendMessage({action:"createGroup",tabId:t},o=>{if(chrome.runtime.lastError){console.error("[TAB SWITCHER] Error creating group:",chrome.runtime.lastError.message);return}o?.success&&u()})}catch(o){console.error("[TAB SWITCHER] Exception in createGroup:",o)}}function I(){if(e.viewMode==="active")return;z("active"),e.currentTabs=e.activeTabs||[];const t=H(e.currentTabs);e.filteredTabs=t,e.selectedIndex=0,e.domCache.grid&&(e.domCache.grid.classList.remove("recent-mode"),e.domCache.grid.classList.remove("search-mode")),e.filteredTabs.length>50?f(e.filteredTabs):m(e.filteredTabs),e.domCache.searchBox&&(e.domCache.searchBox.value="",e.domCache.searchBox.focus())}async function O(){if(e.viewMode==="recent")return;z("recent");let t=[];try{t=await new Promise(o=>{try{chrome.runtime.sendMessage({action:"getRecentlyClosed",maxResults:10},r=>{if(chrome.runtime.lastError){console.debug("[TAB SWITCHER] Runtime error:",chrome.runtime.lastError.message),o([]);return}r?.success?o(r.items||[]):o([])})}catch{o([])}})}catch(o){console.debug("[TAB SWITCHER] Failed to load recently closed:",o)}e.recentItems=t.map((o,r)=>({id:void 0,title:o.title,url:o.url,favIconUrl:o.favIconUrl,screenshot:null,sessionId:o.sessionId,index:r})),e.currentTabs=e.recentItems,e.filteredTabs=e.recentItems,e.selectedIndex=0,e.domCache.grid&&e.domCache.grid.classList.add("recent-mode"),m(e.filteredTabs),e.domCache.searchBox&&e.domCache.searchBox.focus()}function ue(t){if(!t)return;e.collapsedGroups.has(t)?e.collapsedGroups.delete(t):e.collapsedGroups.add(t);const o=e.currentTabs,r=H(o);e.filteredTabs=r,r.length>50?f(r):m(r)}function pe(){let t=null,o=0;const r=100,a=300,n=50;return c=>{const i=performance.now(),l=i-o,d=e.currentTabs.length>=n;t&&clearTimeout(t),!d&&l>=r?(o=i,K(c)):t=setTimeout(()=>{o=performance.now(),K(c)},d?a:r)}}function K(t){try{const o=t?.target?.value&&typeof t.target.value=="string"?t.target.value:e.domCache?.searchBox?.value??"",r=String(o).trim();if(r.startsWith(",")){e.history.active=!0,e.domCache.grid&&(e.domCache.grid.classList.add("search-mode"),e.domCache.grid.classList.remove("recent-mode")),e.domCache.helpText&&(e.domCache.helpText.innerHTML=`
            <span><kbd>,</kbd> History Mode</span>
            <span><kbd>Click</kbd> Navigate</span>
            <span><kbd>Backspace</kbd> Exit History</span>
            <span><kbd>Esc</kbd> Close</span>
          `),chrome.runtime.sendMessage({action:"GET_TAB_HISTORY"},i=>{if(chrome.runtime.lastError){console.error("[TAB SWITCHER] History error:",chrome.runtime.lastError);return}console.log("[TAB SWITCHER] Received history:",i),ae(i||{back:[],forward:[]})});return}if(e.history.active=!1,e.history.backEls=[],e.history.forwardEls=[],r.startsWith("?")){const i=r.substring(1).trim(),l={id:"web-search",title:i?`Search Web for "${i}"`:"Type to search web...",url:i?`https://www.google.com/search?q=${encodeURIComponent(i)}`:"",favIconUrl:"https://www.google.com/favicon.ico",isWebSearch:!0,searchQuery:i};e.filteredTabs=[l],e.selectedIndex=0,e.domCache.grid&&(e.domCache.grid.classList.add("search-mode"),e.domCache.grid.classList.remove("recent-mode")),m(e.filteredTabs);return}e.domCache.grid&&e.domCache.grid.classList.remove("search-mode");const a=!!(t&&typeof t.inputType=="string"&&t.inputType==="deleteContentBackward");if(r==="."&&!a){e.domCache.searchBox.value="",e.viewMode==="recent"?I():O();return}if(!r){e.filteredTabs=e.currentTabs,e.selectedIndex=0,e.currentTabs.length>50?f(e.currentTabs):m(e.currentTabs);return}const c=e.currentTabs.map(i=>{const l=$(i.title,r),d=$(i.url,r),h=l.score>d.score?l:d;return{tab:i,match:h.match,score:h.score}}).filter(i=>i.match).sort((i,l)=>l.score-i.score).map(i=>i.tab);e.filteredTabs=c,e.selectedIndex=0,c.length>50?f(c):m(c)}catch(o){console.error("[TAB SWITCHER] Error in handleSearch:",o),e.filteredTabs=e.currentTabs,e.selectedIndex=0,m(e.currentTabs)}}function $(t,o){if(!t)return{match:!1,score:0};const r=t.toLowerCase(),a=o.toLowerCase();if(a.length===0)return{match:!0,score:1};if(r===a)return{match:!0,score:100};if(r.startsWith(a))return{match:!0,score:80+a.length/r.length*10};if(r.includes(a))return{match:!0,score:50+a.length/r.length*10};let n=0,c=0,i=0,l=0,d=-1;for(;n<r.length&&c<a.length;){if(r[n]===a[c]){d===-1&&(d=n);let h=1;l>0&&(h+=2+l),(n===0||r[n-1]===" "||r[n-1]==="."||r[n-1]==="/"||r[n-1]==="-")&&(h+=3),i+=h,l++,c++}else l=0;n++}return c<a.length?{match:!1,score:0}:(i-=(r.length-a.length)*.1,d>0&&(i-=d*.5),{match:!0,score:Math.max(1,i)})}function me(){try{if(!e.host||!e.host.isConnected){e.shadowRoot=null,e.styleElement=null;const t=document.getElementById(V);if(t)e.host=t;else{const o=document.createElement("tab-switcher-mount");o.id=V,o.style.cssText=`
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
      `,(document.body||document.documentElement).appendChild(o),e.host=o}}if(e.shadowRoot||(e.host.shadowRoot?e.shadowRoot=e.host.shadowRoot:e.shadowRoot=e.host.attachShadow({mode:"open"})),!e.styleElement||!e.shadowRoot.contains(e.styleElement)){const t=document.createElement("style");t.textContent=ee,e.shadowRoot.appendChild(t),e.styleElement=t}return e.shadowRoot}catch(t){return console.error("[TAB SWITCHER] Failed to initialize shadow root:",t),null}}function fe(){if(e.overlay)return;const t=me();if(!t)return;const o=document.createElement("div");o.id="visual-tab-switcher-overlay",o.className="tab-switcher-overlay",o.style.willChange="opacity";const r=document.createElement("div");r.className="tab-switcher-backdrop",o.appendChild(r);const a=document.createElement("div");a.className="tab-switcher-container",a.style.transform="translate3d(0, 0, 0)";const n=document.createElement("div");n.className="tab-switcher-search-row";const c=document.createElement("div");c.className="tab-switcher-search-wrap";const i=document.createElement("input");i.type="text",i.className="tab-switcher-search",i.placeholder="Search tabs by title or URL...",i.autocomplete="off";const l=document.createElement("button");l.type="button",l.className="recent-back-btn",l.title="Back to Active Tabs",l.textContent="←",l.addEventListener("click",()=>I());const d=document.createElement("button");d.className="recently-closed-btn",d.type="button",d.textContent="Recently closed tabs",d.addEventListener("click",()=>O());const h=document.createElement("div");h.className="search-icon",h.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',c.appendChild(l),c.appendChild(h),c.appendChild(i),n.appendChild(c),n.appendChild(d),a.appendChild(n);const s=document.createElement("div");s.className="tab-switcher-grid",s.id="tab-switcher-grid",s.setAttribute("role","listbox"),s.setAttribute("aria-label","Open tabs"),s.style.transform="translate3d(0, 0, 0)",a.appendChild(s);const p=document.createElement("div");p.className="tab-switcher-help",p.innerHTML=`
     <span><kbd>Alt+Q</kbd> Navigate</span>
     <span><kbd>Enter</kbd> Switch</span>
     <span><kbd>Delete</kbd> Close</span>
     <span><kbd>.</kbd> Recent Tabs</span>
     <span><kbd>/</kbd> History</span>
     <span><kbd>?</kbd> Web Search</span>
     <span><kbd>Esc</kbd> Exit</span>
   `,a.appendChild(p),o.appendChild(a),i.addEventListener("input",pe()),i.addEventListener("keydown",ie),r.addEventListener("click",u),s.addEventListener("click",se),e.overlay=o,e.domCache={grid:s,searchBox:i,container:a,searchWrap:c,backBtn:l,recentBtn:d,helpText:p},t.appendChild(o),console.log("[PERF] Overlay created with GPU acceleration and event delegation")}function be(t,o,r=[]){if(performance.now(),console.log(`[TAB SWITCHER] Opening with ${t.length} tabs and ${r.length} groups`),e.isOverlayVisible&&!e.isClosing)return;e.closeTimeout&&(clearTimeout(e.closeTimeout),e.closeTimeout=null),e.isClosing=!1,e.isOverlayVisible=!0,fe(),e.overlay&&(e.overlay.style.display="flex",e.overlay.style.opacity="0"),e.activeTabs=t,e.currentTabs=t,e.filteredTabs=H(t),e.groups=r,z("active");const a=t.findIndex(n=>n.id===o);t.length>1&&a===0?e.selectedIndex=1:(a>0,e.selectedIndex=0),t.length>50?(console.log("[PERF] Using virtual scrolling for",t.length,"tabs"),f(t)):m(t),e.overlay.style.display="flex",e.overlay.style.opacity="0",e.isOverlayVisible=!0,le(),e.domCache.searchBox&&(e.domCache.searchBox.value="",e.domCache.searchBox.focus()),requestAnimationFrame(()=>{requestAnimationFrame(()=>{e.overlay&&(e.overlay.style.opacity="1")})}),document.addEventListener("keydown",R),document.addEventListener("keyup",B),document.addEventListener("focus",A,!0),document.addEventListener("focusin",J,!0),document.addEventListener("keydown",b,!0),document.addEventListener("keypress",b,!0),document.addEventListener("keyup",b,!0),document.addEventListener("input",g,!0),document.addEventListener("beforeinput",g,!0),document.addEventListener("textInput",g,!0),document.addEventListener("click",k,!0),document.addEventListener("mousedown",k,!0),document.addEventListener("compositionstart",v,!0),document.addEventListener("compositionupdate",v,!0),document.addEventListener("compositionend",v,!0),e.focusInterval&&clearInterval(e.focusInterval),e.focusInterval=setInterval(()=>{e.isOverlayVisible&&e.domCache.searchBox&&document.activeElement!==e.domCache.searchBox&&e.domCache.searchBox.focus()},100)}console.log("═══════════════════════════════════════════════════════");console.log("Visual Tab Switcher - Content Script Loaded");console.log("Features: Virtual Scrolling, Event Delegation, GPU Acceleration");console.log("Target: <16ms interactions, 60fps, lazy loading");console.log("═══════════════════════════════════════════════════════");chrome.runtime.onMessage.addListener((t,o,r)=>{if(t.action==="showTabSwitcher"){if(e.isOverlayVisible)return ce(),S(!0),r({success:!0,advanced:!0}),!0;be(t.tabs,t.activeTabId,t.groups),r({success:!0})}return!0});
})()
})()
