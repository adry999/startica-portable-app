# Sincronizare între calculatoare (18) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Several computers of the same kindergarten share the data of every branch through a **small reconciliation server** (`docs/design/screens/18-sincronizare.md`): each install keeps its local SQLite files as the source of truth (local-first, works offline), pushes its changes within seconds, pulls the others', shows the 14a card in the sidebar, lets the user resolve edit conflicts on fișe/grupe (14c) and manages the connected computers with a 6-digit pairing code (14b). Not a SaaS, not a rewrite: the desktop app stays a desktop app.

**Architecture:** One new zero-dependency Node 22 + `node:sqlite` package in `sync-server/` (HTTP behind a TLS reverse proxy). In the app, a `sync` feature adds three tables to **each branch DB** (`sync_state`, `sync_outbox`, `sync_conflicts`), records every local write in the outbox inside the same transaction that writes the record, and runs one sync worker attached to the active branch context. A branch = one local file = one server dataset (exactly as `2026-09-27-filiale.md`, decision 1, designed for). Device identity (`sync.json`) is per install, next to `filiale.json`.

**Tech Stack:** Node 22 vanilla ESM + `node:sqlite` + `node --test` (app and server); React 19 + Vite + TS + Vitest/RTL in `webapp/`. No new dependency anywhere.

**Spec:** `18-sincronizare.md` (authoritative), `Sincronizare.dc.html#14a–14c`, `17-filiale.md`, `22-prima-pornire.md` (only the „Am deja o grădiniță → cod” part), `21-incarcare.md` (the „Sincronizez cu serverul comun” step), `19-prezenta.md` (attendance: last write wins), `00-comun.md`.

## Decisions (read before coding)

1. **Server = `sync-server/` in this repo, same stack, zero deps, one process, one SQLite file.** `sync-server/src/` has its own tiny router (regex paths with ids — `#core/server/http/route-dispatcher.mjs` is flat-path and loopback-guarded, not reusable), its own `sync.db` (all branches in one file, keyed by `branch_id`; the server is per kindergarten, not multi-tenant), WAL + `synchronous=FULL`. It listens on plain HTTP on `SYNC_BIND` (default `127.0.0.1:8790`); **TLS is terminated by a reverse proxy** (Caddy with automatic Let's Encrypt — `Caddyfile.example` shipped). `Dockerfile` + `docker-compose.yml` (server + Caddy) are provided but optional. All configuration via env vars (`SYNC_PORT`, `SYNC_BIND`, `SYNC_DATA_DIR`, `SYNC_SETUP_KEY`, `SYNC_BACKUP_HOUR`, `SYNC_BACKUP_KEEP`, `SYNC_HISTORY_DAYS`, `SYNC_TRUST_PROXY`), so hosting (open question 1) does not change the code. The server imports **nothing** from `src/` (a Docker image copies only `sync-server/`); the one shared constant it needs (sensitive fields) is duplicated with a root test asserting equality.
2. **Device auth = pairing code → long-lived per-device token, stored per install.** A connected computer asks the server for a code (6 digits, `crypto.randomInt(100000, 999999)`, 10 min, single use). The new computer posts `{ code, name, os }` and gets `{ deviceId, token }`; the token is 32 random bytes base64url, stored **hashed (sha256) on the server**, in clear in `<home>\sync.json` on the device (`%LOCALAPPDATA%` is per user; no DPAPI — that would need a native call). `Authorization: Bearer <token>` on every request; „Deconectează” sets `revoked_at` → the next request gets **401 `device-revoked`** and the app stops both directions. Pairing is rate-limited (5 attempts / 10 min per IP, and a code is deleted after 5 wrong tries). **First computer:** no code exists yet, so it pairs with `SYNC_SETUP_KEY` (env; accepted only while the server has zero non-revoked devices, or always when the operator sets `SYNC_SETUP_KEY_ALWAYS=1` for recovery).
3. **Ids stay as they are; sync metadata lives in side tables, not in payloads.** Every record created in `webapp/` already has `PREFIX-<uuid>` (`ID-`, `PAY-`, `EXP-`, `GRP-`, `CAT-`, `VIZ-`, `TPL-`); legacy/imported ids are unique inside a branch, and a branch dataset is uploaded exactly once, so the server key `(branch_id, kind, id)` is unique by construction — **no id migration**. `normalizeRecord` whitelists fields per kind (metadata in the payload would be stripped or leak into exports), so `revision`/`updatedAt`/`updatedByDevice` go to `sync_state(kind,id)` in the branch DB and `branchId` is implied by the file. `meta.revision` (tab-level optimistic concurrency) is untouched and distinct from the per-record `server_revision`.
4. **Outbox captured by wrapping the repository, inside the same transaction.** `createBranchContext` builds the raw record repository, then `recordRepository = createOutboxRecordingRepository(raw, outbox, isEnabled)`; `save` enqueues only when the JSON differs from the stored one, `remove` enqueues a delete. Every write route already goes through this repository under `runRevisionTransaction`'s `BEGIN IMMEDIATE`, so record + outbox row commit atomically. `replaceAllRecords` (import, restore) enqueues from the diff it already computes. Attendance and (Phase 6) settings/templates get an `onChange` hook in their repositories. The sync engine applies **pulled** changes through the **raw** repository, so nothing loops back into the outbox. Outbox rows are coalesced per `(kind,id)` (first `base_revision`, last payload) — that is the „N modificări” number.
5. **Server-side optimistic concurrency, per record, with two policies.** A push carries `baseRevision` per change; the server compares with the head's `revision`. Match → applied (`revision+1`). Mismatch → for `CONFLICT_KINDS = children, groups, categories, visits` the server answers `conflict` with its head (payload, revision, time, device) and the client parks the outbox row and stores a `sync_conflicts` row (14c). For LWW kinds (`payments`, `expenses`, `attendance`, `sms_templates`, `settings`) the newer `changedAt` wins (`applied` or `superseded`; device clocks, skew accepted) — the spec says achitările și cheltuielile never conflict: two *new* payments have different ids and both survive; an *edit* of the same payment on two computers is last-writer-wins with an audit entry. Possible duplicates (same child, date, amount, method) are already flagged by `findRecordIssues` (`Posibil duplicat cu …`) → „De verificat”, nothing to add. Idempotency: `changeId` (uuid) is UNIQUE on the server; a replay returns the stored result.
6. **Per table:** `records` — synced (the whole point). `attendance` — synced, LWW per `(childId,date)` (spec 19). `sms_templates` — synced, LWW (small, shared config; Phase 6). `settings` — only `kindergarten` (minus `nextReceiptNumber`) and `planPresets` synced, LWW (Phase 6); `exchangeRates`/`exchangeRateSources` **not** synced (every device backfills the same BNM value on every open, a whole-map LWW would clobber manual corrections — accepted limitation: a manual correction is per computer, see open question 4); `notificationPreferences`, `externalDir`, `lastLocal`, `localError`, `externalError`, `receipt*`, `schemaVersion` local only (they describe this computer). `sms_log` — **not** synced in V1 (autoincrement id, provider status polling per sender; see open question 5). `audit_changes` — local, but every pulled change writes an entry `sincronizare de pe <calculator>` so Istoric shows what came from elsewhere. `requests` — local (idempotency of local HTTP).
7. **Pull = polling every 15 s + SSE wake-up; the webapp learns through the session singleton.** The worker pushes (2 s debounce after a local write), then pulls `GET /changes?since=<cursor>` (cursor = setting `sync.since`), applies a batch in one `BEGIN IMMEDIATE` through `normalizeRecord` + raw repository, bumps `meta.revision` once, and emits `records-changed { revision }` on a **local SSE** route `GET /api/sync/events`. `useSyncStatus` (webapp) subscribes with `EventSource` and calls `session.load()` (existing `accept()` → `RecordsReloaded` → every screen re-renders; the next save carries the new revision, so no spurious 409). Open form drawers keep their own `useState` values — same behaviour as today with two tabs. Server-side SSE (`GET /v1/branches/:id/events`) is a wake-up only; polling stays the base.
8. **Conflicts are data in the branch DB, resolved through `runRevisionTransaction`.** `sync_conflicts` keeps both payloads and both times; `POST /api/sync/conflicts/resolve { id, choice }` writes the chosen payload with the raw repository, updates `sync_state`, re-enqueues (choice `local`, with `base_revision = remote revision`) or drops the parked outbox row (choice `remote`), and records an audit entry `conflict: păstrată varianta de pe <calculator>` with before/after — „Alegerea intră în Istoric” for free. The „Conflicte” nav row appears under De rezolvat only when the count is > 0, with the counter.
9. **First upload / download = snapshots, then the cursor.** `POST /api/sync/connect` pairs the device and runs `reconcileBranches()`: a local branch unknown to the server → `POST /v1/branches` + `POST /v1/branches/:id/snapshot` (all records, attendance, templates, synced settings, one server transaction, every row at revision 1; `sync_state` written locally, cursor = `headSeq`); a server branch unknown locally → adopted into `filiale.json` **with the server's id** (`registry.adopt(entry)` — new method, keeps the id, picks a folder slug) and downloaded with `GET /v1/branches/:id/snapshot` into `Filiale\<slug>`. **A local branch with 0 records and no kindergarten name is not uploaded**: the first server branch is adopted into that slot (keeps `folder: null` and the legacy dirs) — this is the „calculator nou” of spec 22, where a fresh install already created an empty „Filiala principală”. A local branch with data whose id already exists on the server is refused with a clear message (it can only be a copied `filiale.json`). Registry metadata (name, colour, address) is reconciled on every 5th cycle so a rename propagates. The server keeps the change history `SYNC_HISTORY_DAYS` (365); a cursor older than that gets 410 → snapshot resync.
10. **Offline = the server is unreachable; nothing else changes.** Local writes never wait for the network. A failed `fetch` (ECONNREFUSED, DNS, 10 s timeout) → `connection: 'offline'`, retry with backoff 5 s → 60 s; 401 → `'revoked'`. Status object: `{ configured, connection, pending, pushing, lastSyncedAt, conflicts, lastError }`. The 14a card derives: conflicts > 0 → **Conflict**; offline → **Fără internet**; pushing or pending > 0 → **Se sincronizează**; else **Sincronizat · HH:MM**. Local save/backup errors keep today's precedence (they are about this computer's disk). When sync is not configured, today's `SaveStatusCard` stays. Server daily backup: `VACUUM INTO backups/sync_<ts>.db` at `SYNC_BACKUP_HOUR`, keep `SYNC_BACKUP_KEEP` (14), `lastBackupAt` in `GET /v1/status` for the 14b card.
11. **Security basics for a server holding children's data.** The app refuses `http://` server addresses except `127.0.0.1`/`localhost` (dev/test); tokens hashed at rest; pairing rate-limited; no tokens or data in URLs (ids in paths are UUIDs, pulls carry only `since`); JSON bodies only, 20 MB limit (64 MB for snapshots); the server logs method, path, status, device id — never bodies; `healthNotes` retention: each device's existing 365-day expiry propagates as a normal change (empties the field), and the server **deletes history rows older than `SYNC_HISTORY_DAYS`** and backups older than `SYNC_BACKUP_KEEP` days, so an expired note disappears from the server within ~14 days of its expiry; head rows never hold more than the devices do. `sync.json` in `.gitignore`.
12. **Sync worker = one per active branch context.** `createBranchContext` builds the engine; `selectBranch` stops the old one (`previous.close()` aborts fetches and timers) and starts the new one after `runStartupSweeps()`. Outboxes of branches not open on this computer wait until they are opened (accepted V1 limitation; the 14b card shows only the open branch).
13. **Not built:** multi-tenant anything, user accounts, per-record permissions, field-level merge, `sms_log` sync, the 22 wizard steps (only the connect-by-code form), history compaction beyond age-based deletion.

