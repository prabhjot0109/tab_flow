const shortcutsLink = document.getElementById("shortcutsLink");
if (shortcutsLink) {
  shortcutsLink.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  });
}

const optionsLink = document.getElementById("optionsLink");
if (optionsLink) {
  optionsLink.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}




