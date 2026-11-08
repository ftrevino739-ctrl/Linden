# Linden

Linden is a calm, Liquid Glass-inspired browser project built on **Mozilla Firefox / Gecko**. The product direction is deliberately no-AI: a fast browser with a gold droplet identity, a clean search/start page and a useful live news feed.

## Current development direction

The original Electron/Chromium prototype is no longer the product architecture. The active foundation is in [firefox/](firefox/README.md):

- Real Firefox Desktop engine (Gecko + SpiderMonkey), not Chromium.
- A minimal start page with page title, search field and current headlines.
- News categories: current affairs, sports, finance/business, entertainment and technology.
- Muted champagne-gold droplet mark.
- Restrained translucent surfaces, graphite text and warm neutrals; no neon palette.
- No AI features, AI services or AI API keys.

## Project status

The firefox-gecko-foundation branch contains the first Firefox customization layer: a new-tab WebExtension, RSS news cards, optional userChrome styling, distribution defaults and the Linden droplet SVG.

This is an early foundation, not yet a standalone branded Firefox installer. The next major engineering milestone is a reproducible Windows Firefox build/repackaging pipeline using Mozilla's source and build system. The existing root Electron files are retained temporarily as prototype history and are not the target architecture.

## Start here

See [Firefox foundation and setup instructions](firefox/README.md).

## Official technical references

- [Firefox Desktop architecture](https://firefox-source-docs.mozilla.org/browser/overview.html)
- [Gecko engine](https://firefox-source-docs.mozilla.org/overview/gecko.html)
- [Building Firefox on Windows](https://firefox-source-docs.mozilla.org/setup/windows_build.html)

Linden is an independent project and is not an official Mozilla product.
