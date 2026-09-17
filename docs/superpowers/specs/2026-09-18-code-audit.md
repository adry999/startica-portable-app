# Audit de cod Startica — 18 septembrie 2026

Făcut pe `master` la `aabe151` (1.6.1 + vizite: detaliu, șablon lipit), la 169 de commit-uri și 264 de fișiere după auditul din 14 septembrie (`96e0039`). Între cele două au intrat: pașii 11–12 din plan, `visits` (1.5.0), `telegram-notify` (1.6.0), lansatorul desktop, restaurarea din folder extern. Sursă: citirea integrală a fișierelor schimbate din `src/`, `tests/`, `scripts/`, `launcher/` și a README-urilor, un script propriu de scanare (exporturi fără consumatori, fișiere orfane, teste colocate lipsă, id-uri din `index.html`, clase CSS moarte, scripturi inline) și grep-uri pe fiecare regulă din `project-conventions`. Criteriile sunt cele din auditul precedent (amprentă AI, cod nefolosit, structură, simplify) plus convențiile proiectului, verificate una câte una (§0).

Baseline `npm run check`: Prettier și `tsc` curate; 491 de teste, 489 trec, 2 sărite, 0 eșuate.

Verdict: cod curat, cu AI-score ~2/10 pe ansamblu. Granițele de import țin (0 încălcări), niciun `export *`, niciun fișier orfan, niciun import relativ adânc, `process.env` doar în `#config`. Problemele sunt: o consecință de design la rezumatul Telegram (semnalată de utilizator), două defecte mici de corectitudine, README-uri rămase în urma implementării la `visits` și `telegram-notify`, câteva duplicări și controller-e noi fără test.

AI-score pe zone: `audit-log` 1, `groups` 1, `billing` 1, `backup` 2, `core/shared/app` 2, `dashboard` 2, `expenses` 2, `fee-setup` 2, `payment-assignment` 2, `record-editing` 2, `review-center` 2, `data-transfer` 3, `children` 3, `payments` 3, `telegram-notify` 3, `visits` 4.

Legendă: **auto** = safe-to-automate, **review** = necesită review manual.

## 0. Convențiile proiectului, criteriu cu criteriu

| Criteriu | Stare | Detalii |
|---|---|---|
| Stack (ESM, zero deps, fără build) | OK | `devDependencies` = `@types/node`, `prettier`, `typescript`; SheetJS vendorizat |
| Structură feature (`README`, `*.types.d.mts`, `index.*`, `domain/server/web/test-support`) | OK, cu excepții | `groups`, `review-center`, `billing`, `dashboard`, `expenses`, `fee-setup`, `payments`, `audit-log` nu au `test-support/` (nu au nevoie); `groups`/`billing`/`dashboard` fără `*.types.d.mts` — acceptat, tipurile sunt în JSDoc |
| Granițe de import (`tests/architecture`) | OK | 0 încălcări; testul acoperă și `scripts/`, `tests/`, rădăcina |
| `shared/` izomorf, `domain/` pur | OK | singurul `new Date()` în domeniu e `today()` din `calendar-month.mjs` (ceasul aplicației) |
| Importuri relative ≤ un `../`, tipuri cu `.mjs` | OK | 0 abateri |
| Lista albă servită de server | OK | doar `src/{app,core}/web`, `shared`, `features/*/{domain,web}`, `index.web.mjs` |
| Un singur script inline (import map) | OK | `index.html`: 1 `<script type="importmap">`, 0 atribute `on*=` |
| Erori server: `fail()`, un singur `catch` în dispatcher | Abateri | `try/catch` în `backup.routes` (3) și `telegram.routes` (5), vezi S4; `throw Error` în două module de import, vezi S5 |
| Client: `ViewStatus`/`renderGuarded` | Parțial | `renderGuarded` acoperă toate ecranele din `renderCycle`; `ViewStatus` îl expune doar `audit-log` (starea din 14 sept.); `visits`, `telegram-notify` urmează modelul majoritar (randare directă) |
| Scrieri prin `runRevisionTransaction` | OK | `visits.service` (înscriere + expirare), restaurare, import — toate în tranzacție |
| Contracte HTTP neschimbate | OK | rutele noi (`/api/visits-enrol`, `/api/telegram-*`) sunt adăugiri |
| Teste colocate, fără mock de module | Lipsuri | 10 controller-e/dialoguri fără test, vezi S2 |
| `process.env` doar în `#config` | OK | restul: `scripts/build-icon.mjs` (LOCALAPPDATA), `tests/browser-smoke.mjs` (capturi) |
| Nume: fără `r`, `s`, `item`, `parts`… | Abateri mici | 5 locuri, vezi N1 |
| Română cu diacritice | OK | singurele forme fără diacritice sunt aliasurile de antet CSV (potrivire) și motivele de backup (nume de fișier ASCII, intenționat); dar vezi N2 |
| Comentarii doar DE CE, fără istorie | Abateri mici | referințe la task-uri (S1, S5, T4) rămase, vezi C6 |
| Git: Conventional Commits, fără AI | OK | ultimele 169 de commit-uri respectă formatul; scope-urile `visits`, `telegram`, `launcher`, `web` nu sunt în lista din `docs/arhitectura/README.md` §4.7, vezi C5 |

