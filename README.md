# Linden

Linden is an independent browser project based on **Mozilla Firefox / Gecko**. Its visual identity is warm, restrained and gold-toned, with its own start page, search experience and optional AI assistant.

## Current direction

- Real Firefox Desktop engine (Gecko + SpiderMonkey).
- Linden-branded new-tab extension and browser customization.
- **Linden Search:** its own UI, gateway, first-party crawler and persistent starter index.
- Search categories: web, images, news, videos, shopping and maps.
- No Google or Bing search integration in the active Firefox/Linden Search configuration.
- Independent upstream discovery extends the limited first-party index while Linden grows its own crawl coverage.

## Project status

The active Firefox foundation is in [firefox/](firefox/README.md). The search service and first-party crawler are in [firefox/search-engine/](firefox/search-engine/README.md). The root Electron prototype files remain historical and are not the active Firefox/Gecko architecture.

Linden has started its own index, but it is still a small seed-based crawler, not a full-world search index. Broad discovery also uses independent Brave/Wikimedia sources through SearXNG. That distinction is documented honestly in the search-engine README.

## Start here

1. Read the [Firefox foundation](firefox/README.md).
2. Start the local [Linden Search service and crawler](firefox/search-engine/README.md).
3. Load the Firefox extension and test every result category.

Linden is an independent project and is not an official Mozilla product.
