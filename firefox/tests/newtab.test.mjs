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
  assert.equal(manifest.chrome_url_overrides.newtab, "index.html");
  assert.ok(manifest.permissions.includes("https://feeds.bbci.co.uk/*"));
  assert.equal(manifest.browser_specific_settings.gecko.id, "linden-start@linden.browser");
});

test("all local assets referenced by the start page exist", () => {
  for (const [, asset] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^(https?:|data:|#)/i.test(asset)) continue;
    assert.ok(fs.existsSync(path.join(base, asset)), "Missing local asset: " + asset);
  }
});

test("requested product content is present and unwanted tagline is absent", () => {
  for (const label of ["Deportes", "Finanzas", "Entretenimiento", "Tecnología", "Actualidad"]) {
    assert.ok(html.includes(label), "Missing category: " + label);
  }
  assert.match(html, /id="query"/);
  assert.match(html, /Noticias más recientes/);
  assert.doesNotMatch(html, /Navega\.?\s*Descubre\.?\s*Explora/i);
});

test("new-tab script parses and supports search, filters and RSS", () => {
  assert.doesNotThrow(() => new vm.Script(js, { filename: "app.js" }));
  assert.match(js, /duckduckgo\.com/);
  assert.match(js, /Promise\.all\(feeds\.map\(loadFeed\)\)/);
  assert.match(js, /AbortController/);
  assert.match(js, /item\.category===selected/);
  assert.match(js, /noopener noreferrer/);
});

test("Liquid Glass styling stays warm, responsive and accessible", () => {
  assert.match(css, /backdrop-filter:\s*blur/);
  assert.match(css, /#f3c86c|#f7d98e|#e7b951/i);
  assert.match(css, /@media\s*\(max-width:\s*560px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(css, /#(?:00ff|ff00ff|00ffff)/i);
});

test("Firefox layer does not bundle a Chromium or Electron runtime", () => {
  const files = [
    path.join(root, "firefox", "README.md"),
    path.join(base, "manifest.json"),
    path.join(base, "index.html"),
    path.join(base, "app.js"),
    path.join(root, "firefox", "build", "mozconfig.win")
  ];
  const source = files.map(file => fs.readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(source, /(?:from\s*['"](?:electron|playwright|puppeteer)|require\(['"](?:electron|playwright|puppeteer)|webview2)/i);
});
