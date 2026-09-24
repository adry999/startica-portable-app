import { posix } from 'node:path';

const ALIAS_TARGETS = {
  '#app/': 'src/app/',
  '#config/': 'src/config/',
  '#core/': 'src/core/',
  '#shared/': 'src/shared/',
  '#features/': 'src/features/',
  '#test-support/': 'tests/support/',
};

const ALLOWED_TARGET_AREAS = {
  app: ['app', 'config', 'core', 'shared', 'features'],
  config: ['config'],
  core: ['core', 'shared', 'config'],
  shared: ['shared'],
  features: ['features', 'core', 'shared'],
  entry: ['app', 'config', 'core', 'shared', 'features'],
  tests: ['app', 'config', 'core', 'shared', 'features'],
};

const SRC_AREAS = ['app', 'config', 'core', 'shared', 'features'];

const PUBLIC_FEATURE_ENTRIES = new Set(['index.server.mjs', 'index.web.mjs']);

const IMPORT_SPECIFIER =
  /\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s*['"]([^'"]+)['"]/gm;

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
        report('external-package');
        continue;
      }

      const isRelative = !specifier.startsWith('#');
      if (sourceInSrc && isRelative && (specifier.match(/\.\.\//g)?.length ?? 0) > 1) report('deep-relative-import');

      const destination = locate(target);
      if (!SRC_AREAS.includes(destination.area)) {
        // scripts/, tests/ și rădăcina pot importa liber în afara src/ (ex. startica_server.mjs, fixture-uri).
        if (sourceInSrc && !(isTestFile(path) && target.startsWith('tests/support/'))) report('import-outside-src');
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
