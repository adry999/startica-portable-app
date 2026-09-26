# Audit Startica — 26 septembrie 2026 (`master-v2`)

Audit de arhitectură și calitate a codului, doar citire, pe branch-ul `master-v2` (`d91ae83`, arbore curat), care pornește din `master` `66a93f7` cu 74 de commit-uri în plus. Unghiuri: structură/modularitate (backend `src/` și `webapp/`), componente reutilizabile, comentarii și nume, lucru concurent pe module, pregătirea pentru monedă/SMS/multi-grădiniță. Nu repetă auditul din 22 septembrie (`2026-09-22-code-audit.md`, care privea `feat/notification-preferences` pe vanilla) — pornește de la starea de după cutover-ul pe React.

**Ce am citit vs. ce am sărit.** Citit integral: `.claude/skills/project-conventions/{SKILL,DESIGN}.md`, `tests/architecture/import-boundary-rules.mjs`, `src/config/environment.mjs`, `src/core/server/database/sqlite-connection.mjs`, `src/core/server/http/static-assets.mjs`, `src/app/server/{create-application,main}.mjs`, `webapp/src/app/App.tsx`, `webapp/src/app/shell/{routes,nav-items,TopbarActions}.tsx`, `webapp/src/shared/ui/{DataTable,Badge,FilterPills,group-tone,index}.ts(x)`, `webapp/{package.json,tsconfig.json,vite.config.ts}`. Citit pe fragmente (funcțiile relevante): `ChildrenPage`, `ExpensesPage`, `VisitsPage`, `PaymentsPage`, `GroupsPage`, `useChildren`, `useDashboard`, `useExpenses`, `session.ts`, `save-status.ts`, `visit-form.ts`, `EnrollDrawer`, `record-editing.routes.mjs`, `groups.routes.mjs`, `backup.service.mjs`, `revision-transaction.mjs`. Restul (cca 60 de fișiere de feature din fiecare parte) doar prin `grep`/listare, nu linie cu linie — cifrele de mai jos sunt din grep, nu din impresii, dar nu pretind exhaustivitate acolo unde spun „eșantion”.

## 1. Baseline

| Verificare | Rezultat |
|---|---|
| `git branch --show-current` | `master-v2` @ `d91ae83`, `git status` curat |
| Backend `npm run check` | **ROȘU** — pică la primul pas, `prettier --check` |
| Backend `npm run format:check` | 17 erori de parsare, toate în `docs/design/*.dc.html` (`<meta></meta>`, „Void elements do not have end tags”); `.prettierignore` exclude `web/index.html` și `web/assets/` (care nu mai există) dar nu și `docs/design/` |
| Backend `npm run typecheck` | **4 erori**: `src/app/web/compose-screens.mjs:30,31` și `src/app/web/main.mjs:6` importă `#features/payment-assignment/index.web.mjs` și `#features/payments/index.web.mjs`, șterse în `a3cbfa3`; `src/features/record-editing/server/record-editing.routes.mjs:28` — `record.status` pe uniunea `Child | Payment | …` (Payment n-are `status`) |
| Backend `npm test` | 602 teste, 600 trec, 2 sărite (CSV real lipsă, Chrome — cunoscute), 0 eșuate; `tests/architecture/import-boundaries.test.mjs` trece |
| Webapp `npm run typecheck` | verde |
| Webapp `npm test` | 58 fișiere, **356 teste, toate trec**, 26 s |
| `npm run test:e2e` | nerulat (cere `webapp/dist` construit + instalare) |

Testele backend sunt verzi în timp ce `tsc` e roșu pentru că niciun test nu importă `compose-screens.mjs`/`main.mjs` (web); `tsconfig.json` de la rădăcină le include însă prin `src/**/*.mjs`. Concluzie practică: **pe `master-v2` nimeni nu poate rula `npm run check` verde azi**, deci semnalul „înainte de commit” din SKILL.md §Testare nu funcționează. Ambele cauze sunt mici (vezi §8, R1).

## 2. Structură și module

### 2.1 Backend (`src/`)

14 feature-uri. Forma cerută de SKILL.md (README, `<feature>.types.d.mts`, `index.server`/`index.web`, `domain/`, `server/`, `web/`, `test-support/`) se respectă în proporție mare:

| | README | types | index.server | index.web | domain | server | web | test-support |
|---|---|---|---|---|---|---|---|---|
| prezent în | 14/14 | 11/14 (lipsă: billing, dashboard, fee-setup) | 13/14 (lipsă: dashboard) | 13/14 (lipsă: payment-assignment, șters) | 12/14 (lipsă: groups, record-editing) | 11/14 (lipsă: billing, dashboard, review-center) | 13/14 | 4/14 |

Nimic anormal aici: `billing`/`dashboard`/`review-center` sunt feature-uri de domeniu pur, `groups`/`record-editing` sunt CRUD fără reguli proprii. Granițele țin — testul de arhitectură trece și eșantionul citit (`create-application.mjs`, rutele, serviciile) confirmă că `app/server` e singurul compositor.

**Bine:**
- `create-application.mjs` rămâne un composition root curat: fiecare feature primește doar ce-i trebuie (`recordWriteDependencies`, `readEnvelope`, `readSetting`), nimic nu se importă între feature-uri.
- `static-assets.mjs` servește exclusiv `webapp/dist` cu verificare de traversare, testată prin HTTP real în `tests/http-modules.test.mjs`. Cutover-ul de servire e făcut corect.

