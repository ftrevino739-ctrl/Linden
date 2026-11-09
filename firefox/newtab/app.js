const SEARCH_API = "http://127.0.0.1:8787";
const feeds = [
  {category:"world",label:"Actualidad",url:"https://feeds.bbci.co.uk/news/world/rss.xml"},
  {category:"sport",label:"Deportes",url:"https://feeds.bbci.co.uk/sport/rss.xml"},
  {category:"business",label:"Finanzas",url:"https://feeds.bbci.co.uk/news/business/rss.xml"},
  {category:"entertainment",label:"Entretenimiento",url:"https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml"},
  {category:"technology",label:"Tecnología",url:"https://feeds.bbci.co.uk/news/technology/rss.xml"}
];

const grid = document.querySelector("#news-grid");
const updated = document.querySelector("#updated");
const resultsView = document.querySelector("#results-view");
const resultsGrid = document.querySelector("#results-grid");
const resultsStatus = document.querySelector("#results-status");
const resultsSource = document.querySelector("#results-source");
const queryInput = document.querySelector("#query");
const newsSection = document.querySelector(".news");
const homeButton = document.querySelector("#home-button");
const historyDialog = document.querySelector("#history-dialog");
const aiDialog = document.querySelector("#ai-dialog");

let stories = [];
let selected = "all";
let searchQuery = "";
let searchType = "all";
let searchRequest = 0;

document.querySelector("#search-form").addEventListener("submit", event => {
  event.preventDefault();
  const q = queryInput.value.trim();
  if (q) runSearch(q, "all");
});

document.querySelectorAll(".results-tab").forEach(button => {
  button.addEventListener("click", () => {
    if (!searchQuery) return;
    searchType = button.dataset.searchType;
    document.querySelectorAll(".results-tab").forEach(tab => tab.classList.toggle("active", tab === button));
    loadResults();
  });
});

homeButton.addEventListener("click", () => {
  searchQuery = "";
  searchType = "all";
  document.querySelector(".page").classList.remove("searching");
  resultsView.hidden = true;
  newsSection.hidden = false;
  homeButton.hidden = true;
  queryInput.value = "";
  queryInput.focus();
});

document.querySelectorAll(".filter").forEach(button => button.addEventListener("click", () => {
  document.querySelector(".filter.active")?.classList.remove("active");
  button.classList.add("active");
  selected = button.dataset.category;
  renderNews();
}));

document.querySelector("#history-button").addEventListener("click", openHistory);
document.querySelector("#history-close").addEventListener("click", () => historyDialog.close());
document.querySelector("#ai-button").addEventListener("click", () => aiDialog.showModal());
document.querySelector("#ai-close").addEventListener("click", () => aiDialog.close());

