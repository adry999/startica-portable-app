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
};

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
  if (segments[0] !== 'src') return { area: 'outside', feature: null, runtime: 'any' };
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
    for (const specifier of specifiers) {
      const report = rule => violations.push({ path, specifier, rule });

      if (specifier.startsWith('node:')) {
        if (!isTestFile(path) && (source.area === 'shared' || source.runtime === 'web'))
          report('node-builtin-in-browser-code');
        continue;
      }
      const target = resolveTarget(path, specifier);
      // Aplicația nu are dependențe runtime; bibliotecile externe sunt vendorizate în web/vendor.
      if (target === null) {
        report('external-package');
        continue;
      }

      const isRelative = !specifier.startsWith('#');
      if (isRelative && (specifier.match(/\.\.\//g)?.length ?? 0) > 1) report('deep-relative-import');

      const destination = locate(target);
      if (destination.area === 'outside') {
        if (!(isTestFile(path) && target.startsWith('tests/support/'))) report('import-outside-src');
        continue;
      }
      if (isRelative && !sameModule(source, destination)) report('relative-import-across-boundary');
      if (!ALLOWED_TARGET_AREAS[source.area]?.includes(destination.area)) report('forbidden-layer-dependency');
      if (source.area === 'features' && destination.area === 'features' && source.feature !== destination.feature)
        report('feature-imports-feature');

      const targetSegments = target.split('/');
      if (
        source.area === 'app' &&
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