**S1 — Stratul vanilla din `src/` e mort, dar pe jumătate șters (major).** Migrarea (spec `2026-09-23-ui-redesign-react-migration-design.md`, §Cutover) a șters `web/` (index.html, stiluri), dar nu și codul UI din `src/`:

| Zonă | Fișiere `.mjs` | Linii (fără teste) | Folosit de webapp |
|---|---|---|---|
| `src/app/web/` | 17 | ~1 660 (toate) | nimic |
| `src/features/*/web/` | 47 | ~5 300 (toate) | nimic direct |
| `src/shared/ui/` | 23 | ~1 160 | 3 fișiere: `record-list-search`, `record-list-summary`, `copy-to-clipboard` |
| `src/core/web/` | 10 | ~850 | 3 fișiere: `api-client`, `app-session-store`, `domain-event-bus` |

Total: **5 749 din 11 732 de linii non-test din `src/` (49 %) nu sunt servite de nimeni** — nu există niciun `index.html` care să încarce `src/app/web/main.mjs`, iar serverul nu mai servește `/src/`. **135 din cele 602 teste backend (23 de fișiere) testează acest cod mort.** Commit-ul `a3cbfa3` a început ștergerea (`src/features/payments/` integral, `payment-assignment/web/`), dar a lăsat `compose-screens.mjs` și `main.mjs` cu importuri rupte — de aici erorile `tsc` din baseline. Nu e o eroare de design, e un pas neterminat; efectul e că fiecare `grep` pe repo întoarce dublu (un `useChildren.ts` și un `children-list.controller.mjs` pentru același ecran), iar spec-ul pentru monedă (§6) a fost implementat exact pe acest strat.

**S2 — `index.web.mjs` amestecă domeniu cu DOM, iar webapp-ul sare peste el.** Cele 5 `index.web.mjs` pe care webapp-ul le importă (`children`, `billing`, `review-center`, `visits`, `fee-setup`) reexportă și `create*View`/`create*Controller` (cod DOM mort) lângă funcțiile de domeniu. În paralel, webapp-ul importă direct **20 de căi interne** ale feature-urilor backend, contra regulii „doar prin `index.*`” din SKILL.md §Stadiul migrării: `#features/visits/domain/{visit-status,visit-statistics,visit-child-prefill}.mjs`, `#features/payment-assignment/domain/{unassigned-payment-risk,-queue,-hints}.mjs` + `payment-assignment.types.d.mts`, `#features/data-transfer/domain/excel-workbook.mjs` + tipuri, `#features/review-center/domain/review-center.mjs`, `#features/fee-setup/domain/child-fee-setup.mjs`, `#features/expenses/domain/{expense-category-names,canonical-category-name}.mjs`, `#features/dashboard/domain/cash-summary.mjs`, `#features/audit-log/domain/audit-change-diff.mjs` + tipuri. Testul de granițe nu vede nimic din asta pentru că `webapp/` nu e în aria lui. Nu e grav funcțional (sunt importuri de domeniu pur), dar înseamnă că un feature backend nu mai are un contract public — orice fișier din `domain/` e de facto public.

**S3 — Documentația de convenții descrie stratul vechi ca fiind curent.** `SKILL.md:26` trimite la branch-ul `redesign/react-vite` (inexistent; lucrul e pe `master-v2`); `:33` „stilurile sunt în `web/styles/`”; `:58` „import map-ul din `web/index.html`”; `:60` „serverul servește module doar din lista albă `app/web`, `core/web`…” (fals de la cutover — servește `webapp/dist`); `:84` `npm run test:browser`. Toate cele 14 `src/features/*/README.md` descriu `web/*.controller.mjs`/`*.view.mjs` ca parte vie a feature-ului. `.prettierignore` are 3 intrări pentru `web/` care nu mai există.

### 2.2 Webapp (`webapp/src/`)

14 feature-uri, formă uniformă: `index.ts` (API public — de obicei doar `XPage`), `XPage.tsx` + `.module.css` + `.test.tsx`, `useX.ts` + `.test.ts`, plus `XFormDrawer.tsx` unde există formular. Consistent și ușor de navigat. Niciun README pe feature (backendul are), ceea ce e acceptabil cât timp `docs/design/screens/NN-*.md` joacă rolul ăsta.

**Convenția „un feature nu importă alt feature” — verificată cu grep pe `from '../…'`:**

