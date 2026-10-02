// Copie a #shared/domain/version-compare.mjs — sync-server/ nu importă nimic din src/
// (vezi README.md, „Rulare locală”: pachet separat, livrat singur). Doar compareVersions,
// nu fișierul întreg: sync-server/ are nevoie exclusiv să compare versiunea trimisă de
// client (X-Startica-Version) cu SYNC_MIN_CLIENT_VERSION (version-gate.mjs, 426).

const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

/** @typedef {{ major: number, minor: number, patch: number }} Semver */

/**
 * Doar forma X.Y.Z — fără pre-release sau build metadata, ca în #shared/domain/version-compare.mjs.
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
 * Compară două versiuni X.Y.Z; o versiune malformată face comparația imposibil de decis —
 * întoarce `null`, niciodată nu aruncă (aceeași convenție ca versiunea din #shared/domain/).
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
