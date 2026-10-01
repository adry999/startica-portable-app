import { posix } from 'node:path';

const ALIAS_TARGETS = {
  '#app/': 'src/app/',
  '#config/': 'src/config/',
  '#core/': 'src/core/',
  '#shared/': 'src/shared/',
  '#features/': 'src/features/',
  '#test-support/': 'tests/support/',
  '#sync-server/': 'sync-server/src/',
};

const ALLOWED_TARGET_AREAS = {
  app: ['app', 'config', 'core', 'shared', 'features'],
  config: ['config'],
  core: ['core', 'shared', 'config'],
  shared: ['shared'],
  features: ['features', 'core', 'shared'],
  entry: ['app', 'config', 'core', 'shared', 'features'],
  tests: ['app', 'config', 'core', 'shared', 'features'],
  outside: [],
};

const SRC_AREAS = ['app', 'config', 'core', 'shared', 'features'];

// scripts/ nu livrează cod în aplicație — design-capture.mjs e tooling de dezvoltare, rulat
// manual (PROMPT-CLAUDE-CODE-6.md §3), niciodată importat din src/. Playwright e devDependency
// doar pentru acest script.
const EXTERNAL_PACKAGE_ALLOWED = new Set(['scripts/design-capture.mjs:playwright']);

const PUBLIC_FEATURE_ENTRIES = new Set(['index.server.mjs', 'index.web.mjs']);