## 1. Comportament și corectitudine

| ID | Sev. | Loc | Problemă | Recomandare | Tip |
|---|---|---|---|---|---|
| B1 | **important** | `src/app/server/telegram-digest.mjs:42-90`, `launcher/Startica.cs:302,412-416` | Rezumatul „de azi” pleacă oricând în zi. Lansatorul reînregistrează sarcina la fiecare pornire cu `StartBoundary = azi 08:00` și `StartWhenAvailable = true`; pornit după 08:00, Task Scheduler consideră rularea ratată și o execută imediat. Dovadă (raportat de utilizator): sarcina a rulat prima dată la 17.09 23:51 (`Last Run Time`; `telegram-stare.json`: `lastRun 2026-09-17T20:51:15Z`, `sentKeys` doar `zi:2026-09-17`), iar ziua de naștere din acea zi a fost anunțată „Azi” la sfârșitul zilei. Designul (`2026-09-15-telegram-notifications-design.md:92`) acceptă „mesajul vine la trezire/pornire, în aceeași zi”, dar un rezumat de seară nu mai folosește la nimic. | În `runTelegramDigest`: după o oră de tăiere (propunere 14:00, ora locală) rularea ratată nu mai trimite rezumatul de azi; scrie în jurnal `Rezumat ratat: prea târziu pentru azi` și **nu** marchează `zi:<azi>`, ca a doua zi la 08:00 să plece normal (zilele de naștere de mâine și poimâine sunt oricum în rezumatul următor). Alternativ: nu reînregistra sarcina la fiecare pornire, doar la `--register-task` (instalare) — dar atunci schimbarea căii `--home` nu se mai propagă; prima variantă e mai sigură. Test: `telegram-digest.integration.test.mjs` cu `now` la 23:00 → niciun apel `sendMessage`, nicio cheie. | review |
| B2 | important | `src/app/server/telegram-digest.mjs:50` | `todayStr = now.toISOString().slice(0, 10)` e data UTC, nu cea locală. Între 00:00 și 03:00 (UTC+2/+3) o rulare la trezire calculează „ieri”: trimite rezumatul de ieri, îl marchează `zi:ieri`, apoi la 08:00 mai trimite unul. Restul aplicației folosește data locală (`today()`, `isoDateOf`). | Data locală din `now` (vezi U1: `isoDateOf(now)` din `#shared/domain/calendar-month.mjs`). Test cu `now = new Date('2026-09-18T00:30:00+03:00')` → `zi:2026-09-18`. | auto |
| B3 | minor | `src/app/server/telegram-digest.mjs:93-112` | La succes nu se scrie nimic în `telegram.log`; fișierul nici nu există după o zi reușită (verificat: lipsește pe această mașină, deși `telegram-stare.json` are `lastSuccess`). Diagnosticul unui rezumat lipsă pornește de la un jurnal gol. | `log.write('INFO', \`Trimis: ${keys.length} chei\`)` înainte de `return 0`. | auto |
| B4 | minor | `src/features/visits/web/visits.controller.mjs:184` | `const upcoming = countVisitsForDays(...)` calculat și nefolosit la fiecare randare (badge-ul folosește `funnelStats.scheduled`, corect după `8733463`). | Șterge linia și importul `countVisitsForDays` din controller (rămâne exportat din `index.web.mjs` pentru Dashboard). | auto |
| B5 | minor | `src/core/server/files/rotating-log-file.mjs:25` | `catch {}` gol, interzis de convenție. Comentariul explică DE CE (jurnalul nu doboară serverul), dar orice cădere a jurnalului rămâne complet invizibilă, inclusiv în dezvoltare. | Păstrează comportamentul; în `catch (error)` scrie o singură dată pe proces în `process.stderr` (nu prin `console`, care e redirecționat aici — ar recursiona). | review |
| B6 | important | `src/features/review-center/domain/review-center.mjs:44` | Cheia de grupare e `issue.type + '<NUL>' + issue.id`, cu un byte 0x00 brut în sursă, nu secvența `\0`. Funcțional merge, dar `git diff`, `grep` și orice editor tratează fișierul ca binar: modificările viitoare nu se mai văd în review. | `issue.type + ' ' + issue.id` (id-urile n-au spații) sau `'\0'` scris ca escape; un test în `tests/architecture` care refuză bytes de control în `src/` (S5). | auto |

