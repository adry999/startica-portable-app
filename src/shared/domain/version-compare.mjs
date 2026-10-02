// §5.2 (PROMPT-CLAUDE-CODE-8.md §5 / arhiva PROMPT-CLAUDE-CODE-7.md §3) — versiuni și
// actualizare automată. Compararea e pură și izomorfă (fără node:*), ca server
// (update-check.service.mjs) și, mai târziu, webapp (AppBanner, §11) să folosească aceeași
// regulă, nu două implementări care pot diverge.

const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

/** @typedef {{ major: number, minor: number, patch: number }} Semver */

/**
 * Doar forma X.Y.Z (ca `package.json#version` din acest proiect) — fără pre-release sau
 * build metadata, care nu apar în tag-urile de release folosite aici (`vX.Y.Z`).
 * @param {unknown} value
 * @returns {Semver | null}
 */
export function parseSemver(value) {
  if (typeof value !== 'string') return null;
  const match = SEMVER_PATTERN.exec(value.trim());
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

/**
 * Compară două versiuni X.Y.Z. O versiune malformată (oricare parte) face comparația
 * imposibilă de decis — întoarce `null`, niciodată nu aruncă: apelanții (checkForUpdate)
 * tratează `null` ca „nu există actualizare", nu ca eroare fatală de pornire.
 * @param {string} a
 * @param {string} b
 * @returns {-1 | 0 | 1 | null}
 */
export function compareVersions(a, b) {
  const left = parseSemver(a);
  const right = parseSemver(b);
  if (!left || !right) return null;
  if (left.major !== right.major) return left.major < right.major ? -1 : 1;
  if (left.minor !== right.minor) return left.minor < right.minor ? -1 : 1;
  if (left.patch !== right.patch) return left.patch < right.patch ? -1 : 1;
  return 0;
}

/**
 * @param {string} current
 * @param {string} latest
 */
export function isNewerVersion(current, latest) {
  return compareVersions(current, latest) === -1;
}
