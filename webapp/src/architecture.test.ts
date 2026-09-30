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

  // Permanent, nu datorie: fiecare intrare de mai jos e un hit-area/tabel-de-tipărit pe care
  // `Button`/`DataTable` din `@shared/ui` nu-l poate reproduce fără să-și piardă forma sau
  // comportamentul (vezi comentariul din fișierul sursă, la linia încălcării). Fișierele `.test.tsx`
  // (mock-uri de componente) sunt excluse structural mai jos, ca la R3/R7/R9.
  const ALLOWED: readonly string[] = [
    // Rândul din coada de achitări neasociate (dată + text sursă + sumă) — hit-area pe tot rândul,
    // ca ChildTile/GroupTile/NotifyPage; un `Button` ar impune propriul fundal/padding și ar sparge
    // layout-ul din 11-de-rezolvat.md §9c.
    'assign/AssignPage.tsx',
    // Placa copilului (attendance) — hit-area pe toată placa, cu `currentColor` moștenit din statusul
    // zilei; un `Button` ar impune propriul fundal/padding.
    'attendance/ChildTile.tsx',
    // Grupul „Grupă” (pastilă cu tooltip nativ de capacitate + nuanță de ton per-grupă) — vezi
    // comentariul din fișier.
    'children/ChildFormDrawer.tsx',
    // Rândul din lista de conflicte — hit-area pe tot rândul, ca ChildTile/GroupTile.
    'conflicts/ConflictsPage.tsx',
    // Bara graficului lunar (formă/înălțime dinamică per venit/cheltuială, fără text, cu Tooltip) și
    // acțiunea „→” din cardul „De văzut” cu culoare de ton moștenită (`color: inherit`) — `Button
    // variant="link"` ar forța orange peste tonul roz/galben/mint al cardului.
    'dashboard/DashboardPage.tsx',
    // Rândul candidatului din căutare (avatar + nume + pastilă) e un hit-area pe tot rândul, ca
    // ChildTile — și togglurile de zi L-V (22×22, comutare multiplă, nu `Button`) n-au variantă potrivită.
    'groups/GroupTeamPicker.tsx',
    // Mâner de tragere, numele-ca-buton-de-editare, pastila „Editează" și „+N" — patru roluri într-un
    // tile compact, cu `currentColor` moștenit din tonul dinamic al grupei; un `Button`/`IconButton`
    // ar impune propriul fundal/padding și ar sparge nuanțarea pe ton (ca ChildTile în attendance).
    'groups/GroupTile.tsx',
    // Rândul din coada de notificări (avatar + nume + sumă + bara activă de 4px) — hit-area pe tot
    // rândul, ca ChildTile/GroupTile; un `Button` ar impune propriul fundal/padding și ar sparge
    // layout-ul din 10-de-notificat.md §3.
    'notify/NotifyPage.tsx',
    // Bară de concediu poziționată absolut pe zilele lui (stânga/lățime calculate, culoare dinamică
    // pe tip/planificat) — hit-area pe formă custom, ca ChildTile/GroupTile; vezi comentariul din fișier.
    'personal/LeavesView.tsx',
    // Comutare multiplă a filialelor (una sau ambele) — pereche fixă de pastile mereu vizibile;
    // nici ChipSelect (alegere unică), nici MultiSelect (popover de căutare) nu se potrivesc; vezi
    // comentariul din fișier.
    'personal/StaffFormDrawer.tsx',
    // Pontajul tipărit (23k, `@media print`) — `<table>` semantic real, pentru paginare corectă la
    // printare (antet repetat la 14 rânduri/pagină); același caz ca `report/ReportPrintSummary.tsx`
    // mai jos, `DataTable` nefiind gândit pentru `window.print()`.
    'personal/TimesheetPrint.tsx',
    // Placa dintr-o celulă a grilei săptămânii (22a) — avatar + nume + etichetă de stare + punct de
    // culoare, hit-area pe toată placa, ca ChildTile/GroupTile; un `Button` ar impune propriul
    // fundal/padding și ar sparge grila oră×zi (`display: contents` pe rânduri).
    'pool/WeekView.tsx',
    // Rezumatul tipărit (19b, `@media print`) — `<table>` semantic real, pentru paginare corectă la
    // printare; `DataTable` e un component interactiv (sortare, rânduri, densitate) nepotrivit pentru
    // `window.print()`, nu există altă variantă din `@shared/ui` pentru un tabel doar-print.
    'report/ReportPrintSummary.tsx',
    // Rândul din coada „De verificat" (punct de severitate + nume + problemă + bara activă de 4px) —
    // hit-area pe tot rândul, exact același tipar ca notify/NotifyPage.tsx; un `Button` ar impune
    // propriul fundal/padding și ar sparge layout-ul din 11-de-rezolvat.md §9b.
    'review/ReviewPage.tsx',
  ];

  it('nicio încălcare nouă în afara listei de excepții (permanente, vezi comentariile din fișierele sursă)', () => {
    const files = collectFeatureFilesByName(/\.tsx$/).filter(f => !/\.test\.tsx$/.test(f));
    const actual = featureFilesMatching(files, stripNativeFileInputs);
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
    // `.bankBox { font-family: monospace; }` — cerut explicit de spec (11-de-rezolvat.md §9c:
    // „monospace 13px"), fără token de font monospace în tokens.css. `.queueCard`/`.suggestionCard`
    // `border-radius: 22px`/`18px` — valori exacte din artboard, fără corespondent exact în scara de
    // tokeni (20/24, resp. 16/20), același caz ca `notify/NotifyPage.module.css` mai jos.
    'assign/AssignPage.module.css',
    'attendance/WeeklySheet.module.css',
    'backup/BackupPage.module.css',
    'conflicts/ConflictsPage.module.css',
    // `.dragOver { box-shadow: 0 0 0 3px var(--orange); }` — inel de tragere, aceeași formă în tot
    // shared/ui (Board, DateInput, NumberInput…), unde nu e scanată de R2; nu există un token
    // cu întreaga valoare a umbrei, iar shorthand-ul nu poate începe cu `var(...)`.
    'groups/GroupCardCompact.module.css',
    'groups/GroupTile.module.css',
    // `.rowActive { box-shadow: inset 4px 0 0 var(--orange); }` — bara activă de 4px a rândului de
    // șablon selectat (14-sms.md §11b), același shorthand acceptat ca la `notify/NotifyPage.module.css`
    // mai jos; fundalul `#fff` de pe `.row` a fost mutat pe `var(--white)` (14-sms val 2).
    'notifications/SmsTemplatesPanel.module.css',
    // `.rowActive { box-shadow: inset 4px 0 0 var(--orange); }` — bara activă de 4px, același
    // shorthand acceptat ca în `payments/PaymentsByMonth.module.css` (10-de-notificat.md §3).
    // `.queue`/`.preview { border-radius: 22px; }` și `.bubble` (colț asimetric 18/18/18/6) —
    // valori exacte din artboard, fără corespondent în scara de tokeni (20/24) — vezi comentariile
    // din fișier.
    'notify/NotifyPage.module.css',
    'payments/DayClosingReceipt.module.css',
    'payments/PaymentReceipt.module.css',
    'payments/PaymentReceiptThermal.module.css',
    'payments/PaymentsByMonth.module.css',
    // `.card { border-radius: 22px; }` — vezi comentariul din fișier (același caz ca
    // assign/AssignPage.module.css/backup/BackupPage.module.css). `.legendBar { border-radius: 2px; }`
    // — bară de 8px înălțime, cel mai mic token (5px) ar rotunji-o vizibil spre pilulă.
    'personal/LeavesView.module.css',
    // `.bar { border-radius: 4px 4px 0 0; }` — colț de sus al coloanei din graficul lunar (23h);
    // --radius-5 (5px) e cel mai apropiat, dar nu identic, vezi comentariul din fișier.
    'personal/SalaryHistoryDrawer.module.css',
    // CO `#e0b400` (DECIZII.md #17) și antetul departamentului `#5b666e` (ALINIERE-DESIGN A8, Pontaj
    // 23b) — culori exacte din spec, fără token identic; `.departmentSquare`/`.todayPill` (3px/6px)
    // — radius fără corespondent exact în scara de tokeni, vezi comentariile din fișier.
    'personal/TimesheetView.module.css',
    'pool/MonthView.module.css',
    'pool/PoolReceiptLabel.module.css',
    'pool/WeekView.module.css',
    // `.dot { border-radius: 3px; }` — pătrat rotunjit 10×10 din legenda categoriilor (19a); 3px pe o
    // cutie de 10px n-are corespondent în scara de tokeni (--radius-5 = 5px ar rotunji punctul într-un
    // cerc complet, schimbând forma din artboard).
    'report/ReportCategoriesPanel.module.css',
    // `.queueRowActive { box-shadow: inset 4px 0 0 var(--orange); }` — bara activă de 4px a rândului din
    // coada „De verificat" (11-de-rezolvat.md §9b), același shorthand acceptat ca în
    // `notify/NotifyPage.module.css`/`payments/PaymentsByMonth.module.css` mai sus.
    'review/ReviewPage.module.css',
    'stickers/StickerLabel.module.css',
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

  const ALLOWED: readonly string[] = ['payments/PaymentFormDrawer.tsx'];

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
    // Genuin nou (10-de-notificat.md) — coada golită trece pe `EmptyState variant="done"` pentru
    // decorul consecvent cu restul modulelor; textul rămâne calculat în useNotify.ts (depinde de
    // fișele „De verificat”, nu doar de rows.length), deci nu vine dintr-o cheie de catalog — vezi
    // INTREBARI.md.
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
