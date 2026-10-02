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
    looksLikeSafeFolder(candidate.folder)
  );
}

// `folder` alimentează direct o cale de fișier (branch-layout.mjs); un separator sau
// „..” aici ar fi o traversare de cale dintr-un filiale.json manipulat manual — de
// încredere azi doar pentru că singurul scriitor e branchSlug (limitat la a-z0-9-).
/** @param {unknown} folder */
function looksLikeSafeFolder(folder) {
  return folder === null || (typeof folder === 'string' && folder.length > 0 && !/[\\/]|\.\./.test(folder));
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
    // O listă goală ar face createApplication să deschidă `openBranchContext(undefined)`
    // (TypeError) — un registru fără nicio filială e la fel de corupt ca unul fără structură.
    candidate.branches.length === 0 ||
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
 *   adopt: (entry: { id: string, name: string, color: string, address: string, createdAt: string }, options?: { folder?: string | null }) => BranchEntry,
 *   replaceEmpty: (oldId: string, entry: { id: string, name: string, color: string, address: string, createdAt: string }) => BranchEntry,
 *   replaceAll: (branches: BranchEntry[], lastBranchId: string) => void,
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

  // Sincronizare (Faza 5, Task 11): o filială văzută pe server dar necunoscută local
  // trebuie adoptată cu ID-UL SERVERULUI (cheia (branch_id,kind,id) acolo e deja legată
  // de el) — spre deosebire de `add`, care generează un id nou pentru o filială creată
  // local. `folder: null` doar când chemarea o cere explicit (calculatorul nou, care
  // preia filiala goală implicită în locul ei, cu folderele ei legacy).
  /**
   * @param {{ id: string, name: string, color: string, address: string, createdAt: string }} entry
   * @param {{ folder?: string | null }} [options]
   * @returns {BranchEntry}
   */
  function adopt(entry, { folder } = {}) {
    const registry = load() ?? { version: REGISTRY_VERSION, lastBranchId: '', branches: [] };
    /** @type {BranchEntry} */
    const created = { ...entry, folder: folder === null ? null : uniqueFolder(entry.name) };
    writeBranchRegistry(file, { ...registry, branches: [...registry.branches, created] });
    return created;
  }

  // Calculatorul nou pornește cu o filială #1 goală (create-application.mjs, decizia 4
  // din 2026-09-27-filiale.md); la connect, dacă serverul are deja o filială cu date pe
  // care local n-o are, aia devine filiala #1 — păstrându-i folderul (de obicei null,
  // legacy), ca datele descărcate să meargă direct în folderele vechi, nu într-un
  // Filiale\<slug> nou, orfan.
  /**
   * @param {string} oldId
   * @param {{ id: string, name: string, color: string, address: string, createdAt: string }} entry
   * @returns {BranchEntry}
   */
  function replaceEmpty(oldId, entry) {
    const registry = load();
    const existing = registry?.branches.find(branch => branch.id === oldId);
    if (!registry || !existing) throw new Error(`Filială inexistentă: ${oldId}.`);
    /** @type {BranchEntry} */
    const replaced = { ...entry, folder: existing.folder };
    writeBranchRegistry(file, {
      ...registry,
      lastBranchId: registry.lastBranchId === oldId ? entry.id : registry.lastBranchId,
      branches: registry.branches.map(branch => (branch.id === oldId ? replaced : branch)),
    });
    return replaced;
  }

  // Restaurarea unei arhive complete (42d): „restaurarea e du instalarea la starea de
  // atunci, nu o îmbinare” (decizia 7 din docs/superpowers/plans/2026-10-01-backup-complet.md)
  // — filiale.json e ÎNLOCUIT cu exact lista din arhivă, nu îmbinat cu cea locală. Apelantul
  // (create-application.mjs) decide deja folderul fiecărei filiale (păstrat pentru cele deja
  // cunoscute local, alocat nou pentru cele necunoscute) — aici doar se scrie, atomic.
  /**
   * @param {BranchEntry[]} branches
   * @param {string} lastBranchId
   */
  function replaceAll(branches, lastBranchId) {
    writeBranchRegistry(file, { version: REGISTRY_VERSION, lastBranchId, branches });
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

  return { list, find, add, update, setLastBranchId, ensure, adopt, replaceEmpty, replaceAll };
}
