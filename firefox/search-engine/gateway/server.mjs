import http from 'node:http';
import fs from 'node:fs/promises';

const PORT = Number(process.env.PORT || 8787);
const SEARXNG_URL = (process.env.SEARXNG_URL || 'http://127.0.0.1:8080/').replace(/\/?$/, '/');
const MELI_SITE_ID = process.env.MELI_SITE_ID || 'MLM';
const MELI_ACCESS_TOKEN = process.env.MELI_ACCESS_TOKEN || '';
const NOMINATIM_MIN_INTERVAL_MS = 1100;
const mapCache = new Map();
let lastNominatimRequest = 0;
let nominatimQueue = Promise.resolve();

function corsHeadersFor(req) {
  const origin = String(req.headers.origin || '');
  const allowed = origin.startsWith('moz-extension://') ||
    origin === 'http://127.0.0.1:' + PORT ||
    origin === 'http://localhost:' + PORT;
  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'null',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Private-Network': 'true',
    'Vary': 'Origin',
    'Cache-Control': 'no-store'
  };
}

function send(req, res, status, payload) {
  res.writeHead(status, { ...corsHeadersFor(req), 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function cleanQuery(value) {
  const q = String(value || '').trim().replace(/\s+/g, ' ');
  if (!q) throw new Error('Escribe algo para buscar.');
  if (q.length > 200) throw new Error('La búsqueda no puede superar 200 caracteres.');
  return q;
}

function httpsUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    url.protocol = 'https:';
    return url.toString();
  } catch {
    return '';
  }
}

async function getJson(url, options = {}, timeoutMs = 12000) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      Accept: 'application/json',
      'User-Agent': 'LindenSearch/0.1 (local browser search)',
      ...(options.headers || {})
    }
  });
  if (!response.ok) throw new Error('Proveedor respondió HTTP ' + response.status);
  return response.json();
}


const INDEX_PATH = process.env.LINDEN_INDEX_PATH || '/data/index.json';