// (?<!['"]) exclude „from” apărut ca text obișnuit lipit de un ghilimel (ex. array de nume de câmpuri
// `'from', 'to'` sau JSDoc `Pick<Leave, 'from' | 'to'>`), unde ghilimeaua de după e cea care închide
// cuvântul, nu una care deschide o cale de import.
const IMPORT_SPECIFIER =
  /(?<!['"])\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s*['"]([^'"]+)['"]/gm;

/**
 * Specificatorii din import/export static, import dinamic și tipurile JSDoc `import('…')`.
 * @param {string} sourceText
 */
export function readImportSpecifiers(sourceText) {
  return [...sourceText.matchAll(IMPORT_SPECIFIER)].map(match => match[1] ?? match[2] ?? match[3]);
}

/** @param {string} path cale posix, relativă la rădăcina repo-ului */
function locate(path) {
  const segments = path.split('/');
  if (segments[0] !== 'src') {
    const isEntry = segments[0] === 'scripts' || segments.length === 1;
    return { area: isEntry ? 'entry' : segments[0] === 'tests' ? 'tests' : 'outside', feature: null, runtime: 'any' };
  }
  const area = segments[1];
  const fileName = segments.at(-1);
  const isServer = segments.includes('server') || fileName === 'index.server.mjs';
  const isWeb = segments.includes('web') || fileName === 'index.web.mjs' || (area === 'shared' && segments[2] === 'ui');
  return {
    area,
    feature: area === 'features' ? segments[2] : null,
    runtime: isServer ? 'server' : isWeb ? 'web' : 'any',
  };
}

/**
 * @param {string} fromPath
 * @param {string} specifier
 * @returns {string | null} null pentru module externe
 */
function resolveTarget(fromPath, specifier) {
  if (specifier.startsWith('./') || specifier.startsWith('../'))
    return posix.normalize(posix.join(posix.dirname(fromPath), specifier));
  // URL de browser evaluat de tests/browser-smoke.mjs în Chrome, nu un pachet extern.
  if (specifier.startsWith('/src/')) return specifier.slice(1);
  const alias = Object.keys(ALIAS_TARGETS).find(prefix => specifier.startsWith(prefix));
  return alias ? ALIAS_TARGETS[alias] + specifier.slice(alias.length) : null;
}

const isTestFile = path => path.endsWith('.test.mjs') || path.split('/').includes('test-support');

const sameModule = (source, destination) =>
  source.area === destination.area && (source.area !== 'features' || source.feature === destination.feature);

/**
 * @param {{ path: string, specifiers: string[] }[]} sourceFiles
 * @returns {{ path: string, specifier: string, rule: string }[]}
 */
export function findImportViolations(sourceFiles) {
  const violations = [];
  for (const { path, specifiers } of sourceFiles) {
    const source = locate(path);
    const sourceInSrc = SRC_AREAS.includes(source.area);
    for (const specifier of specifiers) {
      const report = rule => violations.push({ path, specifier, rule });

      if (specifier.startsWith('node:')) {
        if (!isTestFile(path) && (source.area === 'shared' || source.runtime === 'web'))
          report('node-builtin-in-browser-code');
        continue;
      }
      const target = resolveTarget(path, specifier);
      // src/ nu are dependențe runtime externe; singura excepție (SheetJS) trăiește doar
      // ca dependență npm a webapp/-ului, în afara acestei verificări.
      if (target === null) {
        if (!EXTERNAL_PACKAGE_ALLOWED.has(`${path}:${specifier}`)) report('external-package');
        continue;
      }

      // sync-server/ e un pachet separat, deployat singur (decizia 1 din planul de
      // sincronizare): nu importă nimic din src/, iar restul depozitului nu îl importă
      // decât din teste (fixture-uri și integrări) — #sync-server/* nu e un alias liber.
      const sourceIsSyncServer = path.startsWith('sync-server/');
      if (sourceIsSyncServer && target.startsWith('src/')) report('sync-server-imports-src');
      const allowedToImportSyncServer = path.startsWith('tests/') || path.endsWith('.integration.test.mjs');
      if (!sourceIsSyncServer && target.startsWith('sync-server/src/') && !allowedToImportSyncServer)
        report('sync-server-import-restricted');

      const isRelative = !specifier.startsWith('#');
      if (sourceInSrc && isRelative && (specifier.match(/\.\.\//g)?.length ?? 0) > 1) report('deep-relative-import');

      const destination = locate(target);
      if (!SRC_AREAS.includes(destination.area)) {
        // scripts/, tests/ și rădăcina pot importa liber în afara src/ (ex. startica_server.mjs, fixture-uri);
        // un test (unitar cu tests/support/, sau de integrare cu sync-server/) la fel —
        // altfel e deja semnalat mai sus prin sync-server-import-restricted.
        const isExemptTestImport =
          isTestFile(path) &&
          (target.startsWith('tests/support/') || (target.startsWith('sync-server/src/') && allowedToImportSyncServer));
        if (sourceInSrc && !isExemptTestImport) report('import-outside-src');
        continue;
      }
      if (sourceInSrc && isRelative && !sameModule(source, destination)) report('relative-import-across-boundary');
      if (!ALLOWED_TARGET_AREAS[source.area]?.includes(destination.area)) report('forbidden-layer-dependency');
      if (source.area === 'features' && destination.area === 'features' && source.feature !== destination.feature)
        report('feature-imports-feature');

      const targetSegments = target.split('/');
      if (
        ['app', 'entry', 'tests'].includes(source.area) &&
        destination.area === 'features' &&
        (targetSegments.length !== 4 || !PUBLIC_FEATURE_ENTRIES.has(targetSegments[3]))
      )
        report('feature-private-import');

      if (source.runtime !== 'any' && destination.runtime !== 'any' && source.runtime !== destination.runtime)
        report('cross-runtime-import');
    }
  }
  return violations;
}

// Ceasul aplicației (today(), acum) e centralizat aici, ca regulile de domeniu să rămână testabile prin readNow injectat.
const CALENDAR_MONTH_PATH = 'src/shared/domain/calendar-month.mjs';
const DOMAIN_PATH = /^src\/(features\/[^/]+\/domain\/|shared\/domain\/)/;
const ENVIRONMENT_CONFIG_PATH = 'src/config/environment.mjs';

const CLOCK_PATTERN = /\bDate\.now\s*\(\s*\)|\bnew\s+Date\s*\(\s*\)/g;
const ENV_PATTERN = /\bprocess\.env\b/g;
const CONSOLE_PATTERN = /\bconsole\.[a-zA-Z]+\s*\(/g;
const CONTROL_BYTE_PATTERN = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;

/** @param {string} text */
function lineStartsOf(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
  return starts;
}

/** @param {number[]} lineStarts @param {number} index */
function lineAt(lineStarts, index) {
  let low = 0,
    high = lineStarts.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (lineStarts[mid] <= index) low = mid;
    else high = mid - 1;
  }
  return low + 1;
}

/**
 * Reguli aplicate direct pe textul sursă, nu pe specificatorii de import.
 * @param {{ path: string, text: string }[]} sourceFiles
 * @returns {{ path: string, line: number, rule: string }[]}
 */
export function findSourceTextViolations(sourceFiles) {
  const violations = [];
  for (const { path, text } of sourceFiles) {
    if (!path.startsWith('src/') || isTestFile(path)) continue;
    const lineStarts = lineStartsOf(text);
    const report = (index, rule) => violations.push({ path, line: lineAt(lineStarts, index), rule });

    if (DOMAIN_PATH.test(path) && path !== CALENDAR_MONTH_PATH)
      for (const match of text.matchAll(CLOCK_PATTERN)) report(match.index, 'clock-in-domain');

    if (path !== ENVIRONMENT_CONFIG_PATH)
      for (const match of text.matchAll(ENV_PATTERN)) report(match.index, 'env-outside-config');

    const location = locate(path);
    if (location.runtime === 'web' || location.area === 'shared')
      for (const match of text.matchAll(CONSOLE_PATTERN)) report(match.index, 'console-in-browser-code');

    for (const match of text.matchAll(CONTROL_BYTE_PATTERN)) report(match.index, 'control-bytes-in-source');
  }
  return violations;
}