- **O încălcare reală:** `features/children/ChildrenPage.tsx:23-24` importă `../payments/PaymentFormDrawer` și `../payments/payment-form` (`buildPaymentRecord`, `findDuplicatePayment`) — nu prin `index.ts`, ci direct în internele feature-ului `payments`, pentru drawer-ul „Achitare nouă” din fișa copilului (`:531-532`, `:660`). Există deja ruta `/achitari/nou?copil=<id>` (`App.tsx:128-141`, `PaymentsRoute` citește `copil` din query), pe care aceeași pagină o folosește la `:643` — deci cuplajul are o alternativă fără import.
- **Dependență inversată feature → app, în 9 fișiere non-test:** `useTopbarActions`/`useTopbarTitle` din `../../app/shell/TopbarActions` în `ChildrenPage.tsx:14`, `BirthdaysPage.tsx:6`, `GroupsPage.tsx:4`, `VisitsPage.tsx:14`; tipul `ViewKey` din `../../app/shell/nav-items` în `DashboardPage.tsx:7`, `ChildrenPage.tsx:26`, `NotifyPage.tsx:4`, `ReviewPage.tsx:3` (+ 6 fișiere de test). SKILL.md spune că `app/` e cel care importă feature-urile, nu invers. `TopbarActions` e un mecanism generic de „slot” — locul lui e `shared/`; `ViewKey` e un contract de navigare, la fel.
- **Nicio gardă mecanică.** Webapp-ul nu are ESLint (nu e în `devDependencies`, nu există `eslint.config.*`; `// eslint-disable-next-line` din `App.tsx:61` e inert) și niciun test de arhitectură. Spec-ul de migrare §„Gărzi” pct. 4 promitea exact această regulă „plantată cu o încălcare deliberată, văzută eșuând” — nu s-a făcut, și încălcarea de mai sus a intrat fără să o observe nimeni.

## 3. Componente reutilizabile

Inventar `webapp/src/shared/ui/` și câte fișiere non-test din `features/`+`app/` le importă:

| Componentă | Fișiere care o folosesc | Observație |
|---|---|---|
| `Card` | 16 | universal |
| `useToast` | 13 | universal |
| `Drawer` | 9 | toate formularele |
| `Badge` | 8 | ok |
| `SegmentedControl` | 7 | ok |
| `DataTable` | 6 | `AssignPage`, `NotifyPage` folosesc `<table>` brut (parțial justificat: rânduri editabile / fără paginare) |
| `SearchSelect` | 3 | |
| `groupTone` | 2 | doar `children` (vezi mai jos) |
| `FilterPills` | 1 | doar `BirthdaysPage`; comentariul din `FilterPills.tsx:20` o cere în 6 ecrane |
| `MonthStepper` | 1 | |
| `MonthPicker` | 1 (Topbar) | |

Verdict: **nucleul (Card/Drawer/Badge/Toast/DataTable) chiar e reutilizat**, dar tot ce e „în jurul tabelului” a rămas per feature. Concret:

**C1 — Meniul ⋯ de pe rând, trei implementări.** `ChildrenPage.tsx:310-329` și `ExpensesPage.tsx:197-216` au același `<details className={styles.rowMenu}>` copiat, cu CSS-ul duplicat integral (`.rowMenu`, `.rowMenu summary`, `::-webkit-details-marker`, `.rowMenuPanel`, `.rowMenuPanel button`, `:hover`, `.rowMenuDanger` — `ChildrenPage.module.css:243-287` vs `ExpensesPage.module.css:273-317`). `VisitsPage.tsx:244-271` face altceva: 5–7 butoane-link înșirate pe rând (`.rowActions`/`.linkButton`), ceea ce contrazice direct DESIGN.md §Interacțiuni („Acțiunile de pe rând stau în meniul ⋯, nu ca link-uri înșirate pe rând”). (Se lucrează separat — notat, nu reparat.)

**C2 — Bara de selecție, trei copii.** `ChildrenPage.tsx:412-414`, `ExpensesPage.tsx:386-389`, `PaymentsPage.tsx:264-272` — același `<div className={styles.selectionBar}>` cu „N selectate · sumă” + buton, CSS propriu în fiecare `.module.css` (`:150`, `:246`, `:86`). `DataTable` gestionează deja `selectedRowKeys`, dar nu oferă bara.

**C3 — Trei algoritmi diferiți pentru „culoarea grupei”.** `shared/ui/group-tone.ts` (index în lista sortată după nume — stabil între ecrane, cum spune comentariul lui); `GroupsPage.tsx:10,17-18` `TILE_TONES[index % 3]` și `GroupsBoard.tsx:6,46` `COLUMN_TONES[index % 4]` (index în lista primită, cu 3 respectiv 4 tonuri — aceeași grupă poate avea altă culoare în Carduri față de Tablă și față de Copii); `ChildrenPage.tsx:38-44` `AVATAR_TONES` + `hashIndex(nume)` (al treilea algoritm, pe hash de nume). `docs/design/URMATORUL-PAS.md` cere deja pct. 3 („badge-urile de grupă din Copii și Grupe folosesc groupTone”).

**C4 — Butoane: cea mai mare duplicare numeric.** Nu există `Button` în `shared/ui`. `.btnPrimary` e definit în **14 fișiere `.module.css`** (toate paginile și drawer-ele), cu 21 de utilizări `styles.btnPrimary`, 21 `styles.btnGhost`, 8 `styles.linkButton`, 2 `styles.primaryButton`, 1 `styles.btnSecondary`. Orice corecție de stil (DESIGN.md §Antet: „primar padding 8px 18px, 15px, umbră 0 4px 10px…”) se face azi în 14 locuri.

**C5 — Câmpul de căutare și filtrele.** 6 `<input type="search">` cu clasă locală `.search` (`ChildrenPage.module.css:122`, `ExpensesPage:219`, `VisitsPage:451`, …). `FilterPills` există și e folosită într-un singur ecran; celelalte folosesc `SearchSelect` pentru grupă/statut (`ChildrenPage.tsx:386-409`).