## Decided by the user (27.09.2026) — formerly open questions

1. **Hosting: a small VPS in the EU** (option A): Docker Compose + Caddy (automatic HTTPS), daily backup on the same disk + optional off-site. Everything stays env-var configured.
2. **Connect form = address + code.** The 14b card shows the server address next to the 6-digit code; the connect form on the new computer has both fields.
3. **Receipt numbers: strictly in order („la rând”) per branch, across all computers — NOT per-device blocks.** Replaces the Phase 6 block design: the server owns `branches.next_receipt_number` and hands out exactly one number per first print (`POST /v1/branches/:id/receipt-number`, atomic, idempotent per `paymentId` so a retry never burns a number). When sync is configured and the server is reachable, the receipt gets its number immediately. **Offline**: the receipt prints with „Nr. se atribuie la reconectare” (no local number is invented), the payment is queued, and the number is assigned (and saved on the payment, then synced) on the next successful sync; reprinting then shows the real number. Unconfigured installs keep today’s local `nextReceiptNumber`. Task 13 is adjusted accordingly (test: `'două calculatoare primesc numere consecutive, fără goluri și fără dubluri'`, `'offline, confirmarea se tipărește fără număr și îl primește la reconectare'`).
4. **BNM manual corrections** stay per computer for V1 (recommendation accepted).
5. **`sms_log` not synced in V1** (recommendation accepted): one sending computer per branch.

## Global constraints

- Backend code for sync is a feature: `src/features/sync/` (`README.md`, `sync.types.d.mts`, `index.server.mjs`, `domain/`, `server/`, `test-support/`). Composition only in `src/app/server/`. Nothing in other features changes except the small `onChange` hooks named below. `tests/architecture/import-boundaries.test.mjs` gets two rules: `sync-server/` imports nothing from `src/`; `#sync-server/*` (new alias in `package.json#imports` → `./sync-server/src/*`) may be imported only from `tests/` and `*.integration.test.mjs`.
- Root `package.json`: `test` also runs `"sync-server/src/**/*.test.mjs"`; `tsconfig.json` includes `sync-server/src/**/*.mjs`; prettier already covers it.
- Only `@shared/ui` + `tokens.css` in `webapp/`; no new hex.
- Server errors via `fail(message, status)`; the sync engine is the one place allowed to catch network/HTTP errors (it translates them into the status object, never swallows them silently — `lastError` + `console.error`).
- Tests: `npm run check` at root, `cd webapp && npm run typecheck && npm test`, `npm run test:e2e` once after Phase 3.
- Conventional Commits, scopes `sync-server`, `sync`, `core`, `app`, `backup`, `docs`. No AI trailers.

