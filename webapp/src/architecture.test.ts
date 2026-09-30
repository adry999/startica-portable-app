import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const SRC_ROOT: string = import.meta.dirname;
const FEATURES_ROOT = join(SRC_ROOT, 'features');
const APP_ROOT = join(SRC_ROOT, 'app');
const DESIGN_SYSTEM_ROOT = join(SRC_ROOT, 'design-system');

const IMPORT_PATTERN = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;

/** Colectează fișierele .ts/.tsx dintr-un folder de feature, cu excepția testelor. */
function collectFeatureSourceFiles(featureDir: string): string[] {
  return readdirSync(featureDir, { withFileTypes: true, recursive: true })
    .filter(entry => entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name))
    .map(entry => join(entry.parentPath, entry.name));
}

function readImportSpecifiers(sourceText: string): string[] {
  return [...sourceText.matchAll(IMPORT_PATTERN)].map(match => match[1]);
}

/** Rezolvă un specificator de import la o cale absolută, dacă e relativ sau un alias intern (@app/@features). */
function resolveSpecifier(fileDir: string, specifier: string): string | null {
  if (specifier.startsWith('.')) return resolve(fileDir, specifier);
  if (specifier.startsWith('@features/')) return join(FEATURES_ROOT, specifier.slice('@features/'.length));
  if (specifier.startsWith('@app/')) return join(APP_ROOT, specifier.slice('@app/'.length));
  return null;
}

interface Violation {
  file: string;
  specifier: string;
  rule: 'feature-imports-feature' | 'feature-imports-app' | 'feature-imports-design-system';
}

function findViolations(): Violation[] {
  const featureNames = readdirSync(FEATURES_ROOT, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);

  const violations: Violation[] = [];

  for (const featureName of featureNames) {
    const featureDir = join(FEATURES_ROOT, featureName);
    for (const absolutePath of collectFeatureSourceFiles(featureDir)) {
      const fileDir = dirname(absolutePath);
      const specifiers = readImportSpecifiers(readFileSync(absolutePath, 'utf8'));
      const relativeFile = relative(SRC_ROOT, absolutePath).split(sep).join('/');

      for (const specifier of specifiers) {
        const resolved = resolveSpecifier(fileDir, specifier);
        if (!resolved) continue;

        if (resolved === APP_ROOT || resolved.startsWith(APP_ROOT + sep)) {
          violations.push({ file: relativeFile, specifier, rule: 'feature-imports-app' });
          continue;
        }

        if (resolved === DESIGN_SYSTEM_ROOT || resolved.startsWith(DESIGN_SYSTEM_ROOT + sep)) {
          violations.push({ file: relativeFile, specifier, rule: 'feature-imports-design-system' });
          continue;
        }

        if (resolved.startsWith(FEATURES_ROOT + sep)) {
          const otherFeature = relative(FEATURES_ROOT, resolved).split(sep)[0];
          if (otherFeature && otherFeature !== featureName) {
            violations.push({ file: relativeFile, specifier, rule: 'feature-imports-feature' });
          }
        }
      }
    }
  }

  return violations;
}

/**
 * R1-R9 (docs/design/DS-IMPLEMENTARE.md §1) — reguli de migrare spre design-system, aplicate ca
 * "avertisment cu listă de excepții": testul pică doar dacă apare o încălcare NOUĂ, în afara
 * fișierelor deja cunoscute ca datorie (ALLOWED de mai jos). La migrarea unui modul (pas 4),
 * fișierele lui se scot din lista corespunzătoare — lista trebuie să ajungă goală, moment în care
 * regula devine strictă (allowlist = []).
 */

function collectFeatureFilesByName(pattern: RegExp): string[] {
  return readdirSync(FEATURES_ROOT, { withFileTypes: true, recursive: true })
    .filter(entry => entry.isFile() && pattern.test(entry.name))
    .map(entry => join(entry.parentPath, entry.name));
}

function toFeatureRelative(absolutePath: string): string {
  return relative(FEATURES_ROOT, absolutePath).split(sep).join('/');
}

function featureFilesMatching(files: string[], test: (text: string) => boolean): string[] {
  return files
    .filter(file => test(readFileSync(file, 'utf8')))
    .map(toFeatureRelative)
    .sort();
}

function unexpectedViolations(actual: string[], allowed: readonly string[]): string[] {
  const allowedSet = new Set(allowed);
  return actual.filter(file => !allowedSet.has(file));
}