**C6 — Stări goale:** `styles.empty` local în 6 locuri (`AssignPage:85`, `BirthdaysPage:129,131`, `GroupsPage:211`, `NotifyPage:93`, `ReviewPage:88`); `DataTable` are `emptyState` dar nu există o componentă `EmptyState`.

**C7 — Confirmări în afara DESIGN.md.** DESIGN.md:25: „Nu folosi `window.confirm`. Ștergerea definitivă cere «Scrie ȘTERGE». Arhivarea se confirmă cu toast «Anulează»”. În cod: **7 apeluri `window.confirm`** — `ChildrenPage.tsx:238,535`, `ExpensesPage.tsx:84,130`, `GroupsPage.tsx:82`, `PaymentsPage.tsx:73,252`, `VisitsPage.tsx:141`. Toast-ul „Anulează” la arhivare există doar în `children` și `expenses`; `payments`, `visits`, `groups` arhivează fără undo.

## 4. Comentarii și cod

Eșantion citit pentru stil (20 de fișiere): backend — `environment.mjs`, `sqlite-connection.mjs`, `static-assets.mjs`, `create-application.mjs`, `main.mjs`, `revision-transaction.mjs`, `backup.service.mjs`, `groups.routes.mjs`, `record-editing.routes.mjs`, `import-boundary-rules.mjs`; webapp — `App.tsx`, `TopbarActions.tsx`, `routes.ts`, `session.ts`, `save-status.ts`, `DataTable.tsx`, `useChildren.ts`, `useDashboard.ts`, `useExpenses.ts`, `visit-form.ts`, `EnrollDrawer.tsx`. Plus grep pe tot repo-ul pentru engleză, blocuri lungi și identificatori interziși.

**Bine:**
- Limba: **zero comentarii în engleză în sursele `src/` și `webapp/src/`** (grep pe cuvinte-cheie engleze fără diacritice n-a găsit nimic în afară de JSDoc `@param {{ from: string }}`). Singurele în engleză sunt în configurări: `webapp/vite.config.ts:14-16,22-30` și `webapp/tsconfig.json:9-11`.
- Comentariile backend din eșantion sunt aproape toate DE CE autentic: `groups.routes.mjs:39-43` (de ce se golește `desiredGroupId` în loc să blocheze ștergerea — cu consecința asupra backup-ului), `revision-transaction.mjs:31-36` (cele trei garanții), `create-application.mjs:57,87-88,94-95`, `main.mjs:26,33,73,83,97`. Nu povestesc codul.
- `TODO`/`FIXME`/`HACK`: **niciunul** în niciun arbore.

**Abateri concrete:**

*Lungime (regula: 1–2 linii).* Backend: 40 de blocuri `//` de ≥3 linii în fișiere non-test, de ex. `backup.service.mjs:233 (5), :248 (4), :138 (4)`, `revision-transaction.mjs:31 (6)`, `groups.routes.mjs:39 (5)`, `migration-runner.mjs:8 (4)`, `request-guards.mjs:5 (4)`, `static-assets.mjs:6 (4)`. Aproape toate sunt DE CE legitim — problema e doar lungimea, nu conținutul. Webapp: 19 blocuri JSDoc de ≥4 linii, de ex. `shared/api/session.ts:7 (11 linii)`, `app/shell/save-status.ts:24 (8)`, `useDashboard.ts:56 (7)`, `useExpenses.ts:96 (7)`, `visit-form.ts:53 (7)`, `EnrollDrawer.tsx:15 (7)`.

*Comentarii care trimit la istoria task-ului (cel mai răspândit tip de abatere în webapp).* Tiparul „Echivalentul `<x>.controller.mjs` / `<x>.view.mjs`” apare în **14 hook-uri**: `useAssign.ts:77`, `useAuditLog.ts:47`, `useBackup.ts:83`, `useExcelTransfer.ts:40`, `useRestore.ts:70`, `useChildProfile.ts:33`, `useExpenses.ts:97`, `useFeeSetup.ts:72`, `useNotificationPreferences.ts:18`, `useTelegramStatus.ts:31`, `useNotify.ts:83`, `usePayments.ts:116`, `useStatus.ts:30`, `useVisits.ts:58`. Toate referă fișiere din stratul mort (S1) — după ștergerea lui, 14 comentarii vor arăta spre nimic. La fel „pasul 5”/„subagenți” în `AppShell.tsx:15,20`, `SaveStatusCard.tsx:9`, `save-status.ts:30`, `useDashboard.ts:60` (cu typo „quando”), „vezi spec-ul de migrare” `session.ts:12`, „din vanilla/legacy” în `MonthPicker.tsx:23`, `useBackup.ts:98`, `useAssign.ts:79`, `PaymentFormDrawer.tsx:28`. `useChildren.ts:76` și `useDashboard.ts:58` spun „vezi comentariile de import” — nu există niciun comentariu pe importuri.

*Comentariu fals.* `src/core/server/http/static-assets.mjs:29-31`: „SPA fără router propriu: un singur punct de intrare, randat diferit după starea din React, nu după cale” — fals din 2026-09-24 (`react-router-dom`, SKILL.md Decision log); fallback-ul pe `index.html` e necesar tocmai *pentru că* există căi reale (`/copii/:id`). Comentariul explică corect *ce* face codul cu un DE CE greșit.

