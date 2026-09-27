# Personal (24) și Bazin (23) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the „Personal” module (`docs/design/screens/24-personal.md`: team, timesheet, leaves, salaries behind a PIN, roles shared by both branches) and then the „Bazin” module (`docs/design/screens/23-bazin.md`: weekly pool schedule, presence, monthly amounts per child, coach pay, „Închide luna”). Personal comes first because Bazin picks its coaches from Personal (role „Antrenor bazin”) and feeds their salary back into Personal 23c.

**Architecture:** Staff data is shared by all branches, so it lives in a third, install-level SQLite file `<home>\Comun\Startica_Date\startica.db` („comun”) opened once per process next to the branch contexts; branch data (pool, group teams, expenses, charges) stays in the branch file. Two new backend features `src/features/personal/` and `src/features/pool/`, composed in `src/app/server/`. Pool money enters billing as a new record kind `charges` that `obligation()` adds to the month's expected amount. Sync treats „comun” as one more dataset (see „Changes to the sync plan”).

**Tech Stack:** Node 22 vanilla ESM + `node:sqlite` + `node --test`; React 19 + Vite + TS + Vitest/RTL in `webapp/`. No new dependency.

**Spec:** `24-personal.md`, `23-bazin.md` (authoritative), `Personal.dc.html#23a–23k`, `Bazin.dc.html#22a–22d` (visual only — spec wins), `00-comun.md`, `Sidebar.dc.html` (menu order: … Prezența, **Bazin**, Vizite, **Personal**), `25-bon-stickere.md` 24c, `2026-09-27-filiale.md`, `2026-09-27-sincronizare.md`.

## Decisions (read before coding)

1. **Shared data = a third SQLite file per install, `comun`, not staff duplicated per branch.** `departments`, `roles`, `staff` (with `branchIds: string[]` of registry ids), `timesheet`, `leaves`, `salaries`, `advances`, `salary_payments` live in `<home>\Comun\Startica_Date\startica.db`, opened once in `createApplication` (`createCommonContext`) and handed to every branch context. Why: (a) the isolation guarantee of Faza 6 is about *branch* data; the spec declares this data „comun ambelor filiale”, and a file boundary keeps it that way — a branch query still cannot reach the other branch's children; (b) duplicating `staff` per branch means every edit writes a DB that is not open and two copies that drift — with sync, two copies conflict-resolve independently; (c) timesheet/leaves/salary are per *person* (one leave, one salary per month), so they follow the person into `comun`; (d) sync maps it 1:1: one more dataset with the fixed id `comun` (decision 9 below); (e) backups reuse `createBackupService` on the file (`Comun\Startica_Backup`, `pornire` + auto-backup after writes; restore of `comun` = copy the file, documented, not a route in V1). The file uses the same `openDatabase` + `applySchema` (unused `attendance`/`sms_*` tables accepted — one schema, one integrity check).
2. **Personal kinds are JSON rows in `comun`'s `records(kind,id,payload)` table, through a small `createKindRepository(db)` (list/find/save/remove/`onChange`), not through `createRecordRepository`/`TYPES`.** `TYPES`, `normalizeRecord`, `/api/state`, `readEnvelope` stay untouched; validation is `normalizePersonalRecord(kind, input)` in `personal/domain/personal-schema.mjs`. Writes use the repository's own `BEGIN IMMEDIATE` (attendance precedent, no global revision — Personal is not in `/api/state`); deterministic ids where idempotency matters (`TS-<staffId>-<date>`, `SP-<staffId>-<month>-<branchId>`). Audit entries go to the **active branch's** `audit_changes` with `recordType: null`, `action: 'personal: …'` (the `filiale` precedent — the operator was there; Istoric stays one screen).
3. **Group teams live on the group: `Group.team: { staffId, role: 'principal' | 'asistent' | 'inlocuitor', days?: number[] }[]`** (spec `group_staff`). Groups are per branch, so the branch's `records` is the right file, the existing `/api/record` route saves it, the groups sync policy (conflict) applies, and no new table appears. `normalizeRecord('groups')` validates: one `principal` max, known roles, `days` ⊂ 1..5. `Group.educator` (free text) stays as display fallback. Staff ids across files are tolerated like attendance orphan rows: the UI renders only staff present in `comun`.
4. **Pool money = a new record kind `charges` + an obligation line, not a mutation of the child.** `charges` joins `TYPES`: `{ id: 'CHG-bazin-<childId>-<YYYY-MM>', childId, month, kind: 'bazin', label: 'Bazin august: 6 × 150 lei', amount, currency: 'MDL', date }`. `obligation()` gets a **required** 4th parameter `charges` (`obligation(child, month, payments, charges, asOf?, index?, rates?)`), converts them into the fee currency with the existing `sumEntriesInCurrency` (EUR fees: at the rate of `charge.date`; missing rate → `unknown`), adds them to `expected`, and returns `lines: [{ kind: 'fee', label: 'Taxă <lună>', amount }, ...charges]` plus `feeAmount`. Moving the parameter before `asOf` makes every caller fail `tsc` until updated (7 production call sites: `month-evaluation`, `school-year-evaluation`, `unassigned-payment-risk`, `firstUnpaidMonth`, `useChildProfile`, `usePaymentReceipt` ×3) — there is no silent path where a screen forgets the pool. Rejected: `child.charges` (zero call-site changes, but „Închide luna” would rewrite ~24 `children` records — a conflict kind in sync — and a resolved conflict could drop the charge silently); a `charges` parameter appended last (callers that omit it show wrong numbers without any error).
5. **Idempotency of „Închide luna” comes from deterministic ids, not from a „closed” flag.** Charges `CHG-bazin-<childId>-<month>`, the coach expense `EXP-bazin-<coachId>-<month>`, the salary marker `SP-<coachId>-<month>-<branchId>`. A second close recomputes and upserts the same ids (unchanged JSON → no outbox row, no audit entry); a child whose sum became 0 loses the charge. `pool_closings(month, closed_at)` is only the „închisă la …” label on 22c. Closing refuses while the month still has unmarked past sessions (400, „N ședințe nemarcate”) — money is never derived from an unmarked session.
6. **Coach salary: one source, no double counting.** A coach's salary mode is `'bazin'`; its rate is `poolSettings.coachRate`/`coachPayMode` of the branch (the `salaries.amount` field is ignored for this mode). The Bazin card and the closing call the same `coachPayForMonth()`. Closing writes the expense (category `Salarii`, amount = pay − undeducted advances of that month) and the `salary_payments` row; in Personal 23c the coach's row shows „Plătit din Bazin” and „Plătește” is disabled for `bazin` mode. Advances get `deductedBy = <salary_payments id>` the first time and are re-included (not re-deducted) on a recompute.
7. **Salary payment („Plătește”) = one expense per employee per month, `EXP-salariu-<staffId>-<month>`,** amount = salary − Σ undeducted advances with `advance.month === month`; the `salary_payments` row `{ staffId, month, branchId, mode, amount, advances, expenseId, paidAt }` is the cross-branch marker („Plătit din Filiala X” for a two-branch employee opened from the other branch; a second pay is a no-op). An advance is itself an expense the day it is given (`EXP-avans-<advanceId>`, „Avans <luna> · <nume>”) — this is why it is subtracted at payment and never posted twice. The two files cannot share a transaction: the branch `runRevisionTransaction` runs first and, inside its callback after the expense save, commits the `comun` rows; „paid” in the UI = `salary_payments` row **and** its expense exists un-archived, so a torn write shows „De plătit” again instead of hiding money.
8. **PIN = an install-level curtain, not security.** Stored in `comun` settings `adminPin = { salt, hash: sha256(salt + pin) }` (4–6 digits), set/changed in Backup și setări → Grădinița („PIN administrator”, current PIN required to change). Unlock is **in-memory in the server process** (`pinSession = { unlockedUntil }`), slid 10 min on every protected request; „Blochează” clears it; 5 wrong tries → 60 s lock-out (`fail(…, 429)`). Protected routes: everything under `/api/personal/salaries*` and `/api/personal/advances*` (they answer 403 „Salariile sunt protejate. Introdu PIN-ul.”); `GET /api/personal/state` never contains amounts. Said plainly in the README and the settings card: anyone with access to the computer can open the SQLite file or a backup and read salaries — the PIN stops a colleague glancing at the screen, nothing more. No user accounts, no encryption (out of scope). The Bazin 22c coach card shows the coach pay without PIN, as the Bazin spec draws it — noted as a spec inconsistency, kept.
9. **Sync: `comun` is one more dataset with a fixed id, synced by a second engine instance.** See „Changes to the sync plan” — every change is listed there; nothing in the sync design (outbox per file, per-kind policies, snapshots + cursor) is redesigned.
10. **Pool settings are a per-branch settings key `poolSettings`** (`{ enabled, pricePerSession, durationMin, hoursFrom, hoursTo, seatsPerSlot | null, chargeUnexcusedAbsence, coachPayMode, coachRate }`), read/written like `planPresets`. Until the key exists the Bazin page shows „Configurează bazinul în Backup și setări” and no computation runs — the seed values (150 lei, 30 min, 09:00–11:30, unlimited seats, taxează, per_child, 60 lei) prefill the **form** only and are written when the administrator saves (spec: „se țin în setări, nu în cod”). `/api/session` gains `pool: { enabled }`; the Sidebar hides „Bazin” when false.
11. **Pool tables are dedicated per-branch tables** (`pool_bookings`, `pool_sessions`, `pool_closings` in core `SCHEMA`, attendance style, with an `onChange` hook for sync) — sessions are children × weeks and must not ride in `/api/state`. Bookings are recurring; sessions rows exist only when marked (`present | absent | excused | cancelled`); the expected dates of a month come from `expandBooking()` (weekday match, inside `[startDate, endDate]`, not a legal holiday via `#shared/domain/holidays-md.mjs`). Future dates accept only `cancelled`.
12. **Timesheet default = worked.** No row on a working day (`isWorkingDay`) between `staff.since` and `archivedAt` = 8 h. Rows carry `code ∈ CO | CM | A | I | FP` (+ `leaveId` when written by a leave). The 23b click cycle is `'' → CO → CM → A → ''` (spec: „Coduri CO/CM/A”); `FP` comes from the leave form, `I` is accepted by the API and printed in the legend but has no UI in V1 (open question 3). `monthDates()` moves from `attendance/domain` to `#shared/domain/calendar-month.mjs` (attendance re-imports it — the only touch outside the two features).
13. **Not built:** deleting staff (archive only, „Nu mai lucrează aici”), drag-and-drop ordering of roles (up/down buttons), per-coach rates (spec has one rate per branch), the „Exportă” button of 22c, a restore route for `comun`, sync of the PIN unlock state, hram days.

