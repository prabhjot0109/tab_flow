// ============================================================================
// Shared Types - Single source of truth for all Tab Flow interfaces
// Used by: content script overlay, flow popup, quick-switch popup
// ============================================================================

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