/** Elimină comentariile bloc (`/* ... *\/`, inclusiv `{/* ... *\/}` JSX pe mai multe linii) și `//...`, pentru R3. */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(line => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

describe('R1 — fără taguri HTML brute (<input>/<select>/<textarea>/<button>/<table>/<dialog>) în features/**', () => {
  const RAW_TAG_PATTERN = /<(input|select|textarea|button|table|dialog)\b/;

  const ALLOWED: readonly string[] = [
    'assign/AssignPage.tsx',
    'attendance/ChildTile.tsx',
    'backup/ExcelImportDialog.tsx',
    'children/ChildFormDrawer.tsx',
    'conflicts/ConflictsPage.tsx',
    'dashboard/DashboardPage.tsx',
    'expenses/DailyExpensesView.tsx',
    'expenses/ExpenseFormDrawer.tsx',
    'expenses/ExpensesFilters.tsx',
    'groups/GroupTeamPicker.tsx',
    'groups/GroupTile.tsx',
    'notify/NotifyPage.tsx',
    'payments/PaymentFormDrawer.tsx',
    'personal/LeavesView.tsx',
    'personal/RolesDrawer.tsx',
    'personal/SalaryFormDrawer.tsx',
    'personal/StaffFormDrawer.tsx',
    'personal/TimesheetPrint.tsx',
    'pool/PoolPage.test.tsx',
    'pool/WeekView.tsx',
    'report/PeriodStepper.tsx',
    'report/ReportExportDrawer.tsx',
    'report/ReportPrintSummary.tsx',
    'review/ReviewPage.tsx',
    'visits/VisitsPage.tsx',
  ];

  it('nicio încălcare nouă în afara listei de excepții (datorie cunoscută, vezi DS-IMPLEMENTARE.md §3)', () => {
    const files = collectFeatureFilesByName(/\.tsx$/);
    const actual = featureFilesMatching(files, text => RAW_TAG_PATTERN.test(text));
    expect(unexpectedViolations(actual, ALLOWED)).toEqual([]);
  });
});

describe('R2 — fără hex/rgb/box-shadow/font-family/border-radius-px/z-index literale în features/**/*.module.css', () => {
  const CSS_VIOLATION_PATTERNS = [
    /#[0-9a-fA-F]{3,8}\b/,
    /\brgba?\(/,
    /box-shadow:(?!\s*var\()\s*\S/,
    /font-family:(?!\s*var\()\s*\S/,
    /border-radius:\s*\d+px/,
    /z-index:\s*\d/,
  ];

  const ALLOWED: readonly string[] = [
    'assign/AssignPage.module.css',
    'attendance/DayView.module.css',
    'attendance/MonthView.module.css',
    'attendance/WeeklySheet.module.css',
    'attendance/WeeklySheetDialog.module.css',
    'backup/BackupPage.module.css',
    'backup/KindergartenSettings.module.css',
    'children/ChildFormDrawer.module.css',
    'conflicts/ConflictsPage.module.css',
    'expenses/ExpensesPage.module.css',
    'fee-setup/FeeSetupPage.module.css',
    'groups/GroupCardCompact.module.css',
    'groups/GroupsPage.module.css',
    'groups/GroupTeamPicker.module.css',
    'groups/GroupTile.module.css',
    'notifications/SmsTemplatesPanel.module.css',
    'notify/NotifyPage.module.css',
    'payments/DayClosingReceipt.module.css',
    'payments/PaymentFormDrawer.module.css',
    'payments/PaymentReceipt.module.css',
    'payments/PaymentReceiptThermal.module.css',
    'payments/PaymentsByMonth.module.css',
    'payments/PaymentsTable.module.css',
    'personal/LeavesView.module.css',
    'personal/SalariesView.module.css',
    'personal/SalaryHistoryDrawer.module.css',
    'personal/StaffFormDrawer.module.css',
    'personal/StaffProfilePage.module.css',
    'personal/TeamView.module.css',
    'personal/TimesheetPrint.module.css',
    'personal/TimesheetPrintDialog.module.css',
    'personal/TimesheetView.module.css',
    'pool/MonthView.module.css',
    'pool/PoolReceiptLabel.module.css',
    'pool/WeekView.module.css',
    'report/PeriodStepper.module.css',
    'report/ReportCategoriesPanel.module.css',
    'report/ReportMethodsPanel.module.css',
    'review/ReviewPage.module.css',
    'status/PrintOptionsDialog.module.css',
    'status/StatusPage.module.css',
    'stickers/StickerLabel.module.css',
    'visits/VisitsPage.module.css',
  ];

  it('nicio încălcare nouă în afara listei de excepții (datorie cunoscută, vezi DS-IMPLEMENTARE.md §3)', () => {
    const files = collectFeatureFilesByName(/\.module\.css$/);
    const actual = featureFilesMatching(files, text => CSS_VIOLATION_PATTERNS.some(p => p.test(text)));
    expect(unexpectedViolations(actual, ALLOWED)).toEqual([]);
  });
});

describe('R3 — fără caractere-iconiță (⌕⋯▾‹›✓☰⋮⋮↶↗▲▼⇅) ca text randat în features/**', () => {
  // „×" (înmulțire) e exclus intenționat: apare legitim ca semn matematic în text
  // ("tarif × zile lucrate"), nu doar ca iconiță de închidere — vezi INTREBARI.md.
  const ICON_CHAR_PATTERN = /[⌕⋯▾‹›✓☰↶↗▲▼⇅]|⋮⋮/;

  const ALLOWED: readonly string[] = ['attendance/WeeklySheet.tsx'];

  it('nicio încălcare nouă în afara listei de excepții (datorie cunoscută, vezi DS-IMPLEMENTARE.md §3)', () => {
    const files = collectFeatureFilesByName(/\.tsx$/).filter(f => !/\.test\.tsx$/.test(f));
    const actual = featureFilesMatching(files, text => ICON_CHAR_PATTERN.test(stripComments(text)));
    expect(unexpectedViolations(actual, ALLOWED)).toEqual([]);
  });
});

describe('R4 — lucide-react se importă doar în shared/ui/Icon.tsx', () => {
  it('niciun alt fișier din src/ nu importă direct din lucide-react', () => {
    const files = readdirSync(SRC_ROOT, { withFileTypes: true, recursive: true })
      .filter(entry => entry.isFile() && /\.tsx?$/.test(entry.name))
      .map(entry => join(entry.parentPath, entry.name));

    const offenders = files
      .filter(file => /from\s+['"]lucide-react['"]/.test(readFileSync(file, 'utf8')))
      .map(file => relative(SRC_ROOT, file).split(sep).join('/'))
      .filter(relativeFile => relativeFile !== 'shared/ui/Icon.tsx');

    expect(offenders).toEqual([]);
  });
});

describe('R7 — formatele de dată/monedă/număr vin doar din @shared/format în features/**', () => {
  const RAW_FORMAT_PATTERN = /\.(toLocaleDateString|toLocaleString|toFixed)\(/;

  const ALLOWED: readonly string[] = [
    'groups/GroupTeamPicker.tsx',
    'payments/PaymentFormDrawer.tsx',
    'payments/PaymentsByMonth.tsx',
    'personal/SalariesView.tsx',
    'pool/MonthView.tsx',
    'visits/VisitsPage.tsx',
  ];

  it('nicio încălcare nouă în afara listei de excepții (datorie cunoscută, vezi DS-IMPLEMENTARE.md §3)', () => {
    const files = collectFeatureFilesByName(/\.tsx$/).filter(f => !/\.test\.tsx$/.test(f));
    const actual = featureFilesMatching(files, text => RAW_FORMAT_PATTERN.test(text));
    expect(unexpectedViolations(actual, ALLOWED)).toEqual([]);
  });
});

describe('R9 — stările goale vin din @shared/ui/empty-states.ts, nu din text literal sau import direct', () => {
  const EMPTY_TEXT_PATTERN = /\bNiciun\w*|\bNicio\w*/;
  const DIRECT_IMPORT_PATTERN = /import\s*\{[^}]*\bEmptyState\b[^}]*\}\s*from\s*['"]@shared\/ui['"]/;
  // 30-stari-goale.md §35e — nu sunt stări goale, nu intră în regulă: text aruncat (throw/toast),
  // props `label`/`hint`/`emptyLabel` (indicii sub câmp, sloturi goale de câmp, `emptyLabel` din
  // componente ca SearchSelect/MultiSelect) și opțiuni de select (`value`/valoare de listă simplă).
  const EMPTY_TEXT_EXEMPT_LINE_PATTERN =
    /throw\s+new\s+Error\(|\btoast\.(show|error|success|info|warning)\(|\b(label|hint|emptyLabel)\s*[:=]\s*/;

  /** R9 mai precis (PROMPT-CLAUDE-CODE-5.md §1.4): numără doar liniile unde „Niciun/Nicio” apare
   * într-un text randat direct pe ecran, nu în erori aruncate, toast-uri sau props de indiciu/opțiune. */
  function hasUnexpectedEmptyText(text: string): boolean {
    return text.split('\n').some(line => EMPTY_TEXT_PATTERN.test(line) && !EMPTY_TEXT_EXEMPT_LINE_PATTERN.test(line));
  }

  const TEXT_ALLOWED: readonly string[] = [
    'assign/AssignPage.tsx',
    'attendance/DayView.tsx',
    'attendance/MonthView.tsx',
    'attendance/WeeklySheetDialog.tsx',
    'audit-log/AuditLogPage.tsx',
    'backup/ExchangeRateSettings.test.tsx',
    'backup/ExchangeRateSettings.tsx',
    'backup/PoolSettings.tsx',
    'backup/ServicesSettings.tsx',
    'children/BirthdaysPage.error.test.tsx',
    'children/BirthdaysPage.tsx',
    'children/ChildAttendanceSection.test.tsx',
    'children/ChildAttendanceSection.tsx',
    'children/ChildProfileView.test.tsx',
    'children/ChildProfileView.tsx',
    'children/ChildrenPage.tsx',
    'expenses/ExpensesCategoryManager.tsx',
    'fee-setup/FeeSetupPage.tsx',
    'groups/GroupsBoard.tsx',
    'groups/GroupsPage.tsx',
    'groups/GroupTeamPicker.test.tsx',
    'groups/GroupTeamPicker.tsx',
    'notifications/NotificationsPage.test.tsx',
    'notifications/SmsMessagesPanel.tsx',
    'payments/DayClosingReceipt.tsx',
    'payments/PaymentFormDrawer.test.tsx',
    'payments/PaymentFormDrawer.tsx',
    'personal/CandidatesTab.test.tsx',
    'personal/TeamView.tsx',
    'pool/MonthView.tsx',
    'report/ReportCategoriesPanel.tsx',
    'report/ReportDaysTable.tsx',
    'report/ReportMethodsPanel.tsx',
    'status/PaymentHeatmap.test.tsx',
    'status/PaymentHeatmap.tsx',
    'visits/VisitsPage.tsx',
  ];

  const IMPORT_ALLOWED: readonly string[] = [
    'assign/AssignPage.tsx',
    'backup/SyncSettings.tsx',
    'children/BirthdaysPage.tsx',
    'children/ChildProfileView.tsx',
    'children/ChildrenPage.tsx',
    'conflicts/ConflictsPage.tsx',
    'dashboard/DashboardPage.tsx',
    'fee-setup/FeeSetupPage.tsx',
    'payments/PaymentsTable.tsx',
    'personal/CandidatesTab.tsx',
    'review/ReviewPage.tsx',
  ];

  it('nicio încălcare nouă de text literal „Niciun/Nicio" în afara listei de excepții', () => {
    const files = collectFeatureFilesByName(/\.tsx$/);
    const actual = featureFilesMatching(files, hasUnexpectedEmptyText);
    expect(unexpectedViolations(actual, TEXT_ALLOWED)).toEqual([]);
  });

  it('niciun import direct nou al EmptyState în afara listei de excepții', () => {
    const files = collectFeatureFilesByName(/\.tsx$/);
    const actual = featureFilesMatching(files, text => DIRECT_IMPORT_PATTERN.test(text));
    expect(unexpectedViolations(actual, IMPORT_ALLOWED)).toEqual([]);
  });
});

describe('granițele dintre module (webapp/src/features)', () => {
  it('niciun fișier dintr-un feature nu importă direct dintr-un alt feature', () => {
    const violations = findViolations().filter(v => v.rule === 'feature-imports-feature');
    expect(violations).toEqual([]);
  });

  it('niciun fișier dintr-un feature nu importă din app/ (doar app/ poate importa features)', () => {
    const violations = findViolations().filter(v => v.rule === 'feature-imports-app');
    expect(violations).toEqual([]);
  });

  it('niciun fișier dintr-un feature nu importă din design-system/ (e unealtă de dezvoltare, nu un shared kernel)', () => {
    const violations = findViolations().filter(v => v.rule === 'feature-imports-design-system');
    expect(violations).toEqual([]);
  });
});