## 2. Amprentă AI

### 2.1 Defensiv

| ID | Sev. | Loc | Problemă | Recomandare | Tip |
|---|---|---|---|---|---|
| D1 | minor | `src/features/backup/server/backup.service.mjs:53-72` | `permanentBackupsSummary`/`externalBackupsSummary` întorc `{ count: 0, bytes: 0 }` la orice eroare; un folder extern inaccesibil apare ca „0 copii” în Stare, deși `externalFailure()` de alături raportează eroarea. | Acceptabil pentru cel local (există sigur); pentru cel extern, lasă `readdirSync` să arunce doar când `externalFailure()` e gol, altfel nu apela deloc. Sau nu schimba: sumarul e informativ. | review |
| D2 | minor | `src/features/visits/web/visits.controller.mjs:135-138,184,229`, `visit-reminders.controller.mjs:68`, `visits.service.mjs:74` | Cinci casturi `/** @type {any} */` la granița dintre `Visit` canonic (`#shared/contracts/record-types.mjs`) și tipul local minimal din `domain/visit-status.mjs:1-15`, plus `HealthNotesSnapshot` local. Comentariul din controller recunoaște divergența. | Vezi U6: domeniul importă tipul canonic (permis: `domain/` poate importa `#shared/contracts`), casturile dispar. | review |

### 2.2 Over-engineering

| ID | Sev. | Loc | Problemă | Recomandare | Tip |
|---|---|---|---|---|---|
| O1 | minor | `src/features/telegram-notify/server/telegram.routes.mjs:68-97,109-119` | Patru blocuri `try { await telegramService.x() } catch (error) { fail(classify(error).message) }` aproape identice în `connect` și `sendTestMessage`. | Un helper local `callOrFail(action, mapError = message => message)`; `connect` păstrează doar cele două excepții (`no-private-chat`, webhook 409). | auto |
| O2 | — | `src/features/visits/web/visits.api.mjs`, `payment-assignment.api.mjs` | Module de un apel. Nu se schimbă: decizia din 14 sept. (O1) rămâne, e punctul de fake în teste. | — | — |

### 2.3 Duplicare

