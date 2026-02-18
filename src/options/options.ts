type ViewMode = "grid" | "list";
type QualityTier = "PERFORMANCE" | "NORMAL" | "HIGH";

interface Settings {
  qualityTier: QualityTier;
  cacheMaxTabs: number;
  cacheMaxMB: number;
  tabFlowView: ViewMode;
  quickSwitchView: ViewMode;
}

const DEFAULTS: Settings = {
  qualityTier: "NORMAL",
  cacheMaxTabs: 100,
  cacheMaxMB: 50,
  tabFlowView: "grid",
  quickSwitchView: "grid",
};

const ELEMENTS = {
  qualityTier: document.getElementById("qualityTier") as HTMLSelectElement,
  cacheMaxTabs: document.getElementById("cacheMaxTabs") as HTMLInputElement,
  cacheMaxMB: document.getElementById("cacheMaxMB") as HTMLInputElement,
  tabFlowView: document.getElementById("tabFlowView") as HTMLSelectElement,
  quickSwitchView: document.getElementById(
    "quickSwitchView"
  ) as HTMLSelectElement,
  saveBtn: document.getElementById("saveBtn") as HTMLButtonElement,
  resetBtn: document.getElementById("resetBtn") as HTMLButtonElement,
  status: document.getElementById("status") as HTMLElement,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function setStatus(message: string, isError = false) {
  ELEMENTS.status.textContent = message;
  ELEMENTS.status.style.color = isError ? "#ff5d5d" : "";
}

function readFormValues(): Settings {
  const cacheMaxTabs = clamp(
    Number.parseInt(ELEMENTS.cacheMaxTabs.value, 10) || DEFAULTS.cacheMaxTabs,
    20,
    300
  );
  const cacheMaxMB = clamp(
    Number.parseInt(ELEMENTS.cacheMaxMB.value, 10) || DEFAULTS.cacheMaxMB,
    10,
    200
  );

  return {
    qualityTier: ELEMENTS.qualityTier.value as QualityTier,
    cacheMaxTabs,
    cacheMaxMB,
    tabFlowView: ELEMENTS.tabFlowView.value as ViewMode,
    quickSwitchView: ELEMENTS.quickSwitchView.value as ViewMode,
  };
}

function writeFormValues(settings: Settings) {
  ELEMENTS.qualityTier.value = settings.qualityTier;
  ELEMENTS.cacheMaxTabs.value = String(settings.cacheMaxTabs);
  ELEMENTS.cacheMaxMB.value = String(settings.cacheMaxMB);
  ELEMENTS.tabFlowView.value = settings.tabFlowView;
  ELEMENTS.quickSwitchView.value = settings.quickSwitchView;
}

async function loadSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get([
    "qualityTier",
    "cacheMaxTabs",
    "cacheMaxMB",
    "TabFlowViewMode",
    "QuickSwitchViewMode",
  ]);

  return {
    qualityTier: (result.qualityTier as QualityTier) || DEFAULTS.qualityTier,
    cacheMaxTabs:
      typeof result.cacheMaxTabs === "number"
        ? result.cacheMaxTabs
        : DEFAULTS.cacheMaxTabs,
    cacheMaxMB:
      typeof result.cacheMaxMB === "number"
        ? result.cacheMaxMB
        : DEFAULTS.cacheMaxMB,
    tabFlowView:
      (result.TabFlowViewMode as ViewMode) || DEFAULTS.tabFlowView,
    quickSwitchView:
      (result.QuickSwitchViewMode as ViewMode) || DEFAULTS.quickSwitchView,
  };
}

async function saveSettings(settings: Settings) {
  await chrome.storage.local.set({
    qualityTier: settings.qualityTier,
    cacheMaxTabs: settings.cacheMaxTabs,
    cacheMaxMB: settings.cacheMaxMB,
    TabFlowViewMode: settings.tabFlowView,
    QuickSwitchViewMode: settings.quickSwitchView,
  });

  chrome.runtime.sendMessage({
    action: "setQualityTier",
    tier: settings.qualityTier,
  });

  chrome.runtime.sendMessage({
    action: "updateCacheSettings",
    maxTabs: settings.cacheMaxTabs,
    maxMB: settings.cacheMaxMB,
  });
}

async function handleSave() {
  try {
    const settings = readFormValues();
    writeFormValues(settings);
    await saveSettings(settings);
    setStatus("Settings saved.");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save settings.";
    setStatus(message, true);
  }
}

async function handleReset() {
  try {
    writeFormValues(DEFAULTS);
    await saveSettings(DEFAULTS);
    setStatus("Defaults restored.");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reset settings.";
    setStatus(message, true);
  }
}

async function initialize() {
  const settings = await loadSettings();
  writeFormValues(settings);
  ELEMENTS.saveBtn.addEventListener("click", handleSave);
  ELEMENTS.resetBtn.addEventListener("click", handleReset);
}

initialize().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  setStatus(message, true);
});
