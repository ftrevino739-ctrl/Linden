import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const base = path.join(root, "firefox", "newtab");
const read = (name) => fs.readFileSync(path.join(base, name), "utf8");
const html = read("index.html");
const css = read("style.css");
const js = read("app.js");
const manifest = JSON.parse(read("manifest.json"));

test("Firefox WebExtension manifest is valid and overrides new tabs", () => {
  assert.equal(manifest.manifest_version, 2);
  assert.equal(manifest.version, "0.3.0");
  assert.equal(manifest.chrome_url_overrides.newtab, "index.html");
  assert.ok(manifest.permissions.includes("https://feeds.bbci.co.uk/*"));
  assert.ok(manifest.permissions.includes("http://127.0.0.1:8787/*"));
  assert.ok(manifest.permissions.includes("history"));
  assert.equal(manifest.browser_specific_settings.gecko.id, "linden-start@linden.browser");
});

test("all local assets referenced by the start page exist", () => {
  for (const [, asset] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^(https?:|data:|#)/i.test(asset)) continue;
    assert.ok(fs.existsSync(path.join(base, asset)), "Missing local asset: " + asset);
  }
});

test("new tab exposes all requested Linden Search categories", () => {
  for (const label of ["Todos", "Imágenes", "Noticias", "Vídeos", "Shopping", "Maps"]) {
    assert.ok(html.includes(label), "Missing search category: " + label);
  }
  assert.match(html, /id="query"/);
  assert.match(html, /id="results-grid"/);
  assert.match(html, /Noticias más recientes/);
});

test("new-tab script parses and routes searches through the local Linden gateway", () => {
  assert.doesNotThrow(() => new vm.Script(js, { filename: "app.js" }));
  assert.match(js, /127\.0\.0\.1:8787/);
  assert.match(js, /\/api\/shopping/);
  assert.match(js, /\/api\/maps/);
  assert.match(js, /category=images/);
  assert.match(js, /category=news/);
  assert.match(js, /category=videos/);
  assert.doesNotMatch(js, /google\.com|duckduckgo\.com|bing\.com/i);
  assert.match(js, /noopener noreferrer/);
});

test("visual results include web, image, shopping, video and map layouts", () => {
  assert.match(css, /\.results-tabs/);
  assert.match(css, /\.image-results/);
  assert.match(css, /\.shopping-results/);
  assert.match(css, /\.map-results/);
  assert.match(css, /\.video-thumb/);
  assert.match(css, /@media\s*\(max-width:\s*700px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(css, /#(?:00ff|ff00ff|00ffff)/i);
});

test("Firefox layer does not bundle a Chromium or Electron runtime", () => {
  const files = [
    path.join(base, "manifest.json"),
    path.join(base, "index.html"),
    path.join(base, "app.js"),
    path.join(root, "firefox", "build", "mozconfig.win")
  ];
  const source = files.map(file => fs.readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(source, /(?:from\s*['"](?:electron|playwright|puppeteer)|require\(['"](?:electron|playwright|puppeteer)|webview2)/i);
});


test("Linden Search keeps Google and Bing out of its upstream engine allow-list", () => {
  const config = fs.readFileSync(path.join(root, "firefox", "search-engine", "searxng", "settings.yml"), "utf8");
  assert.match(config, /keep_only:/);
  for (const engine of ["brave", "brave.images", "brave.news", "brave.videos", "wikipedia", "wikinews"]) {
    assert.match(config, new RegExp("- " + engine.replace(".", "\\.")));
  }
  assert.doesNotMatch(config, /^\s*- (?:google|bing)(?:\s|$)/m);
  assert.match(config, /formats:\s*\n\s*- html\s*\n\s*- json/);
});

test("Linden Search gateway is bound to loopback on the host", () => {
  const compose = fs.readFileSync(path.join(root, "firefox", "search-engine", "docker-compose.yml"), "utf8");
  assert.match(compose, /127\.0\.0\.1:8787:8787/);
  assert.match(compose, /SEARXNG_URL: http:\/\/searxng:8080\//);
  assert.match(compose, /MELI_SITE_ID: MLM/);
});


test("Search gateway does not expose the local API to arbitrary websites", () => {
  const gateway = fs.readFileSync(path.join(root, "firefox", "search-engine", "gateway", "server.mjs"), "utf8");
  assert.match(gateway, /origin\.startsWith\('moz-extension:\/\/'\)/);
  assert.doesNotMatch(gateway, /Access-Control-Allow-Origin': '\*'/);
});


test("Linden first-party crawler is present and respects crawl boundaries", () => {
  const crawler = fs.readFileSync(path.join(root, "firefox", "search-engine", "gateway", "crawler.mjs"), "utf8");
  assert.match(crawler, /robots\\.txt/);
  assert.match(crawler, /allowedByRobots/);
  assert.match(crawler, /assertPublicHttps/);
  assert.match(crawler, /MAX_PAGES/);
  assert.match(crawler, /noindex/);
  assert.match(crawler, /INDEX_PATH/);
  assert.match(crawler, /images/);
  assert.match(crawler, /visited\\.size < MAX_PAGES/);
});

test("Linden local index is blended into web and image search", () => {
  const gateway = fs.readFileSync(path.join(root, "firefox", "search-engine", "gateway", "server.mjs"), "utf8");
  assert.match(gateway, /searchLocalIndex/);
  assert.match(gateway, /mergeResults\\(local\\.results, remoteResults/);
  assert.match(gateway, /\\/api\\/index\\/stats/);
});
