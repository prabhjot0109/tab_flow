// ... existing Tab interface ...
export interface Tab {
  id?: number;
  title?: string;
  url?: string;
  favIconUrl?: string;
  screenshot?: string | null;
  sessionId?: string;
  pinned?: boolean;
  active?: boolean;
  audible?: boolean;
  hasMedia?: boolean;
  isPlaying?: boolean;
  mutedInfo?: chrome.tabs.MutedInfo;
  groupId?: number;
  isWebSearch?: boolean;
  searchQuery?: string;
  index?: number;
  // Group Header Support
  isGroupHeader?: boolean;
  groupColor?: string;
  groupTitle?: string;
  // Temporary render props
  _groupColor?: string;
  _groupTitle?: string;
}

export interface Group {
  id: number;
  title?: string;
  color: string;
  collapsed?: boolean;
}

export interface State {
  overlay: HTMLElement | null;
  currentTabs: Tab[];
  activeTabs: Tab[];
  filteredTabs: Tab[];
  selectedIndex: number;
  isOverlayVisible: boolean;
  viewMode: "active" | "recent";
  recentItems: Tab[];
  groups: Group[];
  collapsedGroups: Set<number>; // Track collapsed group IDs
  host: HTMLElement | null;
  shadowRoot: ShadowRoot | null;
  styleElement: HTMLStyleElement | null;
  lastFullscreenElement: HTMLElement | null; // Track fullscreen element before overlay
  domCache: {
    grid: HTMLElement | null;
    searchBox: HTMLInputElement | null;
    container: HTMLElement | null;
    searchWrap: HTMLElement | null;
    helpText?: HTMLElement | null;
    sectionTitle?: HTMLElement | null;
    tabHint?: HTMLElement | null;
  };
  virtualScroll: {
    startIndex: number;
    endIndex: number;
    visibleCount: number;
    bufferCount: number;
  };
  lastKeyTime: number;
  keyThrottleMs: number;
  resizeObserver: ResizeObserver | null;
  intersectionObserver: IntersectionObserver | null;
  focusInterval: number | null; // Use number for window.setInterval
  closeTimeout: ReturnType<typeof setTimeout> | null;
  isClosing: boolean;
  pageLock: {
    bodyPointerEvents: string;
    bodyUserSelect: string;
    bodyInert: boolean;
  } | null;
  history: {
    active: boolean;
    backEls: HTMLElement[];
    forwardEls: HTMLElement[];
    column: "back" | "forward";
    index: number;
  };
  webSearch: {
    active: boolean;
  };
}

export const state: State = {
  overlay: null,
  currentTabs: [],
  activeTabs: [],
  filteredTabs: [],
  selectedIndex: 0,
  isOverlayVisible: false,
  viewMode: "active",
  recentItems: [],
  groups: [],
  collapsedGroups: new Set(),
  host: null,
  shadowRoot: null,
  styleElement: null,
  lastFullscreenElement: null,

  // DOM cache
  domCache: {
    grid: null,
    searchBox: null,
    container: null,
    searchWrap: null,
    sectionTitle: null,
    tabHint: null,
  },

  // Virtual scrolling
  virtualScroll: {
    startIndex: 0,
    endIndex: 0,
    visibleCount: 20,
    bufferCount: 5,
  },

  // Performance
  lastKeyTime: 0,
  keyThrottleMs: 16,
  resizeObserver: null,
  intersectionObserver: null,
  focusInterval: null,
  closeTimeout: null,
  isClosing: false,

  // Page interaction lock (restores on close)
  pageLock: null,

  // History view selection state
  history: {
    active: false,
    backEls: [],
    forwardEls: [],
    column: "back",
    index: 0,
  },

  // Web search mode (entered via Tab)
  webSearch: {
    active: false,
  },
};




