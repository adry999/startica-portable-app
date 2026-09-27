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

/**
 * Limitator în memorie, cheie = IP. Suficient pentru un singur proces (decizia 1: un
 * proces, o bază), fără nevoie de stocare partajată.
 * @param {{ limit?: number, windowMs?: number }} [options]
 */
export function createRateLimiter({ limit = 5, windowMs = 600000 } = {}) {
  /** @type {Map<string, number[]>} */
  const hitsByKey = new Map();

  /** @param {string} key @param {number} [now] */
  function consume(key, now = Date.now()) {
    const recent = (hitsByKey.get(key) ?? []).filter(hitAt => now - hitAt < windowMs);
    const allowed = recent.length < limit;
    recent.push(now);
    hitsByKey.set(key, recent);
    return allowed;
  }

  return { consume };
}
