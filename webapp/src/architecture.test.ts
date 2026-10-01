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

  /** Un `<input type="file" hidden>` (dropzone/file-picker nativ) n-are echivalent `@shared/ui` —
   * nu e un câmp de text/număr — deci nu contează ca încălcare, oriunde apare. */
  function stripNativeFileInputs(text: string): boolean {
    const withoutFileInputs = text.replace(/<input\b[\s\S]*?\/?>/g, tag => (/type=["']file["']/.test(tag) ? '' : tag));
    return RAW_TAG_PATTERN.test(withoutFileInputs);
  }

  // Alowlist golit (PROMPT-CLAUDE-CODE-6.md §2) — toate hit-area-urile/tabelele-de-tipărit de pe
  // ecrane foloseau <button>/<table> brut doar din lipsa unui wrapper semantic în @shared/ui;
  // SelectableTile/SelectableRow/PrintTable (și extensiile MonthCalendar/MasterDetail/BarChart/
  // Button/ChipSelect) acoperă acum toate cazurile cunoscute. Fișierele `.test.tsx` (mock-uri de
  // componente) sunt excluse structural, ca la R3/R7/R9.
  it('niciun tag brut în afara fișierelor .test.tsx', () => {
    const files = collectFeatureFilesByName(/\.tsx$/).filter(f => !/\.test\.tsx$/.test(f));
    const actual = featureFilesMatching(files, stripNativeFileInputs);
    expect(actual).toEqual([]);
  });
});

describe('R2 — fără hex/rgb/box-shadow/font-family/border-radius-px/z-index literale în features/**/*.module.css', () => {
  const CSS_VIOLATION_PATTERNS = [
    /#[0-9a-fA-F]{3,8}\b/,
    /\brgba?\(/,
    // `none` e un reset (ex. @media print), nu o valoare de design care are nevoie de token.
    /box-shadow:(?!\s*(?:var\(|none\b))\s*\S/,
    /font-family:(?!\s*var\()\s*\S/,
    /border-radius:\s*\d+px/,
    /z-index:\s*\d/,
  ];

  const ALLOWED: readonly string[] = [
    // `.bubble { border-radius: 18px 18px 18px 6px; }` — colț „coadă de bulă” (6px stânga-jos, De
    // notificat.dc.html#8a), formă asimetrică din artboard fără corespondent într-un singur token.
    'notify/NotifyPage.module.css',
    // `.cutLine { z-index: 1; }` — stacking local al liniei de tăiere peste chitanță, nu ține de
    // scara globală (--z-sticky/popover/drawer/toast/dialog). `.childAvatar { box-shadow: 0 0 0 2px
    // var(--mint); }` — inel unic de avatar, altă culoare/grosime decât --shadow-ring-drag.
    'payments/PaymentReceipt.module.css',
    // `.legendBar { border-radius: 2px; }` — bară de legendă de 8px înălțime; cel mai mic token
    // (--radius-5, 5px) ar rotunji-o aproape de formă de pilulă, schimbând vizibil forma din artboard.
    'personal/LeavesView.module.css',
    // `.departmentSquare { border-radius: 3px; }` — pătrat 8×8 (Pontaj 23b); --radius-5 (5px) pe o
    // cutie atât de mică ar rotunji-o aproape de cerc, schimbând forma din artboard.
    'personal/TimesheetView.module.css',
    // `.dot { border-radius: 3px; }` — pătrat rotunjit 10×10 din legenda categoriilor (19a); 3px pe o
    // cutie de 10px n-are corespondent în scara de tokeni (--radius-5 = 5px ar rotunji punctul într-un
    // cerc complet, schimbând forma din artboard).
    'report/ReportCategoriesPanel.module.css',
  ];

  /** Un comentariu `/* ... *\/` care doar explică o valoare (ex. „#15a”, un id de artboard, sau
   * „#e0b400 nu are token exact”) nu e o valoare CSS reală — nu contează ca încălcare. */
  function stripCssComments(text: string): string {
    return text.replace(/\/\*[\s\S]*?\*\//g, '');
  }

  it('nicio încălcare nouă în afara listei de excepții (datorie cunoscută, vezi DS-IMPLEMENTARE.md §3)', () => {
    const files = collectFeatureFilesByName(/\.module\.css$/);
    const actual = featureFilesMatching(files, text =>
      CSS_VIOLATION_PATTERNS.some(p => p.test(stripCssComments(text))),
    );
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

  it('niciun format brut în afara @shared/format', () => {
    const files = collectFeatureFilesByName(/\.tsx$/).filter(f => !/\.test\.tsx$/.test(f));
    const actual = featureFilesMatching(files, text => RAW_FORMAT_PATTERN.test(text));
    expect(actual).toEqual([]);
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
   * într-un text randat direct pe ecran, nu în comentarii, erori aruncate, toast-uri sau props de
   * indiciu/opțiune. */
  function hasUnexpectedEmptyText(text: string): boolean {
    return stripComments(text)
      .split('\n')
      .some(line => EMPTY_TEXT_PATTERN.test(line) && !EMPTY_TEXT_EXEMPT_LINE_PATTERN.test(line));
  }

  // Fișierele `.test.tsx` sunt excluse structural mai jos (ca la R1/R3/R7) — un test care verifică
  // textul catalogului prin `screen.findByText(...)` conține inevitabil „Niciun/Nicio”, fără să fie
  // text nou hardcodat.
  const TEXT_ALLOWED: readonly string[] = [
    // „Niciun rezultat pentru căutare” pe coada de achitări neasociate — text de căutare fără
    // rezultate, intenționat în afara catalogului (empty-states.ts, header-ul fișierului), ca
    // GroupsBoard/AuditLogPage. Starea „done”/„fără sugestii” folosesc deja catalogul (asociere.done/
    // asociere.suggestions, vezi IMPORT_ALLOWED mai jos).
    'assign/AssignPage.tsx',
    'attendance/WeeklySheetDialog.tsx',
    'audit-log/AuditLogPage.tsx',
    // „Niciun copil nu corespunde filtrelor curente” — text de căutare/filtre fără rezultate,
    // intenționat în afara catalogului, ca AssignPage/AuditLogPage.
    'children/ChildrenPage.tsx',
    // „Niciun rezultat pentru căutare” pe panoul „Fără grupă” — text de căutare fără rezultate,
    // intenționat în afara catalogului (empty-states.ts, header-ul fișierului), ca AssignPage/AuditLogPage.
    'groups/GroupsBoard.tsx',
    // „Niciun asistent" / „Niciun înlocuitor" (03-grupe.md §5c) — indicii scurte pe rolul unui bloc din
    // Echipa grupei, nu o stare goală de listă/pagină (fără ilustrație, fără acțiune); niciun cheie din
    // catalog nu se potrivește, textul rămâne literal, ca în spec.
    'groups/GroupTeamPicker.tsx',
    // „Niciun SMS pentru filtrele alese” pe tabelul jurnalului SMS (14-sms.md §11a) — text de
    // căutare/filtre fără rezultate, intenționat în afara catalogului (empty-states.ts, header-ul
    // fișierului), ca AssignPage/GroupsBoard mai sus.
    'notifications/SmsMessagesPanel.tsx',
    // „Nicio achitare în această zi.” — linie pe chitanța tipărită a închiderii zilei (thermal
    // receipt), nu o stare goală de ecran/listă; catalogul empty-states.ts nu acoperă tipăriri.
    'payments/DayClosingReceipt.tsx',
    // „Niciun curs cunoscut pentru această dată — completează manual” — indiciu inline lângă câmpul
    // de curs valutar (fallback când BNM n-are cursul zilei), nu o stare goală de listă/pagină.
    'payments/PaymentFormDrawer.tsx',
  ];

  const IMPORT_ALLOWED: readonly string[] = [
    // Coada nu e un `DataTable` (listă custom + panou de detaliu) — `EmptyState` randat direct
    // pentru „toate achitările asociate” (`asociere.done`) și, compact, pentru „nicio sugestie”
    // (`asociere.suggestions`), ambele din catalog.
    'assign/AssignPage.tsx',
    'attendance/DayView.tsx',
    'attendance/MonthView.tsx',
    'backup/SyncSettings.tsx',
    'children/BirthdaysPage.tsx',
    // Genuin nou (§3 final) — „Nicio absență motivată în {luna}.” nu mai e text hardcodat, ci
    // `EmptyState` cu cheia din catalog (`fisa.absences`, compact).
    'children/ChildAttendanceSection.tsx',
    // Include și „Nicio notă încă.” (`fisa.notes`, compact, genuin nou §3 final), alături de
    // `fisa.payers` deja cablat.
    'children/ChildProfileView.tsx',
    'children/ChildrenPage.tsx',
    'conflicts/ConflictsPage.tsx',
    'dashboard/DashboardPage.tsx',
    'expenses/ExpensesCategoryManager.tsx',
    'fee-setup/FeeSetupPage.tsx',
    'groups/GroupsBoard.tsx',
    'groups/GroupsPage.tsx',
    // Coada golită nu e un `DataTable` — `EmptyState` cu cheia din catalog (`denotificat.done`,
    // PROMPT-CLAUDE-CODE-6.md §2): titlu static din catalog, nota dinamică „N fișe nu pot fi
    // evaluate” (fișele „De verificat”, din useNotify.ts) e un `params.nefise` în `text`.
    'notify/NotifyPage.tsx',
    'payments/PaymentsTable.tsx',
    // 24-personal.md §23l — starea „Niciun candidat încă" vine din `DataTable.empty="candidati.first"`
    // (catalog); rămâne un import direct doar pentru „Nimeni nu se potrivește căutării." — text de
    // căutare fără rezultate, generic pentru acest ecran, în afara catalogului, ca AssignPage/GroupsBoard.
    'personal/CandidatesTab.tsx',
    // Genuin nou (23-bazin.md §22c) — tabelul „Pe copii” golit („Nicio programare în luna asta”)
    // nu mai e text hardcodat, ci `EmptyState` cu cheia din catalog (`bazin.month.period`, R9).
    'pool/MonthView.tsx',
    // Genuin nou (20-raport-contabil.md §19a) — panourile „Cheltuieli pe categorii”/„Încasări pe
    // metode” și tabelul „Pe zile” foloseau text hardcodat; golite trec pe `EmptyState` cu cheile din
    // catalog (`raport.expenses`/`raport.income`, compact; `raport.period`, R9).
    'report/ReportCategoriesPanel.tsx',
    'report/ReportDaysTable.tsx',
    'report/ReportMethodsPanel.tsx',
    'review/ReviewPage.tsx',
    // Genuin nou (07-situatia.md §4, PaymentHeatmap.tsx) — starea goală a hărții An școlar
    // (`situatia.year.period`) nu mai e text hardcodat, ci `EmptyState` cu cheie din catalog (R9).
    'status/PaymentHeatmap.tsx',
    // Genuin nou (04-vizite.md §3) — panoul zilei fără vizite (`vizite.day`, compact, cu „+ Programează”)
    // și „Următoarele vizite” golit (`vizite.month.rest`, compact) nu sunt un `DataTable`, deci
    // `EmptyState` e randat direct, ca în ChildProfileView.tsx/DashboardPage.tsx mai sus; textul
    // „Nicio vizită nu corespunde filtrelor curente” de pe tabelul „Toate vizitele” a fost înlocuit cu
    // `DataTable.empty="vizite.first"` + `hasActiveFilters`, care nu mai trece prin acest fișier.
    'visits/VisitsPage.tsx',
  ];

  it('nicio încălcare nouă de text literal „Niciun/Nicio" în afara listei de excepții', () => {
    const files = collectFeatureFilesByName(/\.tsx$/).filter(f => !/\.test\.tsx$/.test(f));
    const actual = featureFilesMatching(files, hasUnexpectedEmptyText);
    expect(unexpectedViolations(actual, TEXT_ALLOWED)).toEqual([]);
  });

  it('niciun import direct nou al EmptyState în afara listei de excepții', () => {
    const files = collectFeatureFilesByName(/\.tsx$/);
    const actual = featureFilesMatching(files, text => DIRECT_IMPORT_PATTERN.test(text));
    expect(unexpectedViolations(actual, IMPORT_ALLOWED)).toEqual([]);
  });
});

/**
 * R10 (PROMPT-CLAUDE-CODE-6.md §1.6) — `--orange` nu mai poartă text, nici alb (buton/pastilă
 * plină trece pe `--orange-strong`), nici direct pe el (text pe alb/crem trece pe `--orange-ink`).
 * Fără allowlist de la început — `--orange` a fost golit complet de text de la 30.09 încoace.
 */
describe('R10 — --orange rămâne doar bordură/punct/bară/fundal soft, fără text peste', () => {
  const BG_ORANGE_PATTERN = /(?<![-\w])background(?:-color)?\s*:\s*var\(--orange\)\s*[;)]/;
  const COLOR_WHITE_PATTERN = /(?<![-\w])color\s*:\s*var\(--white\)\s*[;)]/;
  const COLOR_ORANGE_PATTERN = /(?<![-\w])color\s*:\s*var\(--orange\)\s*[;)]/;

  function collectModuleCssFiles(): string[] {
    return readdirSync(SRC_ROOT, { withFileTypes: true, recursive: true })
      .filter(entry => entry.isFile() && entry.name.endsWith('.module.css'))
      .map(entry => join(entry.parentPath, entry.name));
  }

  function toSrcRelative(absolutePath: string): string {
    return relative(SRC_ROOT, absolutePath).split(sep).join('/');
  }

  function stripCssComments(text: string): string {
    return text.replace(/\/\*[\s\S]*?\*\//g, '');
  }

  /** Un bloc de regulă CSS ține de la ultima `}`/`{` până la `{` proprie — nu e nevoie de un
   * parser real, `--orange` fiind mereu folosit ca `proprietate: valoare;` simplu în acest cod. */
  function cssBlocks(text: string): string[] {
    return stripCssComments(text).match(/[^{}]*\{[^{}]*\}/g) ?? [];
  }

  it('niciun bloc cu fundal --orange + text alb, și niciun text direct pe --orange', () => {
    const violations = collectModuleCssFiles()
      .flatMap(file => {
        const blocks = cssBlocks(readFileSync(file, 'utf8'));
        const hasViolation = blocks.some(
          block =>
            (BG_ORANGE_PATTERN.test(block) && COLOR_WHITE_PATTERN.test(block)) || COLOR_ORANGE_PATTERN.test(block),
        );
        return hasViolation ? [toSrcRelative(file)] : [];
      })
      .sort();
    expect(violations).toEqual([]);
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
