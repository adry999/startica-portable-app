// §5.2 (docs/design/PROMPT-CLAUDE-CODE-8.md §5 / arhiva PROMPT-CLAUDE-CODE-7.md §3,
// docs/design/screens/32-actualizari.md) — publicarea unui release: bump versiune → commit →
// `scripts/pachet-client/build-client-package.ps1` (instalerul) → SHA-256 → `latest.json` →
// `gh release create`, pe repo-ul din `releaseRepo` (§config/environment.mjs,
// STARTICA_RELEASE_REPO / DEFAULT_RELEASE_REPO — vezi docs/design/INTREBARI.md pentru
// întrebarea despre un repo de release separat).
//
// `build-client-package.ps1` cere arborele de lucru curat (compară cu `git archive HEAD`) —
// de-asta bump-ul de versiune trebuie commis înainte de a construi instalerul, nu doar scris
// pe disc. Fiecare pas extern (git, PowerShell/ISCC, `gh`) e injectabil, ca scriptul să fie
// testabil fără Inno Setup sau `gh` reale instalate (convenția din scripts/migrate/*.test.mjs).
//
// NU rula cu --execute fără să știi ce faci: scrie în package.json, face un commit real și
// publică un release public pe GitHub. Implicit (fără --execute) e dry-run — arată versiunea
// următoare și pașii care s-ar executa, fără nicio schimbare.
//
// Rulare:
//   node scripts/release.mjs                          # dry-run, bump implicit „patch”
//   node scripts/release.mjs minor --notes "..."      # dry-run, previzualizează un „minor”
//   node scripts/release.mjs --execute                # publică efectiv (patch)
//   node scripts/release.mjs major --execute --notes "Note de release" --repo owner/repo
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { DEFAULT_RELEASE_REPO } from '../src/config/environment.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DEFAULT_PACKAGE_JSON_PATH = join(ROOT, 'package.json');
const BUMP_KINDS = ['major', 'minor', 'patch'];

/**
 * Semver simplu X.Y.Z (fără pre-release/build metadata) — singura formă folosită în
 * `package.json#version` și în tag-urile `vX.Y.Z` ale acestui proiect.
 * @param {string} value
 */
export function parseSemver(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(value).trim());
  if (!match) throw new Error(`Versiune invalidă: „${value}”. Folosește forma X.Y.Z.`);
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

/**
 * @param {string} current
 * @param {'major' | 'minor' | 'patch'} kind
 */