## Open questions for the user (each with the recommendation the plan follows)

1. **Pool defaults** (spec: „de confirmat cu administratorul”): 150 lei/ședință, 30 min, 09:00–11:30 din 30 în 30, locuri nelimitate, lipsa nemotivată se taxează, plata antrenorului pe copil prezent, 60 lei. → Used only as form prefill; change them in the settings tab, no code change.
2. **Personal defaults:** `annualLeaveDays = 28`, `deductOnlyUnexcused = true`; departments Administrație / Educatori / Bucătărie / Altele; roles Director, Administrator (Administrație), Educator, Asistent educator (Educatori), Bucătar (Bucătărie), Menajeră, Antrenor bazin (Altele). → Seeded once when `comun` is created; editable in 23e.
3. **Code `I` (învoire):** no screen sets it. → Keep it out of the cycle; add later as a right-click option if wanted.
4. **Remaining leave counts planned CO days too** (spec 23f „zile rămase”; the mockup subtracts only past CO). → Subtract both (a planned leave is booked capacity); the fișa shows „14 din 28 · 7 planificate”.
5. **From which branch is a two-branch employee's fixed salary paid?** → From the branch active when „Plătește” is clicked; the other branch shows „Plătit din <filiala>”. A `bazin` coach is paid per branch (each pool is separate).
6. **Salaries visible in Bazin 22c without PIN** (coach card). → Keep as drawn; say so in the 22d settings text.

## Changes to the sync plan (`2026-09-27-sincronizare.md`)

The sync feature is being implemented now; these are the exact deltas, all additive:

