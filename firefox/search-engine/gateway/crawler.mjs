import fs from 'node:fs/promises';
import path from 'node:path';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const INDEX_PATH = process.env.LINDEN_INDEX_PATH || '/data/index.json';
const SEEDS_PATH = process.env.LINDEN_SEEDS_PATH || '/app/seeds.txt';
const USER_AGENT = 'LindenBot/0.1';
const MAX_PAGES = Math.max(1, Math.min(100, Number(process.env.LINDEN_CRAWL_MAX_PAGES || 25)));
const MAX_BYTES = 1_500_000;
const MAX_TEXT = 9000;
const MAX_IMAGES = 8;
const DELAY_MS = 1200;
const SKIP_EXT = /\.(?:pdf|zip|rar|7z|mp4|webm|mp3|jpg|jpeg|png|gif|svg|webp|woff2?|ttf|ico|exe)(?:$|\?)/i;
const SKIP_PATH = /\/(?:login|signin|logout|register|cart|checkout|search|share|wp-admin)(?:\/|$)/i;
const robotsCache = new Map();
const lastRequestByHost = new Map();

function cleanText(value) {
  return String(value || '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Math.min(Number(n), 0x10ffff)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(Math.min(parseInt(n, 16), 0x10ffff)))
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function attr(tag, name) {
  const safeName = name.replace(/[^a-z0-9:_-]/gi, '');
  const match = tag.match(new RegExp('\\b' + safeName + '\\s*=\\s*(?:"([^"]*)"|\\x27([^\\x27]*)\\x27|([^\\s>]+))', 'i'));
  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : '';
}

function isPrivateAddress(address) {
  if (isIP(address) === 4) {
    const p = address.split('.').map(Number);
    return p[0] === 0 || p[0] === 10 || p[0] === 127 ||
      (p[0] === 169 && p[1] === 254) ||
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 168) ||
      (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
      p[0] >= 224;
  }
  const v = address.toLowerCase();
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') ||
    /^fe[89ab]/.test(v) || v.startsWith('::ffff:127.') || v.startsWith('::ffff:10.');
}

async function assertPublicHttps(url) {
  if (url.protocol !== 'https:' || url.username || url.password ||
      !url.hostname || (url.port && url.port !== '443')) {
    throw new Error('El crawler solo admite URL HTTPS públicas.');
  }
  const literal = isIP(url.hostname);
  const addresses = literal
    ? [{ address: url.hostname }]
    : await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(item => isPrivateAddress(item.address))) {
    throw new Error('El destino no es una dirección pública permitida.');
  }
}

async function fetchLimited(input, { maxBytes = MAX_BYTES, timeout = 15000, sameHost = true } = {}) {
  let current = new URL(input);
  const originalHost = current.hostname.toLowerCase();
  for (let redirects = 0; redirects <= 4; redirects++) {
    await assertPublicHttps(current);
    if (sameHost && current.hostname.toLowerCase() !== originalHost) {
      throw new Error('Se rechazó una redirección fuera del dominio inicial.');
    }
    const response = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeout),
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.7,*/*;q=0.2'
      }
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Redirección sin destino.');
      current = new URL(location, current);
      continue;
    }
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const length = Number(response.headers.get('content-length') || 0);
    if (length > maxBytes) throw new Error('La página supera el límite de tamaño.');
    const chunks = [];
    let size = 0;
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Respuesta sin contenido.');
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error('La página supera el límite de tamaño.');
      }
      chunks.push(Buffer.from(value));
    }
    return {
      url: current.href,
      status: response.status,
      contentType: response.headers.get('content-type') || '',
      text: Buffer.concat(chunks).toString('utf8')
    };
  }
  throw new Error('Demasiadas redirecciones.');
}

function parseRobots(text) {
  const groups = [];
  let group = null;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.split('#')[0].trim();
    if (!line || !line.includes(':')) continue;
    const colon = line.indexOf(':');
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key === 'user-agent') {
      if (!group || group.hasRules) {
        group = { agents: [], rules: [] };
        groups.push(group);
      }
      group.agents.push(value.toLowerCase());
    } else if (group && ['allow', 'disallow', 'crawl-delay'].includes(key)) {
      group.hasRules = true;
      group.rules.push({ key, value });
    }
  }
  const exact = groups.filter(g => g.agents.includes('lindenbot'));
  const wildcard = groups.filter(g => g.agents.includes('*'));
  const selected = exact.length ? exact : wildcard;
  return {
    rules: selected.flatMap(g => g.rules.filter(r => r.key === 'allow' || r.key === 'disallow')),
    delay: Math.max(DELAY_MS, ...selected.flatMap(g => g.rules.filter(r => r.key === 'crawl-delay').map(r => Number(r.value) * 1000 || 0)))
  };
}

async function getRobots(origin) {
  if (robotsCache.has(origin)) return robotsCache.get(origin);
  let policy = { rules: [], delay: DELAY_MS };
  try {
    const response = await fetchLimited(new URL('/robots.txt', origin).href, { maxBytes: 250000, timeout: 8000 });
    if (response.contentType.includes('text') || response.text.trim()) policy = parseRobots(response.text);
  } catch (error) {
    if (!String(error).includes('HTTP 404') && !String(error).includes('HTTP 410')) {
      console.warn('No se pudo leer robots.txt; se omite el dominio:', origin, String(error));
      policy = { rules: [{ key: 'disallow', value: '/' }], delay: DELAY_MS };
    }
  }
  robotsCache.set(origin, policy);
  return policy;
}

function allowedByRobots(url, policy) {
  const pathName = url.pathname + url.search;
  const matches = policy.rules
    .filter(rule => rule.value && pathName.startsWith(rule.value.replace(/\*$/, '')))
    .sort((a, b) => b.value.length - a.value.length);
  if (!matches.length) return true;
  return matches[0].key === 'allow';
}

async function waitForHost(host, delay) {
  const previous = lastRequestByHost.get(host) || 0;
  const wait = Math.max(0, delay - (Date.now() - previous));
  if (wait) await new Promise(resolve => setTimeout(resolve, wait));
  lastRequestByHost.set(host, Date.now());
}

function extractPage(html, pageUrl) {
  const title = cleanText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]) || pageUrl;
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map(m => m[0]);
  const metaValue = (key) => {
    const tag = metas.find(m => attr(m, 'name').toLowerCase() === key.toLowerCase() ||
      attr(m, 'property').toLowerCase() === key.toLowerCase());
    return tag ? attr(tag, 'content') : '';
  };
  const description = cleanText(metaValue('description') || metaValue('og:description')).slice(0, 600);
  const robots = (metaValue('robots') + ' ' + metaValue('googlebot')).toLowerCase();
  const noindex = /\bnoindex\b/.test(robots);
  const canonicalTag = html.match(/<link\b[^>]*rel\s*=\s*["']?canonical["']?[^>]*>/i)?.[0] || '';
  const canonicalHref = attr(canonicalTag, 'href');
  const canonical = canonicalHref ? new URL(canonicalHref, pageUrl).href : pageUrl;
  const stripped = html
    .replace(/<(script|style|noscript|svg|canvas|template|nav|footer|header)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const content = cleanText(stripped).slice(0, MAX_TEXT);
  const images = [];
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const raw = attr(tag, 'src') || attr(tag, 'data-src');
    const alt = cleanText(attr(tag, 'alt'));
    if (!raw || raw.startsWith('data:')) continue;
    try {
      const imageUrl = new URL(raw, pageUrl);
      if (imageUrl.protocol !== 'https:' || imageUrl.hostname !== new URL(pageUrl).hostname) continue;
      images.push({ imageUrl: imageUrl.href, alt: (alt || title).slice(0, 160) });
      if (images.length >= MAX_IMAGES) break;
    } catch {}
  }
  const links = [];
  for (const match of html.matchAll(/<a\b[^>]*>/gi)) {
    const raw = attr(match[0], 'href');
    if (!raw || raw.startsWith('#') || /^(?:mailto:|javascript:|tel:|data:)/i.test(raw)) continue;
    try {
      const target = new URL(raw, pageUrl);
      if (target.protocol !== 'https:' || target.hostname !== new URL(pageUrl).hostname) continue;
      target.hash = '';
      if (SKIP_EXT.test(target.pathname) || SKIP_PATH.test(target.pathname)) continue;
      links.push(target.href);
    } catch {}
  }
  return { title, description, content, canonical, noindex, images, links: [...new Set(links)] };
}

async function loadIndex() {
  try {
    const value = JSON.parse(await fs.readFile(INDEX_PATH, 'utf8'));
    return Array.isArray(value.documents) ? value : { version: 1, documents: [] };
  } catch {
    return { version: 1, updatedAt: null, documents: [] };
  }
}

async function saveIndex(index) {
  await fs.mkdir(path.dirname(INDEX_PATH), { recursive: true });
  const temp = INDEX_PATH + '.tmp';
  await fs.writeFile(temp, JSON.stringify(index), 'utf8');
  await fs.rename(temp, INDEX_PATH);
}

async function readSeeds() {
  const text = await fs.readFile(SEEDS_PATH, 'utf8');
  return text.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'));
}

async function crawl() {
  const seeds = await readSeeds();
  const queue = [];
  const scopes = new Map();
  for (const seed of seeds) {
    try {
      const url = new URL(seed);
      await assertPublicHttps(url);
      scopes.set(url.hostname.toLowerCase(), url.origin);
      queue.push({ url: url.href, depth: 0, origin: url.origin });
    } catch (error) {
      console.warn('Semilla omitida:', seed, String(error));
    }
  }

  const visited = new Set();
  const index = await loadIndex();
  const byUrl = new Map(index.documents.map(doc => [doc.url, doc]));
  let indexed = 0, denied = 0, failed = 0;

  while (queue.length && visited.size < MAX_PAGES) {
    const item = queue.shift();
    let url;
    try { url = new URL(item.url); } catch { continue; }
    if (visited.has(url.href)) continue;
    visited.add(url.href);
    if (SKIP_EXT.test(url.pathname) || SKIP_PATH.test(url.pathname)) continue;

    const policy = await getRobots(item.origin);
    if (!allowedByRobots(url, policy)) {
      denied++;
      continue;
    }

    try {
      await waitForHost(url.hostname, policy.delay);
      const page = await fetchLimited(url.href, { maxBytes: MAX_BYTES });
      if (!/text\/html|application\/xhtml\+xml/i.test(page.contentType)) continue;
      const data = extractPage(page.text, page.url);
      if (!data.noindex && data.content.length > 80) {
        const canonical = new URL(data.canonical);
        if (canonical.protocol === 'https:' && canonical.hostname.toLowerCase() === url.hostname.toLowerCase()) {
          byUrl.set(canonical.href, {
            url: canonical.href,
            title: data.title,
            description: data.description,
            content: data.content,
            images: data.images,
            crawledAt: new Date().toISOString()
          });
          indexed++;
        }
      }
      if (item.depth < 1) {
        for (const link of data.links) {
          const target = new URL(link);
          const scope = scopes.get(target.hostname.toLowerCase());
          if (scope && target.origin === scope && !visited.has(target.href) && queue.length < MAX_PAGES * 4) {
            queue.push({ url: target.href, depth: item.depth + 1, origin: item.origin });
          }
        }
      }
      console.log((data.noindex ? 'NOINDEX ' : 'INDEXED ') + page.url);
    } catch (error) {
      failed++;
      console.warn('No se pudo rastrear:', url.href, String(error));
    }
  }

  index.documents = [...byUrl.values()].slice(-10000);
  index.updatedAt = new Date().toISOString();
  index.crawl = { visited: visited.size, indexed, denied, failed, maxPages: MAX_PAGES };
  await saveIndex(index);
  console.log(JSON.stringify({
    visited: visited.size,
    indexed,
    deniedByRobots: denied,
    failed,
    totalDocuments: index.documents.length,
    indexPath: INDEX_PATH
  }, null, 2));
}

crawl().catch(error => {
  console.error('Linden crawler falló:', error);
  process.exitCode = 1;
});
