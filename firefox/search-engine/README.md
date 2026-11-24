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
- Discovers page URLs from `Sitemap:` directives in `robots.txt`, plus conventional `/sitemap.xml` and `/sitemap_index.xml` locations. It can follow same-origin sitemap indexes with per-run file and URL caps.
- Restricts HTML-discovered links to the exact page origin and one link-following level per run; sitemap-discovered pages are also restricted to the sitemap's final origin.
- Keeps a persistent queue in `/data/crawl-queue.json`, stored in the same Docker volume as the index. Visited URLs are remembered across runs, pending work survives restarts, duplicate URLs are suppressed, and temporary fetch failures are requeued for a later run.
- Rejects non-HTTPS destinations, private IPs, unapproved host redirects, oversized pages, and common login/cart/search paths.
- Allows a small, explicit set of host-to-host redirect aliases from `gateway/redirect-hosts.txt`, including the current `www.mozilla.org` → `www.firefox.com` transition; every redirect hop is checked separately, DNS/public-IP validation is repeated, and the destination's `robots.txt` policy is checked before the redirected page is fetched.
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

## Automated regression tests

From the repository root, run `node --test firefox/tests/search-ranking.test.mjs` to verify title relevance, whole-token matching, accent normalization, image-label matching, empty indexes and duplicate canonical URLs. Run `node --test firefox/tests/crawler-safety.test.mjs` to verify that same-host and explicitly approved redirects work while unlisted hosts, HTTPS downgrades, credentials and nonstandard ports are rejected. Run `node --test firefox/tests/crawl-discovery.test.mjs` to verify sitemap parsing, URL safety, queue deduplication, same-origin boundaries and queue persistence.

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
- The first-party Linden Index contains only pages the crawler has actually visited. Its local ranking now uses exact token boundaries, field-aware BM25 scoring, phrase boosts for titles and descriptions, duplicate URL suppression, and a relevance cutoff. Up to eight local matches are blended with upstream results. This remains an early ranking model without mature link-authority, freshness, or large-scale quality signals.
- Image results from Linden are limited to images the crawler extracted from its indexed pages. Image delivery, copyright and hotlink policies remain with the original sites.
- Mercado Libre can rate-limit or change its public API. If it fails, Open Food Facts is a narrow fallback, not a general electronics/fashion marketplace.
- Nominatim's public instance has a strict maximum of one request per second; Linden queues requests and uses a 15-minute cache. Map attribution is displayed.
- Shopping links to Amazon/Mercado Libre are direct external search links, not product-feed data from Amazon.

## Roadmap for a genuinely independent engine

1. Add sitemap ingestion and a persistent, bounded crawl queue; safe, explicitly approved redirect handling is implemented.
2. Expand the index format with language, structured data, canonicalization, stronger duplicate detection and freshness.
3. Calibrate ranking with link authority, freshness, language detection and quality signals.
4. Add separate first-party product and media indexes, including permission-aware image indexing.
5. Operate a larger crawler with domain budgets, abuse detection, monitoring and enough storage/compute.

Do not call Linden a full-web independent search engine until its own index has meaningful coverage and the crawler and ranking system have been stress-tested.
