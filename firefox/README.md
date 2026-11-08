# Linden for Firefox — foundation

Linden is being rebuilt as a Firefox-based browser distribution. The browser engine is Mozilla Gecko (with SpiderMonkey), not Chromium, Electron, CEF, or WebView2.

## Architecture decision

The first milestone customizes the real Firefox Desktop application rather than embedding Gecko in a separate shell. Firefox already owns navigation, tabs, networking, TLS, site isolation, permissions, history, bookmarks, downloads, extensions and accessibility. Linden supplies its own start page, restrained Liquid Glass styling, branding and distribution defaults.

This avoids pretending that GeckoView is a supported desktop embedding API. A fully rebranded, self-contained Windows installer will require a later Firefox source build/repackaging milestone.

## Current foundation

- newtab/: a Firefox WebExtension that replaces the new-tab page.
- theme/userChrome.css: optional Firefox browser-chrome styling.
- distribution/distribution.ini: default preferences for Linden profiles.
- branding/linden-drop.svg: original muted-gold droplet mark.
- News cards load recent headlines from public BBC RSS feeds (world, sport, business, entertainment and technology). If a feed is unavailable, the rest of the page continues working.
- Search defaults to DuckDuckGo; users can change Firefox's default search engine.

## Install the development new-tab extension

1. Install current Firefox Desktop (the actual Firefox browser).
2. Open about:debugging#/runtime/this-firefox.
3. Choose Load Temporary Add-on.
4. Select newtab/manifest.json from this repository.
5. Open a new tab. Firefox will display Linden Start.

Temporary add-ons are removed when Firefox closes. For daily use, package and sign the extension or include it in a Firefox distribution.

## Optional browser-chrome styling

1. Open about:config and set toolkit.legacyUserProfileCustomizations.stylesheets to true.
2. Open about:support, find Profile Folder, and open it.
3. Create a folder named chrome if it does not exist.
4. Copy theme/userChrome.css into that folder.
5. Restart Firefox.

The CSS is intentionally conservative and uses neutral graphite, translucent white and warm gold—not neon colors. Firefox UI selectors can change between releases, so this layer must be checked against the target Firefox version.

## News and privacy

The start page requests only the listed public RSS endpoints. It does not inject scripts into visited sites, read page contents, collect browsing history, or send telemetry. Headlines link directly to their publishers. Search requests go to DuckDuckGo by default.

## Performance

Linden does not add a second browser engine or proxy layer. Pages are rendered by Firefox itself. The start page loads news asynchronously with short timeouts and renders a usable search page even when feeds fail. Actual speed still depends on the device, network and websites.

## Roadmap

1. Validate this start page and visual layer on current Firefox for Windows.
2. Add a tested installer/profile bootstrap and branded application assets.
3. Build a reproducible Firefox-based Windows distribution from Mozilla source and apply Linden branding/defaults.
4. Add first-run onboarding, search-engine selection, privacy controls and update channel.
5. Run browser compatibility, security, accessibility and startup/performance tests.

## Build reality

Mozilla's supported Windows build process uses MozillaBuild and the Firefox mach build system. Mozilla documents 4 GB RAM minimum, 8 GB+ recommended and at least 40 GB free disk space. See the official Windows build guide: https://firefox-source-docs.mozilla.org/setup/windows_build.html

This branch is a real Firefox customization foundation, not yet a standalone Linden installer. It does not claim to have compiled or rebranded Firefox itself.
