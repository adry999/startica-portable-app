import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { MODULE_IDS } from '#shared/domain/computer-profile.mjs';

const SRC_ROOT: string = import.meta.dirname;
const FEATURES_ROOT = join(SRC_ROOT, 'features');
const APP_ROOT = join(SRC_ROOT, 'app');

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
  rule: 'feature-imports-feature' | 'feature-imports-app';
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
    // Scara globală (--z-sticky=10 … --z-dialog=400) începe la 10 — un z-index cu o singură cifră
    // (0-9) e stacking local (ex. o linie peste propriul card), nu poate intra în conflict cu ea.
    /z-index:\s*(?:[1-9]\d|\d{3,})\b/,
  ];

  /** Un comentariu `/* ... *\/` care doar explică o valoare (ex. „#15a”, un id de artboard, sau
   * „#e0b400 nu are token exact”) nu e o valoare CSS reală — nu contează ca încălcare. */
  function stripCssComments(text: string): string {
    return text.replace(/\/\*[\s\S]*?\*\//g, '');
  }

  // Allowlist golit (PROMPT-CLAUDE-CODE-6.md §2) — ultimele 5 excepții închise: razele off-scale
  // s-au rotunjit la cel mai apropiat --radius-* (TOKENS.md „Corespondență”), `z-index: 1` e acum
  // exclus structural mai sus (stacking local, sub scara globală), iar inelul de avatar al chitanței
  // are propriul token (--shadow-ring-mint).
  it('nicio încălcare nouă în afara listei de excepții (datorie cunoscută, vezi DS-IMPLEMENTARE.md §3)', () => {
    const files = collectFeatureFilesByName(/\.module\.css$/);
    const actual = featureFilesMatching(files, text =>
      CSS_VIOLATION_PATTERNS.some(p => p.test(stripCssComments(text))),
    );
    expect(actual).toEqual([]);
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
  // `EmptyStateCatalogEntry.variant` e doar 'first' | 'done' | 'period' — 'no-results' (implicit
  // când `variant` lipsește, vezi EmptyState.tsx) nu există în catalog, pentru că textul lui e
  // generic, generat direct de consumator (empty-states.ts, header-ul fișierului). Un `<EmptyState>`
  // cu `title`/`description` literal e o încălcare reală doar când `variant` e una din cele 3
  // catalogate — altfel catalogul n-ar putea reprezenta oricum acel caz.
  const CATALOG_VARIANT_PATTERN = /^(first|done|period)$/;

  function hasUnmigratedEmptyState(text: string): boolean {
    const tags = stripComments(text).match(/<EmptyState\b[\s\S]*?\/?>/g) ?? [];
    return tags.some(tag => {
      if (!/\b(title|description)\s*=\s*["']/.test(tag)) return false;
      const variantMatch = tag.match(/\bvariant\s*=\s*["']([\w-]+)["']/);
      const variant = variantMatch ? variantMatch[1] : 'no-results';
      return CATALOG_VARIANT_PATTERN.test(variant);
    });
  }
  // 30-stari-goale.md §35e — nu sunt stări goale, nu intră în regulă: text aruncat (throw/toast),
  // props `label`/`hint`/`emptyLabel` (indicii sub câmp, sloturi goale de câmp, `emptyLabel` din
  // componente ca SearchSelect/MultiSelect) și opțiuni de select (`value`/valoare de listă simplă).
  // empty-states.ts (header): „Fără rezultate" (căutare/filtre active) are prioritate peste orice
  // cheie din catalog și textul ei e generic, generat direct de consumator — nu intră în R9.
  const SEARCH_EMPTY_PATTERN = /c[ăa]ut|filtr/i;
  const EMPTY_TEXT_EXEMPT_LINE_PATTERN =
    /throw\s+new\s+Error\(|\btoast\.(show|error|success|info|warning)\(|\b(label|hint|emptyLabel)\s*[:=]\s*/;

  /** R9 mai precis (PROMPT-CLAUDE-CODE-5.md §1.4): numără doar liniile unde „Niciun/Nicio” apare
   * într-un text randat direct pe ecran, nu în comentarii, erori aruncate, toast-uri, props de
   * indiciu/opțiune, sau text de căutare/filtre fără rezultate (vezi mai sus). */
  function hasUnexpectedEmptyText(text: string): boolean {
    return stripComments(text)
      .split('\n')
      .some(
        line =>
          EMPTY_TEXT_PATTERN.test(line) &&
          !EMPTY_TEXT_EXEMPT_LINE_PATTERN.test(line) &&
          !SEARCH_EMPTY_PATTERN.test(line),
      );
  }

  // Allowlist golit (PROMPT-CLAUDE-CODE-6.md §2) — textele de căutare/filtre fără rezultate sunt
  // acum excluse structural mai sus; restul (WeeklySheetDialog „Niciuna" → „Fără grupe",
  // GroupTeamPicker „Niciun asistent/înlocuitor" → „Fără asistent/înlocuitor", DayClosingReceipt
  // „Nicio achitare în această zi." → „Zi fără achitări.", PaymentFormDrawer „Niciun curs cunoscut…"
  // → „Curs necunoscut…") au fost reformulate, fără cheie de catalog nouă.

  it('nicio încălcare nouă de text literal „Niciun/Nicio" în afara listei de excepții', () => {
    const files = collectFeatureFilesByName(/\.tsx$/).filter(f => !/\.test\.tsx$/.test(f));
    const actual = featureFilesMatching(files, hasUnexpectedEmptyText);
    expect(actual).toEqual([]);
  });

  // Allowlist golit (PROMPT-CLAUDE-CODE-6.md §2) — `ConflictsPage`/`ReviewPage`/`FeeSetupPage`
  // (starea „done”) au trecut pe catalog (`conflicte.done`/`derezolvat.done`/`taxe.done`, acesta din
  // urmă nou); restul (`ChildrenPage`/`PaymentsTable`/`CandidatesTab`/`SyncSettings`/a doua stare din
  // `FeeSetupPage`) rămân cu `title`/`description` literal doar pe `variant="no-results"` (implicit
  // sau explicit) — structural în afara catalogului (`EmptyStateCatalogEntry.variant` nu include
  // `'no-results'`), nu datorie.
  it('niciun `<EmptyState>` cu title/description literal pe o variantă din catalog', () => {
    const files = collectFeatureFilesByName(/\.tsx$/);
    const actual = featureFilesMatching(files, hasUnmigratedEmptyState);
    expect(actual).toEqual([]);
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

// R11 (FEEDBACK-01-10.md F4) — fără autoComplete="off" Chrome oferă să salveze datele de formular, nedorit în această aplicație desktop.
describe('R11 — <form> brut în features/** are autoComplete="off"', () => {
  const FORM_TAG_PATTERN = /<form\b[\s\S]*?>/g;

  function hasFormWithoutAutoComplete(text: string): boolean {
    const tags = text.match(FORM_TAG_PATTERN) ?? [];
    return tags.some(tag => !/autoComplete\s*=/.test(tag));
  }

  it('niciun <form> fără autoComplete="off"', () => {
    const files = collectFeatureFilesByName(/\.tsx$/).filter(f => !/\.test\.tsx$/.test(f));
    const actual = featureFilesMatching(files, hasFormWithoutAutoComplete);
    expect(actual).toEqual([]);
  });
});

/**
 * R12 (§5.3, 31-profiluri-calculator.md) — oglinda client a testului de arhitectură de pe server
 * (`tests/architecture/route-modules-coverage.test.mjs`): scanează sursa `App.tsx` după fiecare
 * `<Route path="…">` declarat literal și cere ca blocul lui să conțină imediat
 * `<ModuleGuard moduleId="…">`, cu un `moduleId` valid (`MODULE_IDS`) — altfel o rută nouă ar
 * rămâne, din greșeală, fără nicio gardă vizibilă (serverul tot ar respinge-o cu 403, dar
 * interfața ar lăsa utilizatorul să încerce întâi). `*` (catch-all, `<Navigate to="/" />`) nu
 * randează conținut propriu — exemptat explicit, nu „uitat”.
 */
describe('R12 — fiecare rută din App.tsx are moduleId și trece prin ModuleGuard', () => {
  const APP_TSX = join(SRC_ROOT, 'app', 'App.tsx');
  const ROUTE_BLOCK_PATTERN = /<Route\b[\s\S]*?\/>/g;
  const PATH_PATTERN = /\bpath="([^"]+)"/;
  const MODULE_GUARD_PATTERN = /element=\{\s*<ModuleGuard\s+moduleId="([^"]+)">/;

  function collectRouteBlocks(): string[] {
    return readFileSync(APP_TSX, 'utf8').match(ROUTE_BLOCK_PATTERN) ?? [];
  }

  it('App.tsx declară măcar rutele cunoscute (sanitate scanare)', () => {
    expect(collectRouteBlocks().length).toBeGreaterThan(15);
  });

  it('fiecare <Route> (în afara catch-all-ului `*`) e înfășurat în <ModuleGuard moduleId="…">, cu un modul valid', () => {
    const missing: string[] = [];
    for (const block of collectRouteBlocks()) {
      const pathMatch = block.match(PATH_PATTERN);
      const path = pathMatch?.[1] ?? '(fără path)';
      if (path === '*') continue; // catch-all — doar <Navigate>, fără conținut de gardat.
      const guardMatch = block.match(MODULE_GUARD_PATTERN);
      if (!guardMatch || !MODULE_IDS.includes(guardMatch[1])) missing.push(path);
    }
    expect(missing).toEqual([]);
  });
});

/**
 * R13 (44d, COMPONENTE.md §0b) — „fără drawer în drawer”: un `<Drawer>`/`<Dialog>` nu randează
 * direct, în propriile `children`, un alt `<Drawer>`/`<Dialog>` — convenția e o confirmare
 * imbricată (`UnsavedChangesDialog`, 40c) randată ca SOR în fragment, nu ca descendent în JSX
 * (vezi orice `*FormDrawer.tsx` care folosește `useUnsavedChangesGuard`). Scanare pe text, ca și
 * restul regulilor R1-R12: pe fiecare fișier, o stivă de token-uri `<Drawer`/`<Dialog`/`</Drawer>`/
 * `</Dialog>` — o deschidere nouă cât stiva nu e goală înseamnă o imbricare reală.
 */
describe('R13 — niciun Drawer/Dialog nu randează alt Drawer/Dialog ca descendant direct', () => {
  const PANEL_TOKEN_PATTERN = /<(\/)?(Drawer|Dialog)\b/g;

  function collectAllSourceFiles(pattern: RegExp): string[] {
    return readdirSync(SRC_ROOT, { withFileTypes: true, recursive: true })
      .filter(entry => entry.isFile() && pattern.test(entry.name))
      .map(entry => join(entry.parentPath, entry.name));
  }

  function hasNestedPanel(text: string): boolean {
    const stack: string[] = [];
    for (const match of stripComments(text).matchAll(PANEL_TOKEN_PATTERN)) {
      const isClosing = match[1] === '/';
      if (isClosing) {
        stack.pop();
        continue;
      }
      if (stack.length > 0) return true;
      stack.push(match[2]);
    }
    return false;
  }

  it('fiecare fișier .tsx folosește cel mult un Drawer/Dialog nenimbricat (literal <Drawer>/<Dialog>)', () => {
    const files = collectAllSourceFiles(/\.tsx$/).filter(f => !/\.(test|stories)\.tsx$/.test(f));
    const violations = files
      .filter(file => hasNestedPanel(readFileSync(file, 'utf8')))
      .map(file => relative(SRC_ROOT, file).split(sep).join('/'))
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
});
