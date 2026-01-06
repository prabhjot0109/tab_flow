// Visual Tab Switcher - Styles Module
// ============================================================================
// CSS is now loaded from external file for better caching and smaller JS bundle
// ============================================================================

export const SHADOW_HOST_ID = "tab-switcher-host";

// Import CSS as string using Vite's ?inline query
// This allows the CSS to be in a separate file for better maintainability
// while still being injectable into Shadow DOM
import SHADOW_CSS_RAW from "./styles.css?inline";

export const SHADOW_CSS: string = SHADOW_CSS_RAW;