| ID | Sev. | Loc | Problemă | Recomandare | Tip |
|---|---|---|---|---|---|
| U1 | important | `src/features/visits/web/visits.controller.mjs:23-24`, `visit-reminders.controller.mjs:12-13`, `domain/visit-reminders.mjs:6-7`, `src/shared/domain/month-grid.mjs:29-30`, `calendar-month.mjs:1-4`, `children/domain/birthdays.mjs:40` | Formatarea unei `Date` locale în `YYYY-MM-DD` scrisă de cinci ori (`isoDateOf`, `isoDate`, `today`), iar `telegram-digest.mjs` o face greșit (B2). | `export const isoDateOf = date => …` în `#shared/domain/calendar-month.mjs`, `today = () => isoDateOf(new Date())`; celelalte patru copii se șterg. | auto |
| U2 | important | `src/features/children/web/child-editor-fields.mjs:28-34`, `src/features/visits/web/visit-editor-fields.mjs:21-27`, `src/features/fee-setup/web/fee-setup.view.mjs:13-23` | Opțiunile `<select>` de grupă (sortare `localeCompare('ro')` + `<option selected>` + „Fără grupă”) scrise de trei ori, două identice caracter cu caracter. | `groupOptionsMarkup(groupsSortedByName, selectedGroupId)` există deja în `fee-setup.view.mjs`; mută-l în `#shared/ui/form-fields.mjs` (are deja `selectFieldMarkup`) și folosește-l în cele două editoare. Testul din `fee-setup.view.test.mjs` se mută cu el. | auto |
| U3 | minor | `src/features/telegram-notify/server/telegram-config.repository.mjs`, `telegram-state.repository.mjs` | Două repository-uri identice ca mecanism: `existsSync` → `JSON.parse` cu `console.error` la corupere, scriere atomică prin `.tmp` + `renameSync`, ștergere. | `#core/server/files/json-file.mjs` cu `readJsonFile(file, fallback)`, `writeJsonFileAtomically(file, value)`; cele două repository-uri rămân ca nume + formă implicită. | auto |
| U4 | minor | `src/app/server/main.mjs:22,48-49`, `src/app/server/telegram-digest.mjs:31,46`, `src/app/server/create-application.mjs:48-49` | Așezarea folderelor (`Startica_Date`, `Startica_Backup`, `Jurnale/*.log`) față de `home` e scrisă în trei locuri, cu comentariul „aceeași regulă ca…”. | `dataLayout(home)` → `{ dataDir, backupDir, logDir }` în `#config/environment.mjs` (singurul care știe de `STARTICA_HOME`). | auto |
| U5 | — | ~11 comparatoare `a.name.localeCompare(b.name, 'ro')` | Decizia din 14 sept. rămâne: nu se schimbă. | — | — |
| U6 | important | `src/features/visits/domain/visit-status.mjs:1-15`, `visit-statistics.mjs:3`, `visit-reminders.mjs:1`, `visit-health-notes.mjs:3-5` | Tipul `Visit` redeclarat local în domeniu, „minimal, până la S1”; S1 e demult făcut (`record-types.d.mts:106-132`). Cauza lui D2. | `/** @typedef {import('#shared/contracts/record-types.mjs').Visit} Visit */` în cele trei fișiere de domeniu; `HealthNotesSnapshot` devine `Pick<RecordsSnapshot, 'visits' \| 'children'>`. | auto |

### 2.4 Comentarii și documentație

| ID | Sev. | Loc | Problemă | Recomandare | Tip |
|---|---|---|---|---|---|
| C1 | important | `src/features/visits/README.md` | Nu mai corespunde codului: `createVisitsService` cere și `auditTrail`, `createVisitsRoutes` doar `visitsService` (l. 13–14); lipsesc din Public API `expireHealthNotes`, `countVisitsForDays` (server), `createVisitDetailView`, `createVisitRemindersController`, `selectDueReminders`, `VISIT_PASTE_TEMPLATE`; „vine din task S5” (l. 28); dependențe inexistente (`validateState`, `stripSensitiveFields`, l. 35); consumatorul e `compose-screens.mjs`, nu `compose-features.mjs` (l. 48–50); structura fără `server/` (doar „task S3”), fără `visit-detail.view.mjs`, `visits.types.d.mts`, `test-support/`. | Rescrie Public API, Consumatori și Structură din cod. | review |
| C2 | important | `src/features/telegram-notify/README.md:26-27,36,51-52` | `createTelegramSettingsController({ dataDirectory, requestJson, showNotice, renderTelegramSettings })` și `createTelegramSettingsView({ container })` nu există (real: `{ elements, requestJson, showNotice }` și `renderTelegramStatus(status)`); `#shared/format/month-name.mjs` nu există (e `formatMonthName` din `date-format.mjs`); `emptyState` din `record-schema` nu e importat; `index.*.mjs` marcate „(placeholder)”; lipsesc `splitDigest`, `pruneSentKeys`, `removeTelegramState`. | Rescrie tabelele din cod. | review |
| C3 | minor | `src/features/dashboard/README.md:13` | `createDashboardView` primește și `summarizeUpcomingVisits`; `renderDashboard` primește și `missingFeeCount`; lista alertelor nu menționează „Vizite programate”. | Actualizează semnătura și descrierea. | auto |
| C4 | minor | `src/features/children/README.md:13`, `src/features/billing/README.md:9` | `children/index.server.mjs` exportă și `listUpcomingBirthdays`, `billing` are `index.server.mjs` (`evaluateChildrenForMonth`) — ambele pentru rezumatul Telegram, absente din README. | Adaugă rândurile. | auto |
| C5 | minor | `docs/arhitectura/README.md:246,582,670` | Composition root-ul e numit `compose-features.mjs` (real: `compose-screens.mjs` + `global-actions.mjs`); lista de scope-uri nu are `visits`, `telegram-notify`, `launcher`, `web`; arborele țintă (§3.1) nu cunoaște cele două feature-uri noi. | Actualizează cele trei locuri; arborele poate primi o notă „feature-urile adăugate după plan urmează aceeași formă”. | auto |
| C6 | minor | `src/features/visits/domain/visit-status.mjs:1`, `src/features/telegram-notify/telegram-notify.types.d.mts:3-5` | Istorie de plan în comentarii: „S1 aduce tipul canonic”, „Restul (web/) se adaugă odată cu T4”. | Șterge (U6 rezolvă primul de la sine). Referințele la secțiuni de spec (`§6 din specificație`) pot rămâne, dar fără numele specului sunt greu de urmărit: o singură linie în README-ul feature-ului cu calea specului ajunge. | auto |

