# Prompt pentru Claude Code — 6 (01.10.2026)

Înlocuiește `PROMPT-CLAUDE-CODE-5.md`. Val 2 e comis pe toate cele 15 module (verificat la c3f150d). Ce lipsește e în `AUDIT-COD-01-10.md`. Lucrează **o singură sesiune**, fără sesiuni în paralel pe `architecture.test.ts`.

## 0. Pachetul de design
Copiază `design_final_startica/` peste `docs/design/`, cu suprascriere. **Nu șterge** ce există doar în repo: `verificare/`, `INTREBARI.md`, `COADA-DE-LUCRU.md`, `RASPUNSURI.md`, `AUDIT-UI-*.md`.
Apoi mută în `docs/design/arhiva/` și șterge din rădăcină: `PROMPT-CLAUDE-CODE.md`, `-2`, `-3`, `-4`, `-5`, `AUDIT-DS-30-09.md`, `AUDIT-DS-30-09-v2.md`.
Commit: `docs(design): pachet 01.10`.

## 1. Contrast (din `AUDIT-DESIGN-30-09-final.md` A, B)
1. Tokeni noi în `tokens.css` și `TOKENS.md`: `--orange-strong-hover: #a34f00`, `--orange-strong-pressed: #8a4300`.
2. `Button primary`: fundal `--orange-strong`, hover `--orange-strong-hover`, apăsat `--orange-strong-pressed`. Același lucru la `SplitButton` și la butonul primar de antet.
3. Tot textul sau iconița albă stă pe `--orange-strong`: checkbox bifat, itemul activ din `NavRail`/Sidebar (și varianta închisă), pasul curent din `Wizard`/`Stepper`, pastila „azi” din `MonthCalendar`/`DayGrid`/Personal/Prezența, `CountBadge` portocaliu.
4. Tot textul portocaliu de pe alb sau cremă trece pe `--orange-ink`: linkuri, `Button link`, „Pasul N din M”, eticheta de tab activ, ziua curentă.
5. `--orange` rămâne doar pentru borduri, puncte, bare și fundaluri soft, fără text peste.
6. Test nou **R10** în `architecture.test.ts`: în `*.module.css`, niciun bloc nu are simultan `background: var(--orange)` și `color: var(--white)`, și niciun `color: var(--orange)`. Fără allowlist.
Commit: `ui(ds): contrast orange-strong / orange-ink`.

## 2. Golurile de API din componente (închid excepțiile)
Câte un commit pe componentă, cu test și poveste în Storybook (după §4) sau secțiune în `/design-system` (până atunci). După fiecare, scoate ecranul din allowlist.

| Componentă | Ce se adaugă | Ecranul care o adoptă |
|---|---|---|
| `MonthCalendar` | zilele sunt `<button>`; `selected`, `onSelect`, `cellHeight`, `renderCell(day)` | Vizite (șterge `calendarCell` propriu; testele caută `getByRole('button', {name: …})`) |
| `MasterDetail` | `detailSide: 'start' \| 'end'`, `detailWidth` | Achitări „Pe luni” (listă lată + detaliu 400px dreapta) |
| `DayGrid` | `renderCell(child, day)` | Prezența luna, cu `AttendanceDot` în celulă (ARIA rămâne neschimbat) |
| `BarChart` | `grouped`: un singur `<button>` pe grup, `aria-label` combinat, `tooltip(group)` | Dashboard „Evoluția încasărilor”, tooltip cu diferența |
| `Button` | `variant="link" tone="inherit"` (culoarea vine de la părinte) | Dashboard „Vezi lista →” |
| `Dialog` | `ariaLabel` separat de `title` | Salarii: titlul vizibil „Plătește N salarii”, `ariaLabel` „Confirmă plata” (testul rămâne) |
| `Dialog` (adopție) | — | Prezența, `WeeklySheetDialog` (se scoate hack-ul `style` de pe pastila de grupă, se folosește `ChipSelect tone`) |
| `SelectableTile` / `SelectableRow` (nou) | `<button>` pe toată suprafața; `selected`, `tone`, hover/focus din tokeni; slot pentru conținut | ChildTile, GroupTile, NotifyPage, ReviewPage, AssignPage, ConflictsPage, GroupTeamPicker, LeavesView, StaffFormDrawer |
| `ChipSelect` | opțiuni cu `tone` și `hint` (tooltip) | ChildFormDrawer, grupul „Grupă” (capacitatea în tooltip) |
| `PrintTable` | folosit la tipăriri | TimesheetPrint, ReportPrintSummary, Bazin WeekView (print) |
| `@shared/format` | `formatMoneyInput(n)` (valoarea de input, fără separator de mii) | PaymentFormDrawer (scoate R7) |

Tokeni noi pentru R2: `--shadow-row-active: inset 4px 0 0 var(--orange)`, `--font-mono: ui-monospace, "Cascadia Mono", Consolas, monospace`. Razele în afara scării se rotunjesc la cea mai apropiată `--radius-*`, fără token nou. `#e0b400` → `--code-co`, `#5b666e` → `--text-secondary`, pentru că există deja.

