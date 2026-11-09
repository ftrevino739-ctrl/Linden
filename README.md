# Linden

Linden is an independent browser project based on **Mozilla Firefox / Gecko**. Its visual identity is warm, restrained and gold-toned, with its own start page, search experience and optional AI assistant.

## Current direction

- Real Firefox Desktop engine (Gecko + SpiderMonkey).
- Linden-branded new-tab extension and browser customization.
- **Linden Search:** its own results interface and self-hosted search gateway.
- Search categories: web, images, news, videos, shopping and maps.
- No Google or Bing search integration in the Linden Search configuration.
- A staged plan to build Linden's own crawler and index instead of depending permanently on upstream indexes.

## Project status

The active Firefox foundation is in [firefox/](firefox/README.md). The first search-engine infrastructure is in [firefox/search-engine/](firefox/search-engine/README.md). The root Electron prototype files remain historical and are not the target Firefox/Gecko architecture.

Linden Search currently acts as a self-hosted metasearch system: it owns the UI, API gateway and result normalization, while using independent sources to obtain broad web coverage. It is not yet a full-world web index crawled and ranked solely by Linden.

## Start here

1. Read the [Firefox foundation and setup instructions](firefox/README.md).
2. Start the local [Linden Search gateway](firefox/search-engine/README.md).
3. Load the Firefox extension and test every result category.

## Official technical references

- [Firefox Desktop architecture](https://firefox-source-docs.mozilla.org/browser/overview.html)
- [Gecko engine](https://firefox-source-docs.mozilla.org/overview/gecko.html)
- [Building Firefox on Windows](https://firefox-source-docs.mozilla.org/setup/windows_build.html)

Linden is an independent project and is not an official Mozilla product.