*Identificatori interziși (SKILL.md: `b, r, s, o, fn, data, item, handler, util, helpers, parts, views`).*
- `data` — sistematic în webapp, ca rezultat al hook-ului: `const data = useX()` în **15 locuri** (`AssignPage:12`, `AuditLogPage:6`, `BackupPage:12`, `BirthdaysPage:34`, `ChildrenPage:74,483`, `DashboardPage:64`, `ExpensesPage:23`, `FeeSetupPage:11`, `GroupsPage:22`, `NotifyPage:13`, `PaymentsPage:48`, `ReviewPage:20`, `StatusPage:13`, `VisitsPage:93`); și `excel-workbook.mjs:216`.
- `item` — `App.tsx:77-80`, `Sidebar.tsx:28`, `DashboardPage.tsx:207`, `useDashboard.ts:185`, `ExpensesPage.tsx:251-257`, `useExpenses.ts:93`, `useReview.ts:82`, `useChildren.ts:103`, `record-editor-dialog.mjs:117,138`, `children-summary.view.mjs:24`.
- `r` — `Topbar.tsx:33-34`, `DashboardPage.tsx:75`, `useDashboard.ts:95`, `excel-workbook.mjs:135-188`, `financial-history-import.mjs:65`, `record-editor-dialog.mjs:55`; plus masiv în stratul mort (`notify-list.view.mjs:26-34,61-78`, `payment-status.view.mjs:11-18`, `dashboard.view.mjs:38-210`).
- `parts` — `useReview.ts:123`; `s` — `child-profile.view.mjs:85`.
- `any`: `useChildren.ts:103` (`(item: any)` de două ori) — singurul din webapp; tipurile din `review-center` există (`review-center.types.d.mts`).

*Tip incorect real:* `record-editing.routes.mjs:28` — verificarea „Înscris doar prin `/api/visits-enrol`” citește `record.status`/`existing?.status` pe uniunea tuturor tipurilor de înregistrare. Funcționează la runtime (gardat de `request.type === 'visits'`), dar `tsc` nu poate restrânge tipul și raportează eroare — lipsește un cast sau un `narrow` după `type`.

## 5. Lucru concurent pe module — două sesiuni

**Verdict: DA, cu rezerve.** Două sesiuni pe două feature-uri diferite (de ex. `visits` și `expenses`) pot lucra în paralel fără conflicte în majoritatea fișierelor, dar există un set mic de fișiere „fierbinți” pe care aproape orice task de ecran le atinge, plus două condiții de mediu care azi lipsesc.

**Fișiere izolate pe feature (sigure):** `webapp/src/features/<x>/*` (14 foldere, fiecare cu propriile CSS module, hook, teste), `src/features/<x>/*`, `docs/design/screens/<NN>-<x>.md`.

**Fișiere fierbinți, cu numărul de commit-uri care le-au atins din cele 74 de pe `master-v2`:**

| Fișier | Commit-uri | De ce îl ating două sesiuni |
|---|---|---|
| `webapp/src/app/App.tsx` | **26 (35 %)** | orice rută nouă, orice prop nou de pagină, orice contor de sidebar (`:71-81`) |
| `webapp/src/app/App.test.tsx` | 10 | urmează `App.tsx` |
| `webapp/src/app/shell/Topbar.tsx` | 5 | căutare globală / titluri |
| `webapp/src/shared/ui/index.ts` | 4 | orice componentă nouă (barrel) |
| `webapp/src/shared/ui/DataTable.tsx` | 4 | orice prop nou de tabel cerut de un ecran |
| `webapp/src/app/shell/nav-items.ts` | 4 | `ViewKey`, `VIEW_TITLES` |
| `webapp/package.json` + lock | 5 | dependințe |
| `webapp/src/app/shell/routes.ts` | — | orice cale nouă |
| `docs/design/screens/README.md` | — | tabelul Index, un rând pe ecran |
| `package.json` (rădăcină) | — | versiunea |
| `src/shared/contracts/record-types.d.mts`, `record-schema.mjs` | — | orice câmp nou pe o înregistrare (monedă, SMS) |
| `src/app/server/create-application.mjs` | — | orice rută/serviciu nou |

**Rezervele, concret:**
1. **`App.tsx` e punctul de conflict aproape sigur.** Rutele, props-urile și contoarele din sidebar trăiesc toate acolo. Dacă ambele sesiuni adaugă o rută sau un prop, conflictul de merge e garantat (mic, dar e mereu același fișier). Remediu structural: fiecare feature își exportă rutele (`routes: RouteObject[]`) din `index.ts`, iar `App.tsx` doar le concatenează — atunci o rută nouă atinge doar feature-ul.
2. **Cuplajul `children → payments`** (§2.2): o sesiune pe `payments` care schimbă `PaymentFormDrawer`/`payment-form.ts` sparge `ChildrenPage` fără să știe.
3. **Nicio gardă** (§2.2): în paralel, un import cross-feature nou intră nevăzut; azi ar fi prins doar dacă cineva citește diff-ul.
4. **Baseline roșu** (§1): niciuna dintre sesiuni nu are un `npm run check` verde de la care să plece; ambele vor „moșteni” 4 erori `tsc` și 17 erori prettier și vor învăța să le ignore.
5. **Componentele comune lipsă** (§3): dacă ambele sesiuni au nevoie de meniu ⋯ sau bară de selecție, fie le copiază a patra/a cincea oară, fie ambele le extrag în `shared/ui` în paralel → conflict pe `index.ts` și două implementări.