function runSearch(q, type) {
  searchQuery = q;
  searchType = type;
  queryInput.value = q;
  document.querySelector(".page").classList.add("searching");
  resultsView.hidden = false;
  newsSection.hidden = true;
  homeButton.hidden = false;
  document.querySelectorAll(".results-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.searchType === type));
  loadResults();
}

async function loadResults() {
  const requestId = ++searchRequest;
  resultsStatus.textContent = "Buscando " + searchQuery + "…";
  resultsSource.textContent = "";
  resultsGrid.innerHTML = '<div class="result-message"><span class="result-spinner"></span>Consultando las fuentes de Linden Search…</div>';

  const route = {
    all: "/api/search?category=general",
    images: "/api/search?category=images",
    news: "/api/search?category=news",
    videos: "/api/search?category=videos",
    shopping: "/api/shopping",
    maps: "/api/maps"
  }[searchType] || "/api/search?category=general";

  try {
    const response = await fetch(SEARCH_API + route + "&q=" + encodeURIComponent(searchQuery), {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(18000)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Linden Search respondió HTTP " + response.status);
    if (requestId !== searchRequest) return;
    resultsSource.textContent = payload.source || "";
    renderResults(payload);
  } catch (error) {
    if (requestId !== searchRequest) return;
    const reason = error instanceof Error ? error.message : "Error de conexión";
    resultsStatus.textContent = "Linden Search no está disponible";
    resultsGrid.innerHTML =
      '<div class="result-message error-message"><h2>No se pudo completar la búsqueda</h2>' +
      '<p>' + escapeHTML(reason) + '</p>' +
      '<p>Inicia el servicio local de Linden Search con Docker Desktop:</p>' +
      '<code>firefox\search-engine\start.ps1</code>' +
      '<p>Después vuelve a intentar. Linden no redirige la consulta a Google.</p></div>';
  }
}

function renderResults(payload) {
  const items = Array.isArray(payload.results) ? payload.results : [];
  resultsStatus.textContent = Number(payload.total || items.length).toLocaleString("es-MX") + " resultados para “" + searchQuery + "”";
  if (!items.length) {
    resultsGrid.innerHTML = '<div class="result-message">No encontramos resultados para esta consulta. Prueba con otras palabras.</div>' + renderAlternatives(payload.alternatives);
    return;
  }

  if (searchType === "images") {
    resultsGrid.className = "results-grid image-results";
    resultsGrid.innerHTML = items.map(item => {
      const image = safeUrl(item.img_src || item.thumbnail);
      const link = safeUrl(item.url);
      return '<a class="image-result" href="' + link + '" target="_blank" rel="noopener noreferrer">' +
        (image ? '<img src="' + image + '" alt="' + escapeHTML(item.title) + '" loading="lazy" referrerpolicy="no-referrer">' : '<span class="image-placeholder"></span>') +
        '<span>' + escapeHTML(item.title) + '</span><small>' + escapeHTML(item.engine || hostOf(link)) + '</small></a>';
    }).join("");
    return;
  }

  if (searchType === "shopping") {
    resultsGrid.className = "results-grid shopping-results";
    resultsGrid.innerHTML = items.map(item => {
      const link = safeUrl(item.url);
      const image = safeUrl(item.image);
      const price = item.price === null || item.price === undefined
        ? '<span class="no-price">Consultar precio</span>'
        : '<strong>' + formatPrice(item.price, item.currency || "MXN") + '</strong>';
      return '<article class="product-result"><a class="product-picture" href="' + link + '" target="_blank" rel="noopener noreferrer">' +
        (image ? '<img src="' + image + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<span class="image-placeholder"></span>') +
        '</a><div class="product-info"><h3><a href="' + link + '" target="_blank" rel="noopener noreferrer">' + escapeHTML(item.title) + '</a></h3>' +
        price + '<small>' + escapeHTML([item.store, item.condition, item.freeShipping ? "Envío gratis" : ""].filter(Boolean).join(" · ")) + '</small>' +
        '<a class="result-action" href="' + link + '" target="_blank" rel="noopener noreferrer">Ver oferta ↗</a></div></article>';
    }).join("") + renderAlternatives(payload.alternatives);
    return;
  }

  if (searchType === "maps") {
    resultsGrid.className = "results-grid map-results";
    const firstMap = items.find(item => safeUrl(item.embed));
    const map = firstMap ? '<div class="map-frame"><iframe title="Mapa de OpenStreetMap" loading="lazy" src="' + safeUrl(firstMap.embed) + '" referrerpolicy="no-referrer"></iframe><small>© OpenStreetMap contributors</small></div>' : "";
    resultsGrid.innerHTML = map + '<div class="map-list">' + items.map(item => {
      const link = safeUrl(item.url);
      return '<a class="map-result" href="' + link + '" target="_blank" rel="noopener noreferrer"><span class="map-pin">⌖</span><span><b>' + escapeHTML(item.title) + '</b><small>' + escapeHTML(item.address || "") + '</small><em>' + escapeHTML(item.type || "Lugar") + '</em></span><strong>↗</strong></a>';
    }).join("") + '</div><p class="map-attribution">' + escapeHTML(payload.attribution || "© OpenStreetMap contributors") + '</p>';
    return;
  }

  resultsGrid.className = "results-grid list-results";
  resultsGrid.innerHTML = items.map(item => {
    const link = safeUrl(item.url);
    const date = item.publishedDate ? '<time>' + escapeHTML(formatDate(item.publishedDate)) + '</time>' : "";
    const image = safeUrl(item.thumbnail || item.img_src);
    const visual = searchType === "videos" && image
      ? '<a class="video-thumb" href="' + link + '" target="_blank" rel="noopener noreferrer"><img src="' + image + '" alt="" loading="lazy" referrerpolicy="no-referrer"><span>▶</span></a>'
      : "";
    return '<article class="web-result">' + visual +
      '<div class="result-domain">' + escapeHTML(hostOf(link)) + (item.engine ? ' · ' + escapeHTML(item.engine) : '') + '</div>' +
      '<h3><a href="' + link + '" target="_blank" rel="noopener noreferrer">' + escapeHTML(item.title) + '</a></h3>' +
      (date ? '<div class="result-date">' + date + '</div>' : '') +
      '<p>' + escapeHTML(item.content || "") + '</p></article>';
  }).join("");
}

function renderAlternatives(alternatives) {
  if (!Array.isArray(alternatives) || !alternatives.length) return "";
  return '<div class="marketplace-links"><h3>Explorar otras tiendas</h3>' + alternatives.map(item =>
    '<a href="' + safeUrl(item.url) + '" target="_blank" rel="noopener noreferrer">' + escapeHTML(item.name) + ' ↗</a>'
  ).join("") + '</div>';
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" || url.protocol === "http:" ? escapeHTML(url.href) : "";
  } catch {
    return "";
  }
}

function hostOf(value) {
  try { return new URL(value).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function formatPrice(value, currency) {
  try {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(Number(value));
  } catch {
    return Number(value).toLocaleString("es-MX") + " " + currency;
  }
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(date);
}

async function openHistory() {
  const list = document.querySelector("#history-list");
  list.innerHTML = '<p class="dialog-muted">Cargando historial…</p>';
  historyDialog.showModal();
  try {
    if (!browser?.history?.search) throw new Error("API de historial no disponible");
    const entries = await browser.history.search({ text: "", startTime: 0, maxResults: 30 });
    list.innerHTML = entries.length ? entries.map(entry => {
      const title = escapeHTML(entry.title || entry.url);
      const url = safeUrl(entry.url);
      const date = entry.lastVisitTime ? new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short" }).format(new Date(entry.lastVisitTime)) : "";
      return '<a class="history-entry" href="' + url + '" target="_blank" rel="noopener noreferrer"><span>' + title + '</span><small>' + escapeHTML(date) + '</small></a>';
    }).join("") : '<p class="dialog-muted">Todavía no hay páginas en el historial.</p>';
  } catch (error) {
    console.error("Linden history:", error);
    list.innerHTML = '<p class="dialog-muted">Firefox no permitió consultar el historial. Comprueba el permiso de historial de la extensión.</p>';
  }
}

function textOf(parent, tag) {
  return parent.getElementsByTagName(tag)[0]?.textContent?.trim() || "";
}

function safeDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function safeImage(item) {
  const node = item.getElementsByTagName("media:thumbnail")[0] ||
    item.getElementsByTagName("media:content")[0] ||
    item.querySelector("enclosure[type^='image/']");
  const url = node?.getAttribute("url") || node?.getAttribute("href") || "";
  return /^https:\/\//i.test(url) ? url : "";
}

function renderNews() {
  const visible = stories.filter(item => selected === "all" || item.category === selected).slice(0, 12);
  if (!visible.length) {
    grid.innerHTML = '<div class="empty">No hay titulares disponibles en esta categoría por ahora.</div>';
    return;
  }
  grid.innerHTML = visible.map(item => {
    const title = escapeHTML(item.title);
    const summary = escapeHTML(item.description.slice(0, 150));
    const date = item.date ? new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(new Date(item.date)) : "";
    const visual = item.image
      ? '<div class="story-visual"><img src="' + escapeHTML(item.image) + '" alt="" loading="lazy" referrerpolicy="no-referrer"></div>'
      : '<div class="story-visual fallback-visual" aria-hidden="true"></div>';
    return '<article class="story">' + visual +
      '<div class="story-meta"><span>' + item.label + '</span><time>' + date + '</time></div>' +
      '<h3><a href="' + safeUrl(item.link) + '" target="_blank" rel="noopener noreferrer">' + title + '</a></h3>' +
      '<p>' + summary + '</p><a class="read" href="' + safeUrl(item.link) + '" target="_blank" rel="noopener noreferrer">Leer noticia <span aria-hidden="true">↗</span></a></article>';
  }).join("");
}

async function loadFeed(feed) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetch(feed.url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const xml = new DOMParser().parseFromString(await response.text(), "application/xml");
    if (xml.querySelector("parsererror")) throw new Error("RSS inválido");
    return [...xml.querySelectorAll("item")].slice(0, 8).map(item => ({
      category: feed.category,
      label: feed.label,
      title: textOf(item, "title"),
      description: textOf(item, "description").replace(/<[^>]*>/g, "").trim(),
      link: textOf(item, "link"),
      date: textOf(item, "pubDate"),
      image: safeImage(item)
    })).filter(item => item.title && /^https:\/\//i.test(item.link));
  } catch (error) {
    console.warn("Linden news feed unavailable:", feed.category, error);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

(async () => {
  const results = await Promise.all(feeds.map(loadFeed));
  stories = results.flat().sort((a, b) => safeDate(b.date) - safeDate(a.date));
  renderNews();
  updated.textContent = stories.length
    ? "Actualizado " + new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit" }).format(new Date())
    : "Noticias temporalmente no disponibles";
})();
