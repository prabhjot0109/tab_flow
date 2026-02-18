// Import shared types for local use and re-export (single source of truth)
import type { Tab, Group } from "../shared/types";
export type { Tab, Group } from "../shared/types";

export interface State {
  overlay: HTMLElement | null;
  currentTabs: Tab[];
  activeTabs: Tab[];
  filteredTabs: Tab[];
  selectedIndex: number;
  isOverlayVisible: boolean;
  isQuickSwitchVisible: boolean;
  quickSwitchTabs: Tab[];
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
  isQuickSwitchVisible: false,
  quickSwitchTabs: [],
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

  // Virtual scrolling - optimized for 100+ tabs
  virtualScroll: {
    startIndex: 0,
    endIndex: 0,
    visibleCount: 30, // Increased for smoother scrolling
    bufferCount: 10, // Increased buffer for better scroll experience
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
