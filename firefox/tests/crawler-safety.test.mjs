import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRedirectRules,
  isRedirectHostAllowed,
  resolveSafeRedirect
} from '../search-engine/gateway/crawl-safety.mjs';

const rules = parseRedirectRules(`
# Explicit trusted aliases only
www.mozilla.org mozilla.org
mozilla.org www.mozilla.org
www.wikipedia.org wikipedia.org
www.wikipedia.org en.wikipedia.org
`);

test('same-host HTTPS redirects remain allowed without extra rules', () => {
  const target = resolveSafeRedirect(
    'https://developer.mozilla.org/en-US/',
    '/en-US/docs/Web',
    new Map()
  );
  assert.equal(target.href, 'https://developer.mozilla.org/en-US/docs/Web');
});

test('explicit host aliases allow legitimate redirects', () => {
  assert.equal(isRedirectHostAllowed('www.mozilla.org', 'mozilla.org', rules), true);
  const target = resolveSafeRedirect(
    'https://www.wikipedia.org/',
    'https://en.wikipedia.org/wiki/Main_Page',
    rules
  );
  assert.equal(target.hostname, 'en.wikipedia.org');
});

test('unlisted hosts and unlisted reverse directions are rejected', () => {
  assert.equal(isRedirectHostAllowed('www.mozilla.org', 'attacker.example', rules), false);
  assert.equal(isRedirectHostAllowed('en.wikipedia.org', 'www.wikipedia.org', rules), false);
  assert.throws(
    () => resolveSafeRedirect('https://www.mozilla.org/', 'https://attacker.example/', rules),
    /dominio autorizado/
  );
});

test('redirects cannot downgrade HTTPS or include credentials or nonstandard ports', () => {
  assert.throws(
    () => resolveSafeRedirect('https://example.org/', 'http://example.org/page', new Map()),
    /HTTPS/
  );
  assert.throws(
    () => resolveSafeRedirect('https://example.org/', 'https://user:pass@example.org/page', new Map()),
    /HTTPS/
  );
  assert.throws(
    () => resolveSafeRedirect('https://example.org/', 'https://example.org:8443/page', new Map()),
    /HTTPS/
  );
});

test('redirect rule parser rejects malformed or wildcard rules', () => {
  assert.throws(() => parseRedirectRules('*.example.org trusted.example.org'));
  assert.throws(() => parseRedirectRules('source.example.org target.example.org extra'));
});