**`.worktrees/`:** există și e folosit — un singur worktree, `feat-multi-currency-fees` (branch `feat/multi-currency-fees`, **pornit din `master`, nu din `master-v2`** — vezi §6). Nu e documentat nicăieri (`grep worktree docs/ .claude/ CLAUDE.md` → nimic). Rămâne mecanismul potrivit pentru izolare, cu două costuri noi de la separarea toolchain-urilor: `webapp/node_modules` nu se partajează între worktree-uri (un `npm ci` în `webapp/` per worktree), iar dacă sesiunea vrea să vadă ecranul prin serverul Node trebuie și `npm run build` în `webapp/` per worktree (`webapp/dist` e ignorat de git). Backendul n-are dependințe, deci pentru el worktree-ul e gratuit. Alternativa mai ieftină pentru două sesiuni pe două feature-uri **webapp** e un singur checkout + `vite dev` (HMR) — fișierele sunt disjuncte oricum, iar conflictele reale sunt cele din tabel, pe care worktree-ul nu le elimină, doar le amână la merge.

## 6. Pregătire: monedă / SMS / multi-grădiniță

### 6.1 Monedă (MDL/EUR, curs BNM) — NU e „nepornită”

Pe `master-v2`: zero — `grep -i currency|exchangeRate|BNM src webapp/src` nu găsește nimic, `record-types.d.mts` n-are `Currency`. Confirmat.

Dar în `.worktrees/feat-multi-currency-fees` (branch `feat/multi-currency-fees`) există **23 de commit-uri din 2026-09-23** care implementează spec-ul aproape integral (`3b390eb` tipuri → `1ca2ecc` curs + XML BNM → `a536ad2` dashboard → `128e06e`/`faa2b52` fetch + rute → `c193f51` ecran „Curs valutar” → `7e4ca98`/`bf75ac1` selectoare de monedă → `a4456e2`). Branch-ul pornește din `master` `66a93f7` și **țintește UI-ul vanilla**: `web/index.html`, 6 fișiere în `src/app/web/` (`exchange-rates-store`, `exchange-rate-settings.controller`, `compose-screens`, `main`, `render-cycle`), 8 fișiere în `src/features/*/web/`. Planul (`2026-09-23-multi-currency-fees.md:9`) spune explicit „Tech Stack: Node 22 vanilla ESM… no build step”. Deci: **domeniul și serverul sunt scrise, UI-ul e scris pe stratul mort.**

Ce se reia pe `master-v2` (cca 22 din 45 de fișiere atinse): `record-types.d.mts`, `record-schema.mjs`, `tuition-obligation.mjs`, `payment-allocations.mjs`, `money-format.mjs`, `exchange-rates.mjs` (nou, `#shared/domain`), `bnm-exchange-rate.mjs` + `exchange-rates.routes.mjs` (noi, `src/app/server/` — plasare corectă: rută cross-feature, ca `notification-settings.routes.mjs`), `create-application.mjs`, `main.mjs`, `billing/domain/*`, `dashboard/domain/cash-summary.mjs`, `fee-setup/domain/child-fee-setup.mjs`, cu testele lor. Ce se rescrie în `webapp/` după `docs/design/screens/16-planuri-eur.md`: store de curs în `shared/api/`, selector de monedă în `PaymentFormDrawer` (`payments`), `ChildFormDrawer` (`children`), `FeeSetupPage`, afișare în moneda copilului în `status`/`notify`/`children` fișă, conversie în `dashboard`, ecran „Curs valutar” (probabil în `notifications` sau `backup` — spec-ul 12-administrare adaugă „Grădinița”).

Unde se lovește de structura actuală: (a) `record-types.d.mts` și `record-schema.mjs` sunt fișiere fierbinți (§5) — orice altă sesiune care adaugă un câmp intră în conflict; (b) cuplajul `children → payments` (§2.2) înseamnă că selectorul de monedă din `PaymentFormDrawer` trebuie să meargă și în fișa copilului — dacă se rezolvă întâi cuplajul, task-ul de monedă e mai mic; (c) `ChildrenPage.tsx` de 718 linii (§7) va crește iar. Notă de igienă: `3b390eb` are `Co-Authored-By: Claude Haiku 4.5` chiar în *subiectul* commit-ului, contra SKILL.md §Git.

### 6.2 SMS — greenfield, confirmat

Zero cod (`grep -i '\bsms\b' src webapp/src` → nimic), doar `docs/design/screens/14-sms.md` + `Sms.dc.html`. Nu e gol în cod existent. Dacă se face, are un șablon exact: `src/features/telegram-notify/` (service cu `fetch` injectat + `test-support/fake-telegram-api.mjs`, config repository în `dataDir`, rute, `daily-digest` în domeniu). Un `src/features/sms-notify/` cu aceeași formă + `webapp/src/features/sms/` intră în structură fără nicio schimbare de granițe; singurul punct comun ar fi șabloanele de mesaj, care azi sunt în `billing/domain/reminder-message.mjs` — dacă SMS-ul le refolosește, ele trec în `#shared/domain/` (regula „reguli folosite de două feature-uri”).

