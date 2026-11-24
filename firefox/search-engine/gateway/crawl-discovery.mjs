function decodeXml(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Math.min(Number(value), 0x10ffff)))
    .replace(/&#x([\da-f]+);/gi, (_, value) => String.fromCodePoint(Math.min(parseInt(value, 16), 0x10ffff)));
}

export function normalizeCrawlUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password ||
        !url.hostname || (url.port && url.port !== '443')) return '';
    url.hash = '';
    return url.href;
  } catch {
    return '';
  }
}

/**
 * Parse both <urlset> and <sitemapindex> documents.
 * The caller decides which exact origin is in crawl scope.
 */
export function parseSitemapLocations(xml, baseUrl, limit = 5000) {
  const base = new URL(baseUrl);
  const output = [];
  const seen = new Set();
  const pattern = /<loc\b[^>]*>([\s\S]*?)<\/loc\s*>/gi;
  for (const match of String(xml || '').matchAll(pattern)) {
    const raw = decodeXml(match[1]).trim();
    if (!raw) continue;
    let resolved;
    try {
      resolved = normalizeCrawlUrl(new URL(raw, base).href);
    } catch {
      continue;
    }
    if (!resolved || seen.has(resolved)) continue;
    seen.add(resolved);
    output.push(resolved);
    if (output.length >= limit) break;
  }
  return output;
}

function makeState(saved = {}) {
  const seen = Array.isArray(saved.seen)
    ? [...new Set(saved.seen.map(normalizeCrawlUrl).filter(Boolean))].slice(-50000)
    : [];
  const state = {
    version: 1,
    seen,
    queue: [],
    updatedAt: saved.updatedAt || null
  };
  Object.defineProperty(state, '_seen', { value: new Set(seen), enumerable: false });
  Object.defineProperty(state, '_queued', { value: new Set(), enumerable: false });

  if (Array.isArray(saved.queue)) {
    for (const item of saved.queue) enqueueCrawlUrl(state, item);
  }
  return state;
}

export function createCrawlState(saved = {}) {
  return makeState(saved);
}

export function enqueueCrawlUrl(state, item, { maxQueue = 50000, maxDepth = 1 } = {}) {
  const url = normalizeCrawlUrl(item?.url);
  if (!url) return false;
  let origin;
  try {
    origin = new URL(item.origin).origin;
  } catch {
    return false;
  }
  if (new URL(url).origin !== origin) return false;
  const depth = Math.max(0, Math.floor(Number(item.depth) || 0));
  if (depth > maxDepth || state._seen.has(url) || state._queued.has(url) ||
      state.queue.length >= maxQueue) return false;
  state.queue.push({
    url,
    origin,
    depth,
    source: String(item.source || 'discovered').slice(0, 40),
    attempts: Math.max(0, Math.floor(Number(item.attempts) || 0))
  });
  state._queued.add(url);
  return true;
}

export function takeNextCrawlItem(state) {
  const item = state.queue.shift() || null;
  if (item) state._queued.delete(item.url);
  return item;
}

export function markCrawlVisited(state, value) {
  const url = normalizeCrawlUrl(value);
  if (!url) return false;
  if (state._queued.has(url)) {
    state._queued.delete(url);
    state.queue = state.queue.filter(item => item.url !== url);
  }
  if (state._seen.has(url)) return false;
  state._seen.add(url);
  state.seen.push(url);
  if (state.seen.length > 50000) {
    const removed = state.seen.splice(0, state.seen.length - 50000);
    for (const old of removed) state._seen.delete(old);
  }
  return true;
}
