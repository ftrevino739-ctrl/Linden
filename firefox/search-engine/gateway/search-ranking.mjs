function normalizeText(value) {
  return String(value || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenize(value) {
  return normalizeText(value).split(/\s+/).filter(token => token.length > 1);
}

function frequencies(tokens) {
  const counts = new Map();
  for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1);
  return counts;
}

function containsPhrase(tokens, phraseTokens) {
  if (!phraseTokens.length || phraseTokens.length > tokens.length) return false;
  for (let i = 0; i <= tokens.length - phraseTokens.length; i++) {
    if (phraseTokens.every((token, offset) => tokens[i + offset] === token)) return true;
  }
  return false;
}

function bm25(fieldCounts, fieldLength, averageLength, weight, idf) {
  let score = 0;
  const k1 = 1.2;
  const b = 0.68;
  for (const [term, tf] of fieldCounts) {
    if (!tf) continue;
    const lengthNorm = 1 - b + b * fieldLength / Math.max(1, averageLength);
    score += idf.get(term) * weight * ((tf * (k1 + 1)) / (tf + k1 * lengthNorm));
  }
  return score;
}

function normalizedUrl(value) {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.href.replace(/\/$/, '');
  } catch {
    return String(value || '');
  }
}

/**
 * Rank first-party Linden documents using exact token boundaries, field-aware
 * BM25 scoring, phrase boosts and a relative relevance floor.
 */
export function rankLocalDocuments(query, documents, { imagesOnly = false, limit = 8 } = {}) {
  const queryText = normalizeText(query);
  const terms = [...new Set(tokenize(query))];
  if (!terms.length || !Array.isArray(documents) || !documents.length) return [];

  const prepared = documents.map((doc) => {
    const titleTokens = tokenize(doc.title);
    const descriptionTokens = tokenize(doc.description);
    const contentTokens = tokenize(doc.content);
    const allTokens = new Set([...titleTokens, ...descriptionTokens, ...contentTokens]);
    return {
      doc,
      titleTokens,
      descriptionTokens,
      contentTokens,
      titleCounts: frequencies(titleTokens),
      descriptionCounts: frequencies(descriptionTokens),
      contentCounts: frequencies(contentTokens),
      allTokens
    };
  });

  const documentFrequency = new Map(terms.map(term => [term, 0]));
  for (const entry of prepared) {
    for (const term of terms) {
      if (entry.allTokens.has(term)) {
        documentFrequency.set(term, documentFrequency.get(term) + 1);
      }
    }
  }

  const idf = new Map(terms.map((term) => {
    const df = documentFrequency.get(term) || 0;
    return [term, Math.log(1 + (prepared.length - df + 0.5) / (df + 0.5))];
  }));

  const averages = {
    title: prepared.reduce((sum, item) => sum + item.titleTokens.length, 0) / prepared.length,
    description: prepared.reduce((sum, item) => sum + item.descriptionTokens.length, 0) / prepared.length,
    content: prepared.reduce((sum, item) => sum + item.contentTokens.length, 0) / prepared.length
  };

  const ranked = [];
  for (const entry of prepared) {
    const { doc, titleTokens, descriptionTokens, contentTokens } = entry;
    const matchedTerms = terms.filter(term => entry.allTokens.has(term));
    if (!matchedTerms.length) continue;

    const termIdf = new Map(matchedTerms.map(term => [term, idf.get(term)]));
    const score =
      bm25(entry.titleCounts, titleTokens.length, averages.title, 7, termIdf) +
      bm25(entry.descriptionCounts, descriptionTokens.length, averages.description, 3.2, termIdf) +
      bm25(entry.contentCounts, contentTokens.length, averages.content, 1, termIdf) +
      (matchedTerms.length / terms.length) * 2.4 +
      (containsPhrase(titleTokens, terms) ? 11 : 0) +
      (containsPhrase(descriptionTokens, terms) ? 4.5 : 0) +
      (containsPhrase(contentTokens, terms) ? 1.2 : 0) +
      (titleTokens.join(' ') === queryText ? 6 : 0);

    if (!imagesOnly) {
      ranked.push({
        score,
        item: {
          title: String(doc.title || doc.url || 'Resultado'),
          url: String(doc.url || ''),
          content: String(doc.description || doc.content || '').slice(0, 450),
          engine: 'Linden Index',
          score
        }
      });
      continue;
    }

    for (const image of Array.isArray(doc.images) ? doc.images : []) {
      const labelTokens = tokenize((image.alt || '') + ' ' + (doc.title || ''));
      const imageMatches = terms.filter(term => labelTokens.includes(term));
      if (!imageMatches.length) continue;
      const imageScore = score + imageMatches.length * 2.5 +
        (containsPhrase(labelTokens, terms) ? 4 : 0);
      const imageUrl = String(image.imageUrl || '');
      if (!imageUrl) continue;
      ranked.push({
        score: imageScore,
        item: {
          title: String(image.alt || doc.title || 'Imagen'),
          url: String(doc.url || ''),
          img_src: imageUrl,
          thumbnail: imageUrl,
          engine: 'Linden Index',
          score: imageScore
        }
      });
    }
  }

  ranked.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title));
  if (!ranked.length) return [];

  const cutoff = Math.max(0.85, ranked[0].score * 0.06);
  const unique = new Map();
  for (const entry of ranked) {
    if (entry.score < cutoff) continue;
    const key = normalizedUrl(entry.item.url) +
      (imagesOnly ? '|' + normalizedUrl(entry.item.img_src) : '');
    if (key && !unique.has(key)) unique.set(key, entry.item);
    if (unique.size >= Math.max(1, limit)) break;
  }
  return [...unique.values()];
}
