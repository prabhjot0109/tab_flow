import { state } from "../state";

export function lockPageInteraction() {
  if (state.pageLock) return;

  const body = document.body;
  if (!body) return;

  const inertSupported = "inert" in body;
  state.pageLock = {
    bodyPointerEvents: body.style.pointerEvents,
    bodyUserSelect: body.style.userSelect,
    bodyInert: inertSupported ? Boolean((body as any).inert) : false,
  };

  // Make the underlying page non-interactive.
  // Important: our UI is mounted on documentElement, not inside body.
  try {
    if (inertSupported) {
      (body as any).inert = true;
    }
  } catch {
    // Ignore if browser blocks inert writes.
  }

  body.style.pointerEvents = "none";
  body.style.userSelect = "none";
}

export function unlockPageInteraction() {
  if (!state.pageLock) return;

  const body = document.body;
  if (!body) {
    state.pageLock = null;
    return;
  }

  const inertSupported = "inert" in body;
  try {
    if (inertSupported) {
      (body as any).inert = state.pageLock.bodyInert;
    }
  } catch {
    // Ignore.
  }

  body.style.pointerEvents = state.pageLock.bodyPointerEvents;
  body.style.userSelect = state.pageLock.bodyUserSelect;

  state.pageLock = null;
}

// Blur all focusable elements on the page to prevent they from receiving input
export function blurPageElements() {
  try {
    // Blur the currently focused element if it's not our extension
    if (
      document.activeElement &&
      document.activeElement !== document.body &&
      document.activeElement !== state.host
    ) {
      const active = document.activeElement;
      if (active instanceof HTMLElement) {
        active.blur();
      }
    }

    // Also try to blur any iframes' active elements
    const iframes = document.querySelectorAll("iframe");
    iframes.forEach((iframe) => {
      try {
        const iframeActive = iframe.contentDocument?.activeElement;
        if (iframeActive instanceof HTMLElement) {
          iframeActive.blur();
        }
      } catch {
        // Cross-origin iframe, can't access
      }
    });
  } catch (error) {
    console.debug("[Tab Flow] Error blurring page elements:", error);
  }
}

// Check if an event target is inside our shadow DOM
export function isEventFromOurExtension(e: Event) {
  // Check if the target is our shadow host
  if (e.target === state.host) return true;

  // Check if target is inside our shadow root using composedPath
  const path = e.composedPath ? e.composedPath() : [];
  return path.some(
    (el) => el === state.host || el === state.shadowRoot || el === state.overlay
  );
}

export function handleGlobalFocus(e: FocusEvent) {
  if (!state.isOverlayVisible) return;

  // If focus moves to something other than our host (shadow host), force it back.
  if (!isEventFromOurExtension(e)) {
    e.stopPropagation();
    e.stopImmediatePropagation();
    e.preventDefault();

    // Blur the element that tried to steal focus
    if (e.target instanceof HTMLElement) {
      e.target.blur();
    }

    if (state.domCache?.searchBox) {
      state.domCache.searchBox.focus();
    }
  }
}

export function handleGlobalKeydown(e: KeyboardEvent) {
  if (!state.isOverlayVisible) return;

  // Always block events that don't originate from our extension
  if (!isEventFromOurExtension(e)) {
    // Target is outside our extension. Block it completely.
    e.stopPropagation();
    e.stopImmediatePropagation();
    e.preventDefault();

    // Force focus back to our search box
    if (state.domCache?.searchBox) {
      state.domCache.searchBox.focus();

      // For printable characters, manually add them to the search box
      if (
        e.key &&
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey
      ) {
        const searchBox = state.domCache.searchBox;
        const start = searchBox.selectionStart || 0;
        const end = searchBox.selectionEnd || 0;
        const value = searchBox.value;
        searchBox.value = value.slice(0, start) + e.key + value.slice(end);
        searchBox.setSelectionRange(start + 1, start + 1);
        // Trigger input event so search updates
        searchBox.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
    return;
  }
}

// Block input/beforeinput/textInput events that target page elements
export function handleGlobalInput(e: Event) {
  if (!state.isOverlayVisible) return;

  if (!isEventFromOurExtension(e)) {
    e.stopPropagation();
    e.stopImmediatePropagation();
    e.preventDefault();

    // For beforeinput events, we may need to insert the data into our search box
    if (
      e instanceof InputEvent &&
      e.type === "beforeinput" &&
      typeof e.data === "string" &&
      state.domCache?.searchBox
    ) {
      const searchBox = state.domCache.searchBox;
      searchBox.focus();
      const start = searchBox.selectionStart || 0;
      const end = searchBox.selectionEnd || 0;
      const value = searchBox.value;
      searchBox.value = value.slice(0, start) + e.data + value.slice(end);
      searchBox.setSelectionRange(start + e.data.length, start + e.data.length);
      searchBox.dispatchEvent(new Event("input", { bubbles: true }));
    } else if (state.domCache?.searchBox) {
      state.domCache.searchBox.focus();
    }
  }
}

// Block composition events (for IME input)
export function handleGlobalComposition(e: CompositionEvent) {
  if (!state.isOverlayVisible) return;

  if (!isEventFromOurExtension(e)) {
    e.stopPropagation();
    e.stopImmediatePropagation();
    e.preventDefault();
  }
}

// Block focus attempts on page elements
export function handleGlobalFocusIn(e: FocusEvent) {
  if (!state.isOverlayVisible) return;

  if (!isEventFromOurExtension(e)) {
    e.stopPropagation();
    e.stopImmediatePropagation();
    e.preventDefault();

    // Blur the element that received focus
    if (e.target instanceof HTMLElement) {
      e.target.blur();
    }

    if (state.domCache?.searchBox) {
      state.domCache.searchBox.focus();
    }
  }
}

// Block click events on page elements when overlay is visible
export function handleGlobalClick(e: MouseEvent) {
  if (!state.isOverlayVisible) return;

  if (!isEventFromOurExtension(e)) {
    e.stopPropagation();
    e.stopImmediatePropagation();
    e.preventDefault();
  }
}




