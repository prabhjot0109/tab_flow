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
  mutedInfo?: chrome.tabs.MutedInfo;
  groupId?: number;
  isWebSearch?: boolean;
  searchQuery?: string;
  index?: number;
  // Group Header Support
  isGroupHeader?: boolean;
  groupColor?: string;
  groupTitle?: string;
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
  domCache: {
    grid: HTMLElement | null;
    searchBox: HTMLInputElement | null;
    container: HTMLElement | null;
    searchWrap: HTMLElement | null;
    backBtn: HTMLElement | null;
    recentBtn: HTMLElement | null;
    helpText?: HTMLElement | null;
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
  history: {
    active: boolean;
    backEls: HTMLElement[];
    forwardEls: HTMLElement[];
    column: "back" | "forward";
    index: number;
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

  // History view selection state
  history: {
    active: false,
    backEls: [],
    forwardEls: [],
    column: "back",
    index: 0,
  },
};