### 6.3 Multi-grădiniță locală (N foldere `STARTICA_HOME`, unul ales la lansare) — raza de impact

Presupunerea „o singură bază” e concentrată în puține locuri, dar e adâncă:

| Loc | Ce presupune |
|---|---|
| `src/config/environment.mjs:38-43,73` | un singur `STARTICA_HOME`, absolut; `dataLayout(home)` → cele 3 foldere |
| `src/app/server/create-application.mjs:47-56` | **o singură** `openDatabase()` la construcție; toate serviciile (backup, repository, tranzacție, telegram, notification-settings) închid peste `db`/`dataDir`/`backupDir` prin closure — nu există nicio noțiune de „context” per cerere |
| `src/app/server/main.mjs:25,72-76` | un `startica.port` în `home`, citit de lansatorul C# (`launcher/`) ca semnal „instanța e vie” |
| `src/core/server/database/sqlite-connection.mjs:10` | numele `startica.db` fix în `dataDir` |
| `startica_telegram.mjs` / `telegram-digest.mjs` | proces separat, deschide *acea* bază read-only din `dataDir` |
| `webapp/src/shared/api/session.ts:19-45` | store singleton la nivel de modul — un token, o revizie, un snapshot |
| tabela `settings` (`externalDir` etc.), `telegram.json`, `notify-schedule.json` | per `dataDir` — deja izolate corect |