---

## Phase 1 — `sync-server/`: devices, pairing, branches, changes, backup

### Task 1: Package, config, database, router, auth

**Files:** create `sync-server/package.json` (`{ "name": "startica-sync-server", "private": true, "type": "module", "engines": { "node": ">=22.5.0" }, "scripts": { "start": "node src/main.mjs" } }`), `sync-server/README.md`, `sync-server/Dockerfile` (`node:22-alpine`, `COPY sync-server/`, `CMD node src/main.mjs`), `sync-server/docker-compose.yml` (server + `caddy:2` with a volume), `sync-server/Caddyfile.example` (`sync.example.md { reverse_proxy sync:8790 }`), `sync-server/src/config.mjs`, `database.mjs`, `router.mjs`, `auth.mjs`, `main.mjs`, `create-sync-server.mjs`; modify root `package.json` (`imports` alias, `test` glob), `tsconfig.json`, `tests/architecture/import-boundaries.test.mjs`, `.gitignore` (`sync-server/data/`, `sync.json`).

**`config.mjs`:** `loadSyncConfig(env) → { port, bind, dataDir, setupKey, setupKeyAlways, backupHour, backupKeep, historyDays, trustProxy }` with validation like `#config/environment.mjs` (fails fast with a Romanian message).

**`database.mjs`:** `openSyncDatabase(dataDir) → DatabaseSync` with WAL/FULL and the schema:

```sql
CREATE TABLE IF NOT EXISTS devices(id TEXT PRIMARY KEY, name TEXT NOT NULL, os TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, last_branch_id TEXT, revoked_at TEXT);
CREATE TABLE IF NOT EXISTS pairing_codes(code TEXT PRIMARY KEY, created_by TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT, attempts INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS branches(id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL, address TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, uploaded_by TEXT, uploaded_at TEXT);
CREATE TABLE IF NOT EXISTS records(branch_id TEXT NOT NULL, kind TEXT NOT NULL, id TEXT NOT NULL, revision INTEGER NOT NULL, payload TEXT, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL, PRIMARY KEY(branch_id,kind,id));
CREATE TABLE IF NOT EXISTS changes(seq INTEGER PRIMARY KEY AUTOINCREMENT, change_id TEXT NOT NULL UNIQUE, branch_id TEXT NOT NULL, kind TEXT NOT NULL, record_id TEXT NOT NULL, revision INTEGER NOT NULL, payload TEXT, changed_at TEXT NOT NULL, received_at TEXT NOT NULL, device_id TEXT NOT NULL, result TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS changes_branch_seq ON changes(branch_id,seq);
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
```

`payload NULL` = deleted. `changes.result` ∈ `applied | superseded | conflict` (a replay returns it).

**`router.mjs`:** `createRouter({ routes: [{ method, pattern: RegExp, auth: boolean, handle({ params, body, device, url, response }) }], authenticate, log })` → `(request, response)`; JSON body with size limit (per route, default 20 MB); one `catch` → `{ error }` with `status || 400`; `fail(message, status)` is a local copy (4 lines) — no import from `src/`. Trust `X-Forwarded-For` only when `trustProxy`.

**`auth.mjs`:** `hashToken(token) = sha256 hex`, `createToken() = randomBytes(32).toString('base64url')`, `bearerToken(request)`, `createRateLimiter({ limit: 5, windowMs: 600000 })` (in-memory map keyed by IP).

Tests (`config.test.mjs`, `router.test.mjs`, `auth.test.mjs`): `'configurația refuză portul și ora de backup invalide'`, `'ruta cu autentificare refuză fără Bearer și cu token revocat (401)'`, `'corpul peste limită dă 413'`, `'limitatorul lasă 5 încercări pe fereastră'`.

- [ ] Write tests, run (fail), implement, run (pass).
- [ ] Commit: `feat(sync-server): package skeleton, config, router and device auth`

---

### Task 2: Devices, pairing codes, branches registry, status, backup

**Files:** create `sync-server/src/devices.repository.mjs`, `pairing.service.mjs`, `branches.repository.mjs`, `backup.service.mjs`, `devices.routes.mjs`, `branches.routes.mjs`, `status.routes.mjs`; `*.test.mjs`.

| Route                                 | Auth      | Body / query                                        | Returns                                                                                  |
| ------------------------------------- | --------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `POST /v1/devices/pair`               | none (RL) | `{ code?, setupKey?, name, os }`                    | `{ deviceId, token, branches }` — 400 wrong/expired code, 403 setup key not accepted     |
| `POST /v1/pairing-codes`              | device    | —                                                   | `{ code, expiresAt }`                                                                    |
| `GET /v1/devices`                     | device    | —                                                   | `{ devices: [{ id, name, os, lastSeenAt, lastBranchId, revokedAt, me }] }`               |
| `POST /v1/devices/:id/revoke`         | device    | —                                                   | `{ ok }` — 400 on self                                                                   |
| `GET /v1/status`                      | device    | —                                                   | `{ branches, devices, lastBackupAt, serverTime }`                                        |
| `GET /v1/branches`                    | device    | —                                                   | `{ branches: [{ id, name, color, address, createdAt, updatedAt }] }`                     |
| `POST /v1/branches`                   | device    | `{ id, name, color, address, createdAt }`           | `{ branch, created }` — idempotent by id; metadata updated when `updatedAt` is newer     |

Every authenticated call updates `last_seen_at` (and `last_branch_id` for branch routes). `backup.service.mjs`: `scheduleDailyBackup({ database, dataDir, hour, keep, historyDays, now })` — checks every 10 min, runs once per day: `VACUUM INTO <dataDir>/backups/sync_<ts>.db.tmp` → rename, prune to `keep` newest, `DELETE FROM changes WHERE received_at < now - historyDays` (head `records` untouched), `meta.lastBackupAt`.

Tests: `'codul de conectare expiră după 10 minute și se folosește o singură dată'`, `'a cincea încercare greșită șterge codul'`, `'cheia de instalare merge doar când nu există calculatoare'`, `'un calculator revocat primește 401 la următoarea cerere'`, `'backupul zilnic rulează o dată, păstrează 14 fișiere și șterge istoricul mai vechi de un an'`.

- [ ] Commit: `feat(sync-server): pairing, devices, branch registry, daily backup`

---

### Task 3: Changes — push with conflict policy, pull, snapshots, SSE

**Files:** create `sync-server/src/change-policy.mjs`, `changes.service.mjs`, `changes.routes.mjs`, `events.mjs`, `changes.service.test.mjs`, `create-sync-server.integration.test.mjs`.

