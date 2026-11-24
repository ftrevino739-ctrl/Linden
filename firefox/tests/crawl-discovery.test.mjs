import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCrawlState,
  enqueueCrawlUrl,
  markCrawlVisited,
  normalizeCrawlUrl,
  parseSitemapLocations,
  takeNextCrawlItem
} from '../search-engine/gateway/crawl-discovery.mjs';

test('parses ordinary URL sitemaps and normalizes fragments', () => {
  const xml = `<?xml version="1.0"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>https://docs.example.org/a</loc></url>
    <url><loc>https://docs.example.org/b#section</loc></url>
    <url><loc>https://docs.example.org/a</loc></url>
  </urlset>`;
  assert.deepEqual(
    parseSitemapLocations(xml, 'https://docs.example.org/sitemap.xml'),
    ['https://docs.example.org/a', 'https://docs.example.org/b']
  );
});

test('parses sitemap indexes and decodes XML entities', () => {
  const xml = `<sitemapindex>
    <sitemap><loc>https://docs.example.org/part-1.xml</loc></sitemap>
    <sitemap><loc>https://docs.example.org/part-2.xml?a=1&amp;b=2</loc></sitemap>
  </sitemapindex>`;
  assert.deepEqual(
    parseSitemapLocations(xml, 'https://docs.example.org/sitemap.xml'),
    [
      'https://docs.example.org/part-1.xml',
      'https://docs.example.org/part-2.xml?a=1&b=2'
    ]
  );
});

test('rejects non-HTTPS, credentials, nonstandard ports and malformed entries', () => {
  const xml = `<urlset>
    <url><loc>http://docs.example.org/no</loc></url>
    <url><loc>https://user:pass@docs.example.org/no</loc></url>
    <url><loc>https://docs.example.org:8443/no</loc></url>
    <url><loc>not a URL</loc></url>
  </urlset>`;
  assert.deepEqual(parseSitemapLocations(xml, 'https://docs.example.org/sitemap.xml'), []);
  assert.equal(normalizeCrawlUrl('http://docs.example.org/'), '');
});

test('limits sitemap extraction and uses the sitemap URL as the relative base', () => {
  const xml = `<urlset><url><loc>/one</loc></url><url><loc>/two</loc></url></urlset>`;
  assert.deepEqual(
    parseSitemapLocations(xml, 'https://docs.example.org/maps/site.xml', 1),
    ['https://docs.example.org/one']
  );
});

test('persistent crawl queue deduplicates queued and visited URLs', () => {
  const state = createCrawlState();
  const first = { url: 'https://docs.example.org/page#top', origin: 'https://docs.example.org', depth: 0, source: 'seed' };
  assert.equal(enqueueCrawlUrl(state, first), true);
  assert.equal(enqueueCrawlUrl(state, first), false);
  const item = takeNextCrawlItem(state);
  assert.equal(item.url, 'https://docs.example.org/page');
  assert.equal(markCrawlVisited(state, item.url), true);
  assert.equal(enqueueCrawlUrl(state, first), false);
});

test('queue state survives JSON persistence and retains pending work', () => {
  const state = createCrawlState();
  enqueueCrawlUrl(state, {
    url: 'https://docs.example.org/pending',
    origin: 'https://docs.example.org',
    depth: 1,
    source: 'sitemap'
  });
  markCrawlVisited(state, 'https://docs.example.org/old');
  const restored = createCrawlState(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.seen.includes('https://docs.example.org/old'), true);
  assert.equal(restored.queue.length, 1);
  assert.equal(takeNextCrawlItem(restored).source, 'sitemap');
});

test('queue only accepts URLs within their declared origin scope', () => {
  const state = createCrawlState();
  assert.equal(enqueueCrawlUrl(state, {
    url: 'https://other.example.org/page',
    origin: 'https://docs.example.org',
    depth: 0
  }), false);
  assert.equal(enqueueCrawlUrl(state, {
    url: 'https://docs.example.org/page',
    origin: 'https://docs.example.org',
    depth: 2
  }), false);
});
