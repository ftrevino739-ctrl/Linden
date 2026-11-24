export function normalizeHostname(value) {
  return String(value || '').trim().toLowerCase().replace(/\.$/, '');
}

export function parseRedirectRules(text) {
  const rules = new Map();
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.split('#')[0].trim();
    if (!line) continue;
    const [sourceRaw, targetRaw, extra] = line.split(/\s+/);
    if (!sourceRaw || !targetRaw || extra) {
      throw new Error('Regla de redirección inválida: ' + raw);
    }
    const source = normalizeHostname(sourceRaw);
    const target = normalizeHostname(targetRaw);
    if (!/^[a-z0-9.-]+$/.test(source) || !/^[a-z0-9.-]+$/.test(target) ||
        source.startsWith('.') || target.startsWith('.') ||
        source.includes('..') || target.includes('..')) {
      throw new Error('Host inválido en regla de redirección: ' + raw);
    }
    if (!rules.has(source)) rules.set(source, new Set());
    rules.get(source).add(target);
  }
  return rules;
}

export function isRedirectHostAllowed(fromHost, toHost, rules = new Map()) {
  const from = normalizeHostname(fromHost);
  const to = normalizeHostname(toHost);
  if (!from || !to) return false;
  if (from === to) return true;
  return rules.get(from)?.has(to) === true;
}

/**
 * Resolve one redirect hop. Host changes are allowed only through an explicit
 * source -> destination rule. Every hop is checked independently.
 */
export function resolveSafeRedirect(currentValue, location, rules = new Map()) {
  const current = new URL(currentValue);
  const target = new URL(location, current);

  if (target.protocol !== 'https:' || target.username || target.password ||
      !target.hostname || (target.port && target.port !== '443')) {
    throw new Error('La redirección no apunta a una URL HTTPS pública válida.');
  }
  if (!isRedirectHostAllowed(current.hostname, target.hostname, rules)) {
    throw new Error('Se rechazó una redirección fuera del dominio autorizado.');
  }
  return target;
}