Două forme, cu raze de impact foarte diferite:
- **„Alegi folderul la lansare, apoi un singur server per proces”** — se rezolvă în lansator (C#: listă de foldere → setează `STARTICA_HOME` → pornește serverul) + un câmp `homeName` în `GET /api/session` pentru topbar. **Zero schimbări de arhitectură în `src/`**; afectează `launcher/`, `scripts/pachet-client/` (instalatorul), `diagnostic.routes.mjs` (afișează home-ul) și portul (două instanțe simultan ar cere `STARTICA_PORT` diferit sau `startica.port` per home — deja e per home). Mărime: **mic/mediu**, aproape tot în C#.
- **„Comuți între grădinițe din aplicație, fără restart”** — `createApplication` devine o fabrică de contexte per home, rutele primesc contextul (prefix de cale sau header), backup-ul programat rulează per bază, `session.ts` trebuie să știe să-și reseteze store-ul, lansatorul urmărește N porturi sau unul multiplexat. Atinge `create-application`, `main`, `route-dispatcher`, `session.routes`, `backup.service`, `telegram-digest`, `session.ts`, `App.tsx`. Mărime: **mare**, și e exact drumul care duce spre SaaS-ul amânat deliberat (`project_saas_pivot_discussion`).

Recomandare de raportat, nu de decis aici: prima formă acoperă „2+ grădinițe pe același calculator, una deschisă odată” aproape gratuit; a doua nu merită fără un motiv concret.

## 7. Alte observații

- **Fișiere mari (>400 linii).** `webapp/src/features/children/ChildrenPage.tsx` **718** — două ecrane într-un fișier (`ChildrenListView` `:65-471`, `ChildProfileView` `:472-671`) + 2 subcomponente; `visits/VisitsPage.tsx` 568; `expenses/ExpensesPage.tsx` 541 (conține `ExpenseFormDrawer` `:426-518` și `DailyExpensesView` `:519+`, deși toate celelalte feature-uri țin drawer-ul în fișier propriu); `payments/PaymentsPage.tsx` 410; `payments/usePayments.test.ts` 405. CSS: `DashboardPage.module.css` 536, `VisitsPage.module.css` 508, `ChildrenPage.module.css` 466. Backend: doar `compose-screens.mjs` 470 (mort, S1).
- **Cod mort dincolo de S1:** `src/core/web/{api-error,notice-banner,view-state}.mjs` folosite doar de stratul mort; 20 din 23 de module `src/shared/ui/*.mjs` la fel; aliasurile `#app`/`#config` din `vite.config.ts`/`tsconfig.json` nu sunt folosite de niciun import din `webapp/src`.
- **Dependință din afara registrului:** `webapp/package.json` ia `xlsx` dintr-un tarball de pe `cdn.sheetjs.com` (nu npm), iar `scripts/import-v5-history.mjs:38` (script de la rădăcină) îl încarcă cu `require('../webapp/node_modules/xlsx/xlsx.js')` — un script backend depinde de `node_modules`-ul webapp-ului. Funcționează, dar e o legătură ascunsă între cele două toolchain-uri.
- **`App.tsx:71-81`** rulează `useDashboard(month)` și `useFeeSetup()` pe toate rutele ca să umple contoarele din sidebar — corect ca reutilizare (comentariul spune de ce), dar înseamnă că fiecare ecran plătește evaluarea completă a lunii; irelevant la dimensiunea unei grădinițe, notat doar.
- **Testele webapp importă `app/shell/TopbarActions`** în 6 fișiere de test de feature ca să monteze provider-ul — încă un motiv ca provider-ul să fie în `shared/` (sau `test-setup.ts` să-l ofere).

## 8. Recomandări prioritizate

| # | Recomandare | Legat de | Mărime |
|---|---|---|---|
| **R1** | **Fă `npm run check` verde pe `master-v2`:** adaugă `docs/design/` în `.prettierignore` (și scoate intrările `web/*` moarte); repară `record-editing.routes.mjs:28` (restrânge după `request.type`); erorile din `compose-screens`/`main` dispar odată cu R2 — până atunci, șterge cele 3 importuri | §1, §4 | mic |
| **R2** | **Termină ștergerea stratului vanilla din `src/`:** `src/app/web/`, `src/features/*/web/`, `src/shared/ui/` minus cele 3 folosite, `src/core/web/` minus cele 3 folosite; `index.web.mjs` rămâne doar cu exporturi de domeniu (sau se redenumește `index.domain.mjs`, cu regula de granițe actualizată); actualizează cele 14 README-uri, SKILL.md `:26,:33,:58,:60,:84`. −5 700 de linii, −135 de teste moarte. **Înainte de R8**, altfel monedă se rescrie de două ori | S1, S2, S3 | mediu |
| **R3** | **Gardă de arhitectură pentru `webapp/`:** un test Vitest (`webapp/src/architecture.test.ts`) după modelul `import-boundary-rules.mjs`: feature nu importă feature, feature nu importă `app/`, importuri din backend doar prin `@domain`/`@contracts`/`@core/web` și `index.*` ale feature-urilor, nu `#features/*/domain/*`. Plantează încălcarea din `ChildrenPage.tsx:23` ca să vezi testul roșu, apoi rezolv-o (R4) | §2.2 | mic |
| **R4** | **Rezolvă cuplajul `children → payments` și dependența inversată feature → app:** mută `TopbarActions` și `ViewKey` în `shared/` (mic); pentru drawer-ul de achitare din fișa copilului, fie navighează la `/achitari/nou?copil=` (ruta există deja), fie `payments/index.ts` exportă explicit `PaymentFormDrawer` + `payment-form` ca API public și `children` îl importă prin `@features/payments` (rămâne cross-feature, dar declarat) | §2.2, §5 | mic/mediu |
| **R5** | **Extrage în `shared/ui` ce e copiat de ≥3 ori:** `RowMenu` (în lucru), `SelectionBar`, `Button` (primar/ghost/link — 14 definiții CSS), `SearchInput`; apoi `groupTone` în `GroupsPage`/`GroupsBoard`/avatarele din `ChildrenPage` (un singur algoritm de culoare); `FilterPills` în ecranele din `URMATORUL-PAS.md`. Fă-le **înainte** de a porni două sesiuni în paralel, ca să nu apară a patra copie | C1–C6, §5 | mediu |
| **R6** | **Confirmări conform DESIGN.md:** înlocuiește cele 7 `window.confirm` cu drawer-ul „Scrie ȘTERGE” (spec 13-formulare) și adaugă toast-ul „Anulează” la arhivare în `payments`/`visits`/`groups` | C7 | mediu |
| **R7** | **Curățenie de comentarii și nume, mecanică:** șterge cele 14 „Echivalentul `<x>.controller.mjs`” și referințele „pasul 5”/„vanilla”/„legacy” odată cu R2; corectează `static-assets.mjs:29-31`; redenumește `const data = useX()` → `children`/`payments`/`visits`… (15 locuri) și `item`/`r`/`parts` unde apar în cod viu; scoate `any` din `useChildren.ts:103` | §4 | mic |
| **R8** | **Monedă pe `master-v2`:** după R2, cherry-pick commit-urile de domeniu/server din `feat/multi-currency-fees` (`3b390eb`…`439bce5` fără cele 6 de `app/web`), rezolvă conflictele pe `record-types`/`record-schema`; apoi UI-ul în `webapp/` după `16-planuri-eur.md`; șterge worktree-ul vechi | §6.1 | mediu (backend) + mare (UI) |
| **R9** | **Rute per feature:** fiecare `features/<x>/index.ts` exportă rutele lui, `App.tsx` le concatenează — scoate `App.tsx` din lista fierbinte (26/74 commit-uri) | §5 | mic/mediu |
| **R10** | **Împarte `ChildrenPage.tsx`** (`ChildProfileView` în fișier propriu) și scoate `ExpenseFormDrawer` din `ExpensesPage.tsx`, ca restul feature-urilor | §7 | mic |
| **R11** | **Documentează izolarea:** un paragraf în SKILL.md despre `.worktrees/` (când merită, `npm ci` în `webapp/` per worktree, `vite dev` ca alternativă) și regula „branch-urile de feature pornesc din `master-v2`, nu din `master`” | §5, §6.1 | mic |
| **R12** | **Multi-grădiniță:** dacă se dorește, alege forma „la lansare” (lansator C# + `homeName` în `/api/session`); forma „în aplicație” doar cu un motiv concret. Nu porni nimic înainte de R2 | §6.3 | mic/mediu vs. mare |

**Ordinea care are sens:** R1 → R2 → R3 → R4 → R5 (deblochează lucrul în paralel cu semnal verde și gărzi), apoi R8 (monedă) și R6/R7/R9/R10 pe măsură ce se atinge fiecare ecran.
