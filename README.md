# Linden

Linden is an experimental Chromium-based desktop browser with a quiet, Liquid Glass-inspired interface and an optional AI companion.

## First milestone
- Real browser tabs powered by Electron `WebContentsView`.
- Address/search bar, back, forward, reload, home and popup-to-new-tab handling.
- Minimal glass UI with an AI side panel.
- OpenAI-compatible chat endpoint configuration.
- Optional page context: page text is only read when the context toggle is enabled and the user sends a chat request.
- API keys encrypted locally with Electron `safeStorage`.
- React + TypeScript + Vite renderer, isolated Electron main/preload.

## Requirements
Node.js 20.19+ or 22.12+, npm, and a Windows/macOS/Linux desktop.

## Run
```bash
npm install
npm run dev
```

## Package
```bash
npm run dist
```
Installers are written to `release/`. Build on each target operating system for reliable native packages.

## Configure AI
Open Linden AI settings and provide a base URL (for example `https://api.openai.com/v1`), model ID, and API key. Compatible providers exposing `/chat/completions` can be used. Keys are stored outside the repository using OS-backed Electron encryption when available.

## Security and status
This is an early, runnable foundation—not a hardened production browser. App chrome uses context isolation, no Node integration, sandboxing, and a narrow preload bridge. Website content runs in separate WebContentsViews without the privileged preload. Before public distribution, add explicit permission prompts, download management, stricter popup/navigation policies, CSP, certificate/error UX, signed updates, automated tests and security review.

## Roadmap
1. Permission controls, downloads, private windows and session restore.
2. Bookmarks, history, profiles, find-in-page and keyboard shortcuts.
3. AI streaming, provider presets, model picker and page actions.
4. Reader mode, translation, tab search and comparison.
5. Signed release pipelines for Windows, macOS and Linux.

License: not selected yet.