### 2.5 Denumiri și texte

| ID | Sev. | Loc | Problemă | Tip |
|---|---|---|---|---|
| N1 | minor | `src/features/data-transfer/domain/excel-workbook.mjs:293-296` (`r`), `server/data-transfer.routes.mjs:55` (`r`), `src/features/payment-assignment/domain/unassigned-payment-hints.mjs:14` (`s`), `src/features/telegram-notify/domain/daily-digest.mjs:37` (`parts`), `src/features/review-center/web/review-center.view.mjs:22` (`item`) | Nume interzise în bucle/parametri de mai multe linii (lambda-urile de o linie `r => r.id` rămân acceptate). | auto |
| N2 | minor | `src/features/children/server/children-csv-import.mjs:27,30,138-143,176` | Aliasurile de antet fără diacritice (`Data nasterii`) sunt corecte pentru potrivire (`key()` le normalizează), dar `headers[field][0]` ajunge și în mesajele către utilizator: „Lipsește coloana Data nasterii”. | Prima intrare din fiecare listă cu diacritice (potrivirea nu se schimbă). | auto |

### 2.6 Structuri mari

| ID | Sev. | Loc | Problemă | Recomandare | Tip |
|---|---|---|---|---|---|
| M1 | minor | `src/app/web/compose-screens.mjs` (467 linii) | Composition root legitim, dar a crescut cu 3 ecrane de la împărțirea din 14 sept.; conține și porturi de infrastructură (`notifications`, `rememberedKeys` cu `localStorage`, l. 257–289) care nu sunt compunere. | Mută cele două porturi în `src/app/web/browser-ports.mjs` (sau `#core/web/`); restul rămâne. | review |
| M2 | minor | `src/features/backup/web/backup.controller.mjs` (246 linii, fără test) | Trei fluxuri (backup, restaurare locală/externă cu curse de cereri, setări) într-un controller netestat unitar; smoke-ul acoperă doar calea fericită. | Vezi S2. | review |

## 3. Cod nefolosit