**`change-policy.mjs`:** `KINDS = [...TYPES, 'attendance', 'sms_templates', 'settings']`, `CONFLICT_KINDS = ['children','groups','categories','visits']`, `SENSITIVE_FIELDS` (copy; root test `tests/sync-shared-constants.test.mjs` asserts equality with `#shared/domain/record-schema.mjs`), `isLastWriterWins(kind)`.

**`changes.service.mjs`:**

```js
applyPush({ branchId, deviceId, changes }) → { results: [{ changeId, status, revision, head? }] }
// per change, in one transaction for the whole batch:
//   prior = changes.find(change_id)            → return stored result (replay)
//   head  = records.find(branch, kind, id)
//   if (!head && baseRevision === 0) || head.revision === baseRevision → write head rev+1, insert change 'applied'
//   else if isLastWriterWins(kind): changedAt > head.updated_at ? applied (rev = head.revision+1) : 'superseded' + head
//   else → 'conflict' + head { payload, revision, updatedAt, updatedBy: { id, name } } (nothing written but the change row)
pull({ branchId, since, limit = 500 }) → { changes: [{ seq, changeId, kind, recordId, revision, payload, changedAt, device: { id, name } }], nextSince, headSeq }   // only result='applied'; since < oldest kept seq → 410
writeSnapshot({ branchId, deviceId, snapshot }) → { headSeq }   // 409 if the branch already has records; every row rev 1, one change row per record
readSnapshot({ branchId }) → { records: { kind: [{ id, revision, payload, updatedAt }] }, attendance, smsTemplates, settings, headSeq }
```

Routes: `POST /v1/branches/:id/changes` (push), `GET /v1/branches/:id/changes?since=&limit=` (pull), `POST /v1/branches/:id/snapshot` (64 MB), `GET /v1/branches/:id/snapshot`, `GET /v1/branches/:id/events` (SSE: `event: change\ndata: {"seq":N}` after every applied push, heartbeat comment every 25 s; `events.mjs` = a Map branchId → Set of responses, `closeAll()` on shutdown).

Tests: `'o modificare cu revizia curentă se aplică și crește revizia'`, `'aceeași fișă modificată de două calculatoare dă conflict cu varianta de pe server, fără să piardă nimic'`, `'două achitări noi cu id-uri diferite se aplică amândouă'`, `'o achitare editată pe două calculatoare: câștigă ultima modificare, cealaltă e superseded'`, `'un changeId reluat întoarce rezultatul memorat fără a scrie a doua oară'`, `'pull întoarce doar modificările aplicate după cursor, în ordinea seq'`, `'snapshot pe o filială cu date dă 409'`, `'un cursor mai vechi decât istoricul păstrat dă 410'`; integration: `'serverul pornit pe port 0 acceptă pair → push → pull între două tokenuri'`, `'SSE trimite un eveniment după un push'`.

- [ ] `npm run check` green (root runs the server tests too).
- [ ] Commit: `feat(sync-server): push with conflict policy, pull, snapshots and events`

---

## Phase 2 — App: sync tables, outbox capture, device file, HTTP client

### Task 4: Schema, repositories, outbox-recording wrappers