- **Dataset id ≠ branch id.** Server: the reserved id `COMMON_DATASET_ID = 'comun'` is accepted by every `/v1/branches/:id/{changes,snapshot,events}` route without a `branches` row; `GET /v1/branches` and `reconcileBranches()` skip it. `writeSnapshot('comun')` on a dataset that already has records is **not** 409: the client then pushes its local rows as ordinary changes with `baseRevision 0` (new ids apply, colliding ids follow the kind's policy). Test: `'setul comun se urcă de pe primul calculator și se contopește de pe al doilea fără 409'`.
- **Connect:** after the branches, `connect()` handles `comun`: server has none → upload snapshot; local empty → download; both have rows → push-as-changes (above). Registry untouched.
- **Kinds and policies:** `KINDS` gains `staff` (conflict — it is a fișă), `departments`, `roles`, `timesheet`, `leaves`, `salaries`, `advances`, `salary_payments` (LWW, dataset `comun`); `charges` (LWW, a `records` kind — automatic through the outbox wrapper), `pool_bookings`, `pool_sessions`, `pool_closings` (LWW, dedicated tables, `onChange` hooks like attendance). `SYNCED_SETTINGS` gains `poolSettings` (branch) and, for `comun`, `adminPin` + `personalSettings`. `change-applier.mjs` gets one applier per new kind (a repository `save`/`remove` without `onChange`), and `record-labels.mjs` a title for `staff`/`charges` (the 14c list).
- **Engines:** decision 12 („one worker per active branch context”) becomes „one worker per **open dataset**: the active branch and `comun`”. `createCommonContext` builds its own `sync_state/sync_outbox/sync_conflicts` (same `applySchema`), cursor `sync.since` in its own `settings`, and a second `createSyncEngine` started at process start and **not** stopped on branch switch. `GET /api/sync/status` sums `pending`/`conflicts` of both; `GET /api/sync/conflicts` rows carry `dataset: 'branch' | 'comun'` and resolve through the right repository; the local SSE `records-changed` carries `dataset`, and `usePersonal()` reloads on `dataset === 'comun'` (the session store ignores it). Test: `'motorul setului comun rulează în paralel cu cel al filialei și supraviețuiește schimbării filialei'`.
- **Personal/pool writes never wait for sync** — they are captured by the same `onChange` mechanism (`createKindRepository({ onChange })`, `createPoolRepository({ onChange })`), inside the repository transaction.

## Global constraints

- Backend: `src/features/personal/` and `src/features/pool/` (README, `*.types.d.mts`, `index.server.mjs`, `index.web.mjs`, `domain/`, `server/`, `test-support/`); no feature imports another — Personal needs `readCoachPayForMonth(staffId, month)` and Pool needs `listCoaches()` + `advancesForMonth()`; both are ports injected in `src/app/server/create-branch-context.mjs`. The `charges` kind and the `obligation()` change are `#shared/domain`.
- Webapp: `webapp/src/features/personal/`, `webapp/src/features/pool/`, hook shared by Grupe/Backup/Bazin in `webapp/src/shared/personal/` (`architecture.test.ts` forbids feature→feature). Only `@shared/ui` + `tokens.css`; no new hex (the spec's greys map to `--off-day`, `--neutral-soft`, `--subtle`).
- Server errors via `fail(message, status)`; PIN lock-out 429; protected routes 403.
- Tests: `npm run check` at root, `cd webapp && npm run typecheck && npm test` per phase; `npm run test:e2e` once after Phase 6.
- Conventional Commits, scopes `personal`, `pool`, `shared`, `core`, `app`, `docs`. No AI trailers.

---

## Phase 1 — `comun` database, Personal core (team, timesheet, leaves)

### Task 1: Common context + kind repository + shared calendar helper

**Files:** create `src/app/server/create-common-context.mjs` (+ integration test), `src/core/server/persistence/kind-repository.mjs` (+test); modify `src/config/environment.mjs` (`COMMON_DIR_NAME = 'Comun'`), `src/core/server/branches/branch-layout.mjs` (`commonDirectories(home) → dataLayout(join(home, COMMON_DIR_NAME))` minus `logDir`), `src/app/server/create-application.mjs` (`const common = createCommonContext({ home, autoBackupIntervalMs })` before the first branch context; passed to `openBranchContext`; `backup()`/`close()` include it), `src/app/server/main.mjs` (`app.backup('pornire')` already covers both through the delegate), `.gitignore` (`Comun/`), `src/shared/domain/calendar-month.mjs` (`monthDates(month)` moved here; `src/features/attendance/domain/attendance-month.mjs` imports it).

```js
createCommonContext({ home, autoBackupIntervalMs }) → { db, dbFile, dataDir, backupDir, backups, settings, readSetting, kinds: KindRepository, pinSession, backup, close }
createKindRepository(database, { onChange } = {}) → { list(kind), find(kind, id), save(kind, record), remove(kind, id), transaction(fn) }
// records(kind,id,payload) of that file; save/remove call onChange({ kind, id, payload | null }) inside the caller's transaction
```

Tests: `'setul comun se deschide o singură dată per proces, în <home>\\Comun, și rămâne deschis la schimbarea filialei'`, `'kind-repository salvează, citește și șterge pe kind și notifică onChange în tranzacție'`, `'monthDates dă toate zilele lunii, inclusiv 29 februarie'`.

- [ ] Commit: `feat(app): install-level common database next to the branch contexts`

---

### Task 2: Personal domain — schema, seeds, timesheet month, leave days

**Files:** create `src/features/personal/README.md`, `personal.types.d.mts`, `index.server.mjs`, `index.web.mjs`, `domain/personal-schema.mjs` (+test), `domain/personal-seeds.mjs`, `domain/timesheet-month.mjs` (+test), `domain/leave-days.mjs` (+test), `test-support/personal-fixtures.mjs`.

**Types:** `Department { id, name, order }`, `Role { id, name, departmentId, order }`, `Staff { id, name, roleId, branchIds: string[], phone, birth?, idnp?, address?, since, archivedAt?: string | null, notes: { at, text }[] }`, `TimesheetRow { id, staffId, date, code: 'CO'|'CM'|'A'|'I'|'FP', leaveId? }`, `Leave { id, staffId, from, to, type: 'CO'|'CM'|'FP', planned: boolean, note? }`, `PersonalSettings { annualLeaveDays, deductOnlyUnexcused }`.

**`personal-schema.mjs`:** `PERSONAL_KINDS`, `normalizePersonalRecord(kind, input)` (whitelist + `requireThat`, ids `DEP-|ROL-|STF-|TS-|LV-|SAL-|ADV-|SP-`), `TIMESHEET_CODES`, `nextTimesheetCode(code)` (`'' → CO → CM → A → ''`), `isStaffInBranch(staff, branchId)`, `worksAtAllBranches(staff, branchIds)`.

**`timesheet-month.mjs`:**

```js
workingDatesFor(staff, month) = monthDates(month).filter(d => isWorkingDay(d) && d >= staff.since && (!staff.archivedAt || d <= staff.archivedAt))
summarizeTimesheetMonth({ staff, month, rows: Map<'staffId|date', TimesheetRow>, todayStr, upTo: 'today' | 'month' })
→ { staffId, cells: [{ date, kind: 'off' | 'none' | 'future' | '' | code }], worked, hours: worked * 8, co, cm, a, i, fp, workingDays }
// '' on a counted working day = lucrat 8 h; upTo 'today' for the screen counters, 'month' for print and salary
```

**`leave-days.mjs`:** `leaveWorkingDays(leave)` (working days in `[from, to]`), `leaveDaysRemaining({ staffId, year, leaves, annualLeaveDays }) → { used, planned, remaining }` (CO only, planned included in `remaining` — open question 4), `timesheetRowsForLeave(leave)`, `overlappingLeavesInGroup(leaves, groups, staffById)` (same `group.team`, intersecting ranges → `{ groupId, staffIds, from, to }[]`).

Tests: `'lipsa rândului într-o zi lucrătoare înseamnă 8 ore lucrate; weekendul și sărbătorile nu contează'`, `'contoarele ecranului se opresc azi, cele de tipar și salariu iau toată luna'`, `'un concediu CO de 6–27 iulie consumă 16 zile lucrătoare și rămân 12 din 28'`, `'două concedii suprapuse în aceeași grupă sunt raportate o singură dată'`, `'normalizePersonalRecord refuză un rol fără departament și un angajat fără filială'`.

- [ ] Commit: `feat(personal): domain rules — schema, timesheet month, leave days`

---

### Task 3: Personal repository + routes (team, timesheet, leaves, roles) + group team

**Files:** create `src/features/personal/server/personal.repository.mjs` (+test), `server/leaves.service.mjs` (+test), `server/personal.routes.mjs` (+ `personal.routes.integration.test.mjs`); modify `src/shared/domain/record-schema.mjs` (`groups` FIELDS + `team` validation: one principal, roles, days), `src/shared/contracts/record-types.d.mts` (`Group.team?`), `src/app/server/create-branch-context.mjs` (`createPersonalRoutes({ common, branchId: branch.id, listBranches, auditTrail, recordRepository, readCoachPayForMonth })`), `src/app/server/session.routes.mjs` (nothing yet).

`personal.repository.mjs` wraps `common.kinds` with the seeds on first open (departments/roles from `personal-seeds.mjs` when both are empty) and typed queries: `staffForBranch(branchId)`, `timesheetForMonth(month, staffIds)`, `leavesForYear(year, staffIds)`, `applyTimesheetChanges(changes)` (upsert `TS-<staffId>-<date>` / remove on `code: null`, one transaction), `roleHasStaff(roleId)`.

| Route                                   | Body / query                                     | Returns                                                                                                    |
| --------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `GET /api/personal/state`               | —                                                | `{ departments, roles, staff, settings }` — staff of the active branch only (`isStaffInBranch`)            |
| `POST /api/personal/staff`              | `{ mode: 'create' \| 'update', staff }`          | `{ staff }` — `branchIds` ⊂ registry ids, non-empty                                                        |
| `POST /api/personal/staff-archive`      | `{ id, archivedAt }`                             | `{ staff }`                                                                                                |
| `POST /api/personal/roles`              | `{ departments, roles }`                         | whole lists (23e) — a role with staff cannot disappear (400)                                               |
| `GET /api/personal/timesheet?month=`    | —                                                | `{ rows }` for the branch's staff                                                                          |
| `POST /api/personal/timesheet`          | `{ changes: [{ staffId, date, code \| null }] }` | `{ ok, rows }` — LWW, ≤ 500 per request, any date (planned leave)                                          |
| `GET /api/personal/leaves?year=`        | —                                                | `{ leaves, warnings }` (`overlappingLeavesInGroup` over the active branch's groups)                        |
| `POST /api/personal/leaves`             | `{ leave }` / `{ id, remove: true }`             | `{ leave }` — writes/removes the timesheet rows with `leaveId` in the same transaction; overlap → 400      |
| `POST /api/personal/settings`           | `{ annualLeaveDays, deductOnlyUnexcused }`       | `{ settings }`                                                                                             |

Tests (integration, two branches created through `POST /api/branches`): `'echipa filialei active conține doar angajații ei; cei cu ambele filiale apar în amândouă'` (criterion 1), `'un concediu CO scrie CO în pontaj pe zilele lucrătoare, iar ștergerea lui le scoate'` (criterion 2, server half), `'o funcție cu angajați nu se poate șterge, doar redenumi'`, `'grupa acceptă un singur principal în echipă'`.

- [ ] `npm run check` green.
- [ ] Commit: `feat(personal): staff, roles, timesheet and leaves routes on the common database`

---

## Phase 2 — Salaries, advances, PIN (backend)

### Task 4: Salary computation, advances, payment, PIN

**Files:** create `src/features/personal/domain/salary-computation.mjs` (+test), `server/pin.service.mjs` (+test), `server/salaries.service.mjs` (+test), `server/salaries.routes.mjs` (+ integration test); modify `personal.routes.mjs` (mount), `create-branch-context.mjs` (`runRevisionTransaction`, `recordRepository` for expenses).

**`salary-computation.mjs`:**

```js
salaryForMonth({ salary: { mode, amount }, timesheetRow, settings, coachPay })
  fix   : deductible = settings.deductOnlyUnexcused ? row.a : row.a + row.i + row.fp
          gross = round2(amount - amount * deductible / row.workingDays); base = `${amount} lei / lună` (+ ` · ${deductible} zile absent`)
  zi    : gross = amount * row.worked (upTo 'month'); base = `${amount} lei × ${row.worked} zile`
  bazin : gross = coachPay?.amount ?? null; base = coachPay ? `${rate} lei × ${count} ${mode === 'per_child' ? 'copii' : 'ședințe'}` : 'de închis în Bazin'
→ { gross, base, deductible }
salaryEntryFor(salaries, staffId, month) — last validFrom <= month (feeEntryFor pattern)
```

**`pin.service.mjs`:** `createPinService({ readSetting, writeSetting, pinSession, now })` → `isConfigured()`, `set({ pin, currentPin })`, `unlock(pin)` (sha256 with `node:crypto`, 5 failures → 60 s), `lock()`, `assertUnlocked()` (403; slides `unlockedUntil` 10 min), `status()`.

**`salaries.service.mjs`:** `listMonth(month)` → rows `{ staff, mode, base, gross, advances, net, paid: { branchId, paidAt } | null }` for the branch's staff; `giveAdvance({ staffId, date, amount, method, month })` (advance row + expense `EXP-avans-<id>` in one branch transaction); `removeAdvance(id)` (undeducted only; archives its expense); `pay({ staffIds, month, method, date })` (decision 7; `bazin` mode → 400 „se plătește din Bazin”); `history(staffId)` (salaries + salary_payments + advances by month).

| Route                                    | Body                                                    | Returns                    |
| ---------------------------------------- | ------------------------------------------------------- | -------------------------- |
| `GET /api/personal/pin`                  | —                                                       | `{ configured, unlocked }` |
| `POST /api/personal/pin`                 | `{ pin, currentPin? }`                                  | `{ ok }`                   |
| `POST /api/personal/pin/unlock`          | `{ pin }`                                               | `{ ok }` — 403 / 429       |
| `POST /api/personal/pin/lock`            | `{}`                                                    | `{ ok }`                   |
| `GET /api/personal/salaries?month=`      | — (PIN)                                                 | `{ rows, totals }`         |
| `POST /api/personal/salaries`            | `{ staffId, mode, amount, validFrom }` (PIN)            | `{ salary }`               |
| `POST /api/personal/salaries/pay`        | `{ staffIds, month, method, revision, requestId }` (PIN)| `RevisionEnvelope & { paid: string[], skipped: string[] }` |
| `GET /api/personal/advances?year=`       | — (PIN)                                                 | `{ advances }`             |
| `POST /api/personal/advances`            | `{ advance, revision, requestId }` / `{ id, remove }`   | `RevisionEnvelope`         |
| `GET /api/personal/salaries/history?staffId=` | — (PIN)                                            | `{ months }`               |

Tests: `'salariul fix scade doar pentru A când deductOnlyUnexcused e activ, și pentru A/I/FP altfel; concediul și boala nu scad'`, `'salariul pe zile = tarif × zilele lucrate din toată luna'`, `'avansul lunii se scade la plată o singură dată; a doua plată e ignorată și avansul rămâne scăzut'` (criterion 3), `'plata creează o cheltuială Salarii cu id determinist în filiala activă și o marchează în comun'`, `'salariile, avansurile și istoricul răspund 403 fără PIN, 429 după 5 greșeli, și se blochează cu /lock'` (criterion 5, server half), `'state-ul personalului nu conține sume'`.

- [ ] `npm run check` green.
- [ ] Commit: `feat(personal): salaries, advances and PIN-protected routes`

---

## Phase 3 — Personal webapp: Echipa, fișa, Pontaj (+print), Concedii, 23e, 23i

### Task 5: Hook, page shell, Echipa (23a), fișa (23j), funcții (23e), echipa grupei (23i)

**Files:** create `webapp/src/shared/personal/usePersonal.ts` (+test: module store like `useAttendance`, `reload()`, `staffById`, `roleName`), `webapp/src/shared/personal/staff-labels.ts` (initials, „ambele filiale”), `webapp/src/features/personal/PersonalPage.tsx` (+css, +test; tabs via `SegmentedControl` in the topbar: Echipa · Pontaj · Concedii · Salarii · admin), `TeamView.tsx` (+test), `StaffFormDrawer.tsx` (+test; branches as `FilterPills`-style toggles, at least one), `StaffProfilePage.tsx` (+test; route `/personal/:id`, `useTopbarTitle`), `RolesDrawer.tsx` (+test; 23e, opened from the Echipa toolbar), `webapp/src/features/groups/GroupTeamCard.tsx` (+test; 23i — reads `group.team`, saves through the existing group save); modify `shared/view-key.ts`, `app/shell/nav-items.ts` (`personal` after `visits`, eyebrow „Evidență”), `routes.ts` (`/personal`), `App.tsx` (routes), `search-records.ts` (staff in global search: optional, skip if > 20 lines).

Echipa per spec: search + department pills (`FilterPills`), header sort (Angajat / Funcția / Grupa și rolul; default grouped by department with the coloured square + count), columns `2fr 1.2fr 1.3fr 130px 100px 20px`, „Azi” badge from today's timesheet row (La lucru / Concediu / Boală), tag line „ambele filiale · ziua de naștere DD.MM” when applicable, row → `/personal/:id`. Fișa: band `--orange-soft`, left Date personale / Grupe (from `group.team`) / Note, right 3 mini-cards (zile lucrate · boală, concediu rămas „N din 28 · M planificate”, Salariu `•••••` „Vezi cu PIN →” → Salarii tab), pontaj dots of the month, concedii of the year, „Nu mai lucrează aici” → `ConfirmDeleteDialog` pattern → archive.

Tests: `TeamView.test.tsx` — `'echipa e grupată pe departamente și filtrează cu pastilele'`, `'un angajat cu ambele filiale poartă eticheta'`; `StaffProfilePage.test.tsx` — `'fișa arată zilele lucrate, concediul rămas și salariul ascuns'`; `RolesDrawer.test.tsx` — `'o funcție cu angajați nu are buton de ștergere'`; `GroupTeamCard.test.tsx` — `'echipa grupei arată principalul, asistenții și înlocuitorii cu zilele'`.

- [ ] Compare at 1440 px with `Personal.dc.html#23a`, `#23j`, `#23e`, `#23i`.
- [ ] Commit: `feat(personal): team list, staff profile, roles and group team`

---

### Task 6: Pontaj (23b) + print (23k) + Concedii (23f)

**Files:** create `webapp/src/features/personal/TimesheetView.tsx` (+css, +test), `useTimesheet.ts` (+test; optimistic cycle, 400 ms debounce — copy `useAttendance`), `TimesheetPrint.tsx` (+css, +test), `TimesheetPrintDialog.tsx` (what: toți / departament / un angajat; days as „8” or „P”), `LeavesView.tsx` (+css, +test), `LeaveFormDrawer.tsx` (+test), `useLeaves.ts`.

Pontaj: `MonthStepper`, department pills, grid `190px repeat(N, 1fr) 44px 36px 36px`, legend, cells: `--off-day` weekend/holiday, worked `--mint-soft`, CO `--yellow`, CM `--pink`, A `--muted`, future unmarked dashed border; click → `nextTimesheetCode`; counters from `summarizeTimesheetMonth(upTo: 'today')`. Print (StatusPrint pattern: `@page { size: A4 landscape; margin: 10mm }`, black/white, `break-inside: avoid`, `thead { display: table-header-group }` so page 2 repeats the header): firm + „Subdiviziunea: Filiala <name>” from `useKindergarten` + `session.state.branch`, title „Tabel de pontaj · <luna> · N zile lucrătoare · N×8 ore”, columns Nr. · Numele, funcția · days · Zile · Ore · CO · CM · A, legend, 3 signature lines. Concedii: year row per employee (12-month track, bars CO `--yellow`, CM `--pink`, planned dashed), „Rămas”, warning banner `--yellow-soft` from `warnings`, „+ Concediu” drawer (staff, type, from–to, planned, note).

Tests: `TimesheetView.test.tsx` — `'clic pe celulă ciclează gol → CO → CM → A → gol și trimite un singur POST'`, `'concediul salvat apare în pontaj și scade din zilele rămase'` (criterion 2, UI half); `TimesheetPrint.test.tsx` — `'foaia are @page A4 landscape, o coloană pe zi și antetul tabelului se repetă pe pagina 2'` (criterion 4: CSS assertions + a 20-row render splits into two `<table>` blocks of ≤ 14 rows); `LeavesView.test.tsx` — `'două concedii suprapuse în aceeași grupă arată avertizarea'`.

- [ ] Compare with `#23b`, `#23k` (print preview), `#23f`.
- [ ] `npm run typecheck && npm test` green.
- [ ] Commit: `feat(personal): timesheet grid, A4 print and leaves calendar`

---

## Phase 4 — Salarii webapp (PIN gate, 23c, 23g, 23h)

### Task 7: PIN gate + Salarii + Avansuri + istoric + PIN setting

**Files:** create `webapp/src/features/personal/PinGate.tsx` (+css, +test; 23d — 4–6 boxes, auto-submit, error shake, „Se blochează singur după 10 minute”), `usePinStatus.ts`, `SalariesView.tsx` (+css, +test; cards Total · Avansuri · Plătit · Rămas, table `40px 1.5fr 1.3fr 1.2fr 110px 100px 110px 110px`, checkbox rows, „Plătește N selectați” → method dialog, „Blochează”, row ⋯ → Avans / Istoric / Setează salariul), `SalaryFormDrawer.tsx`, `AdvancesTab.tsx` (+test; 23g), `AdvanceFormDrawer.tsx`, `SalaryHistoryDrawer.tsx` (+test; 23h bars + list), `useSalaries.ts` (+test; a 403 on any call flips `locked`); modify `webapp/src/features/backup/KindergartenSettings.tsx` (card „PIN administrator”: set / change, honest one-liner about what it protects), `StaffProfilePage.tsx` (salary card unlock).

Tests: `PinGate.test.tsx` — `'fără PIN corect salariile nu se randează; după deblocare apare lista lunii'` (criterion 5, UI half); `SalariesView.test.tsx` — `'rândul unui antrenor de bazin arată „Plătit din Bazin” și nu se poate selecta'`, `'Plătește trimite id-urile selectate cu metoda aleasă și reîncarcă'`; `AdvancesTab.test.tsx` — `'avansul scăzut are starea Scăzut și nu se mai poate șterge'`.

- [ ] Compare with `#23c`, `#23d`, `#23g`, `#23h`.
- [ ] `npm run typecheck && npm test` green.
- [ ] Commit: `feat(personal): PIN gate, salaries, advances and salary history`

---

## Phase 5 — Bazin backend: settings, bookings, sessions, month, charges, closing

### Task 8: `charges` kind + `obligation()` lines

**Files:** modify `src/shared/domain/record-schema.mjs` (`TYPES` + `'charges'`, `FIELDS.charges`, `emptyState`, `validateState`), `record-snapshot-upgrade.mjs` (missing `charges` → `[]`, note), `record-types.d.mts` (`Charge`, `RecordsSnapshot.charges`), `record-integrity.mjs` (`charges.childId` must exist), `record-labels.mjs`, `records-report.mjs`, `tuition-obligation.mjs` (decision 4), `src/features/record-editing/server/record-editing.routes.mjs` (deleting a child requires no charges — same rule as payments), `src/features/data-transfer/domain/excel-workbook.mjs` (sheet „Bazin” with childName/month/label/amount; import ignores it), the 7 `obligation()` callers, tests of each.

Tests: `tuition-obligation.test.mjs` — `'o taxă de bazin se adaugă la obligația lunii ca linie separată și intră în rest'`, `'taxa de bazin în lei se convertește în euro la cursul zilei închiderii pentru un copil cu taxă EUR'`; `record-schema.test.mjs` — `'un snapshot vechi fără charges se încarcă cu lista goală'`; `month-evaluation.test.mjs` — `'evaluarea lunii trece taxele de bazin la obligation()'`.

- [ ] `npm run check` + `cd webapp && npm run typecheck` green (every caller updated).
- [ ] Commit: `feat(shared): charges record kind added to the monthly obligation`

---

### Task 9: Pool feature — settings, tables, domain, routes, closing

**Files:** create `src/features/pool/README.md`, `pool.types.d.mts`, `index.server.mjs`, `index.web.mjs`, `domain/pool-settings.mjs` (+test: `parsePoolSettings(json) → PoolSettings | null`, `validatePoolSettings`, `POOL_SETTINGS_SEED`, `slotTimes(settings)`), `domain/pool-schedule.mjs` (+test: `expandBooking`, `sessionState`, `weekOf(date)`, `seatsTaken(bookings, weekday, time, onDate)`), `domain/pool-month.mjs` (+test: `childMonth`, `coachPayForMonth`, `monthTotals`), `server/pool.repository.mjs` (+test), `server/pool-closing.service.mjs` (+test), `server/pool.routes.mjs` (+ integration test); modify `src/core/server/database/schema.mjs`, `src/app/server/create-branch-context.mjs` (`createPoolRoutes({ database, branch, recordRepository, runRevisionTransaction, auditTrail, readSetting, writeSetting, listCoaches, advancesForMonth, markSalaryPaid })`, and Personal's `readCoachPayForMonth` port now points at `pool.coachPayForMonth`), `session.routes.mjs` (`pool: { enabled }`).

```sql
CREATE TABLE IF NOT EXISTS pool_bookings(id TEXT PRIMARY KEY,child_id TEXT NOT NULL,coach_id TEXT NOT NULL,weekday INTEGER NOT NULL,time TEXT NOT NULL,start_date TEXT NOT NULL,end_date TEXT,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS pool_sessions(booking_id TEXT NOT NULL,date TEXT NOT NULL,status TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(booking_id,date));
CREATE INDEX IF NOT EXISTS pool_sessions_date ON pool_sessions(date);
CREATE TABLE IF NOT EXISTS pool_closings(month TEXT PRIMARY KEY,closed_at TEXT NOT NULL,charges_total REAL NOT NULL,coach_total REAL NOT NULL);
```

```js
childMonth({ bookings, sessions, month, settings, todayStr }) → { scheduled, present, absent, excused, cancelled, unmarked, amount }
  amount = (present + (settings.chargeUnexcusedAbsence ? absent : 0)) * settings.pricePerSession   // excused, cancelled = 0
coachPayForMonth({ coachId, bookings, sessions, month, settings }) → { sessionsHeld, childrenPresent, rate, mode, amount }
  sessionsHeld = distinct (date,time) with ≥ 1 present; amount = rate * (mode === 'per_child' ? childrenPresent : sessionsHeld)
closeMonth({ month, method, date, revision, requestId }) — decision 5/6, one runRevisionTransaction(action: 'închidere lună bazin')
```

| Route                             | Body / query                                                      | Returns                                                                                   |
| --------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `GET /api/pool/settings`          | —                                                                 | `{ settings \| null, seed, coaches }` — coaches = `listCoaches()` (role „Antrenor bazin”, this branch) |
| `POST /api/pool/settings`         | `PoolSettings`                                                    | `{ settings }`                                                                            |
| `GET /api/pool/week?date=`        | —                                                                 | `{ days: [{ date, slots: [{ time, entries: [{ booking, child, state }] }] }], stats }`     |
| `POST /api/pool/bookings`         | `{ booking }` / `{ id, endDate }`                                 | `{ booking }` — `seatsTaken ≥ seatsPerSlot` → 400 (criterion 1); child must exist         |
| `POST /api/pool/sessions`         | `{ changes: [{ bookingId, date, status \| null }] }`              | `{ ok }` — future dates only `cancelled`                                                  |
| `GET /api/pool/month?month=`      | —                                                                 | `{ children: [childMonth + payment label from obligation], coaches: [coachPayForMonth], closing }` |
| `POST /api/pool/close-month`      | `{ month, method, revision, requestId }`                          | `RevisionEnvelope & { charges: n, coaches: n }`                                           |

Tests: `pool-schedule.test.mjs` — `'o programare de marți produce datele lunii fără sărbătorile legale și în intervalul ei'`; `pool-month.test.mjs` — `'suma copilului = prezențe × preț, plus lipsele nemotivate doar când setarea o cere; motivat și anulat = 0'`, `'salariul antrenorului din închidere e egal cu cel de pe card (aceeași funcție)'` (criterion 3); `pool-closing.service.test.mjs` — `'închiderea lunii a doua oară nu dublează nici taxa copilului, nici cheltuiala antrenorului'` (criterion 2), `'închiderea refuză o lună cu ședințe nemarcate'`, `'avansul antrenorului se scade o singură dată și rămâne scăzut la reînchidere'`; integration — `'a treia programare pe un slot cu 2 locuri e refuzată'` (criterion 1), `'setările bazinului sunt per filială: Botanica nu vede prețul din Buiucani și Bazin lipsește din sesiunea ei'` (criterion 4).

- [ ] `npm run check` green.
- [ ] Commit: `feat(pool): settings, bookings, sessions, month totals and month closing`

---

## Phase 6 — Bazin webapp (22a–22d), receipt wiring, billing lines

### Task 10: Pages, drawer, settings tab, nav gating

**Files:** create `webapp/src/features/pool/PoolPage.tsx` (+css, +test; `SegmentedControl` Săptămâna · Luna, `DayStepper`-style week stepper / `MonthStepper`), `WeekView.tsx` (+test; grid `72px repeat(5, 1fr)`, tiles in `groupTone`, click cycles Prezent → Lipsă → Motivat → nemarcat, future = schedule only, cancelled = struck through, 4 cards), `BookingDrawer.tsx` (+test; 22b — child `SearchSelect`, coach, weekday pills, hour tiles with „N copii”/remaining seats, start date, price preview), `MonthView.tsx` (+test; 22c — 4 cards, table per child with payment badge from `obligation().label`, coach card, „Cum se încasează” note, „Închide luna” → `CloseMonthDialog` with method + unmarked-sessions guard), `usePool.ts` (+test), `webapp/src/features/backup/PoolSettings.tsx` (+test; 22d — form on `poolSettings`, toggle „Folosim bazinul”, coaches list read-only from Personal with „+ Adaugă antrenor → Personal”); modify `BackupPage.tsx` (`ViewMode` + `'pool'`, label „Bazin”), `nav-items.ts` (`bazin` after `attendance`, eyebrow „Evidență”), `routes.ts`, `view-key.ts`, `App.tsx`, `Sidebar.tsx` (hide `bazin` when `!session.state.pool?.enabled`), `app-session-store.mjs` (`state.pool`).

Tests: `WeekView.test.tsx` — `'clic pe placă ciclează prezent → lipsă → motivat → nemarcat; zilele viitoare nu se marchează'`; `BookingDrawer.test.tsx` — `'ora fără locuri libere e dezactivată'`; `MonthView.test.tsx` — `'Închide luna e dezactivat cât există ședințe nemarcate și arată motivul'`; `Sidebar.test.tsx` — `'Bazin apare în meniu doar când filiala folosește bazinul'`.

- [ ] Compare with `Bazin.dc.html#22a–22d`.
- [ ] Commit: `feat(pool): week and month screens, booking drawer, settings tab`

---

### Task 11: „Bazin” lines in Situația / fișă / confirmare + 58 mm pool receipt

**Files:** `git mv webapp/src/features/payments/PoolReceiptLabel.{tsx,module.css,test.tsx} webapp/src/features/pool/`; create `webapp/src/features/pool/PoolReceiptPage.tsx` (+test; route `/bazin/bon/:childId?month=`, print bar like `PaymentReceiptThermal`, data from `GET /api/pool/month` + `expandBooking` → `sessions` cells, `dashed` = cancelled, `itemsNote` from a `poolSettings.itemsNote` text field added to 22d); modify `MonthView.tsx` (row ⋯ → „Bon 58 mm”), `webapp/src/features/status/StatusPage.tsx` + `useStatus.ts` (Taxă cell second line „incl. Bazin N lei” from `obligation().lines`), `webapp/src/features/children/ChildProfileView.tsx` (Sold card lists the lines), `webapp/src/features/payments/usePaymentReceipt.ts` + `PaymentReceipt.tsx` (the month row shows „incl. Bazin: N × P lei” under „Taxă <lună>”).

Tests: `PoolReceiptPage.test.tsx` — `'bonul de bazin listează ședințele lunii, cele anulate punctat, și totalul lunii'`; `StatusPage.test.tsx` — `'un copil cu taxă de bazin arată rândul Bazin sub taxă și restul include bazinul'`; `PaymentReceipt.test.tsx` — `'confirmarea arată linia Bazin a lunii'`.

- [ ] `npm run typecheck && npm test` green; `npm run test:e2e` once.
- [ ] Commit: `feat(pool): pool lines in billing screens and the 58 mm pool receipt`

---

## Phase 7 — Sync hookup, docs, acceptance

### Task 12: Sync deltas (only what Phase 2–6 of the sync plan needs), docs

**Files:** the deltas of „Changes to the sync plan” — modify `sync-server/src/change-policy.mjs` (`COMMON_DATASET_ID`, new kinds), `branches.routes.mjs` / `changes.routes.mjs` (accept `comun`), `src/features/sync/server/change-applier.mjs` (appliers for personal/pool kinds via the injected repositories), `sync-connect.service.mjs` (`comun` step), `sync-engine.service.mjs` (nothing — a second instance), `src/app/server/create-common-context.mjs` (sync tables, engine, `onChange` into its outbox), `create-branch-context.mjs` (`onChange` for `pool_*`), `sync.routes.mjs` (merged status/conflicts), `webapp/src/shared/personal/usePersonal.ts` + `features/pool/usePool.ts` (reload on `records-changed` with the matching dataset); docs: `docs/design/screens/24-personal.md` and `23-bazin.md` (tick criteria), `docs/arhitectura/README.md` (one paragraph: `Comun\`, the two features, `charges`), `scripts/pachet-client/GHID-LIVRARE.md` (where `Comun\` lives, that its backup is next to it, PIN caveat), `docs/design/COADA-DE-LUCRU.md`, `docs/design/INTREBARI.md` (open questions 1–6 above with the provisional answers).

If the sync plan has not merged yet when this phase starts, Task 12 shrinks to the docs + the `onChange` hooks (already in place from Tasks 1/3/9) and the sync deltas move into the sync plan's Phase 6.

Tests: `'setul comun se urcă de pe primul calculator și se contopește de pe al doilea fără 409'`, `'motorul setului comun rulează în paralel cu cel al filialei și supraviețuiește schimbării filialei'`, `'o modificare de personal făcută dincolo reîncarcă echipa aici'`.

- [ ] `npm run check`, `cd webapp && npm run typecheck && npm test`, `npm run test:e2e` green.
- [ ] Manual: on a copy of the real `%LOCALAPPDATA%\Startica`: start → `Comun\` appears, nothing else changes; add a staff with both branches → visible after switching; set PIN → Salarii locked → unlock → pay one salary → Cheltuieli shows it once; configure Bazin on one branch only → menu item only there; book, mark, close → Situația shows the Bazin line, closing again changes nothing (Istoric has no new entries).
- [ ] Commit: `docs: personal și bazin — decizii, sincronizarea setului comun, criterii bifate`

---

## Acceptance criteria → where they are proven

| Spec criterion                                              | Test / check                                                                                                                            |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| (24) Filiala activă filtrează tot; „ambele” apar la ambele  | `personal.routes.integration.test.mjs` „echipa filialei active…”; `TeamView.test.tsx` „un angajat cu ambele filiale poartă eticheta”    |
| (24) Concediul adăugat apare în pontaj și scade din rămase  | `leave-days.test.mjs` „un concediu CO de 6–27 iulie…”; routes „un concediu CO scrie CO în pontaj…”; `TimesheetView.test.tsx` „concediul salvat…” |
| (24) Avansul se scade o singură dată                        | `salaries.service.test.mjs` „avansul lunii se scade la plată o singură dată…”; `pool-closing.service.test.mjs` „avansul antrenorului…” |
| (24) Tipărirea încape pe A4 orizontal fără tăiere           | `TimesheetPrint.test.tsx` „foaia are @page A4 landscape…”; manual print preview against `#23k`                                          |
| (24) Salariile nu se văd fără PIN                           | `salaries.routes.integration.test.mjs` „…răspund 403 fără PIN…”, „state-ul personalului nu conține sume”; `PinGate.test.tsx`             |
| (23) Nu se poate programa peste `seatsPerSlot`              | `pool.routes.integration.test.mjs` „a treia programare pe un slot cu 2 locuri e refuzată”; `BookingDrawer.test.tsx`                     |
| (23) Închide luna e idempotent                              | `pool-closing.service.test.mjs` „închiderea lunii a doua oară nu dublează…”                                                             |
| (23) Salariul antrenorului = aceeași formulă ca pe card     | `pool-month.test.mjs` „salariul antrenorului din închidere e egal cu cel de pe card”                                                    |
| (23) Botanica are setări proprii                            | `pool.routes.integration.test.mjs` „setările bazinului sunt per filială…”; `Sidebar.test.tsx` „Bazin apare în meniu doar când…”         |

## Compatibility notes

- An install that never opens Personal or Bazin gets an empty `Comun\` database and the seeded roles; `/api/state` gains `charges: []`; old backups/imports load through `upgradeSnapshot`. No existing HTTP contract changes shape except `obligation()`'s JS signature (compile-checked) and `/api/session.pool`.
- Backups: the branch backup is unchanged; `Comun\Startica_Backup` holds the common file's backups with the same retention. Restore of a branch never touches `comun`; restoring `comun` = replace the file with the app closed (GHID-LIVRARE).
- The Telegram digest and the accounting report are unaffected (expenses written here are ordinary `expenses` records in the branch).