| ID | Sev. | Loc | Problemă | Recomandare | Tip |
|---|---|---|---|---|---|
| X1 | minor | `src/features/payment-assignment/web/payment-assignment.controller.mjs` | `ASSIGNMENT_QUEUE_LIMIT` exportat, folosit doar intern (scos din `index.web.mjs` în 14 sept., dar `export` a rămas pe modul). | Scoate `export`. | auto |
| X2 | minor | `web/styles/components.css:77,150`, `layout.css:135,264,424`, `features/backup.css:1`, `features/dashboard.css:63`, `print.css:4-5` | Clase CSS fără niciun consumator în `src/` sau `index.html`: `.table-panel`, `.cardpay`, `.side-note`, `.footer-note`, `.payment-button`, `.safety`, `.children-summary .subtext`. | Șterge regulile (și referințele din `print.css`). | auto |
| X3 | — | `STATIC_FILES`, `AUDIT_PAGE_SIZE`, `DEFAULT_EXPENSE_CATEGORIES`, `CONFIRMATION_WINDOW_MS`, `parseCsvRows`, `mapV5ChildStatus`, `telegramStateFilePath`, cinci helper-e din `bulk-selection.mjs` | Exportate doar pentru teste. Nu se schimbă: e modelul acceptat pentru testarea unităților interne. | — | — |
| X4 | minor | `src/features/visits/index.web.mjs:1,4,7-9`, `src/features/telegram-notify/index.server.mjs:2,5`, `index.web.mjs:2`, `src/features/billing/index.web.mjs:2` | Nouă exporturi publice pe care nimeni nu le importă prin `index.*.mjs` (verificat pe importuri multi-linie, în `src/`, `tests/`, `scripts/`, rădăcină): `buildChildPrefill`, `selectDueReminders`, `createVisitsListView`, `createVisitsCalendarView`, `createVisitDetailView`, `removeTelegramState`, `splitDigest`, `renderTelegramStatus`, `reminderMessage`. Toate sunt folosite doar în interiorul feature-ului. Aceeași curățenie ca X4 din 14 sept. (`applyParsedVisitFields` și `VISIT_PASTE_TEMPLATE` rămân: le importă `tests/browser-smoke.mjs`.) | Scoate-le din `index.*.mjs` și din tabelele Public API (C1–C2, C4). | auto |
| X5 | minor | `src/features/children/server/children-csv-import.mjs:5`, `src/features/children/web/children-csv-dialog.mjs:5` (`ChildrenCsvPreviewRow`), `src/shared/ui/records-summary.mjs:3` (`RecordsSnapshot`), `src/features/review-center/domain/review-center.mjs:5` (`ReviewItem`) | `@typedef {import(…)}` declarat și nefolosit în fișier (`tsc` nu semnalează typedef-uri JSDoc moarte). | Șterge liniile. | auto |

Fără fișiere orfane, fără importuri `import type` nefolosite în `*.d.mts`, fără id-uri lipsă în `index.html` pentru `element('…')`, fără dependențe nefolosite.

## 4. Structură și modularitate