**Files:** create `src/features/sync/README.md`, `sync.types.d.mts`, `index.server.mjs`, `domain/change-coalescing.mjs` (+test), `domain/sync-status.mjs` (+test: derive `{ mode }` for the 14a card, shared with the webapp through the API contract only), `server/sync-outbox.repository.mjs`, `server/sync-state.repository.mjs`, `server/sync-conflicts.repository.mjs`, `server/outbox-recording-repository.mjs`, `*.test.mjs`; modify `src/core/server/database/schema.mjs` (new tables; `CREATE TABLE IF NOT EXISTS` on every open, no migration needed — no data transformation), `src/core/server/persistence/revision-transaction.mjs` (`replaceAllRecords` gets an optional `changeSink` and calls `changeSink.record(type, id, after ?? null)` in the diff loop), `src/features/attendance/server/attendance.repository.mjs` + `attendance.routes.mjs` (optional `onChange({ kind: 'attendance', id: \`${childId}|${date}\`, payload | null })` called inside `applyChanges`'s transaction).

```sql
CREATE TABLE IF NOT EXISTS sync_state(kind TEXT NOT NULL,id TEXT NOT NULL,server_revision INTEGER NOT NULL,updated_at TEXT NOT NULL,updated_by_device TEXT NOT NULL,updated_by_name TEXT NOT NULL DEFAULT '',PRIMARY KEY(kind,id));
CREATE TABLE IF NOT EXISTS sync_outbox(seq INTEGER PRIMARY KEY AUTOINCREMENT,change_id TEXT NOT NULL UNIQUE,kind TEXT NOT NULL,record_id TEXT NOT NULL,base_revision INTEGER NOT NULL,payload TEXT,created_at TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending');
CREATE UNIQUE INDEX IF NOT EXISTS sync_outbox_record ON sync_outbox(kind,record_id) WHERE status='pending';
CREATE TABLE IF NOT EXISTS sync_conflicts(id TEXT PRIMARY KEY,kind TEXT NOT NULL,record_id TEXT NOT NULL,local_payload TEXT,local_updated_at TEXT NOT NULL,remote_payload TEXT,remote_revision INTEGER NOT NULL,remote_updated_at TEXT NOT NULL,remote_device_id TEXT NOT NULL,remote_device_name TEXT NOT NULL,created_at TEXT NOT NULL,outbox_seq INTEGER);
```

`sync-outbox.repository.mjs`: `enqueue({ kind, recordId, payload })` (base_revision from `sync_state` or 0; if a pending row exists for the record, update its payload and `created_at`), `pending(limit)`, `countPending()`, `markSent(seqs)`, `park(seq)`, `unpark(seq, baseRevision)`, `remove(seq)`. `sync-state.repository.mjs`: `get`, `set`, `setMany`. `sync-conflicts.repository.mjs`: `insert`, `list()`, `find`, `remove`, `count`.

`outbox-recording-repository.mjs`: `createOutboxRecordingRepository(raw, outbox, isEnabled)` — same interface as `createRecordRepository`; `save` compares `JSON.stringify(raw.find())` with the new record before enqueueing; `remove` enqueues `payload: null`. `isEnabled()` = `sync.json` exists (before connecting, nothing is queued — the first upload is a snapshot).

Tests: `'save pune în outbox doar când înregistrarea chiar diferă, remove pune o ștergere'`, `'două salvări ale aceleiași fișe rămân un singur rând pending cu ultimul payload și prima revizie de bază'`, `'cu sincronizarea neconfigurată nu se scrie nimic în outbox'`, `'replaceAllRecords trimite în outbox doar diferențele'`, `'prezența notifică onChange în aceeași tranzacție'`.

- [ ] Commit: `feat(sync): sync tables, outbox capture and conflict storage in the branch DB`

---

### Task 5: Device file, HTTP client, wiring into the branch context

**Files:** create `src/features/sync/server/sync-device.repository.mjs` (+test), `server/sync-http-client.mjs` (+test with a fake `fetch`); modify `src/config/environment.mjs` (`SYNC_DEVICE_FILE_NAME = 'sync.json'`), `src/app/server/create-application.mjs` (reads `<home>\sync.json` once into a mutable holder `syncDevice = { read(), write(), clear() }`, passes it to every context), `src/app/server/create-branch-context.mjs` (builds outbox/state/conflicts repositories, wraps the repository, passes `onChange` to attendance routes, exposes `sync: { outbox, state, conflicts, rawRecordRepository }` on the context).

`sync.json`: `{ version: 1, serverUrl, deviceId, deviceName, token, connectedAt }`, written with `writeJsonFileAtomically`; a corrupt file stops startup with a message (same policy as `filiale.json`).

`sync-http-client.mjs`: `createSyncHttpClient({ serverUrl, token, fetch, timeoutMs = 10000 })` → `pair`, `status`, `createPairingCode`, `listDevices`, `revokeDevice`, `listBranches`, `registerBranch`, `uploadSnapshot`, `downloadSnapshot`, `pushChanges`, `pullChanges`, `openEvents(branchId, onSeq)` (uses `fetch` + `ReadableStream` line parsing, `AbortController`). Errors: `SyncNetworkError` (no response / timeout), `SyncRevokedError` (401), `SyncHttpError(status, message)`. Refuses `http://` unless the host is loopback.

Tests: `'fișierul de dispozitiv se scrie atomic și unul corupt oprește pornirea'`, `'clientul refuză http:// spre o adresă care nu e loopback'`, `'401 devine SyncRevokedError, lipsa răspunsului SyncNetworkError'`.

- [ ] `npm run check` green (no behaviour change: nothing configured).
- [ ] Commit: `feat(sync): device identity file and sync HTTP client`

---

## Phase 3 — App: sync engine, local routes, 14a card, startup step

### Task 6: `createSyncEngine` — push, pull, apply, status, timers

**Files:** create `src/features/sync/server/sync-engine.service.mjs` (+ `sync-engine.service.test.mjs` with a fake client, + `sync-engine.integration.test.mjs` against the real server via `#sync-server/create-sync-server.mjs`), `server/change-applier.mjs` (+test).

```js
createSyncEngine({ database, branch, rawRecordRepository, outbox, syncState, conflicts, auditTrail,
                   readSetting, writeSetting, attendanceRepository, client, deviceId, now, onStatus, onRecordsChanged,
                   pollIntervalMs = 15000, pushDebounceMs = 2000 })
→ { start(), stop(), syncNow(), status(), noteLocalChange() }
```

Cycle (`syncNow`, serialized — a second call while running just marks `again`):

1. `push`: `rows = outbox.pending(200)` → `client.pushChanges(branch.id, rows)`; per result: `applied` → `syncState.set(rev, changedAt, me)`, `outbox.remove`; `superseded` → `applier.apply(head)` (raw write + `syncState` + audit `sincronizare de pe <name>`), `outbox.remove`; `conflict` → `conflicts.insert({ local: row.payload, remote: head, outbox_seq })`, `outbox.park`. Repeat while 200 were returned.
2. `pull`: `client.pullChanges(branch.id, since)` → `applier.applyBatch(changes)`: one `BEGIN IMMEDIATE`; skip changes whose `device.id === deviceId`; skip a record that has a parked outbox row (its conflict already holds the newer remote — update the conflict's remote side instead); `normalizeRecord` for `records` kinds (a throw → `lastError = 'Modificare neînțeleasă (versiune veche?)'`, batch rolled back, pull paused until restart); attendance → repository upsert/delete; `sms_templates`/`settings` → Phase 6; `syncState.setMany`; `meta.revision += 1` once if anything was written; `writeSetting('sync.since', nextSince)`; `COMMIT`; `onRecordsChanged(revision)`. Repeat while `nextSince < headSeq`. 410 → `client.downloadSnapshot` → `applier.replaceFromSnapshot` (audit one entry `descărcare de pe server: N înregistrări`).
3. `status.lastSyncedAt = now()`, `connection = 'online'`, `lastError = ''`.

Errors: `SyncNetworkError` → `connection = 'offline'`, backoff (5 s doubling to 60 s); `SyncRevokedError` → `'revoked'`, timers stopped; other → `lastError`, `console.error`. `noteLocalChange()` → debounce push. `start()` = first cycle immediately, poll timer (`unref`), SSE wake via `client.openEvents`. `onStatus` fires on every status change (local SSE fan-out in Task 7).

Tests (fake client): `'un push aplicat golește outbox-ul și scrie revizia în sync_state'`, `'un conflict parchează rândul din outbox și creează un conflict cu ambele variante'`, `'pull aplică modificările altora prin normalizeRecord, sare peste ale mele și crește meta.revision o singură dată'`, `'o eroare de rețea trece în offline cu backoff, 401 în revocat și oprește timerele'`, `'410 reface filiala din snapshot'`. Integration (real server, one app DB): `'push urmat de pull de pe un al doilea dispozitiv aduce aceeași înregistrare'`.

- [ ] Commit: `feat(sync): sync engine — push, pull, apply and status`

---

### Task 7: Local routes, session, wiring, branch switch

**Files:** create `src/features/sync/server/sync.routes.mjs` (+ `sync.routes.integration.test.mjs`); modify `src/app/server/create-branch-context.mjs` (builds the engine when `syncDevice.read()` exists; `start()` after `runStartupSweeps()`; `close()` stops it; the context exposes `sync.engine`), `create-application.mjs` (`selectBranch` already calls `previous.close()` / `next.runStartupSweeps()` — add `next.startSync()` after it; `main.mjs` calls `app.startSync()` after the startup sweeps), `src/app/server/session.routes.mjs` (`/api/session` gains `sync: { configured, deviceName, serverUrl } | null`), `src/core/web/app-session-store.mjs` (`state.sync`, `startupTimings.syncAt` set after `/api/sync/status` answers when configured — the „Sincronizez cu serverul comun” step of 21a; never blocks: offline is a valid answer).

| Route                          | Body                        | Returns                                                                                                      |
| ------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `GET /api/sync/status`         | —                           | `{ configured, serverUrl, deviceName, connection, pending, pushing, lastSyncedAt, conflicts, lastError }`   |
| `GET /api/sync/events`         | —                           | SSE: `status` (the object above) on change, `records-changed { revision }` after a pull; returns `RESPONSE_SENT`; heartbeat 25 s; closed on shutdown/branch switch |
| `POST /api/sync/now`           | `{}`                        | runs `syncNow()`, returns the status                                                                          |

Tests: `'status fără sync.json e configured:false'`, `'events trimite status și records-changed după un pull'`, `'schimbarea filialei oprește motorul vechi și pornește unul pe filiala nouă'` (fake server in-process).

- [ ] Commit: `feat(app): sync engine attached to the active branch; status and events routes`

---

### Task 8: Webapp — `useSyncStatus`, `SyncStatusCard` (14a), reload on incoming changes

**Files:** create `webapp/src/features/sync/useSyncStatus.ts` (+test), `webapp/src/app/shell/sync-status.ts` (+test), `webapp/src/app/shell/SyncStatusCard.tsx` + `.module.css` (+test); modify `webapp/src/shared/api/session.ts` (export `reloadRecords()` = `store.load()` when not `busy`/`pending`/`loading`), `Sidebar.tsx` (`syncStatus?: SyncStatusCardProps` — rendered instead of `SaveStatusCard` when `session.state.sync?.configured`; click → `/backup-si-setari` with `localStorage['view.backup']='sync'`, the `Topbar.goToCursValutar` trick), `AppShell.tsx`, `StartupScreen.tsx` (step „Sincronizez cu serverul comun” when `session.state.sync?.configured`, duration from `startupTimings.syncAt`; offline → „Fără internet — lucrezi cu datele locale”).

`useSyncStatus()`: module-level store like `session.ts`; `EventSource('/api/sync/events')`; on `records-changed` with `revision !== session.state.revision` → `reloadRecords()` (debounced 1 s); fallback poll `GET /api/sync/status` every 10 s when the `EventSource` errors.

`deriveSyncStatus(sync, local: SessionStateForSaveStatus)` → `{ mode: 'synced' | 'syncing' | 'offline' | 'conflict' | 'revoked', label, detail, action? }` exactly as the 14a table: conflicts > 0 → `'conflict'` („N conflicte” / „Aceleași date modificate pe alt calculator.” + „Rezolvă” → `/conflicte`); `connection === 'offline'` → `'offline'` („Fără internet” / „N modificări salvate local. Se trimit automat când revine conexiunea.”); `'revoked'` → yellow card „Deconectat de pe server” / „Reconectează din Backup și setări” (deviation: a fifth text on the yellow style, noted in the commit); `pushing || pending > 0` → `'syncing'` („Se trimit N modificări…” / „Poți lucra în continuare”); else `'synced'` („Sincronizat · HH:MM” / „Toate calculatoarele au aceleași date”). Local `saveError`/`connectionError`/backup errors still win (they are rendered by the existing `SaveStatusCard` styles, `error`). CSS: cream + `--success-dot`; cream + `--yellow` dot; `--yellow-soft` + border `--yellow`; `--pink-soft` + border `--pink`.

Tests: `sync-status.test.ts` — `'cardul derivă cele 4 stări din spec în ordinea conflict > offline > se sincronizează > sincronizat'` (criterion 6); `SyncStatusCard.test.tsx` — `'starea conflict arată contorul și linkul Rezolvă'`; `useSyncStatus.test.ts` — `'records-changed cu altă revizie reîncarcă datele o singură dată'`; `Sidebar.test.tsx` — `'cu sincronizarea configurată cardul de sincronizare înlocuiește „Salvat · ora”'`.

- [ ] Compare at 1440 px with `Sincronizare.dc.html#14a`.
- [ ] `npm run typecheck && npm test` green; `npm run test:e2e` once.
- [ ] Commit: `feat(app): sync status card and live reload of incoming changes`

---

## Phase 4 — Conflicts (14c)

### Task 9: Resolution routes + audit

**Files:** create `src/features/sync/server/sync-conflicts.routes.mjs` (+ integration test), `src/features/sync/domain/conflict-diff.mjs` (+test: `diffFields(kind, local, remote) → [{ field, local, remote, differs }]`, arrays/objects compared by JSON, `healthNotes` shown as `[date medicale]` on both sides unless equal — the same rule as `redactSensitiveFields`).

| Route                                | Body                                            | Returns                                                                                                             |
| ------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `GET /api/sync/conflicts`            | —                                               | `{ conflicts: [{ id, kind, recordId, title, subtitle, localUpdatedAt, remoteUpdatedAt, remoteDeviceName, fields }] }` — `title` via `#shared/domain/record-labels.mjs`, a deleted side has `payload: null` |
| `POST /api/sync/conflicts/resolve`   | `{ id, choice: 'local' \| 'remote', revision, requestId }` | `RevisionEnvelope` — via `runRevisionTransaction(action: 'rezolvare conflict')`                            |

Resolve: `remote` → `raw.save/remove(kind, remote_payload)`, `syncState.set(remote_revision, …)`, `outbox.remove(outbox_seq)`, audit `{ action: 'conflict: păstrată varianta de pe <remote_device_name>', before: local, after: remote }`; `local` → record already local, `outbox.unpark(outbox_seq, remote_revision)`, audit `{ action: 'conflict: păstrată varianta de pe acest calculator', before: remote, after: local }`, `engine.noteLocalChange()`. Both: `conflicts.remove(id)`; the engine emits `status`. A conflict whose record was resolved elsewhere meanwhile (remote revision moved on) is re-evaluated at the next push like any parked row.

Tests: `'păstrarea variantei de pe alt calculator scrie fișa lui, revizia și o intrare în istoric'`, `'păstrarea variantei locale re-trimite modificarea cu revizia serverului și intră în istoric'`, `'diferențele pe câmpuri marchează doar câmpurile care diferă și ascund notele medicale'`.

- [ ] Commit: `feat(sync): conflict list and resolution with audit trail`

---

### Task 10: Webapp — `/conflicte`, nav row + counter

**Files:** create `webapp/src/features/conflicts/ConflictsPage.tsx` + `.module.css` + `.test.tsx`, `ConflictDetail.tsx`, `useConflicts.ts` (+test), `field-labels.ts` (per kind: `name → 'Nume'`, `phone → 'Telefon părinte'`, `groupId → 'Grupă'` rendered as the group name from `session.state.state.groups`, `fee → 'Taxa'` with `formatMoney`, dates with `formatDate`; unknown fields shown by key); modify `webapp/src/shared/view-key.ts` (`'conflicts'`), `app/shell/nav-items.ts` (`{ view: 'conflicts', label: 'Conflicte' }` under „De rezolvat”, `VIEW_TITLES.conflicts = { eyebrow: 'De rezolvat', title: 'Conflicte' }`), `routes.ts` (`conflicts: '/conflicte'`), `Sidebar.tsx` (the row is rendered only when `counts.conflicts > 0`; the marker/counter like the other De rezolvat rows), `AppShell.tsx` (`counts.conflicts` from `useSyncStatus().conflicts`), the router registration in `App.tsx`.

Layout per spec: grid `320px 1fr`; left list card („N conflicte” header, rows with title + „<Tip> · <câmpuri diferite>”, active row `box-shadow: inset 4px 0 0 var(--orange)`); detail: eyebrow „<Tip> · Filiala <name>”, title Baloo 24, the 3-column table (`140px 1fr 1fr`; headers „Pe acest calculator” / „Pe <calculator>” with `formatDateTime` under each), differing rows on `--yellow-soft` with weight 800, note „Rândurile galbene diferă. Celelalte câmpuri sunt identice.”; actions: secondary „Păstrează varianta de pe acest calculator”, primary „Păstrează varianta de pe <calculator>”. A deleted side shows „(ștearsă)” in every cell. After resolving, the next conflict becomes active; empty state „Nu există conflicte.”

Tests: `ConflictsPage.test.tsx` — `'lista și detaliul arată ambele variante cu rândurile diferite evidențiate'` (criterion 3, visible side), `'alegerea unei variante trimite resolve și trece la următorul conflict'`; `Sidebar.test.tsx` — `'rândul Conflicte apare doar cu contor mai mare ca zero'`.

- [ ] Compare at 1440 px with `Sincronizare.dc.html#14c`.
- [ ] Commit: `feat(app): conflicts screen under De rezolvat`

---

## Phase 5 — Connect, first upload, new computer, devices (14b)

### Task 11: `connect` — pairing, branch reconciliation, snapshots

**Files:** create `src/features/sync/server/sync-connect.service.mjs` (+ integration test against the real server), `server/snapshot-io.mjs` (+test: `readLocalSnapshot(db)`, `writeLocalSnapshot(db, snapshot)` — bulk, `sync_state` rows, cursor); modify `src/core/server/branches/branch-registry.mjs` (`adopt(entry: BranchEntry & { folder?: null })` — keeps the given id, computes a unique folder unless `folder: null` is requested; `replaceEmpty(oldId, entry)` swaps the id of the empty legacy branch in place) + test, `sync.routes.mjs` (routes below), `create-application.mjs` (`connectSync` needs the registry, `legacy` dirs and `openBranchContext`; after connect, the active context is re-created so its engine starts).

```
connect({ serverUrl, code | setupKey, deviceName }):
  pair → write sync.json
  server = client.listBranches()
  for local in registry.list():
    if server.has(local.id): if countBranchRecords(local).children+groups+... > 0 → fail('Filiala „X” există deja pe server…', 409); else mark for download
    else if isEmpty(local) (0 records and no kindergarten name) && server has a branch not present locally → registry.replaceEmpty(local.id, serverBranch); mark for download
    else → client.registerBranch(local) + client.uploadSnapshot(local.id, readLocalSnapshot(open(local)))   // „se urcă o singură dată, de pe calculatorul filialei”
  for remaining server branches not local → registry.adopt(branch) → openDatabase(new dirs) → writeLocalSnapshot(downloadSnapshot)
  return { uploaded: [...], downloaded: [...] }
```

Runs synchronously inside the request (branch DBs opened one at a time with `openDatabase`, closed after); the active branch is handled through its context (`replaceFromSnapshot`) and the webapp reloads afterwards. Progress goes to the log; the response lists what happened.

| Route                            | Body                                          | Returns                                     |
| -------------------------------- | --------------------------------------------- | ------------------------------------------- |
| `POST /api/sync/connect`         | `{ serverUrl, code?, setupKey?, deviceName }` | `{ device, uploaded, downloaded, branches }` |
| `POST /api/sync/disconnect`      | `{}`                                          | `{ ok }` — deletes `sync.json`, stops the engine; data stays |
| `POST /api/sync/pairing-codes`   | `{}`                                          | `{ code, expiresAt, serverUrl }`             |
| `GET /api/sync/devices`          | —                                             | `{ devices }` (proxied, `me` marked)        |
| `POST /api/sync/devices/revoke`  | `{ deviceId }`                                | `{ ok }`                                    |
| `GET /api/sync/server`           | —                                             | `{ branches, devices, lastBackupAt }` for the 14b card, `connection` when offline |

Tests (real server in-process, two `startTestApplication` homes): `'primul calculator urcă fiecare filială cu date o singură dată'` (a second connect of the same home is refused per branch with 409 and does not duplicate), `'un calculator nou cu filiala goală preia prima filială de pe server în locul ei și descarcă restul în Filiale\\'` (criterion 1: afterwards `POST /api/branches/select` opens each), `'redenumirea unei filiale ajunge în registrul celuilalt calculator'`.

- [ ] Commit: `feat(sync): connect a computer — pairing, first upload and branch download`

---

### Task 12: Webapp — fila Sincronizare (14b) + connect form (22, minimal)

**Files:** create `webapp/src/features/sync/SyncSettings.tsx` + `.module.css` + `.test.tsx`, `ConnectServerForm.tsx`, `PairingCodeCard.tsx`, `DevicesList.tsx`, `useSyncSettings.ts` (+test); modify `BackupPage.tsx` (`ViewMode` gains `'sync'`, option „Sincronizare” after „Filiale”).

Not configured: a card „Conectează acest calculator la server” with two modes: „Am deja o grădiniță pe alt calculator” (address + 6-digit code) and „Primul calculator” (address + setup key), device name prefilled from `session.state.sync?.suggestedName` (`os.hostname()` returned by `/api/session`); on success a toast „Conectat. Filiale urcate: …, descărcate: …” and `location.reload()`. Configured: the server card (mint; `--yellow-soft` when offline) with „Conectat · sincronizat la HH:MM” or „Fără internet · ultima sincronizare HH:MM”, „Ambele filiale · N calculatoare · ultima copie de siguranță pe server: <formatDateTime>” (branch count from the registry), button „Sincronizează acum” → `POST /api/sync/now`; the „Calculatoare conectate” list (name, „<os> · deschide de obicei Filiala <name>”, dot Sincronizat / „Offline de N zile” from `lastSeenAt`, red „Deconectează” absent on the `me` row, confirmation dialog like `ConfirmDeleteDialog`); „+ Conectează un calculator” → right column card with the address and the code in Baloo 40 + „Codul expiră în 10 minute și poate fi folosit o singură dată.” + „Închide”; the two info cards („Cum funcționează”, „Calculator pierdut sau vândut?”) as in the reference.

Tests: `'fără sync.json apare formularul de conectare cu cod sau cheie'`, `'cardul serverului arată starea, contoarele și ultima copie de siguranță'`, `'Deconectează lipsește pe rândul Acest calculator și cere confirmare pe celelalte'`, `'+ Conectează un calculator cere un cod și îl afișează cu adresa'`.

- [ ] Compare at 1440 px with `Sincronizare.dc.html#14b`.
- [ ] Commit: `feat(app): Sincronizare tab — connect, server card, devices, pairing code`

---

## Phase 6 — Settings & templates sync, receipt blocks, end-to-end, docs

### Task 13: Settings whitelist, SMS templates, receipt blocks

**Files:** modify `src/app/server/create-branch-context.mjs` (`settings.setSetting` wrapped: keys in `SYNCED_SETTINGS = ['kindergarten', 'planPresets']` enqueue `{ kind: 'settings', id: key, payload: { value } }`; the `kindergarten` payload is sent without `nextReceiptNumber`), `src/features/sms-notify/server/sms-template.repository.mjs` (`onChange` hook like attendance), `src/features/sync/server/change-applier.mjs` (`settings` → `writeSettingValue` merging `nextReceiptNumber` back from the local value; `sms_templates` → repository save/remove without `onChange`), `src/features/receipts/server/receipt-numbering.service.mjs` (counter read from setting `receiptBlock` `{ from, to, next }` when sync is configured; `nextReceiptNumber` stays the source when it is not), `src/features/sync/server/sync-engine.service.mjs` (refill: `POST /v1/branches/:id/receipt-block { size: 100 }` when `to - next < 20`; the server keeps `branches.next_receipt_number`, seeded from the uploaded `kindergarten.nextReceiptNumber` at first upload), `sync-server/src/branches.routes.mjs` (+ route, + test).

Tests: `'numele grădiniței și planurile ajung pe celălalt calculator, numărul următor de confirmare nu'`, `'un șablon SMS salvat aici apare dincolo'`, `'două calculatoare primesc blocuri disjuncte de numere de confirmare și tipăresc offline din blocul lor'`.

- [ ] Commit: `feat(sync): synced settings, SMS templates and per-device receipt number blocks`

---

### Task 14: End-to-end test, manual verification, docs, acceptance

**Files:** create `tests/sync-end-to-end.integration.test.mjs` (real `sync-server` on port 0 + two `startTestApplication({ home })` instances; helper `tests/support/start-test-sync-server.mjs`); modify `docs/design/screens/18-sincronizare.md` (tick criteria), `docs/design/INTREBARI.md` (the „Sincronizez”/„Lucrez fără legătură” provisional decision → done), `docs/design/COADA-DE-LUCRU.md` (point 13 done), `docs/arhitectura/README.md` (one paragraph: `sync-server/`, `src/features/sync/`, the three tables, `sync.json`), `scripts/pachet-client/GHID-LIVRARE.md` (how to connect a computer; what `sync.json` is; that a reinstall keeps it), `sync-server/README.md` (deploy recipe for the chosen hosting: env vars, Caddy, backups, restore).

End-to-end test names (one per acceptance criterion): `'de pe orice calculator conectat se deschide oricare filială'`, `'lucrul fără server funcționează; după repornirea serverului modificările ajung pe celălalt calculator'` (stop the server's `listen`, write on both, start again, `POST /api/sync/now` on both, assert `/api/state`), `'aceeași fișă modificată pe două calculatoare produce un conflict vizibil, fără pierdere de date'` (`GET /api/sync/conflicts` has both payloads; resolve each way), `'două achitări simultane se păstrează amândouă și dublurile intră în De verificat'` (`findRecordIssues` on the pulled state contains `Posibil duplicat`), `'un calculator deconectat nu mai primește și nu mai trimite date'` (revoke B from A; B's next cycle → `connection: 'revoked'`, B's `/api/state` unchanged after A writes), `'cardul din meniu arată corect cele 4 stări'` is `sync-status.test.ts` (Task 8).

**Manual end-to-end on one machine** (documented in `sync-server/README.md`):

```
# 1. server (terminal 1)
SYNC_DATA_DIR=C:\tmp\sync-data SYNC_PORT=8790 SYNC_SETUP_KEY=dev node sync-server/src/main.mjs
# 2. build the webapp once, then two app instances with separate homes (terminals 2, 3)
cd webapp && npm run build && cd ..
STARTICA_HOME=C:\tmp\startica-A STARTICA_PORT=8765 npm start
STARTICA_HOME=C:\tmp\startica-B STARTICA_PORT=8766 STARTICA_NO_BROWSER=1 npm start   # open http://127.0.0.1:8766 by hand
# 3. A: Backup și setări → Sincronizare → „Primul calculator” (http://127.0.0.1:8790, dev) → branches uploaded
# 4. A: „+ Conectează un calculator” → code; B: Sincronizare → „Am deja o grădiniță” → address + code → downloads
# 5. edit a child on A → within ~2 s it appears on B; Ctrl+C the server → both cards „Fără internet”; edit the same child on both;
#    start the server → one computer shows „1 conflict” → De rezolvat → Conflicte → resolve → Istoric shows the choice
# 6. A: Deconectează B → B shows „Deconectat de pe server”; further edits on A do not reach B
```

- [ ] `npm run check` (root, includes `sync-server`), `cd webapp && npm run typecheck && npm test`, `npm run test:e2e` green.
- [ ] Manual run above on a copy of the real `%LOCALAPPDATA%\Startica` as home A (nothing changes locally until „Conectează”; revision identical after connect).
- [ ] Commit: `docs: sincronizare — decizii, ghid de livrare, criterii bifate`

---

## Acceptance criteria → where they are proven

| Spec criterion                                                                       | Test / check                                                                                                                                  |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| De pe orice calculator conectat se deschide oricare filială                          | `tests/sync-end-to-end.integration.test.mjs` „de pe orice calculator conectat…”; `sync-connect.service` test „un calculator nou cu filiala goală…” |
| Lucrul offline funcționează; la reconectare modificările ajung pe celelalte calculatoare | e2e „lucrul fără server funcționează…”; `sync-engine.service.test.mjs` „o eroare de rețea trece în offline cu backoff…”                   |
| Modificarea aceleiași fișe pe 2 calculatoare produce un conflict vizibil, fără pierdere de date | e2e „aceeași fișă modificată…”; server „aceeași fișă modificată de două calculatoare dă conflict…”; `ConflictsPage.test.tsx`         |
| Două achitări simultane se păstrează amândouă                                        | e2e „două achitări simultane…”; server „două achitări noi cu id-uri diferite se aplică amândouă”                                             |
| Un calculator deconectat nu mai primește date                                        | e2e „un calculator deconectat…”; server „un calculator revocat primește 401…”                                                                 |
| Cardul din meniu arată corect cele 4 stări                                           | `sync-status.test.ts` „cardul derivă cele 4 stări…”; `SyncStatusCard.test.tsx`; `Sidebar.test.tsx`                                            |

## Compatibility notes

- Nothing in this plan changes an HTTP contract of the existing routes; `/api/session` and `/api/state` only gain fields. A computer that never connects behaves exactly as today (no outbox rows, `SaveStatusCard` unchanged, no timers).
- Backups (`VACUUM INTO`) now contain the three sync tables; restore keeps reading only `records`, so restoring an old backup on a synced branch propagates the differences as normal changes (with conflicts where the server moved on) — documented in `GHID-LIVRARE.md`.
- The Telegram digest (`--telegram`) opens branch DBs read-only and is unaffected; `notify-schedule.json` stays per install.

## Contract reconciliation after Phases 1–2 (27.09.2026)

The server (`sync-server/`, commits 417647a–0b01433) and the app client (`src/features/sync/server/sync-http-client.mjs`, cfa1965) were built in parallel against this plan. The server is the source of truth (see `sync-server/README.md`); Phase 3/5 must align the client:

1. `POST /v1/devices/pair` returns `{ deviceId, token, createdBy }` — **no `branches`**; after pairing the client calls `GET /v1/branches`.
2. Snapshots are flat: upload `POST /v1/branches/:id/snapshot { entries: [{ kind, id, payload, updatedAt }] }` → `{ headSeq }` (409 if the branch already has records); download `GET …/snapshot` → `{ records: { <kind>: [{ id, revision, payload, updatedAt }] }, headSeq }`.
3. `GET /v1/status` returns counts (`branches`, `devices`), not lists.
4. Pull may answer **410** when `since` is older than the retained history → the client re-downloads the snapshot.
5. SSE: `event: change` / `data: {"seq":N}`, heartbeat `: ping` every 25 s; the server flushes headers immediately.
