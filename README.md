# <img src="./icons/icon128.png" width="40" height="40" style="vertical-align: bottom; margin-right: 10px;"> Browser Tab Switch

![Extension Preview](./preview.png)

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Chrome](https://img.shields.io/badge/platform-Chrome%20%7C%20Edge%20%7C%20Brave-grey.svg)

**A professional, high-performance tab switcher for power users.**
Replace the default browser tab cycle with a beautiful, Mac-like "Mission Control" overlay. Visualize your tabs, search instantly, and navigate with speed.

---

## ✨ Features

### 🎨 Stunning Visual Interface

- **Material Design 3**: Modern, polished overlay that follows Material Design principles.
- **Live Previews**: High-resolution thumbnail previews of all your open tabs.
- **Theming**: Automatically adapts to **Light** and **Dark** system themes.
- **Audio Indicators**: See which tabs are playing audio at a glance.

### 🚀 High-Performance Navigation

- **Instant Access**: Opens in **<100ms** thanks to smart pre-caching and service worker optimization.
- **Fuzzy Search**: Rapidly find tabs by title or URL. Just start typing.
- **Smart Sorting**: Tabs are automatically sorted by **Recency**, so your last-used tab is always just one click away.
- **Input Isolation**: Advanced event handling ensures your keystrokes stay within the switcher, preventing accidental input on the underlying page.

### ⌨️ Power User Shortcuts

- **Tab History**: Navigate back/forward in a specific tab's history directly from the switcher.
- **Restore Closed**: Quickly find and restore recently closed tabs.
- **Keyboard First**: Fully navigable via keyboard, but mouse-friendly too.

---

## ⌨️ Keyboard Shortcuts

| Key                            | Action                                         |
| :----------------------------- | :--------------------------------------------- |
| **`Alt` + `Q`**                | **Open Switcher** (Customizable to `Ctrl+Tab`) |
| **`Tab`** / **Arrows**         | Navigate between tabs                          |
| **`Enter`**                    | Switch to selected tab                         |
| **`Delete`** / **`Backspace`** | Close selected tab                             |
| **`/`**                        | View Tab History (Back/Forward)                |
| **`.`**                        | View Recently Closed Tabs                      |
| **`?`** (Shift + /)            | Web Search                                     |
| **`Esc`**                      | Close Switcher                                 |

> **Pro Tip:** You can map this extension to `Ctrl+Tab` in `chrome://extensions/shortcuts` for a native replacement feel.

---

## 🛠️ Installation

### Developer Mode (Current Method)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/prabhjot0109/tab_switcher_extension.git
   cd tab_switcher_extension
   ```
2. **Install & Build**:
   ```bash
   bun install
   bun run build
   ```
3. **Open Chrome Extensions**:
   - Go to `chrome://extensions/`
   - Toggle **Developer mode** in the top right.
4. **Load Unpacked**:
   - Click **"Load unpacked"**.
   - Select the `dist` directory created by the build.
5. **Setup**:
   - The extension is now active! Press `Alt + Q` to try it out.

---

## 🔧 Technical Architecture

Built with modern **Manifest V3** standards for security and performance.

- **Build System**: Powered by **Vite** and **Bun** for ultra-fast builds and modular development.
- **Architecture**: Modular codebase split into specialized components (UI, Input, State, Actions) for better maintainability.
- **Content Script**: Uses **Shadow DOM** to completely isolate extension styles from the host page, ensuring no broken layouts.
- **Service Worker**: Manages tab state and handles background screenshotting.
- **LRU Cache**: Implements a custom Least Recently Used cache with **IndexedDB persistence** to store tab screenshots efficiently (<50MB memory footprint).
- **Performance**: Targeting 60fps animations and instant responsiveness even with 50+ tabs open (Virtual Scrolling).

---

## 🗺️ Roadmap & Improvements

- [ ] **Tab Groups**: Visual indicators and filtering for Chrome Tab Groups.
- [ ] **Cloud Sync**: Sync your preferences across devices.
- [ ] **Multi-Window**: enhanced support for managing tabs across multiple windows.
- [ ] **Stats Dashboard**: Visualize your browsing habits.

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the project.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

**Made with ❤️ for productivity enthusiasts.**
