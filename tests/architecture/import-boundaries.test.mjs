import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findImportViolations, readImportSpecifiers } from './import-boundary-rules.mjs';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

const sourceFile = (path, ...specifiers) => ({ path, specifiers });
const rulesFor = sourceFiles => findImportViolations(sourceFiles).map(violation => violation.rule);

/** @param {string} projectRoot folderul care conține src/ */
function collectSourceFiles(projectRoot) {
  return readdirSync(join(projectRoot, 'src'), { withFileTypes: true, recursive: true })
    .filter(entry => entry.isFile() && /\.(mjs|d\.mts)$/.test(entry.name))
    .map(entry => {
      const absolutePath = join(entry.parentPath, entry.name);
      return {
        path: relative(projectRoot, absolutePath).split(sep).join('/'),
        specifiers: readImportSpecifiers(readFileSync(absolutePath, 'utf8')),
      };
    });
}

/** @param {string} dir cale relativă la REPO_ROOT @param {RegExp} pattern @param {string} [excludePrefix] */
function collectRepoFiles(dir, pattern, excludePrefix) {
  return readdirSync(join(REPO_ROOT, dir), { withFileTypes: true, recursive: true })
    .filter(entry => entry.isFile() && pattern.test(entry.name))
    .map(entry => relative(REPO_ROOT, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .filter(path => !excludePrefix || !path.startsWith(excludePrefix))
    .map(path => ({ path, specifiers: readImportSpecifiers(readFileSync(join(REPO_ROOT, path), 'utf8')) }));
}

/** Tot codul livrat: src/, scripts/, tests/ (fără fixture-urile din tests/architecture/) și rădăcina. */
function collectApplicationFiles() {
  const rootFiles = readdirSync(REPO_ROOT, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.mjs'))
    .map(entry => ({
      path: entry.name,
      specifiers: readImportSpecifiers(readFileSync(join(REPO_ROOT, entry.name), 'utf8')),
    }));
  return [
    ...collectRepoFiles('src', /\.(mjs|d\.mts)$/),
    ...collectRepoFiles('scripts', /\.mjs$/),
    ...collectRepoFiles('tests', /\.mjs$/, 'tests/architecture/'),
    ...rootFiles,
  ];
}

test('citește specificatorii din import, export, import dinamic și tipuri JSDoc', () => {
  const sourceText = [
    "import { formatMoney } from '#shared/format/money-format.mjs';",
    "export { createAuditLogApi } from './web/audit-log.api.mjs';",
    "import './side-effect.mjs';",
    "const { ApiError } = await import('#core/web/api-error.mjs');",
    "/** @typedef {import('../audit-log.types.mjs').AuditEntry} AuditEntry */",
  ].join('\n');

  assert.deepEqual(readImportSpecifiers(sourceText), [
    '#shared/format/money-format.mjs',
    './web/audit-log.api.mjs',
    './side-effect.mjs',
    '#core/web/api-error.mjs',
    '../audit-log.types.mjs',
  ]);
});

test('permite dependențele din arhitectura țintă', () => {
  assert.deepEqual(
    rulesFor([
      sourceFile(
        'src/features/payment-assignment/web/payment-assignment.controller.mjs',
        '#shared/contracts/domain-events.mjs',
        '#core/web/view-state.mjs',
        '../domain/unassigned-payment-queue.mjs',
      ),
      sourceFile(
        'src/features/payment-assignment/web/payment-assignment.controller.test.mjs',
        'node:test',
        '#test-support/in-memory-record-repository.mjs',
        '../test-support/assignment-fixtures.mjs',
      ),
      sourceFile('src/features/audit-log/server/audit-log.repository.mjs', '#core/server/errors/domain-error.mjs'),
      sourceFile(
        'src/app/server/create-application.mjs',
        '#features/audit-log/index.server.mjs',
        '#core/server/database/schema.mjs',
        '#config/environment.mjs',
        'node:path',
      ),
      sourceFile('src/core/web/view-state.mjs', './api-error.mjs', '#shared/contracts/domain-events.mjs'),
      sourceFile(
        'scripts/import-v5-history.mjs',
        '#features/data-transfer/index.server.mjs',
        '#app/server/create-application.mjs',
      ),
      sourceFile('tests/browser-smoke.mjs', '../startica_server.mjs', '/src/app/web/app-session.mjs'),
      sourceFile('tests/support/start-test-application.mjs', '#app/server/create-application.mjs'),
      sourceFile(
        'src/app/server/telegram-digest.mjs',
        '#features/children/index.server.mjs',
        '#features/visits/index.server.mjs',
        '#features/billing/index.server.mjs',
        '#features/telegram-notify/index.server.mjs',
      ),
    ]),
    [],
  );
});

test('semnalează fiecare tip de încălcare a granițelor', () => {
  /** @type {[{ path: string, specifiers: string[] }, string][]} */
  const cases = [
    [
      sourceFile('src/features/billing/web/notify-list.controller.mjs', '#features/payment-assignment/index.web.mjs'),
      'feature-imports-feature',
    ],
    [sourceFile('src/shared/domain/money.mjs', '#core/web/api-error.mjs'), 'forbidden-layer-dependency'],
    [
      sourceFile('src/core/server/http/route-dispatcher.mjs', '#features/audit-log/index.server.mjs'),
      'forbidden-layer-dependency',
    ],
    [
      sourceFile('src/app/web/compose-features.mjs', '#features/audit-log/web/audit-log.controller.mjs'),
      'feature-private-import',
    ],
    [
      sourceFile('src/features/audit-log/web/audit-log.api.mjs', '../server/audit-log.repository.mjs'),
      'cross-runtime-import',
    ],
    [
      sourceFile('src/features/audit-log/web/audit-log.view.mjs', '../../../shared/format/html-escape.mjs'),
      'deep-relative-import',
    ],
    [
      sourceFile('src/core/web/api-client.mjs', '../../shared/format/html-escape.mjs'),
      'relative-import-across-boundary',
    ],
    [sourceFile('src/shared/format/date-format.mjs', 'node:util'), 'node-builtin-in-browser-code'],
    [sourceFile('src/features/children/web/children-list.view.mjs', 'lodash'), 'external-package'],
    [
      sourceFile('src/features/children/domain/birthdays.mjs', '#test-support/in-memory-record-repository.mjs'),
      'import-outside-src',
    ],
    [
      sourceFile('scripts/import-v5-history.mjs', '#features/data-transfer/domain/excel-workbook.mjs'),
      'feature-private-import',
    ],
    [sourceFile('tests/http-modules.test.mjs', '#features/backup/server/backup.service.mjs'), 'feature-private-import'],
    [
      sourceFile(
        'src/features/telegram-notify/server/telegram-digest-helper.mjs',
        '#features/children/index.server.mjs',
      ),
      'feature-imports-feature',
    ],
  ];

  for (const [file, expectedRule] of cases)
    assert.ok(
      rulesFor([file]).includes(expectedRule),
      `${file.path} → ${file.specifiers[0]}: lipsește ${expectedRule}`,
    );
});

test('codul de referință din docs/arhitectura respectă granițele', () => {
  const referenceRoot = join(REPO_ROOT, 'docs', 'arhitectura', 'referinta');

  assert.deepEqual(findImportViolations(collectSourceFiles(referenceRoot)), []);
});

test('codul aplicației, scripturile și testele respectă granițele', () => {
  assert.deepEqual(findImportViolations(collectApplicationFiles()), []);
});
