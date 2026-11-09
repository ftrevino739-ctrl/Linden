# Linden for Firefox — foundation

Linden is being built as a Firefox-based browser distribution. The browser engine is Mozilla Gecko (with SpiderMonkey), not Chromium, Electron, CEF or WebView2.

## Current foundation

- \`newtab/\`: Firefox WebExtension that replaces the new-tab page.
- \`theme/userChrome.css\`: optional Firefox browser-chrome styling.
- \`distribution/distribution.ini\`: default preferences for Linden profiles.
- \`branding/linden-drop.svg\`: original Linden mark.
- The start page keeps current headlines and supplies a Linden-owned search-results interface with tabs for web, images, news, videos, shopping and maps.

## Linden Search

Read [the search-engine setup](search-engine/README.md). Its architecture now includes a first-party crawler and persistent local index, alongside a self-hosted SearXNG service that aggregates independent Brave/Wikimedia sources. Google and Bing are excluded from the SearXNG engine allow-list.

The crawler is a first milestone, not a world-scale index. It starts from a small set of Mozilla/MDN pages, respects robots.txt, is limited to 25 pages per manual run, and stores extracted text and some same-host images in a Docker volume. Broad web discovery still uses the independent upstream index.

### Windows setup

1. Install and open Docker Desktop.
2. In PowerShell, run:

   \`cd $HOME\\Linden-Firefox-Test\`
   
   \`git pull origin firefox\`
   
   \`cd firefox\\search-engine\`
   
   \`powershell -ExecutionPolicy Bypass -File .\\start.ps1\`

3. Check \`Invoke-RestMethod http://127.0.0.1:8787/health\`.
4. Build the initial local index with \`docker compose exec gateway node crawler.mjs\`.
5. In actual Mozilla Firefox, open \`about:debugging#/runtime/this-firefox\`, reload Linden Start and open a new tab.

The gateway is bound only to \`127.0.0.1:8787\` on the local PC; it is not exposed as a public service.

## Browser distribution status

The current foundation uses Firefox Desktop as the application shell and Gecko as the web engine. A branded standalone Linden installer still requires a reproducible Firefox build/repackaging pipeline, update strategy, security review and compatibility testing. This repo state does not claim that a production installer already exists.

Linden is an independent project and is not an official Mozilla product.
