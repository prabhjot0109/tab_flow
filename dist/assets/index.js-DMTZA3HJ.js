(function(){(function(){function x(t="navigate"){try{if(document.hidden&&t==="navigate")return;const r={action:"REPORT_NAVIGATION",url:window.location.href,title:document.title,navType:t};chrome.runtime.sendMessage(r,a=>{chrome.runtime.lastError})}catch{}}x();window.addEventListener("popstate",()=>x("back_forward"));window.addEventListener("hashchange",()=>x("navigate"));const O=new MutationObserver(()=>{x("title_update")}),U=document.querySelector("title");if(U)O.observe(U,{childList:!0,characterData:!0,subtree:!0});else{const t=new MutationObserver(r=>{const a=document.querySelector("title");a&&(O.observe(a,{childList:!0,characterData:!0,subtree:!0}),t.disconnect())});t.observe(document.head||document.documentElement,{childList:!0,subtree:!0})}const Q=history.pushState;history.pushState=function(...t){Q.apply(this,t),x("navigate")};const J=history.replaceState;history.replaceState=function(...t){J.apply(this,t),x("navigate")};const e={overlay:null,currentTabs:[],activeTabs:[],filteredTabs:[],selectedIndex:0,isOverlayVisible:!1,viewMode:"active",recentItems:[],host:null,shadowRoot:null,styleElement:null,domCache:{grid:null,searchBox:null,container:null,searchWrap:null,backBtn:null,recentBtn:null},virtualScroll:{startIndex:0,endIndex:0,visibleCount:20,bufferCount:5},lastKeyTime:0,keyThrottleMs:16,resizeObserver:null,intersectionObserver:null,focusInterval:null,history:{active:!1,backEls:[],forwardEls:[],column:"back",index:0}},V="tab-switcher-host",X=`/* Visual Tab Switcher - Modern Glass UI 2.0 */
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
`;function m(t){const r=performance.now(),a=e.domCache.grid;if(a.innerHTML="",t.length===0){const l=document.createElement("div");l.className="tab-switcher-empty",l.textContent="No tabs found",a.appendChild(l);return}const o=document.createDocumentFragment();t.forEach((l,s)=>{const c=_(l,s);c.dataset.tabIndex=s,o.appendChild(c)}),a.appendChild(o),S(!1);const n=performance.now()-r;console.log(`[PERF] Rendered ${t.length} tabs in ${n.toFixed(2)}ms`)}function p(t){const r=performance.now(),a=e.domCache.grid;if(a.innerHTML="",t.length===0){const h=document.createElement("div");h.className="tab-switcher-empty",h.textContent="No tabs found",a.appendChild(h);return}const o=e.virtualScroll.visibleCount,n=e.virtualScroll.bufferCount,l=Math.max(0,e.selectedIndex-n),s=Math.min(t.length,e.selectedIndex+o+n);e.virtualScroll.startIndex=l,e.virtualScroll.endIndex=s;const c=t.length*180;a.style.minHeight=`${c}px`;const i=document.createDocumentFragment();for(let h=l;h<s;h++){const b=t[h],A=_(b,h);A.style.position="relative",A.style.top=`${h*180}px`,i.appendChild(A)}a.appendChild(i),Z(),S(!1);const d=performance.now()-r;console.log(`[PERF] Virtual rendered ${s-l} of ${t.length} tabs in ${d.toFixed(2)}ms`)}function _(t,r){const a=document.createElement("div");a.className="tab-card",t&&typeof t.id=="number"&&(a.dataset.tabId=t.id),t?.sessionId&&(a.dataset.sessionId=t.sessionId,a.dataset.recent="1"),t?.isWebSearch&&(a.dataset.webSearch="1",a.dataset.searchQuery=t.searchQuery),a.dataset.tabIndex=r,a.setAttribute("role","option"),a.setAttribute("aria-selected",r===e.selectedIndex?"true":"false"),a.setAttribute("aria-label",`${t.title} - ${t.url}`),a.tabIndex=-1,a.style.transform="translate3d(0, 0, 0)";const o=t.screenshot&&typeof t.screenshot=="string"&&t.screenshot.length>0;o?a.classList.add("has-screenshot"):a.classList.add("has-favicon"),r===e.selectedIndex&&a.classList.add("selected"),t.pinned&&a.classList.add("pinned");const n=document.createElement("div");if(n.className="tab-thumbnail",!t.sessionId&&!t.isWebSearch){const i=document.createElement("button");i.className="tab-mute-btn",i.title=t.mutedInfo?.muted?"Unmute tab":"Mute tab",i.dataset.action="mute",i.dataset.tabId=t.id,t.mutedInfo?.muted?(i.classList.add("muted"),i.innerHTML='<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>'):(i.innerHTML='<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',t.audible&&(i.style.opacity="0.9")),n.appendChild(i)}if(t.sessionId){a.classList.add("recent-item");const i=F(t);n.appendChild(i)}else if(o){const i=document.createElement("img");i.className="screenshot-img",i.dataset.src=t.screenshot,i.alt=t.title,Math.abs(r-e.selectedIndex)<10&&(i.src=t.screenshot),n.appendChild(i)}else{const i=F(t);n.appendChild(i)}a.appendChild(n);const l=document.createElement("div");l.className="tab-info";const s=document.createElement("div");if(s.className="tab-header",t.favIconUrl&&o){const i=document.createElement("img");i.src=t.favIconUrl,i.className="tab-favicon",i.onerror=()=>{i.style.display="none"},s.appendChild(i)}const c=document.createElement("div");if(c.className="tab-title",c.textContent=t.title,c.title=t.title,s.appendChild(c),l.appendChild(s),o){const i=document.createElement("div");i.className="tab-url",i.textContent=t.url,i.title=t.url,l.appendChild(i)}if(a.appendChild(l),!t.sessionId&&!t.isWebSearch){const i=document.createElement("button");i.className="tab-close-btn",i.innerHTML="×",i.title="Close tab",i.dataset.action="close",t.id&&(i.dataset.tabId=t.id),a.appendChild(i)}return a}function F(t){const r=document.createElement("div");if(r.className="favicon-tile",t.favIconUrl){const a=document.createElement("img");a.src=t.favIconUrl,a.className="favicon-large",a.onerror=()=>{a.style.display="none";const o=document.createElement("div");o.className="favicon-letter",o.textContent=(t.title||"T")[0].toUpperCase(),r.appendChild(o)},r.appendChild(a)}else{const a=document.createElement("div");a.className="favicon-letter",a.textContent=(t.title||"T")[0].toUpperCase(),r.appendChild(a)}return r}function S(t){try{const r=e.domCache.grid;if(!r)return;r.querySelectorAll(".tab-card.selected").forEach(n=>{n.classList.remove("selected"),n.setAttribute("aria-selected","false")});const o=r.querySelector(`.tab-card[data-tab-index="${e.selectedIndex}"]`);if(!o)return;o.classList.add("selected"),o.setAttribute("aria-selected","true"),r.setAttribute("aria-activedescendant",o.id||`tab-card-${e.selectedIndex}`),o.id||(o.id=`tab-card-${e.selectedIndex}`),t&&requestAnimationFrame(()=>{o.scrollIntoView({behavior:"smooth",block:"nearest",inline:"nearest"})})}catch(r){console.error("[TAB SWITCHER] Error enforcing selection:",r)}}function T(){try{if(!e.domCache.grid)return;if(e.filteredTabs&&e.filteredTabs.length>50){const{startIndex:r,endIndex:a}=e.virtualScroll;(e.selectedIndex<r||e.selectedIndex>=a)&&p(e.filteredTabs)}S(!0)}catch(t){console.error("[TAB SWITCHER] Error in updateSelection:",t)}}function Z(){e.intersectionObserver&&e.intersectionObserver.disconnect(),e.intersectionObserver=new IntersectionObserver(r=>{r.forEach(a=>{if(a.isIntersecting){const o=a.target;o.dataset.src&&!o.src&&(o.src=o.dataset.src,e.intersectionObserver.unobserve(o))}})},{rootMargin:"100px"}),e.domCache.grid.querySelectorAll("img[data-src]").forEach(r=>{e.intersectionObserver.observe(r)})}function ee(t){const r=e.domCache.grid;if(!r)return;r.innerHTML="",r.className="tab-switcher-grid search-mode";const a=document.createElement("div");a.className="history-view",e.history.active=!0,e.history.backEls=[],e.history.forwardEls=[];const o=document.createElement("div");o.className="history-column";const n=document.createElement("div");if(n.className="history-column-header",n.textContent="← BACK",o.appendChild(n),t.back&&t.back.length>0){const c=document.createElement("div");c.className="history-items-container",t.back.forEach((i,d)=>{const h=P(i,-(d+1));h.dataset.column="back",h.dataset.index=String(d),c.appendChild(h),e.history.backEls.push(h)}),o.appendChild(c)}else{const c=document.createElement("div");c.className="tab-switcher-empty",c.textContent="No back history",c.style.padding="20px",c.style.textAlign="center",c.style.color="var(--text-muted)",o.appendChild(c)}const l=document.createElement("div");l.className="history-column";const s=document.createElement("div");if(s.className="history-column-header",s.textContent="FORWARD →",l.appendChild(s),t.forward&&t.forward.length>0){const c=document.createElement("div");c.className="history-items-container",t.forward.forEach((i,d)=>{const h=P(i,d+1);h.dataset.column="forward",h.dataset.index=String(d),c.appendChild(h),e.history.forwardEls.push(h)}),l.appendChild(c)}else{const c=document.createElement("div");c.className="tab-switcher-empty",c.textContent="No forward history",c.style.padding="20px",c.style.textAlign="center",c.style.color="var(--text-muted)",l.appendChild(c)}a.appendChild(o),a.appendChild(l),r.appendChild(a),e.history.backEls.length>0?(e.history.column="back",e.history.index=0):e.history.forwardEls.length>0&&(e.history.column="forward",e.history.index=0),w()}function P(t,r){const a=typeof t=="string"?t:t.url,o=typeof t=="string"?t:t.title||t.url,n=document.createElement("div");n.className="history-item",n.tabIndex=0,n.dataset.delta=r,n.onclick=()=>{chrome.runtime.sendMessage({action:"NAVIGATE_HISTORY",delta:r}),u()},n.onkeydown=d=>{(d.key==="Enter"||d.key===" ")&&(d.preventDefault(),chrome.runtime.sendMessage({action:"NAVIGATE_HISTORY",delta:r}),u())};const l=document.createElement("img");l.className="history-favicon";try{const d=new URL(chrome.runtime.getURL("/_favicon/"));d.searchParams.set("pageUrl",a),d.searchParams.set("size","16"),l.src=d.toString()}catch{}const s=document.createElement("div");s.className="history-item-content";const c=document.createElement("div");c.className="history-item-title",c.textContent=o,c.title=o;const i=document.createElement("div");i.className="history-item-url";try{const d=new URL(a);i.textContent=d.hostname+d.pathname}catch{i.textContent=a}return i.title=a,s.appendChild(c),s.appendChild(i),n.appendChild(l),n.appendChild(s),n}function w(){const t=e.history.backEls||[],r=e.history.forwardEls||[];for(const l of t)l.classList.remove("selected");for(const l of r)l.classList.remove("selected");const a=e.history.column==="forward"?r:t;if(!a.length)return;const o=Math.min(Math.max(0,e.history.index),a.length-1);e.history.index=o;const n=a[o];n&&(n.classList.add("selected"),n.scrollIntoView({block:"nearest"}))}function te(){const t=e.history.backEls||[],r=e.history.forwardEls||[],o=(e.history.column==="forward"?r:t)[e.history.index];if(!o)return;const n=Number(o.dataset.delta);Number.isFinite(n)&&(chrome.runtime.sendMessage({action:"NAVIGATE_HISTORY",delta:n}),u())}function re(t){try{const r=t.target;if(r.dataset.action==="close"||r.classList.contains("tab-close-btn")){t.stopPropagation();const o=parseInt(r.dataset.tabId||r.parentElement.dataset.tabId),n=parseInt(r.dataset.tabIndex||r.parentElement.dataset.tabIndex);o&&!Number.isNaN(o)&&D(o,n);return}if(r.dataset.action==="mute"||r.closest(".tab-mute-btn")){t.stopPropagation();const o=r.closest(".tab-mute-btn"),n=parseInt(o.dataset.tabId);n&&!Number.isNaN(n)&&se(n,o);return}const a=r.closest(".tab-card");if(a){if(e.viewMode==="recent"||a.dataset.recent==="1"){const n=a.dataset.sessionId;n&&N(n);return}if(a.dataset.webSearch==="1"){const n=a.dataset.searchQuery;n&&(window.open(`https://www.google.com/search?q=${encodeURIComponent(n)}`,"_blank"),u());return}const o=parseInt(a.dataset.tabId);o&&!Number.isNaN(o)?H(o):console.error("[TAB SWITCHER] Invalid tab ID in card:",a)}}catch(r){console.error("[TAB SWITCHER] Error in handleGridClick:",r)}}function $(){return((e.domCache?.searchBox&&typeof e.domCache.searchBox.value=="string"?e.domCache.searchBox.value:"")||"").trim().startsWith(",")}function R(t){if(!e.isOverlayVisible)return;const r=t.target===e.domCache.searchBox,a=$()&&e.history.active,n=a&&["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Enter"].includes(t.key);if(r&&t.key!=="Escape"&&!n)return;const l=performance.now();if(l-e.lastKeyTime<e.keyThrottleMs){t.preventDefault();return}e.lastKeyTime=l;try{if(a)switch(t.key){case"Escape":t.preventDefault(),u();return;case"Enter":t.preventDefault(),te();return;case"ArrowDown":{t.preventDefault();const s=e.history.column==="forward"?e.history.forwardEls:e.history.backEls;s.length&&(e.history.index=Math.min(e.history.index+1,s.length-1),w());return}case"ArrowUp":{t.preventDefault(),(e.history.column==="forward"?e.history.forwardEls:e.history.backEls).length&&(e.history.index=Math.max(e.history.index-1,0),w());return}case"ArrowLeft":{t.preventDefault(),e.history.column==="forward"&&e.history.backEls.length&&(e.history.column="back",e.history.index=Math.min(e.history.index,e.history.backEls.length-1),w());return}case"ArrowRight":{t.preventDefault(),e.history.column==="back"&&e.history.forwardEls.length&&(e.history.column="forward",e.history.index=Math.min(e.history.index,e.history.forwardEls.length-1),w());return}}switch(t.key){case"Escape":t.preventDefault(),u();break;case"Enter":if(t.preventDefault(),e.filteredTabs.length>0&&e.selectedIndex>=0&&e.selectedIndex<e.filteredTabs.length){const s=e.filteredTabs[e.selectedIndex];s&&(e.viewMode==="recent"&&s.sessionId?N(s.sessionId):s.id&&H(s.id))}break;case"Tab":t.preventDefault(),t.shiftKey?k():E();break;case"ArrowRight":t.preventDefault(),j();break;case"ArrowLeft":t.preventDefault(),q();break;case"ArrowDown":t.preventDefault(),E();break;case"ArrowUp":t.preventDefault(),k();break;case"Delete":if(e.viewMode!=="recent"&&e.filteredTabs.length>0&&e.selectedIndex>=0&&e.selectedIndex<e.filteredTabs.length){t.preventDefault();const s=e.filteredTabs[e.selectedIndex];s?.id&&D(s.id,e.selectedIndex)}break}}catch(s){console.error("[TAB SWITCHER] Error in handleKeyDown:",s)}}function M(){}function ae(t){try{if($()&&e.history.active&&["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Enter"].includes(t.key))return;if(["Delete","Tab","ArrowDown","ArrowUp","ArrowRight","ArrowLeft","Enter"].includes(t.key)){const n=performance.now();if(n-e.lastKeyTime<e.keyThrottleMs){t.preventDefault();return}e.lastKeyTime=n}if(t.key==="."&&(t.target.value||"").length===0){t.preventDefault(),e.viewMode==="recent"?I():z();return}if(t.key==="Backspace"){if((t.target.value||"").length===0&&e.viewMode==="recent"){t.preventDefault(),I();return}return}if(t.key==="Delete"){if(t.preventDefault(),e.viewMode!=="recent"&&e.filteredTabs.length>0&&e.selectedIndex>=0&&e.selectedIndex<e.filteredTabs.length){const n=e.filteredTabs[e.selectedIndex];n?.id&&D(n.id,e.selectedIndex)}return}if(t.key==="Tab"){t.preventDefault(),t.shiftKey?k():E();return}if(t.key==="ArrowDown"){t.preventDefault(),E();return}if(t.key==="ArrowUp"){t.preventDefault(),k();return}if(t.key==="ArrowRight"){t.preventDefault(),j();return}if(t.key==="ArrowLeft"){t.preventDefault(),q();return}if(t.key==="Enter"){if(t.preventDefault(),e.filteredTabs.length>0&&e.selectedIndex>=0&&e.selectedIndex<e.filteredTabs.length){const n=e.filteredTabs[e.selectedIndex];e.viewMode==="recent"&&n?.sessionId?N(n.sessionId):n?.isWebSearch?(window.open(`https://www.google.com/search?q=${encodeURIComponent(n.searchQuery)}`,"_blank"),u()):n?.id&&H(n.id)}return}}catch(r){console.error("[TAB SWITCHER] Error in handleSearchKeydown:",r)}}function L(){if(!e.domCache.grid)return 1;const t=e.domCache.grid,r=t.querySelectorAll(".tab-card");if(r.length===0)return 1;const a=window.getComputedStyle(t),o=parseFloat(a.columnGap)||0,n=t.clientWidth||t.offsetWidth||0,l=r[0].clientWidth||r[0].offsetWidth||0;return!n||!l?1:Math.max(1,Math.floor((n+o)/(l+o)))}function oe(){try{if(!e.filteredTabs||e.filteredTabs.length===0){console.warn("[TAB SWITCHER] No tabs available for navigation");return}e.selectedIndex<0||e.selectedIndex>=e.filteredTabs.length?e.selectedIndex=0:(e.selectedIndex=e.selectedIndex+1,e.selectedIndex>=e.filteredTabs.length&&(e.selectedIndex=0)),T()}catch(t){console.error("[TAB SWITCHER] Error in selectNext:",t)}}function j(){try{if(!e.filteredTabs||e.filteredTabs.length===0){console.warn("[TAB SWITCHER] No tabs available for navigation");return}const t=L(),r=e.selectedIndex+1;if(Math.floor(r/t)===Math.floor(e.selectedIndex/t))if(r<e.filteredTabs.length)e.selectedIndex=r;else{const a=Math.floor(e.selectedIndex/t)*t;e.selectedIndex=a}else{const a=Math.floor(e.selectedIndex/t)*t;e.selectedIndex=a}T()}catch(t){console.error("[TAB SWITCHER] Error in selectRight:",t)}}function q(){try{if(!e.filteredTabs||e.filteredTabs.length===0){console.warn("[TAB SWITCHER] No tabs available for navigation");return}const t=L(),r=Math.floor(e.selectedIndex/t)*t;if(e.selectedIndex-r>0)e.selectedIndex=e.selectedIndex-1;else{const o=Math.min(r+t-1,e.filteredTabs.length-1);e.selectedIndex=o}T()}catch(t){console.error("[TAB SWITCHER] Error in selectLeft:",t)}}function E(){try{if(!e.filteredTabs||e.filteredTabs.length===0){console.warn("[TAB SWITCHER] No tabs available for navigation");return}const t=L(),r=Math.floor(e.selectedIndex/t),a=e.selectedIndex-r*t,o=(r+1)*t+a;o<e.filteredTabs.length?e.selectedIndex=o:e.selectedIndex=0,T()}catch(t){console.error("[TAB SWITCHER] Error in selectDown:",t)}}function k(){try{if(!e.filteredTabs||e.filteredTabs.length===0){console.warn("[TAB SWITCHER] No tabs available for navigation");return}const t=L(),r=Math.floor(e.selectedIndex/t),a=e.selectedIndex-r*t;if(r>0)e.selectedIndex=(r-1)*t+a;else{const n=(Math.ceil(e.filteredTabs.length/t)-1)*t+a;e.selectedIndex=Math.min(n,e.filteredTabs.length-1)}T()}catch(t){console.error("[TAB SWITCHER] Error in selectUp:",t)}}function ne(){try{document.activeElement&&document.activeElement!==document.body&&document.activeElement!==e.host&&document.activeElement.blur(),document.querySelectorAll("iframe").forEach(r=>{try{r.contentDocument?.activeElement&&r.contentDocument.activeElement.blur()}catch{}})}catch(t){console.debug("[TAB SWITCHER] Error blurring page elements:",t)}}function y(t){return t.target===e.host?!0:(t.composedPath?t.composedPath():[]).some(a=>a===e.host||a===e.shadowRoot||a===e.overlay)}function B(t){e.isOverlayVisible&&(y(t)||(t.stopPropagation(),t.stopImmediatePropagation(),t.preventDefault(),t.target&&typeof t.target.blur=="function"&&t.target.blur(),e.domCache?.searchBox&&e.domCache.searchBox.focus()))}function f(t){if(e.isOverlayVisible&&!y(t)){if(t.stopPropagation(),t.stopImmediatePropagation(),t.preventDefault(),e.domCache?.searchBox&&(e.domCache.searchBox.focus(),t.key&&t.key.length===1&&!t.ctrlKey&&!t.altKey&&!t.metaKey)){const r=e.domCache.searchBox,a=r.selectionStart||0,o=r.selectionEnd||0,n=r.value;r.value=n.slice(0,a)+t.key+n.slice(o),r.setSelectionRange(a+1,a+1),r.dispatchEvent(new Event("input",{bubbles:!0}))}return}}function g(t){if(e.isOverlayVisible&&!y(t))if(t.stopPropagation(),t.stopImmediatePropagation(),t.preventDefault(),t.type==="beforeinput"&&t.data&&e.domCache?.searchBox){const r=e.domCache.searchBox;r.focus();const a=r.selectionStart||0,o=r.selectionEnd||0,n=r.value;r.value=n.slice(0,a)+t.data+n.slice(o),r.setSelectionRange(a+t.data.length,a+t.data.length),r.dispatchEvent(new Event("input",{bubbles:!0}))}else e.domCache?.searchBox&&e.domCache.searchBox.focus()}function v(t){e.isOverlayVisible&&(y(t)||(t.stopPropagation(),t.stopImmediatePropagation(),t.preventDefault()))}function Y(t){e.isOverlayVisible&&(y(t)||(t.stopPropagation(),t.stopImmediatePropagation(),t.preventDefault(),t.target&&typeof t.target.blur=="function"&&t.target.blur(),e.domCache?.searchBox&&e.domCache.searchBox.focus()))}function C(t){e.isOverlayVisible&&(y(t)||(t.stopPropagation(),t.stopImmediatePropagation(),t.preventDefault()))}function u(){try{if(!e.isOverlayVisible)return;requestAnimationFrame(()=>{e.overlay&&(e.overlay.style.opacity="0"),setTimeout(()=>{e.overlay&&(e.overlay.style.display="none"),e.isOverlayVisible=!1,e.focusInterval&&(clearInterval(e.focusInterval),e.focusInterval=null),document.removeEventListener("keydown",R),document.removeEventListener("keyup",M),document.removeEventListener("focus",B,!0),document.removeEventListener("focusin",Y,!0),document.removeEventListener("keydown",f,!0),document.removeEventListener("keypress",f,!0),document.removeEventListener("keyup",f,!0),document.removeEventListener("input",g,!0),document.removeEventListener("beforeinput",g,!0),document.removeEventListener("textInput",g,!0),document.removeEventListener("click",C,!0),document.removeEventListener("mousedown",C,!0),document.removeEventListener("compositionstart",v,!0),document.removeEventListener("compositionupdate",v,!0),document.removeEventListener("compositionend",v,!0),e.intersectionObserver&&(e.intersectionObserver.disconnect(),e.intersectionObserver=null)},200)})}catch(t){console.error("[TAB SWITCHER] Error in closeOverlay:",t),e.isOverlayVisible=!1,e.focusInterval&&(clearInterval(e.focusInterval),e.focusInterval=null);try{document.removeEventListener("keydown",R),document.removeEventListener("keyup",M),document.removeEventListener("focus",B,!0)}catch{}}}function H(t){try{if(!t||typeof t!="number"){console.error("[TAB SWITCHER] Invalid tab ID:",t);return}try{chrome.runtime.sendMessage({action:"switchToTab",tabId:t},()=>{chrome.runtime.lastError&&console.debug("[TAB SWITCHER] SW not ready:",chrome.runtime.lastError.message)})}catch(r){console.debug("[TAB SWITCHER] sendMessage warn:",r?.message||r)}u()}catch(r){console.error("[TAB SWITCHER] Exception in switchToTab:",r),u()}}function N(t){try{if(!t)return;try{chrome.runtime.sendMessage({action:"restoreSession",sessionId:t},()=>{chrome.runtime.lastError&&console.debug("[TAB SWITCHER] SW not ready (restoreSession):",chrome.runtime.lastError.message)})}catch(r){console.debug("[TAB SWITCHER] sendMessage warn:",r?.message||r)}u()}catch(r){console.error("[TAB SWITCHER] Exception in restoreSession:",r),u()}}function D(t,r){try{if(!t||typeof t!="number"){console.error("[TAB SWITCHER] Invalid tab ID for closing:",t);return}if(!e.currentTabs.some(o=>o&&o.id===t)){console.warn("[TAB SWITCHER] Tab no longer exists:",t),e.filteredTabs=e.filteredTabs.filter(o=>o&&o.id!==t),e.currentTabs=e.currentTabs.filter(o=>o&&o.id!==t),e.selectedIndex>=e.filteredTabs.length&&(e.selectedIndex=Math.max(0,e.filteredTabs.length-1)),e.filteredTabs.length>0?e.filteredTabs.length>50?p(e.filteredTabs):m(e.filteredTabs):u();return}chrome.runtime.sendMessage({action:"closeTab",tabId:t},o=>{if(chrome.runtime.lastError){console.error("[TAB SWITCHER] Error closing tab:",chrome.runtime.lastError.message);return}o?.success&&(e.currentTabs=e.currentTabs.filter(n=>n&&n.id!==t),e.filteredTabs=e.filteredTabs.filter(n=>n&&n.id!==t),e.filteredTabs.length>0?(e.selectedIndex>=e.filteredTabs.length&&(e.selectedIndex=Math.max(0,e.filteredTabs.length-1)),e.filteredTabs.length>50?p(e.filteredTabs):m(e.filteredTabs),e.domCache.searchBox&&e.domCache.searchBox.focus()):u())})}catch(a){console.error("[TAB SWITCHER] Exception in closeTab:",a)}}function se(t,r){try{if(!t)return;chrome.runtime.sendMessage({action:"toggleMute",tabId:t},a=>{if(chrome.runtime.lastError){console.error("[TAB SWITCHER] Error toggling mute:",chrome.runtime.lastError);return}if(a&&a.success){const o=a.muted;o?(r.classList.add("muted"),r.title="Unmute tab",r.innerHTML='<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>'):(r.classList.remove("muted"),r.title="Mute tab",r.innerHTML='<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>');const n=e.currentTabs.find(l=>l.id===t);n&&(n.mutedInfo||(n.mutedInfo={}),n.mutedInfo.muted=o)}})}catch(a){console.error("[TAB SWITCHER] Exception in toggleMute:",a)}}function W(t){e.viewMode=t,e.domCache?.backBtn&&(e.domCache.backBtn.style.display=t==="recent"?"flex":"none"),e.domCache?.recentBtn&&(e.domCache.recentBtn.style.display=t==="recent"?"none":"inline-flex"),e.domCache?.searchBox&&(e.domCache.searchBox.placeholder=t==="recent"?"Search recently closed tabs...":"Search tabs by title or URL..."),e.domCache?.helpText&&(t==="recent"?e.domCache.helpText.innerHTML=`
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
      `)}function I(){e.viewMode!=="active"&&(W("active"),e.currentTabs=e.activeTabs||[],e.filteredTabs=e.currentTabs,e.selectedIndex=0,e.domCache.grid&&(e.domCache.grid.classList.remove("recent-mode"),e.domCache.grid.classList.remove("search-mode")),e.filteredTabs.length>50?p(e.filteredTabs):m(e.filteredTabs),e.domCache.searchBox&&(e.domCache.searchBox.value="",e.domCache.searchBox.focus()))}async function z(){if(e.viewMode==="recent")return;W("recent");let t=[];try{t=await new Promise(r=>{try{chrome.runtime.sendMessage({action:"getRecentlyClosed",maxResults:10},a=>{if(chrome.runtime.lastError){console.debug("[TAB SWITCHER] Runtime error:",chrome.runtime.lastError.message),r([]);return}a?.success?r(a.items||[]):r([])})}catch{r([])}})}catch(r){console.debug("[TAB SWITCHER] Failed to load recently closed:",r)}e.recentItems=t.map((r,a)=>({id:null,title:r.title,url:r.url,favIconUrl:r.favIconUrl,screenshot:null,sessionId:r.sessionId,index:a})),e.currentTabs=e.recentItems,e.filteredTabs=e.recentItems,e.selectedIndex=0,e.domCache.grid&&e.domCache.grid.classList.add("recent-mode"),m(e.filteredTabs),e.domCache.searchBox&&e.domCache.searchBox.focus()}function ie(){let t=null,r=0;const a=100,o=300,n=50;return l=>{const s=performance.now(),c=s-r,i=e.currentTabs.length>=n;t&&clearTimeout(t),!i&&c>=a?(r=s,K(l)):t=setTimeout(()=>{r=performance.now(),K(l)},i?o:a)}}function K(t){try{const r=t?.target?.value&&typeof t.target.value=="string"?t.target.value:e.domCache?.searchBox?.value??"",a=String(r).trim();if(a.startsWith(",")){e.history.active=!0,e.domCache.grid&&(e.domCache.grid.classList.add("search-mode"),e.domCache.grid.classList.remove("recent-mode")),e.domCache.helpText&&(e.domCache.helpText.innerHTML=`
            <span><kbd>,</kbd> History Mode</span>
            <span><kbd>Click</kbd> Navigate</span>
            <span><kbd>Backspace</kbd> Exit History</span>
            <span><kbd>Esc</kbd> Close</span>
          `),chrome.runtime.sendMessage({action:"GET_TAB_HISTORY"},s=>{if(chrome.runtime.lastError){console.error("[TAB SWITCHER] History error:",chrome.runtime.lastError);return}console.log("[TAB SWITCHER] Received history:",s),ee(s||{back:[],forward:[]})});return}if(e.history.active=!1,e.history.backEls=[],e.history.forwardEls=[],a.startsWith("?")){const s=a.substring(1).trim(),c={id:"web-search",title:s?`Search Web for "${s}"`:"Type to search web...",url:s?`https://www.google.com/search?q=${encodeURIComponent(s)}`:"",favIconUrl:"https://www.google.com/favicon.ico",isWebSearch:!0,searchQuery:s};e.filteredTabs=[c],e.selectedIndex=0,e.domCache.grid&&(e.domCache.grid.classList.add("search-mode"),e.domCache.grid.classList.remove("recent-mode")),m(e.filteredTabs);return}e.domCache.grid&&e.domCache.grid.classList.remove("search-mode");const o=!!(t&&typeof t.inputType=="string"&&t.inputType==="deleteContentBackward");if(a==="."&&!o){e.domCache.searchBox.value="",e.viewMode==="recent"?I():z();return}if(!a){e.filteredTabs=e.currentTabs,e.selectedIndex=0,e.currentTabs.length>50?p(e.currentTabs):m(e.currentTabs);return}const l=e.currentTabs.map(s=>{const c=G(s.title,a),i=G(s.url,a),d=c.score>i.score?c:i;return{tab:s,match:d.match,score:d.score}}).filter(s=>s.match).sort((s,c)=>c.score-s.score).map(s=>s.tab);e.filteredTabs=l,e.selectedIndex=0,l.length>50?p(l):m(l)}catch(r){console.error("[TAB SWITCHER] Error in handleSearch:",r),e.filteredTabs=e.currentTabs,e.selectedIndex=0,m(e.currentTabs)}}function G(t,r){if(!t)return{match:!1,score:0};const a=t.toLowerCase(),o=r.toLowerCase();if(o.length===0)return{match:!0,score:1};if(a===o)return{match:!0,score:100};if(a.startsWith(o))return{match:!0,score:80+o.length/a.length*10};if(a.includes(o))return{match:!0,score:50+o.length/a.length*10};let n=0,l=0,s=0,c=0,i=-1;for(;n<a.length&&l<o.length;){if(a[n]===o[l]){i===-1&&(i=n);let d=1;c>0&&(d+=2+c),(n===0||a[n-1]===" "||a[n-1]==="."||a[n-1]==="/"||a[n-1]==="-")&&(d+=3),s+=d,c++,l++}else c=0;n++}return l<o.length?{match:!1,score:0}:(s-=(a.length-o.length)*.1,i>0&&(s-=i*.5),{match:!0,score:Math.max(1,s)})}function ce(){try{if(!e.host||!e.host.isConnected){e.shadowRoot=null,e.styleElement=null;const t=document.getElementById(V);if(t)e.host=t;else{const r=document.createElement("tab-switcher-mount");r.id=V,r.style.cssText=`
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
      `,(document.body||document.documentElement).appendChild(r),e.host=r}}if(e.shadowRoot||(e.host.shadowRoot?e.shadowRoot=e.host.shadowRoot:e.shadowRoot=e.host.attachShadow({mode:"open"})),!e.styleElement||!e.shadowRoot.contains(e.styleElement)){const t=document.createElement("style");t.textContent=X,e.shadowRoot.appendChild(t),e.styleElement=t}return e.shadowRoot}catch(t){return console.error("[TAB SWITCHER] Failed to initialize shadow root:",t),null}}function le(){if(e.overlay)return;const t=ce();if(!t)return;const r=document.createElement("div");r.id="visual-tab-switcher-overlay",r.className="tab-switcher-overlay",r.style.willChange="opacity";const a=document.createElement("div");a.className="tab-switcher-backdrop",r.appendChild(a);const o=document.createElement("div");o.className="tab-switcher-container",o.style.transform="translate3d(0, 0, 0)";const n=document.createElement("div");n.className="tab-switcher-search-row";const l=document.createElement("div");l.className="tab-switcher-search-wrap";const s=document.createElement("input");s.type="text",s.className="tab-switcher-search",s.placeholder="Search tabs by title or URL...",s.autocomplete="off";const c=document.createElement("button");c.type="button",c.className="recent-back-btn",c.title="Back to Active Tabs",c.textContent="←",c.addEventListener("click",()=>I());const i=document.createElement("button");i.className="recently-closed-btn",i.type="button",i.textContent="Recently closed tabs",i.addEventListener("click",()=>z());const d=document.createElement("div");d.className="search-icon",d.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',l.appendChild(c),l.appendChild(d),l.appendChild(s),n.appendChild(l),n.appendChild(i),o.appendChild(n);const h=document.createElement("div");h.className="tab-switcher-grid",h.id="tab-switcher-grid",h.setAttribute("role","listbox"),h.setAttribute("aria-label","Open tabs"),h.style.transform="translate3d(0, 0, 0)",o.appendChild(h);const b=document.createElement("div");b.className="tab-switcher-help",b.innerHTML=`
     <span><kbd>Alt+Q</kbd> Navigate</span>
     <span><kbd>Enter</kbd> Switch</span>
     <span><kbd>Delete</kbd> Close</span>
     <span><kbd>.</kbd> Recent Tabs</span>
     <span><kbd>/</kbd> History</span>
     <span><kbd>?</kbd> Web Search</span>
     <span><kbd>Esc</kbd> Exit</span>
   `,o.appendChild(b),r.appendChild(o),s.addEventListener("input",ie()),s.addEventListener("keydown",ae),a.addEventListener("click",u),h.addEventListener("click",re),e.overlay=r,e.domCache={grid:h,searchBox:s,container:o,searchWrap:l,backBtn:c,recentBtn:i,helpText:b},t.appendChild(r),console.log("[PERF] Overlay created with GPU acceleration and event delegation")}function de(t,r){if(performance.now(),console.log(`[TAB SWITCHER] Opening with ${t.length} tabs`),e.isOverlayVisible)return;le(),e.activeTabs=t,e.currentTabs=t,e.filteredTabs=t,W("active");const a=t.findIndex(o=>o.id===r);t.length>1&&a===0?e.selectedIndex=1:(a>0,e.selectedIndex=0),t.length>50?(console.log("[PERF] Using virtual scrolling for",t.length,"tabs"),p(t)):m(t),e.overlay.style.display="flex",e.overlay.style.opacity="0",e.isOverlayVisible=!0,ne(),e.domCache.searchBox&&(e.domCache.searchBox.value="",e.domCache.searchBox.focus()),requestAnimationFrame(()=>{requestAnimationFrame(()=>{e.overlay&&(e.overlay.style.opacity="1")})}),document.addEventListener("keydown",R),document.addEventListener("keyup",M),document.addEventListener("focus",B,!0),document.addEventListener("focusin",Y,!0),document.addEventListener("keydown",f,!0),document.addEventListener("keypress",f,!0),document.addEventListener("keyup",f,!0),document.addEventListener("input",g,!0),document.addEventListener("beforeinput",g,!0),document.addEventListener("textInput",g,!0),document.addEventListener("click",C,!0),document.addEventListener("mousedown",C,!0),document.addEventListener("compositionstart",v,!0),document.addEventListener("compositionupdate",v,!0),document.addEventListener("compositionend",v,!0),e.focusInterval&&clearInterval(e.focusInterval),e.focusInterval=setInterval(()=>{e.isOverlayVisible&&e.domCache.searchBox&&document.activeElement!==e.domCache.searchBox&&e.domCache.searchBox.focus()},100)}console.log("═══════════════════════════════════════════════════════");console.log("Visual Tab Switcher - Content Script Loaded");console.log("Features: Virtual Scrolling, Event Delegation, GPU Acceleration");console.log("Target: <16ms interactions, 60fps, lazy loading");console.log("═══════════════════════════════════════════════════════");chrome.runtime.onMessage.addListener((t,r,a)=>{if(t.action==="showTabSwitcher"){if(e.isOverlayVisible)return oe(),S(!0),a({success:!0,advanced:!0}),!0;de(t.tabs,t.activeTabId),a({success:!0})}return!0});
})()
})()
