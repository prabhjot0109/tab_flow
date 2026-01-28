# <img src="./icons/icon128.png" width="32" height="32" style="vertical-align: bottom; margin-right: 10px;"> Tab Flow

![Extension Preview](./preview.png)

[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)](https://github.com/prabhjot0109/TabFlow/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Chrome](https://img.shields.io/badge/platform-Chrome%20%7C%20Edge%20%7C%20Brave-grey.svg)](#installation)

---

## What is Tab Flow?

Ever find yourself drowning in browser tabs? We've all been there. You've got 30+ tabs open, and finding that one page you need feels like searching for a needle in a haystack.

**Tab Flow** changes that. It's a beautiful, lightning-fast tab switcher that gives you two powerful ways to navigate:

- **Quick Switch (`Alt + Q`)** – Instant Alt+Tab style switching. Just hold Alt, tap Q to cycle, and release Alt to switch. No typing required.
- **Tab Flow with Search (`Alt + W`)** – A visual overlay with live thumbnails, search, and powerful keyboard navigation.

No more squinting at tiny favicons. No more clicking through endless tabs. Just press a shortcut and you're there.

---

## Why You'll Love It

### 🎯 **Find Any Tab in Seconds**

Start typing and Tab Flow instantly filters your tabs by title or URL. Looking for that GitHub PR? Just type "github" and there it is.

### ⚡ **Quick Switch Like Alt+Tab**

Press `Alt + Q` for instant tab switching – just like Windows Alt+Tab. Hold Alt, tap Q to cycle through tabs, release Alt to switch. It's that fast.

### 👀 **See What's Actually Open**

Each tab shows a live thumbnail preview, so you can visually spot the page you're looking for. No more guessing which "Google Docs" tab is the right one.

### ⚡ **Stupidly Fast**

Opens in under 100ms. Seriously. We obsess over performance so you don't have to wait.

### 🎨 **Looks Great Everywhere**

Clean, modern design that automatically adapts to light and dark themes. Uses glassmorphism effects that look stunning without being distracting.

### 🔊 **Control Your Audio**

See which tabs are playing sound at a glance. Mute that random YouTube video without hunting for it.

### 📂 **Tab Groups? We Got You**

If you use Chrome's tab groups, they're displayed beautifully with collapsible headers and color coding.

---

## Keyboard Shortcuts

| Key                     | What it does                         |
| ----------------------- | ------------------------------------ |
| `Alt + Q`               | Quick Switch (Alt+Tab style)         |
| `Alt + W`               | Open Tab Flow with Search            |
| `↑` / `↓`               | Navigate through tabs                |
| `Enter`                 | Switch to selected tab               |
| `Delete` or `Backspace` | Close selected tab                   |
| `.`                     | View recently closed tabs            |
| `;`                     | View tab history (back/forward)      |
| `Tab`                   | Search the web                       |
| `Esc`                   | Close Tab Flow                       |
| Release `Alt`           | Switch to selected (in Quick Switch) |

> **💡 Pro Tip:** Want to use `Ctrl+Tab` instead? Head to `chrome://extensions/shortcuts` and remap it. Makes Tab Flow feel completely native.

---

## Installation

### Chrome Web Store (Coming Soon)

The extension will be available on the Chrome Web Store soon. Star this repo to get notified!

### Manual Installation (Developer Mode)

1. **Grab the code:**

   ```bash
   git clone https://github.com/prabhjot0109/TabFlow.git
   cd TabFlow
   ```

2. **Install dependencies and build:**

   ```bash
   # Using bun (recommended)
   bun install && bun run build

   # Or using npm
   npm install && npm run build
   ```

3. **Load it in Chrome:**

   - Open `chrome://extensions/`
   - Turn on **Developer mode** (top right toggle)
   - Click **"Load unpacked"**
   - Select the `dist` folder

4. **Try it out:**
   Press `Alt + Q` and enjoy!

---

## How It Works

Tab Flow is built with performance and privacy in mind:

- **Manifest V3** – Uses Chrome's latest extension platform for better security and performance
- **Service Worker** – Captures tab screenshots and manages state efficiently in the background
- **Shadow DOM** – The overlay is completely isolated from web pages, so it looks perfect everywhere
- **LRU Cache** – Smart caching keeps memory usage under control, even with 100+ tabs
- **Virtual Scrolling** – Handles large tab counts smoothly at 60fps

### Tech Stack

- TypeScript for type safety
- Vite + CRXJS for blazing fast builds
- IndexedDB for persistent caching
- No external dependencies for the core functionality

---

## Privacy

**Your data stays on your device. Period.**

Tab Flow stores tab thumbnails and metadata locally to power the tab switching experience. Here's what we want you to know:

- ✅ **No data leaves your browser** – Everything is stored locally in IndexedDB
- ✅ **No analytics or tracking** – We don't collect usage data
- ✅ **No accounts required** – Just install and use
- ✅ **Open source** – You can see exactly what the code does

For the legal stuff, check out our [Privacy Policy](./PRIVACY.md).

> The use of information received from Google APIs adheres to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/), including the Limited Use requirements.

---

## FAQ

**Q: Why does it request site access?**  
A: Tab Flow only injects the overlay when you trigger a shortcut. The first time you use it on a site, Chrome will ask to grant access for that site so it can render the overlay and capture a thumbnail. You can deny or revoke access anytime.

**Q: Does it work on Chrome internal pages?**  
A: Chrome doesn't allow extensions to inject content on `chrome://` pages. On these pages, Tab Flow opens as a popup window instead. Same functionality, different container.

**Q: Can I change the keyboard shortcut?**  
A: Yes! Go to `chrome://extensions/shortcuts` and set whatever key combo you prefer.

**Q: How much memory does it use?**  
A: We cap screenshot cache at ~20MB. With typical usage (30 tabs), expect around 15-25MB of memory usage.

---

## Contributing

Found a bug? Have a feature idea? Contributions are welcome!

1. Fork the repo
2. Create your feature branch: `git checkout -b feature/cool-thing`
3. Make your changes and commit: `git commit -m 'Add cool thing'`
4. Push to your fork: `git push origin feature/cool-thing`
5. Open a Pull Request

Please keep PRs focused and include a clear description of what you're changing and why.

---

## License

MIT License – do whatever you want with it. See [LICENSE](./LICENSE) for details.

---

<p align="center">
  <b>Built for people who have too many tabs open.</b><br>
  (So, everyone.)
</p>
