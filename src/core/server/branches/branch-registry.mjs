import { existsSync, readFileSync } from 'node:fs';
import { writeJsonFileAtomically } from '#core/server/files/json-file.mjs';
import { normalizeBranchInput, branchSlug } from '#shared/domain/branch.mjs';

/** @typedef {{ id: string, name: string, color: string, address: string, createdAt: string, folder: string | null }} BranchEntry */
/** @typedef {{ version: 1, lastBranchId: string, branches: BranchEntry[] }} BranchRegistry */

const REGISTRY_VERSION = 1;

/**
 * @param {unknown} value
 * @returns {value is BranchEntry}
 */
function looksLikeBranchEntry(value) {
  const candidate = /** @type {Partial<BranchEntry> | null} */ (value);
  return (
    !!candidate &&
    typeof candidate === 'object' &&
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.color === 'string' &&
    typeof candidate.address === 'string' &&
    typeof candidate.createdAt === 'string' &&
    (candidate.folder === null || typeof candidate.folder === 'string')
  );
}

// Distinct de readJsonFile (care întoarce null și doar loghează pe JSON corupt):
// un registru care nu se poate citi trebuie să opreze pornirea cu un mesaj
// clar, nu să fie recreat în tăcere — l-ar face să orfanizeze folderul unei
// filiale existente (decizia 4 din plan).
/**
 * @param {string} file
 * @returns {BranchRegistry | null}
 */
export function readBranchRegistry(file) {
  if (!existsSync(file)) return null;
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`Registrul filialelor (filiale.json) este corupt: ${/** @type {Error} */ (error).message}`);
  }
  const candidate = /** @type {Partial<BranchRegistry> | null} */ (parsed);
  if (
    !candidate ||
    typeof candidate !== 'object' ||
    candidate.version !== REGISTRY_VERSION ||
    typeof candidate.lastBranchId !== 'string' ||
    !Array.isArray(candidate.branches) ||
    !candidate.branches.every(looksLikeBranchEntry)
  )
    throw new Error('Registrul filialelor (filiale.json) este corupt: structură necunoscută.');
  return /** @type {BranchRegistry} */ (candidate);
}

/**
 * @param {string} file
 * @param {BranchRegistry} registry
 */
export function writeBranchRegistry(file, registry) {
  writeJsonFileAtomically(file, registry);
}

/**
 * @typedef {{
 *   list: () => BranchEntry[],
 *   find: (id: string) => BranchEntry | undefined,
 *   add: (input: { name: string, color?: string | null, address?: string | null }) => BranchEntry,
 *   update: (id: string, patch: { name?: string, color?: string, address?: string }) => BranchEntry,
 *   setLastBranchId: (id: string) => void,
 *   ensure: (initialBranch: { name: string, color: string, address: string, folder: string | null }) => BranchRegistry,
 * }} BranchRegistryStore
 */

/**
 * @param {{ file: string, now?: () => string, createId: () => string }} dependencies
 * @returns {BranchRegistryStore}
 */
export function createBranchRegistryStore({ file, now = () => new Date().toISOString(), createId }) {
  const load = () => readBranchRegistry(file);

  /** @returns {BranchEntry[]} */
  function list() {
    return load()?.branches ?? [];
  }

  /** @param {string} id */
  function find(id) {
    return list().find(branch => branch.id === id);
  }

  /** @param {string} name */
  function uniqueFolder(name) {
    const base = branchSlug(name) || 'filiala';
    const taken = new Set(
      list()
        .map(branch => branch.folder)
        .filter(folder => folder !== null),
    );
    if (!taken.has(base)) return base;
    let suffix = 2;
    while (taken.has(`${base}-${suffix}`)) suffix += 1;
    return `${base}-${suffix}`;
  }

  /**
   * @param {{ name: string, color?: string | null, address?: string | null }} input
   * @returns {BranchEntry}
   */
  function add(input) {
    const normalized = normalizeBranchInput(input);
    const registry = load() ?? { version: REGISTRY_VERSION, lastBranchId: '', branches: [] };
    /** @type {BranchEntry} */
    const entry = {
      id: createId(),
      name: normalized.name,
      color: normalized.color,
      address: normalized.address,
      createdAt: now(),
      folder: uniqueFolder(normalized.name),
    };
    writeBranchRegistry(file, { ...registry, branches: [...registry.branches, entry] });
    return entry;
  }

  /**
   * @param {string} id
   * @param {{ name?: string, color?: string, address?: string }} patch
   * @returns {BranchEntry}
   */
  function update(id, patch) {
    const registry = load();
    const existing = registry?.branches.find(branch => branch.id === id);
    if (!registry || !existing) throw new Error(`Filială inexistentă: ${id}.`);
    const normalized = normalizeBranchInput({
      name: patch.name ?? existing.name,
      color: patch.color ?? existing.color,
      address: patch.address ?? existing.address,
    });
    const updated = { ...existing, ...normalized };
    writeBranchRegistry(file, {
      ...registry,
      branches: registry.branches.map(branch => (branch.id === id ? updated : branch)),
    });
    return updated;
  }

  /** @param {string} id */
  function setLastBranchId(id) {
    const registry = load();
    if (!registry) throw new Error('Registrul filialelor nu există.');
    writeBranchRegistry(file, { ...registry, lastBranchId: id });
  }

  // Marca existenței registrului: scrie o singură dată, la prima pornire fără
  // filiale.json. O a doua pornire (registrul deja există) nu îl mai schimbă,
  // altfel o filială #2 creată manual ar fi înlocuită.
  /**
   * @param {{ name: string, color: string, address: string, folder: string | null }} initialBranch
   * @returns {BranchRegistry}
   */
  function ensure(initialBranch) {
    const existing = load();
    if (existing) return existing;
    /** @type {BranchEntry} */
    const entry = { id: createId(), createdAt: now(), ...initialBranch };
    /** @type {BranchRegistry} */
    const registry = { version: REGISTRY_VERSION, lastBranchId: entry.id, branches: [entry] };
    writeBranchRegistry(file, registry);
    return registry;
  }

  return { list, find, add, update, setLastBranchId, ensure };
}
