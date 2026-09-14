# Audit de cod Startica — 14 septembrie 2026

Făcut după pasul 10 din `docs/arhitectura/README.md` (commit `96e0039`), înaintea pașilor 11–12. Surse: scanare statică pe 223 de fișiere (exporturi, importuri, fișiere orfane, `catch` gol, comentarii, dimensiuni), `/code-review` pe diff-ul pasului 10 și trei review-uri pe zone (`core/shared/app/config/tests`, feature-uri A–E, feature-uri F–R), cu criteriile din `startica-ai-code-review`, `simplify` și `senior-architecture`.

Verdict: cod curat în ansamblu (AI-score ~3/10), fără cod defensiv exagerat sistematic, fără importuri între feature-uri, fără `export *` și fără importuri relative adânci în `src/`. Problemele sunt resturi de migrare, câteva duplicări și un script de mentenanță rupt.

AI-score pe zone: `audit-log` 1, `groups` 1, `backup` 2, `data-transfer` 2, `fee-setup` 2, `payment-assignment` 2, `review-center` 2, `core/shared/app` 2, `billing` 3, `dashboard` 4, `payments` 5, `record-editing` 5, `children` 6, `expenses` 6.

Legendă: **auto** = safe-to-automate, **review** = necesită review manual.

## 1. Amprentă AI

### 1.1 Defensiv

| ID | Sev. | Loc | Problemă | Recomandare | Tip |
|---|---|---|---|---|---|
| D1 | minor | `src/features/children/server/children-csv-import.mjs:124-126` | `try/catch {}` în jurul `dateOK`, care întoarce boolean și nu aruncă | Șterge `try/catch` | auto |
| D2 | important | `src/core/server/files/remove-file-if-present.mjs:8`, `src/features/backup/server/backup.service.mjs:53,118` | `catch {}` gol la curățări best-effort (convenția interzice `catch {}` gol) | Păstrează comportamentul, adaugă `console.warn` cu context | review |
| D3 | minor | `src/app/web/main.mjs:60-68`, handler-ul de click | Casturi `any` la compunere | Se reduc la împărțirea `main.mjs` | review |

### 1.2 Over-engineering

| ID | Sev. | Loc | Problemă | Recomandare | Tip |
|---|---|---|---|---|---|
| O1 | minor | `src/features/payment-assignment/web/payment-assignment.api.mjs` | Modul care învelește un singur apel | Nu se schimbă: e simetric cu `audit-log.api.mjs` și e punctul de fake în teste | — |
| O2 | minor | `src/features/record-editing/record-editing.types.d.mts:6,17-18`, `server/record-editing.routes.mjs:13` | Lista tipurilor ștergibile scrisă de 3 ori | Reutilizează `EditableRecordType` | review |

### 1.3 Duplicare

| ID | Sev. | Loc | Problemă | Recomandare | Tip |
|---|---|---|---|---|---|
| U1 | important | `src/app/web/main.mjs:414-428`, `src/shared/ui/bulk-selection.mjs:84-101,133-165` | Confirmarea în doi pași implementată de două ori | `src/shared/ui/confirm-twice-button.mjs` | review |
| U2 | important | `src/features/children/web/child-editor-fields.mjs:10-13`, `src/features/payments/web/payment-editor-fields.mjs:14-17` | `section()` identic | `formSectionMarkup` în `#shared/ui/form-fields.mjs` | auto |
| U3 | important | `src/features/children/server/children-csv-import.mjs:5-15`, `web/children-csv-dialog.mjs:5-29` | Tipuri CSV redeclarate și divergente | `src/features/children/children.types.d.mts` | review |
| U4 | minor | `src/features/backup/backup.types.d.mts:73-82` | `BackupPreview` nefolosit, identic cu `RecordsSummary` din data-transfer | Șterge | auto |
| U5 | minor | ~8 locuri `a.name.localeCompare(b.name, 'ro')` | Comparator repetat | Nu se schimbă: o linie clară, un helper ar adăuga indirecție | — |

### 1.4 Comentarii și documentație

| ID | Sev. | Loc | Problemă | Recomandare | Tip |
|---|---|---|---|---|---|
| C1 | important | `src/features/record-editing/server/record-editing.routes.integration.test.mjs:9-12` | Afirmă că rutele sunt în `server/routes.mjs` (șters) | Rescrie | auto |
| C2 | important | `src/features/record-editing/README.md:11,70-88` | Spune că nu există `index.*` și descrie compunerea din `web/app.js` (șters) | Rescrie Public API și compunerea | review |
| C3 | important | `src/features/expenses/README.md:7` + tabel Public API | Pretinde că lista și editorul se mută „la pasul următor” | Rescrie | review |
| C4 | important | `src/features/payment-assignment/README.md:73`, `src/features/fee-setup/README.md:51`, `src/features/payments/README.md:5` | Compunere descrisă în `web/app.js`/`server/routes.mjs` | Trimite la `src/app/web/main.mjs` / `src/app/server/create-application.mjs` | review |
| C5 | minor | ~24 comentarii în cod: „Port 1:1 al fostului web/ui/…”, „Înlocuiește `renderX` din web/ui/…”, „ca la legacy”, „înainte de migrare” (listă în scanare) | Istorie de migrare în comentarii | Șterge istoria, păstrează DE CE | auto |
| C6 | minor | README `groups`, `review-center`, `payment-assignment`, `billing`, `dashboard`, `expenses`, `children` | „(fost …)”, „portat din …”, „Până la pasul …” | Șterge istoria | review |

