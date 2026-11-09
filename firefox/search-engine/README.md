# Linden Search — first crawler + metasearch layer

Linden Search now has two complementary sources:

1. **Linden Index:** a small first-party crawler and a locally stored search index owned by this project.
2. **Independent discovery:** a self-hosted SearXNG service configured to query Brave and Wikimedia sources, without Google or Bing.

The first-party index is real but deliberately small. It does not represent the whole web yet.

## What is implemented

- **Web:** local Linden Index matches are merged with results from Brave through SearXNG.
- **Images:** images extracted from indexed pages are merged with Brave image results.
- **News:** Brave news and Wikinews through SearXNG.
- **Videos:** Brave video results through SearXNG.
- **Shopping:** Mercado Libre México listings; Open Food Facts is a fallback limited to food and related products.
- **Maps:** OpenStreetMap/Nominatim search, cache and attribution.
- **No Google or Bing:** SearXNG's \`keep_only\` list includes Brave and Wikimedia engines only.
- **No public search server:** the gateway port is bound to \`127.0.0.1:8787\` on the user's machine.

## First-party crawler

The crawler is \`gateway/crawler.mjs\`. It currently:

- Starts with HTTPS URLs from \`gateway/seeds.txt\`.
- Checks the domain's \`robots.txt\` and honors matching Allow/Disallow rules.
- Uses a per-domain delay of at least 1.2 seconds.
- Restricts links to the exact seeded domain/origin and one link-following level per run.
- Rejects non-HTTPS destinations, private IPs, off-domain redirects, oversized pages, and common login/cart/search paths.
- Stores title, description, extracted text, canonical URL and a small set of same-host images.
- Skips pages marked \`noindex\`.
- Saves its index into a persistent Docker volume, so it survives container rebuilds.

The first seed set covers selected Mozilla and MDN pages. Edit \`gateway/seeds.txt\` to add public HTTPS pages/domains you have permission to crawl. This initial crawler does **not** yet parse XML sitemaps, follow links across domains, index every image on a site, or crawl the entire web. Robots.txt is a crawler instruction, not a grant of copyright or reuse rights; indexed results link to the original publisher.

## Requirements

- Windows 10/11.
- Docker Desktop installed and running.
- Mozilla Firefox with Linden Start loaded as a temporary add-on.

## Start on Windows

In PowerShell:

\`\`\`powershell
cd $HOME\\Linden-Firefox-Test
git pull origin firefox
cd firefox\\search-engine
powershell -ExecutionPolicy Bypass -File .\\start.ps1
\`\`\`

Check the API:

\`\`\`powershell
Invoke-RestMethod http://127.0.0.1:8787/health
Invoke-RestMethod http://127.0.0.1:8787/api/index/stats
\`\`\`

### Build Linden's own index

Run this after the containers are up:

\`\`\`powershell
docker compose exec gateway node crawler.mjs
\`\`\`

To change seed sites, edit \`gateway/seeds.txt\`, then run the crawl command again. The initial crawl is capped at 25 pages per run; increase only after reviewing the target sites' robots policy and server load. It is intentionally manual at this stage, not a background crawler.

Reload the extension in Firefox at \`about:debugging#/runtime/this-firefox\`, then open a new tab and search. General web and image results can include pages already present in Linden Index.

## Manual API checks

\`\`\`powershell
Invoke-RestMethod "http://127.0.0.1:8787/api/search?q=Firefox&category=general"
Invoke-RestMethod "http://127.0.0.1:8787/api/search?q=JavaScript&category=images"
Invoke-RestMethod "http://127.0.0.1:8787/api/search?q=tecnología&category=news"
Invoke-RestMethod "http://127.0.0.1:8787/api/search?q=recetas&category=videos"
Invoke-RestMethod "http://127.0.0.1:8787/api/shopping?q=audífonos"
Invoke-RestMethod "http://127.0.0.1:8787/api/maps?q=Monterrey"
\`\`\`

Stop the local service with \`docker compose down\` from \`firefox/search-engine\`. The named Docker volume \`linden-index\` preserves the downloaded index.

## Sources and limitations

- SearXNG is a metasearch service, not an index built by Linden. Brave supplies an independent upstream web index; its HTML-based integration may be rate-limited or change.
- The first-party Linden Index contains only pages the initial crawler has actually visited. Its initial ranking is a weighted term-frequency score, not mature BM25 yet.
- Image results from Linden are limited to images the crawler extracted from its indexed pages. Image delivery, copyright and hotlink policies remain with the original sites.
- Mercado Libre can rate-limit or change its public API. If it fails, Open Food Facts is a narrow fallback, not a general electronics/fashion marketplace.
- Nominatim's public instance has a strict maximum of one request per second; Linden queues requests and uses a 15-minute cache. Map attribution is displayed.
- Shopping links to Amazon/Mercado Libre are direct external search links, not product-feed data from Amazon.

## Roadmap for a genuinely independent engine

1. Add sitemap ingestion and a persistent crawl queue.
2. Expand the index format with language, structured data, canonicalization, duplicate detection and freshness.
3. Improve ranking with BM25 and quality signals.
4. Add separate first-party product and media indexes, including permission-aware image indexing.
5. Operate a larger crawler with domain budgets, abuse detection, monitoring and enough storage/compute.

Do not call Linden a full-web independent search engine until its own index has meaningful coverage and the crawler and ranking system have been stress-tested.
