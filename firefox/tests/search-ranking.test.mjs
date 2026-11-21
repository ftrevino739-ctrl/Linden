import test from 'node:test';
import assert from 'node:assert/strict';
import { rankLocalDocuments } from '../search-engine/gateway/search-ranking.mjs';

const documents = [
  {
    title: 'JavaScript | MDN',
    url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
    description: 'Learn JavaScript, the programming language of the web.',
    content: 'JavaScript guide and reference.',
    images: [
      { imageUrl: 'https://developer.mozilla.org/assets/javascript-logo.png', alt: 'JavaScript logo' },
      { imageUrl: 'https://developer.mozilla.org/assets/coffee.png', alt: 'Coffee cup' }
    ]
  },
  {
    title: 'Web APIs',
    url: 'https://developer.mozilla.org/en-US/docs/Web/API',
    description: 'Browser APIs and platform features.',
    content: 'This page mentions JavaScript in a few paragraphs, but JavaScript is not its main subject.',
    images: [
      { imageUrl: 'https://developer.mozilla.org/assets/api-icon.png', alt: 'API icon' }
    ]
  },
  {
    title: 'Java programming language',
    url: 'https://example.org/java',
    description: 'An overview of Java.',
    content: 'Java is a programming language.'
  },
  {
    title: 'Café and typography',
    url: 'https://example.org/cafe',
    description: 'A page about café culture.',
    content: 'Coffee and typography.'
  }
];

test('exact title and phrase matches outrank body-only mentions', () => {
  const results = rankLocalDocuments('javascript', documents);
  assert.ok(results.length > 0);
  assert.equal(results[0].title, 'JavaScript | MDN');
  assert.ok(!results.some(item => item.url.endsWith('/Web/API')),
    'Body-only matches should not displace a strong title match.');
});

test('matching uses whole tokens rather than partial substrings', () => {
  const results = rankLocalDocuments('java', documents);
  assert.ok(results.some(item => item.title === 'Java programming language'));
  assert.ok(!results.some(item => item.title === 'JavaScript | MDN'));
});

test('Spanish accents are normalized consistently', () => {
  const results = rankLocalDocuments('cafe', documents);
  assert.ok(results.some(item => item.title === 'Café and typography'));
});

test('image search requires a matching image label', () => {
  const results = rankLocalDocuments('javascript', documents, { imagesOnly: true });
  assert.ok(results.some(item => item.img_src.endsWith('/javascript-logo.png')));
  assert.ok(!results.some(item => item.img_src.endsWith('/coffee.png')));
  assert.ok(!results.some(item => item.img_src.endsWith('/api-icon.png')));
});

test('empty queries and empty indexes return no local results', () => {
  assert.deepEqual(rankLocalDocuments('   ', documents), []);
  assert.deepEqual(rankLocalDocuments('javascript', []), []);
});

test('duplicate canonical URLs are removed and the result limit is enforced', () => {
  const duplicates = [
    ...documents,
    { ...documents[0], url: documents[0].url + '#section' },
    { ...documents[0], url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/' }
  ];
  const results = rankLocalDocuments('javascript', duplicates, { limit: 2 });
  assert.equal(results.length, 1);
});
