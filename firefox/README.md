# Linden for Firefox — foundation

Linden is being built as a Firefox-based browser distribution. The browser engine is Mozilla Gecko (with SpiderMonkey), not Chromium, Electron, CEF or WebView2.

## Current foundation

- `newtab/`: Firefox WebExtension that replaces the new-tab page.
- `theme/userChrome.css`: optional Firefox browser-chrome styling.
- `distribution/distribution.ini`: default preferences for Linden profiles.
- `branding/linden-drop.svg`: original Linden mark.
- News cards load recent headlines from public BBC RSS feeds.
- Search opens a Linden-owned results interface with tabs for web, images, news, videos, shopping and maps. It does not redirect searches to Google.

## Linden Search

The search infrastructure lives in [search-engine/](search-engine/README.md). It contains a local gateway and a SearXNG instance configured to use only the independent Brave and Wikimedia sources listed in `searxng/settings.yml`; Google and Bing are excluded from that allow-list.

Shopping queries use Mercado Libre México with an Open Food Facts fallback. Maps use OpenStreetMap/Nominatim with a local cache and request pacing. See the search-engine README for important limitations and attribution notes.

### Start the local search service on Windows

1. Install and open Docker Desktop.
2. Open PowerShell in the repository folder.
3. Run:
   `cd $HOME\Linden-Firefox-Test\firefox\search-engine`
4. Run:
   `powershell -ExecutionPolicy Bypass -File .\start.ps1`
5. Verify:
   `Invoke-RestMethod http://127.0.0.1:8787/health`

The gateway listens only on the local computer at `127.0.0.1:8787`. It is not exposed to the public internet by this configuration.

## Install the development new-tab extension

1. Open actual Mozilla Firefox Desktop.
2. Visit `about:debugging#/runtime/this-firefox`.
3. Choose **Load Temporary Add-on**.
4. Select `firefox/newtab/manifest.json` from this repository.
5. Open a new tab.

Temporary add-ons are removed when Firefox closes. A production Linden installer still needs a reproducible Firefox build/repackaging pipeline and extension distribution/signing strategy.

## Architecture and limitations

- Firefox owns navigation, tabs, TLS, site isolation, permissions, history, downloads and accessibility.
- Linden supplies the start page, branding and search interface.
- Linden Search currently owns the gateway, API normalization, category UI and local service configuration. Broad web search results still come from independent upstream indexes, not from a complete Linden-built world index.
- Creating a genuinely independent index requires a crawler, robots.txt and sitemap handling, content extraction, canonicalization, deduplication, storage, ranking, spam control, freshness updates and significant compute/storage. That work is the next major search milestone.
- Search results link to their original publishers. Image and video use depends on the source's rights and availability.

Linden is an independent project and is not an official Mozilla product.
