import { createHash, randomBytes } from 'node:crypto';

/** @param {string} token */
export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

/** 32 octeți aleatori, în clar doar în `sync.json` de pe calculator; pe server se ține hash-ul. */
export function createToken() {
  return randomBytes(32).toString('base64url');
}

/** @param {{ headers: Record<string, string | string[] | undefined> }} request */
export function bearerToken(request) {
  const header = request.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return undefined;
  const token = header.slice('Bearer '.length).trim();
  return token || undefined;
}

const DEFAULT_MAX_KEYS = 10000;

/**
 * Limitator în memorie, cheie = IP. Suficient pentru un singur proces (decizia 1: un
 * proces, o bază), fără nevoie de stocare partajată.
 *
 * Fără curățare, harta ar crește nelimitat: fiecare IP distinct văzut vreodată rămâne
 * pentru totdeauna (D-6). O curățare periodică elimină cheile fără nicio lovitură în
 * fereastra curentă, iar `maxKeys` e un plafon dur împotriva unui atacator care schimbă
 * adresa la fiecare cerere (prin `X-Forwarded-For`, dacă `trustProxy` e activat greșit).
 * @param {{ limit?: number, windowMs?: number, sweepIntervalMs?: number, maxKeys?: number }} [options]
 */
export function createRateLimiter({
  limit = 5,
  windowMs = 600000,
  sweepIntervalMs = windowMs,
  maxKeys = DEFAULT_MAX_KEYS,
} = {}) {
  /** @type {Map<string, number[]>} */
  const hitsByKey = new Map();

  /** @param {string} key @param {number} [now] */
  function consume(key, now = Date.now()) {
    const recent = (hitsByKey.get(key) ?? []).filter(hitAt => now - hitAt < windowMs);
    const allowed = recent.length < limit;
    recent.push(now);
    hitsByKey.set(key, recent);
    if (hitsByKey.size > maxKeys) {
      // Map păstrează ordinea de inserare: prima cheie e cea mai veche văzută vreodată.
      const oldestKey = hitsByKey.keys().next().value;
      if (oldestKey !== undefined && oldestKey !== key) hitsByKey.delete(oldestKey);
    }
    return allowed;
  }

  /** @param {number} [now] */
  function sweep(now = Date.now()) {
    for (const [key, hits] of hitsByKey) {
      const recent = hits.filter(hitAt => now - hitAt < windowMs);
      if (recent.length === 0) hitsByKey.delete(key);
      else hitsByKey.set(key, recent);
    }
  }

  const timer = setInterval(sweep, sweepIntervalMs);
  timer.unref?.();

  return { consume, sweep, stop: () => clearInterval(timer), size: () => hitsByKey.size };
}
