import { state } from "../state";
import { switchToActive, switchToRecent, closeOverlay } from "../actions";
import {
  renderTabsStandard,
  renderTabsVirtual,
  renderHistoryView,
} from "../ui/rendering";

// Extend Window interface to include the Navigation API
declare global {
  interface Window {
    navigation?: {
      entries: () => Array<{
        url: string | null;
        key: string;
        id: string;
        index: number;
        sameDocument: boolean;
      }>;
      currentEntry?: {
        url: string | null;
        key: string;
        id: string;
        index: number;
      };
    };
  }
}

// Get browser's actual navigation history using the Navigation API
// This provides accurate back/forward entries that match browser's native UI
export function getNavigationHistory(): {
  back: Array<{ url: string; title: string }>;
  forward: Array<{ url: string; title: string }>;
} {
  try {
    // Check if Navigation API is available
    if (!window.navigation || typeof window.navigation.entries !== "function") {
      console.log("[TAB SWITCHER] Navigation API not available");
      return { back: [], forward: [] };
    }

    const entries = window.navigation.entries();
    const currentEntry = window.navigation.currentEntry;

    if (!entries || entries.length === 0 || !currentEntry) {
      console.log("[TAB SWITCHER] No navigation entries available");
      return { back: [], forward: [] };
    }

    const currentIndex = currentEntry.index;
    console.log(
      "[TAB SWITCHER] Navigation entries:",
      entries.length,
      "Current index:",
      currentIndex
    );

    // Build back history (entries before current, reversed so most recent is first)
    const backEntries: Array<{ url: string; title: string }> = [];
    for (let i = currentIndex - 1; i >= 0; i--) {
      const entry = entries[i];
      if (entry && entry.url) {
        backEntries.push({
          url: entry.url,
          title: getTitleFromUrl(entry.url),
        });
      }
    }

    // Build forward history (entries after current)
    const forwardEntries: Array<{ url: string; title: string }> = [];
    for (let i = currentIndex + 1; i < entries.length; i++) {
      const entry = entries[i];
      if (entry && entry.url) {
        forwardEntries.push({
          url: entry.url,
          title: getTitleFromUrl(entry.url),
        });
      }
    }

    console.log(
      "[TAB SWITCHER] Back entries:",
      backEntries.length,
      "Forward entries:",
      forwardEntries.length
    );
    return { back: backEntries, forward: forwardEntries };
  } catch (error) {
    console.error("[TAB SWITCHER] Error getting navigation history:", error);
    return { back: [], forward: [] };
  }
}

// Extract a readable title from URL
function getTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Try to create a readable title from the URL
    let title = urlObj.hostname;

    // Remove www. prefix
    if (title.startsWith("www.")) {
      title = title.substring(4);
    }

    // Add path if it's meaningful
    if (urlObj.pathname && urlObj.pathname !== "/") {
      const path = urlObj.pathname
        .split("/")
        .filter((p) => p)
        .pop();
      if (path && path.length < 50) {
        title += " - " + decodeURIComponent(path).replace(/[-_]/g, " ");
      }
    }

    return title;
  } catch {
    return url;
  }
}

// Create smart search handler with combined throttle + debounce
export function createSmartSearchHandler() {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastSearchTime = 0;
  const THROTTLE_MS = 100; // Immediate feedback for small tab sets
  const DEBOUNCE_MS = 300; // Wait for user to finish typing on large sets
  const LARGE_TAB_THRESHOLD = 50;

  return (e: Event) => {
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

export function handleSearch(e) {
  try {
    const rawVal =
      e?.target?.value && typeof e.target.value === "string"
        ? e.target.value
        : state.domCache?.searchBox?.value ?? "";
    const query = String(rawVal).trim();

    // Update tab hint visibility - show only when search is empty in active mode
    if (state.domCache?.tabHint) {
      const shouldHideHint =
        query.length > 0 ||
        state.viewMode === "recent" ||
        state.webSearch.active;
      state.domCache.tabHint.classList.toggle("hidden", shouldHideHint);
    }

    // History Mode: starts with ,
    if (query.startsWith(",")) {
      state.webSearch.active = false;
      state.history.active = true;
      if (state.domCache.grid) {
        state.domCache.grid.classList.add("search-mode");
        state.domCache.grid.classList.remove("recent-mode");
      }

      // Update section title for history mode
      if (state.domCache.sectionTitle) {
        state.domCache.sectionTitle.textContent = "Tab History";
      }

      // Update help text for history mode
      if (state.domCache.helpText) {
        state.domCache.helpText.innerHTML = `
            <span><kbd>,</kbd> History Mode</span>
            <span><kbd>←→</kbd> Switch Column</span>
            <span><kbd>↑↓</kbd> Navigate</span>
            <span><kbd>Enter</kbd> Go</span>
            <span><kbd>Backspace</kbd> Exit</span>
            <span><kbd>Esc</kbd> Close</span>
          `;
      }

      // Use the Navigation API to get actual browser history entries
      // This is more reliable than tracking history ourselves
      const historyData = getNavigationHistory();
      console.log("[TAB SWITCHER] Navigation API history:", historyData);
      renderHistoryView(historyData);
      return;
    }

    // Leaving history mode
    state.history.active = false;
    state.history.backEls = [];
    state.history.forwardEls = [];

    // Web Search Mode: entered via Tab (no '?' prefix)
    if (state.viewMode !== "recent" && state.webSearch.active) {
      const searchQuery = query;
      const webSearchTab = {
        title: searchQuery
          ? `Search Web for "${searchQuery}"`
          : "Type to search web...",
        url: searchQuery
          ? `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`
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
      // Update section title for web search mode
      if (state.domCache.sectionTitle) {
        state.domCache.sectionTitle.textContent = "Web Search";
      }
      renderTabsStandard(state.filteredTabs);
      return;
    }

    // Remove search-mode class when not in web search/history
    if (state.domCache.grid) {
      state.domCache.grid.classList.remove("search-mode");
    }

    // Reset section title to default based on view mode
    if (state.domCache.sectionTitle) {
      state.domCache.sectionTitle.textContent =
        state.viewMode === "recent" ? "Recently Closed" : "Opened Tabs";
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

// Fuzzy match scoring
export function fuzzyMatch(text, query) {
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