export function bumpVersion(current, kind) {
  if (!BUMP_KINDS.includes(kind))
    throw new Error(`Tip de bump necunoscut: „${kind}”. Folosește ${BUMP_KINDS.join(', ')}.`);
  const { major, minor, patch } = parseSemver(current);
  if (kind === 'major') return `${major + 1}.0.0`;
  if (kind === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

/** @param {string} [packageJsonPath] */
export function readPackageVersion(packageJsonPath = DEFAULT_PACKAGE_JSON_PATH) {
  return JSON.parse(readFileSync(packageJsonPath, 'utf8')).version;
}

/**
 * @param {string} nextVersion
 * @param {string} [packageJsonPath]
 */
export function writePackageVersion(nextVersion, packageJsonPath = DEFAULT_PACKAGE_JSON_PATH) {
  const json = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  json.version = nextVersion;
  // 2 spații + linie finală nouă — ca restul fișierelor JSON din repo (prettier).
  writeFileSync(packageJsonPath, JSON.stringify(json, null, 2) + '\n');
}

/** @param {string} filePath */
export function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

/** @param {string} version */
export function installerFileName(version) {
  return `Startica_Setup_${version}.exe`;
}

/**
 * @param {string} repo "owner/repo"
 * @param {string} version
 */
export function releaseDownloadUrl(repo, version) {
  return `https://github.com/${repo}/releases/download/v${version}/${installerFileName(version)}`;
}

/**
 * Manifestul publicat ca asset de release, citit de `update-check.service.mjs` (§5.2).
 * @param {{ repo: string, version: string, sha256: string, notes?: string, now?: () => Date }} args
 */
export function buildLatestManifest({ repo, version, sha256, notes = '', now = () => new Date() }) {
  return {
    version,
    downloadUrl: releaseDownloadUrl(repo, version),
    sha256,
    notes,
    publishedAt: now().toISOString(),
  };
}

/**
 * @param {object} manifest
 * @param {string} outputPath
 */
export function writeLatestManifest(manifest, outputPath) {
  writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + '\n');
}

/** @param {{ cwd: string, args: string[] }} args */
function defaultRunGit({ cwd, args }) {
  return execFileSync('git', args, { cwd, stdio: 'pipe', encoding: 'utf8' });
}

/** @param {{ cwd: string, outputDirectory: string }} args */
function defaultRunPowerShell({ cwd, outputDirectory }) {
  const script = join(cwd, 'scripts', 'pachet-client', 'build-client-package.ps1');
  execFileSync(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-OutputDirectory', outputDirectory],
    { cwd, stdio: 'inherit' },
  );
}

/** @param {{ cwd: string, args: string[] }} args */
function defaultRunGh({ cwd, args }) {
  execFileSync('gh', args, { cwd, stdio: 'inherit' });
}

/**
 * Orchestrarea publicării. Fiecare pas extern e injectabil, implicit pe comenzile reale
 * (git/PowerShell+ISCC/gh) — un apelant de test dă funcții false, ca restul logicii (bump,
 * manifest, numele asset-urilor) să rămână testabilă fără unelte externe instalate.
 * @param {{
 *   bump?: 'major' | 'minor' | 'patch',
 *   repo?: string,
 *   notes?: string,
 *   execute?: boolean,
 *   root?: string,
 *   packageJsonPath?: string,
 *   outputDir?: string,
 *   runGit?: (args: { cwd: string, args: string[] }) => string,
 *   runPowerShell?: (args: { cwd: string, outputDirectory: string }) => void,
 *   runGh?: (args: { cwd: string, args: string[] }) => void,
 *   log?: (line: string) => void,
 * }} [options]
 */
export async function runRelease({
  bump = 'patch',
  repo = DEFAULT_RELEASE_REPO,
  notes = '',
  execute = false,
  root = ROOT,
  packageJsonPath = join(root, 'package.json'),
  outputDir = join(root, 'Livrare'),
  runGit = defaultRunGit,
  runPowerShell = defaultRunPowerShell,
  runGh = defaultRunGh,
  log = console.log,
} = {}) {
  const currentVersion = readPackageVersion(packageJsonPath);
  const nextVersion = bumpVersion(currentVersion, bump);
  const tag = `v${nextVersion}`;
  const installerPath = join(outputDir, installerFileName(nextVersion));
  const manifestPath = join(outputDir, 'latest.json');

  log(execute ? '=== EXECUTE — se publică efectiv ===' : '=== DRY RUN (implicit) — nimic scris, nimic publicat ===');
  log(`Versiune curentă: ${currentVersion} → următoarea (${bump}): ${nextVersion}`);
  log(`Repo de release: ${repo} (tag ${tag})`);
  log(`Instaler așteptat: ${installerPath}`);
  log(`Manifest: ${manifestPath}`);

  if (!execute) {
    log('\nDry-run — nimic scris. Rulează cu --execute pentru publicarea reală.');
    return { currentVersion, nextVersion, tag, repo, installerPath, manifestPath, executed: false };
  }

  log('\n1/5 — scriu versiunea nouă în package.json');
  writePackageVersion(nextVersion, packageJsonPath);

  log('2/5 — commit (build-client-package.ps1 cere arborele de lucru curat)');
  runGit({ cwd: root, args: ['add', '--', packageJsonPath] });
  runGit({ cwd: root, args: ['commit', '-m', `chore(packaging): pregătire ${tag}`] });

  log('3/5 — construiesc instalerul (build-client-package.ps1 → ISCC)');
  runPowerShell({ cwd: root, outputDirectory: outputDir });
  if (!existsSync(installerPath)) throw new Error(`Instalerul așteptat lipsește după build: ${installerPath}`);

  log('4/5 — SHA-256 + latest.json');
  const sha256 = sha256File(installerPath);
  const manifest = buildLatestManifest({ repo, version: nextVersion, sha256, notes });
  writeLatestManifest(manifest, manifestPath);
  log(`SHA-256: ${sha256}`);

  log('5/5 — gh release create');
  runGh({
    cwd: root,
    args: [
      'release',
      'create',
      tag,
      installerPath,
      manifestPath,
      '--repo',
      repo,
      '--title',
      `Startica ${nextVersion}`,
      '--notes',
      notes || `Startica ${nextVersion}.`,
    ],
  });

  log(`\nGata — ${tag} publicat pe ${repo}.`);
  return { currentVersion, nextVersion, tag, repo, installerPath, manifestPath, sha256, manifest, executed: true };
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  const args = process.argv.slice(2);
  const bump = args.find(arg => BUMP_KINDS.includes(arg)) ?? 'patch';
  const execute = args.includes('--execute');
  const repoIndex = args.indexOf('--repo');
  const repo = repoIndex !== -1 ? args[repoIndex + 1] : DEFAULT_RELEASE_REPO;
  const notesIndex = args.indexOf('--notes');
  const notes = notesIndex !== -1 ? args[notesIndex + 1] : '';
  runRelease({ bump, execute, repo, notes }).catch(e => {
    console.error('EROARE:', /** @type {Error} */ (e).message);
    process.exitCode = 1;
  });
}