### 1.5 Denumiri

| ID | Sev. | Loc | Problemă | Tip |
|---|---|---|---|---|
| N1 | important | `src/shared/domain/record-schema.mjs:98-229` | `r`, `s`, `p`, `c`, `a` în validarea centrală | auto |
| N2 | minor | `src/features/children/server/children-csv-import.mjs:229-270` | `item`, `r` pe 40 de linii | auto |
| N3 | minor | `src/features/data-transfer/domain/excel-workbook.mjs:213,233,261` | `r` în obiecte de export | auto |
| N4 | minor | `src/features/data-transfer/server/financial-history-import.mjs:85-111` | `r` pe ~25 de linii | auto |
| N5 | minor | `src/features/children/web/child-editor-fields.mjs:15-26` | `s`, `parts`, `r` | auto |
| N6 | minor | `src/features/fee-setup/server/fee-setup.routes.integration.test.mjs:27-80` | `r` reasignat | auto |

### 1.6 Structuri monolitice

| ID | Sev. | Loc | Problemă | Recomandare | Tip |
|---|---|---|---|---|---|
| M1 | important | `src/app/web/main.mjs` (513 linii) | Bootstrap + compunerea a ~15 ecrane + handler global + formulare | `main.mjs` + `compose-screens.mjs` + `global-actions.mjs` | review |

## 2. Cod nefolosit

| ID | Sev. | Loc | Problemă | Recomandare | Tip |
|---|---|---|---|---|---|
| X1 | **critic** | `scripts/import-v5-history.mjs:13-14,36,43,60,103` | Importă `shared/excel.mjs` și `server/financial-import.mjs` (șterse la pasul 9); pică la pornire; totalurile așteptate nu conțin `groups`/`categories` | Repară importurile și totalurile, test care încarcă scriptul | review |
| X2 | minor | `shared/text.mjs` | Orfan | Șterge | auto |
| X3 | minor | `shared/domain.mjs:36-39` | `monthCalendar`, `upcomingBirthdays` fără consumatori | Șterge; fațada dispare după mutarea testelor | auto |
| X4 | minor | `index.server.mjs`/`index.web.mjs` din `backup`, `dashboard`, `fee-setup`, `payment-assignment`, `review-center` | Exporturi publice neconsumate de `src/app` | Scoate-le din index | auto |
| X5 | minor | `month-picker.mjs:47` `closeMonthPicker`, `migration-runner.mjs:12,20`, `static-assets.mjs:22,38`, `child-picker.mjs:8` `normalizeSearch`, `pagination.mjs:3` `PAGE_SIZE`, `financial-history-fixtures.mjs:7` `v5SourceChild` | Exportate, folosite doar intern | Scoate `export` | auto |
| X6 | minor | `src/features/data-transfer/data-transfer.types.d.mts:1` | Import `RecordType` nefolosit | Șterge | auto |

Fără cod comentat, fără dependențe nefolosite în `package.json`.

## 3. Structură și modularitate

| ID | Sev. | Loc | Problemă | Recomandare | Tip |
|---|---|---|---|---|---|
| S1 | important | `src/app/web/main.mjs` | Vezi M1 | Împărțire | review |
| S2 | important | `tests/fixes.test.mjs`, `tests/application.test.mjs`, `tests/children-csv.test.mjs` | Teste pentru module deja în `src/` rămase la rădăcină, prin fațada `shared/domain.mjs`; `record-schema.mjs` fără test colocat | Mută lângă cod; șterge fațada | review |
| S3 | important | `src/features/children/` | Fără fișier de tipuri (cauza U3) | `children.types.d.mts` | review |
| S4 | minor | `src/core/server/http/static-assets.mjs:45,70-71` | Lista albă acceptă încă `/ui/*.mjs` și `/shared/*.mjs` | Șterge ramura legacy după S2 | auto |
| S5 | minor | `tests/support/start-test-application.mjs:4` | `../../startica_server.mjs` | Alias `#app/server/create-application.mjs` | auto |

## 4. Simplify

| ID | Sev. | Loc | Problemă | Recomandare | Tip |
|---|---|---|---|---|---|
| E1 | minor | `src/features/fee-setup/web/fee-setup.view.mjs:14,43` | Grupele sortate din nou pentru fiecare rând | Sortare o dată pe randare | auto |
| E2 | minor | `src/features/dashboard/web/dashboard.view.mjs:94,114` | `listUpcomingBirthdays` de două ori pe randare | O singură calculare | auto |
| E3 | minor | `src/features/children/web/children-list.view.mjs:76,90` | `readRecords()` pe fiecare rând | Transmite `records` | auto |
| E4 | minor | `src/features/backup/server/backup.service.mjs:34-41,69-74,201-215` | `health()` citește folderul de două ori | Nu se schimbă: sondaj la 30 s, câteva zeci de fișiere | — |