function normalizeText(value) {
  return String(value || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function queryTokens(query) {
  return [...new Set(normalizeText(query).split(/\s+/).filter(token => token.length > 1))];
}

async function searchLocalIndex(query, { imagesOnly = false } = {}) {
  let documents = [];
  try {
    const stored = JSON.parse(await fs.readFile(INDEX_PATH, 'utf8'));
    if (Array.isArray(stored.documents)) documents = stored.documents;
  } catch {}
  const terms = queryTokens(query);
  if (!terms.length || !documents.length) return { total: 0, results: [] };

  const ranked = [];
  for (const doc of documents) {
    const title = normalizeText(doc.title);
    const description = normalizeText(doc.description);
    const content = normalizeText(doc.content);
    const whole = title + ' ' + description + ' ' + content;
    const scoreTerm = (term) => {
      const titleHits = title.split(term).length - 1;
      const descriptionHits = description.split(term).length - 1;
      const contentHits = content.split(term).length - 1;
      return titleHits * 5 + descriptionHits * 2 + contentHits;
    };
    const matched = terms.reduce((sum, term) => sum + (whole.includes(term) ? 1 : 0), 0);
    if (!matched) continue;
    let score = terms.reduce((sum, term) => sum + scoreTerm(term), 0);
    if (title.includes(normalizeText(query))) score += 12;
    score += matched / terms.length;
    if (!imagesOnly) {
      ranked.push({
        score,
        item: {
          title: String(doc.title || doc.url),
          url: String(doc.url || ''),
          content: String(doc.description || doc.content || '').slice(0, 450),
          engine: 'Linden Index',
          score
        }
      });
      continue;
    }
    for (const image of Array.isArray(doc.images) ? doc.images : []) {
      const label = normalizeText(image.alt || doc.title);
      const imageMatches = terms.reduce((sum, term) => sum + (label.includes(term) || whole.includes(term) ? 1 : 0), 0);
      if (!imageMatches) continue;
      ranked.push({
        score: score + imageMatches * 2,
        item: {
          title: String(image.alt || doc.title || 'Imagen'),
          url: String(doc.url || ''),
          img_src: httpsUrl(image.imageUrl),
          thumbnail: httpsUrl(image.imageUrl),
          engine: 'Linden Index',
          score: score + imageMatches * 2
        }
      });
    }
  }

  ranked.sort((a, b) => b.score - a.score);
  const unique = new Map();
  for (const entry of ranked) {
    const item = entry.item;
    const key = (item.url || '') + (imagesOnly ? '|' + (item.img_src || '') : '');
    if (key && !unique.has(key)) unique.set(key, item);
  }
  const results = [...unique.values()];
  return { total: results.length, results: results.slice(0, 12) };
}

function mergeResults(primary, secondary, includeImage = false) {
  const seen = new Set();
  const results = [];
  for (const item of [...primary, ...secondary]) {
    if (!item.url) continue;
    const key = (() => {
      try {
        const u = new URL(item.url);
        u.hash = '';
        return u.href.replace(/\/$/, '') + (includeImage ? '|' + (item.img_src || item.thumbnail || '') : '');
      } catch { return item.url; }
    })();
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(item);
  }
  return results;
}

async function indexStats() {
  try {
    const stored = JSON.parse(await fs.readFile(INDEX_PATH, 'utf8'));
    const documents = Array.isArray(stored.documents) ? stored.documents : [];
    return {
      name: 'Linden Index',
      documents: documents.length,
      domains: new Set(documents.map(doc => {
        try { return new URL(doc.url).hostname; } catch { return ''; }
      }).filter(Boolean)).size,
      updatedAt: stored.updatedAt || null,
      lastCrawl: stored.crawl || null
    };
  } catch {
    return { name: 'Linden Index', documents: 0, domains: 0, updatedAt: null, lastCrawl: null };
  }
}

async function searchWeb(q, category, page) {
  const local = (category === 'general' || category === 'images')
    ? await searchLocalIndex(q, { imagesOnly: category === 'images' })
    : { total: 0, results: [] };

  const target = new URL('search', SEARXNG_URL);
  target.searchParams.set('q', q);
  target.searchParams.set('format', 'json');
  target.searchParams.set('categories', category);
  target.searchParams.set('language', 'es-MX');
  target.searchParams.set('pageno', String(page));
  target.searchParams.set('safesearch', '1');

  let payload = null;
  let remoteError = null;
  try {
    payload = await getJson(target);
  } catch (error) {
    remoteError = error;
  }

  if (!payload && !local.results.length) {
    throw (remoteError || new Error('No hay resultados disponibles.'));
  }

  const remoteResults = (Array.isArray(payload?.results) ? payload.results : [])
    .map((item) => ({
      title: String(item.title || 'Resultado sin título'),
      url: httpsUrl(item.url),
      content: String(item.content || item.description || ''),
      img_src: httpsUrl(item.img_src || item.image || ''),
      thumbnail: httpsUrl(item.thumbnail || item.thumbnail_src || ''),
      publishedDate: item.publishedDate || null,
      engine: item.engine || (Array.isArray(item.engines) ? item.engines.join(', ') : ''),
      score: Number(item.score || 0)
    }))
    .filter((item) => item.url);

  const combined = (category === 'general' || category === 'images')
    ? mergeResults(local.results, remoteResults, category === 'images')
    : remoteResults;

  return {
    query: q,
    category,
    total: Number(payload?.number_of_results || remoteResults.length) + local.total,
    source: local.total
      ? 'Linden Index + Brave Search independiente vía SearXNG'
      : 'Brave Search independiente vía SearXNG',
    notice: remoteError
      ? 'Brave no respondió; se muestran coincidencias del índice local de Linden.'
      : undefined,
    results: combined
  };
}
function marketplaceLinks(q) {
  const term = encodeURIComponent(q);
  return [
    { name: 'Mercado Libre México', url: 'https://listado.mercadolibre.com.mx/' + encodeURIComponent(q.toLowerCase().replace(/\s+/g, '-')) },
    { name: 'Amazon México', url: 'https://www.amazon.com.mx/s?k=' + term }
  ];
}

async function searchShopping(q) {
  const target = new URL('/sites/' + encodeURIComponent(MELI_SITE_ID) + '/search', 'https://api.mercadolibre.com');
  target.searchParams.set('q', q);
  target.searchParams.set('limit', '30');
  target.searchParams.set('sort', 'relevance');

  try {
    const headers = MELI_ACCESS_TOKEN ? { Authorization: 'Bearer ' + MELI_ACCESS_TOKEN } : {};
    const payload = await getJson(target, { headers });
    const results = Array.isArray(payload.results) ? payload.results : [];
    return {
      query: q,
      source: 'Mercado Libre México',
      total: Number(payload.paging?.total || results.length),
      alternatives: marketplaceLinks(q),
      results: results.map((item) => ({
        title: String(item.title || 'Producto'),
        url: httpsUrl(item.permalink),
        image: httpsUrl(item.thumbnail || item.secure_thumbnail || ''),
        price: Number(item.price || 0),
        currency: String(item.currency_id || 'MXN'),
        condition: String(item.condition || ''),
        seller: String(item.seller?.nickname || ''),
        freeShipping: Boolean(item.shipping?.free_shipping),
        store: 'Mercado Libre'
      })).filter((item) => item.url)
    };
  } catch (marketError) {
    // Free catalog fallback. It is food/cosmetics-oriented, not a general marketplace.
    const fallback = new URL('https://world.openfoodfacts.org/cgi/search.pl');
    fallback.searchParams.set('search_terms', q);
    fallback.searchParams.set('search_simple', '1');
    fallback.searchParams.set('action', 'process');
    fallback.searchParams.set('json', '1');
    fallback.searchParams.set('page_size', '24');
    fallback.searchParams.set('fields', 'product_name,brands,quantity,code,image_front_small_url,product_url');
    const payload = await getJson(fallback);
    const products = Array.isArray(payload.products) ? payload.products : [];
    return {
      query: q,
      source: 'Open Food Facts · catálogo abierto limitado a alimentos y productos relacionados',
      notice: 'Mercado Libre no respondió. Se muestran coincidencias del catálogo abierto cuando existen.',
      total: products.length,
      alternatives: marketplaceLinks(q),
      results: products.map((item) => ({
        title: String(item.product_name || 'Producto sin nombre'),
        url: httpsUrl(item.product_url) || ('https://world.openfoodfacts.org/product/' + encodeURIComponent(item.code || '')),
        image: httpsUrl(item.image_front_small_url || ''),
        price: null,
        currency: 'MXN',
        condition: [item.brands, item.quantity].filter(Boolean).join(' · '),
        seller: '',
        freeShipping: false,
        store: 'Open Food Facts'
      })).filter((item) => item.url)
    };
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchNominatim(url) {
  const request = nominatimQueue.then(async () => {
    const wait = Math.max(0, NOMINATIM_MIN_INTERVAL_MS - (Date.now() - lastNominatimRequest));
    if (wait) await sleep(wait);
    lastNominatimRequest = Date.now();
    return getJson(url, {
      headers: { 'User-Agent': 'LindenSearch/0.1 (OpenStreetMap geocoding; local desktop browser)' }
    });
  });
  nominatimQueue = request.then(() => undefined, () => undefined);
  return request;
}

async function searchMaps(q) {
  const cached = mapCache.get(q.toLowerCase());
  if (cached && cached.expires > Date.now()) return cached.value;

  const target = new URL('https://nominatim.openstreetmap.org/search');
  target.searchParams.set('q', q);
  target.searchParams.set('format', 'jsonv2');
  target.searchParams.set('addressdetails', '1');
  target.searchParams.set('limit', '8');
  target.searchParams.set('accept-language', 'es-MX');

  const payload = await fetchNominatim(target);
  const results = (Array.isArray(payload) ? payload : []).map((item) => {
    const box = Array.isArray(item.boundingbox) ? item.boundingbox.map(Number) : [];
    const south = box[0], north = box[1], west = box[2], east = box[3];
    const embed = box.length === 4 && box.every(Number.isFinite)
      ? 'https://www.openstreetmap.org/export/embed.html?bbox=' + [west, south, east, north].join('%2C') + '&layer=mapnik&marker=' + encodeURIComponent(item.lat + ',' + item.lon)
      : '';
    return {
      title: String(item.name || item.display_name || 'Lugar'),
      address: String(item.display_name || ''),
      type: String([item.category, item.type].filter(Boolean).join(' · ')),
      lat: Number(item.lat),
      lon: Number(item.lon),
      url: 'https://www.openstreetmap.org/?mlat=' + encodeURIComponent(item.lat) + '&mlon=' + encodeURIComponent(item.lon) + '#map=16/' + encodeURIComponent(item.lat) + '/' + encodeURIComponent(item.lon),
      embed
    };
  }).filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon));

  const value = {
    query: q,
    source: 'OpenStreetMap · búsqueda geográfica con Nominatim',
    attribution: 'Datos © OpenStreetMap contributors',
    total: results.length,
    results
  };
  mapCache.set(q.toLowerCase(), { value, expires: Date.now() + 15 * 60 * 1000 });
  if (mapCache.size > 100) mapCache.delete(mapCache.keys().next().value);
  return value;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeadersFor(req));
    res.end();
    return;
  }

  const url = new URL(req.url || '/', 'http://127.0.0.1:' + PORT);
  try {
    if (req.method !== 'GET') return send(req, res, 405, { error: 'Método no permitido.' });
    if (url.pathname === '/health') return send(req, res, 200, { ok: true, name: 'Linden Search Gateway', version: '0.2.0' });
    if (url.pathname === '/api/index/stats') return send(req, res, 200, await indexStats());

    const q = cleanQuery(url.searchParams.get('q'));
    if (url.pathname === '/api/search') {
      const allowed = new Set(['general', 'images', 'news', 'videos']);
      const category = url.searchParams.get('category') || 'general';
      if (!allowed.has(category)) return send(req, res, 400, { error: 'Categoría de búsqueda no válida.' });
      const page = Math.max(1, Math.min(20, Number(url.searchParams.get('page') || 1) || 1));
      return send(req, res, 200, await searchWeb(q, category, page));
    }
    if (url.pathname === '/api/shopping') return send(req, res, 200, await searchShopping(q));
    if (url.pathname === '/api/maps') return send(req, res, 200, await searchMaps(q));
    return send(req, res, 404, { error: 'Ruta no encontrada.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido.';
    const status = message.startsWith('Escribe') || message.startsWith('La búsqueda') ? 400 : 502;
    return send(req, res, status, { error: message });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Linden Search Gateway escuchando en el puerto ' + PORT);
});