Stări goale: cheie nouă `dashboard.attention.first` („Adaugă primii copii”, buton „Copil nou”), folosită când nu există copii. La De notificat, titlul vine din `denotificat.done`, iar nota dinamică „N fișe nu pot fi evaluate…” merge în `text`.

**Criteriu:** în `architecture.test.ts` rămân cel mult 2 excepții: R3 `WeeklySheet.tsx` (✓ din legenda tipărită) și nimic altceva. Apoi mecanismul de allowlist se șterge pentru R1, R2, R7 și R9.

## 3. Capturi design lângă cod, pe o copie a bazei
Nu se pornește niciodată pe `Startica_Date/startica.db` real.
1. Găsește unde se citește directorul de date (server). Dacă nu există, adaugă override prin variabilă de mediu (ex. `STARTICA_DATA_DIR`) și un script `npm run dev:copy`: copiază `Startica_Date/` într-un director temporar (`.tmp/data-copy/`, în `.gitignore`), pornește serverul pe copie cu sincronizarea **oprită**, apoi pornește `webapp` dev.
2. Script Playwright `scripts/design-capture.mjs`: pentru fiecare modul din `docs/design/verificare/README.md`, deschide artboard-ul (`docs/design/<fișier>.dc.html#<id>`) și ruta reală la 1440×900 (și la 1024 unde spec-ul are responsive). Salvează `docs/design/verificare/<NN>-<modul>.png` cu design stânga și cod dreapta.
3. Completează în fiecare `verificare/<NN>-*.md` secțiunea „Diferențe vizuale”: ce diferă, și pentru fiecare fie repari, fie treci „deviere acceptată: motiv”.
4. Actualizează tabelul din `verificare/README.md` cu o coloană „Captură”.
Commit per modul: `verify(<modul>): captură 1440`.

## 4. Storybook în locul `/design-system`
Decizia de la 30.09 rămâne: Storybook înlocuiește ruta `/design-system` și `build:design-system`.
1. `npx storybook@latest init --builder vite --type react` în `webapp/`. Addon-uri: `@storybook/addon-a11y`, `@storybook/test`. Scripturi: `storybook` (6006), `build-storybook` (`storybook-static/`, în `.gitignore`).
2. `.storybook/preview.ts`: `tokens.css`, fonturile locale (Baloo 2, Nunito), resetul global, fundal `--cream` / `--white`, viewport-uri 1440/1024/768/390, a11y cu `test: 'error'`.
3. Grupele urmează paginile de design: `Fundamente/`, `Componente/`, `Formular/`, `Tabel și filtre/`, `Date și grafice/`, `Încărcare și stări/`, `Tipare de pagină/`, `Diverse/`, `Aplicație/` (shell-ul din `ShellSection`), `Stări goale/` (o poveste pe cheie din `empty-states.ts`, plus no-results). `*.stories.tsx` stă lângă componentă. `parameters.design` = `docs/design/<fișier>.dc.html#<id>`.
4. Fiecare poveste: `Default` cu `args`, apoi câte una pe stare (hover/focus prin `play`, activ, dezactivat, loading, error, gol). Texte reale din design. Fără CSS în poveste.
5. `design-system.coverage.test.ts`: fiecare export din `@shared/ui/index.ts` are poveste; `Disabled`/`Loading`/`Error` doar dacă prop-ul există; fiecare cheie din `empty-states.ts` are poveste. Poveștile rulează ca teste (`composeStories` + `jest-axe`) în `npm test`.
6. Mută fiecare secțiune din `webapp/src/design-system/` în povești, apoi șterge folderul, ruta, linkul din meniu, `vite.design-system.config.ts` și scriptul `build:design-system`.
Commit-uri: `chore(storybook): setup` → `docs(storybook): <grupa>` → `chore: șterge /design-system`.
**Criteriu:** `npm run build-storybook` fără warning-uri, a11y 0 încălcări, acoperire 100%.

## 5. După toate, task separat
**21c „Lucrez fără legătură” + „Ultima sincronizare”:** persistă `lastSyncedAt` în `sync.json` (`sync-engine.service.mjs`), expune-l în `/api/session` (`syncSummary`), apoi construiește 21c după `Incarcare.dc.html`. Scrie întâi un plan scurt în `docs/superpowers/plans/`.

## Ordinea
§0 → §1 → §2 → §3 → §4 → §5. `npm run check` și `cd webapp && npm run typecheck && npm test` trebuie să fie verzi după fiecare commit. Treci mai departe fără să aștepți.

## Nu se face
Documentele copilului, `child_notes` separat, IBAN pe plătitori reținuți, plus tot ce e în „Nu se face” din `arhiva/PROMPT-CLAUDE-CODE-3.md`.

## Te oprești doar dacă
- o extindere de componentă schimbă logica de date;
- un spec contrazice componenta din design system;
- `npm run check` rămâne roșu după 2 încercări;
- nu poți porni serverul pe o copie izolată a bazei (§3). În cazul ăsta nu pornești pe baza reală.
Scrii întrebarea în `docs/design/INTREBARI.md` și treci la punctul următor.