| ID | Sev. | Loc | Problemă | Recomandare | Tip |
|---|---|---|---|---|---|
| S1 | important | `src/features/children/web/children-list.view.mjs`, `payments/web/payments-list.view.mjs`, `expenses/web/expenses-list.view.mjs` | Numite `.view`, dar țin stare (sortare, paginare), leagă evenimente și trimit mutații (`submitMutation` prin `bulk-selection`). Convenția: view-ul doar randează; orchestrarea e în controller. `visits` a făcut corect separarea (`visits.controller` + `visits-list.view` + `visits-calendar.view`). | Redenumire onestă (`*.controller.mjs`) sau împărțire după modelul `visits`. Redenumirea e ieftină și scoate ambiguitatea; împărțirea se face când se atinge lista respectivă. | review |
| S2 | important | `src/features/backup/web/backup.controller.mjs` (246), `record-editing/web/record-editor-dialog.mjs` (146), `fee-setup/web/fee-setup.controller.mjs` (134), `children/web/children-csv-dialog.mjs` (131), `groups/web/groups.controller.mjs` (101), `data-transfer/web/excel-transfer.controller.mjs` (99), `payments/web/payment-editor-fields.mjs` (199), `app/web/global-actions.mjs` (135), `app/web/month-picker.mjs` (167) | Orchestrare fără test colocat; convenția cere testul controller-ului lângă cod. `visits` și `telegram-notify` au (`visits.controller.test.mjs`, `telegram-settings.controller.test.mjs`, `visit-reminders.controller.test.mjs`) — modelul de fake DOM de acolo se poate refolosi. În `domain/` lipsesc testele pentru `payment-assignment/domain/unassigned-payment-{queue,risk}.mjs` și `data-transfer/domain/import-report.mjs` (mici, dar sunt reguli). | Prioritate: `backup.controller` (curse de cereri la restaurare), `record-editor-dialog` (revizie reținută la deschidere, `submit` injectat), `fee-setup.controller` (`collect()`), apoi cele trei module de domeniu. Restul, când se ating. | review |
| S3 | minor | `src/features/backup/server/backup.routes.mjs:17-24,44-53,97-104`, `telegram-notify/server/telegram.routes.mjs` | `try/catch` în rute, față de „un singur catch, în dispatcher”. Toate traduc erori de sistem în mesaje pentru operator, deci sunt justificate; dar în `backup.routes` două dintre ele fac și `console.error(stack)`, ceea ce dispatcher-ul ar face oricum pentru erori cu `code`. | Păstrează traducerea; O1 reduce cele din telegram la un helper. Notează excepția în `project-conventions` („un catch care traduce o eroare de sistem într-un mesaj pentru operator e permis în rută/serviciu”). | review |
| S4 | minor | `src/features/children/server/children-csv-import.mjs`, `src/features/data-transfer/server/financial-history-import.mjs:41-88` | `throw Error(...)` în module din `server/`, în loc de `fail()`. Primul le prinde singur în `result.errors` (corect: sunt erori de rând, nu HTTP); al doilea le lasă să ajungă la dispatcher, care le tratează ca 400 doar pentru că nu au `code`. | În `financial-history-import.mjs`: `fail(message)` (400 explicit). CSV rămâne. | auto |
| S5 | minor | `tests/architecture/import-boundary-rules.mjs` | Nu impune: puritatea `domain/` față de `Date.now()`/`new Date()`, absența `process.env` în afara `#config`, absența `console.*` în `web/`, absența bytes de control în sursă (B6). Primele trei sunt curate azi (verificat manual), dar nimic nu le păzește. | Patru reguli simple pe text în același test (`clock-in-domain`, `env-outside-config`, `console-in-browser-code`, `control-bytes-in-source`). | auto |
| S6 | minor | `src/app/web/compose-screens.mjs:229-255,290-298`, `web/index.html` | Ecranul „Vizite” are 14 id-uri legate în compunere + 2 pentru memento-uri; `visits` e singurul feature cu detaliu, calendar și listă în același ecran. Acceptabil, dar `visitsDetail` e randat de controller în afara `renderCycle`, prin `render()` propriu la fiecare clic — la fel ca listele (S1). | Nu se schimbă acum; se rezolvă odată cu S1. | — |

## 5. Simplify

| ID | Sev. | Loc | Problemă | Recomandare | Tip |
|---|---|---|---|---|---|
| E1 | minor | `src/features/visits/web/visits.controller.mjs:137-184` | La fiecare randare, `records.visits` e parcurs de 4 ori (`summarizeVisitFunnel` face 4 `filter`, `visitsByDate`, `rows`, `countVisitsForDays`). Sub 1 000 de vizite e irelevant; B4 scoate una dintre treceri. | Doar B4. | — |
| E2 | minor | `src/shared/format/date-format.mjs:26-38` | `formatAge` apelează `new Date()` per rând (liste, calendar, detaliu). | `formatAge(birthDate, today = new Date())`; apelanții din liste transmit `now`. Opțional. | auto |
| E3 | — | `src/features/backup/server/backup.service.mjs` `health()` | Decizia din 14 sept. (E4) rămâne: nu se schimbă. | — | — |

## Stare

Baseline: 491 de teste, 489 trec, 2 sărite (CSV real lipsă, Chrome), 0 eșuate.

Remediat pe `fix/audit-2026-09-18` (18 septembrie 2026): B1–B6, D2, O1, U1–U4, U6, C1–C6, N1–N2, M1, X1–X2, X4–X5, S1–S5. După remediere: 538 de teste, 536 trec, 2 sărite, 0 eșuate; browser smoke și `desktop-lifecycle.ps1` verzi. Decizii luate la remediere: ora de tăiere pentru B1 e 18:00 (`LATE_RUN_HOUR` în `telegram-digest.mjs`); S1 s-a rezolvat prin redenumire (`*-list.controller.mjs`), nu prin împărțire; S3 a intrat ca excepție explicită în `project-conventions`; fixture-ul de vizită din `tests/browser-smoke.mjs` e acum pe ziua curentă (data fixă `2026-09-15` făcea badge-ul 0 după 15 septembrie). Nerezolvate intenționat: D1, O2, U5, X3, E2, E3, S6.
