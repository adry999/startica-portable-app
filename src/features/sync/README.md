# sync

Sincronizarea datelor între calculatoarele aceleiași grădinițe, prin serverul mic de reconciliere din `sync-server/` (`18-sincronizare.md`). Acest README descrie ce e construit până acum — **Fazele 1-3** ale `docs/superpowers/plans/2026-09-27-sincronizare.md`: tabelele de sincronizare din baza fiecărei filiale, capturarea coadei de modificări (outbox), identitatea de dispozitiv, clientul HTTP și motorul de sincronizare (push/pull/apply/status/timere). Rutele locale (`/api/sync/*`), cardul din meniu (14a) și ecranul de conflicte (14c) sunt Faza 3 continuată / Faza 4+, vezi `src/app/server/` și `webapp/`.

Modul **independent**: nu depinde de alt feature. `attendance` primește un hook opțional (`onChange`) ca să scrie în outbox fără să importe acest feature.

## Public API

### `index.server.mjs`

| Export | Rol |
| --- | --- |
| `createSyncOutboxRepository(database)` | `enqueue`, `pending`, `countPending`, `markSent`, `park`, `unpark`, `remove` pe `sync_outbox` |
| `createSyncStateRepository(database)` | `get`, `set`, `setMany` pe `sync_state` (ultima revizie confirmată de server, per înregistrare) |
| `createSyncConflictsRepository(database)` | `insert`, `list`, `find`, `remove`, `count` pe `sync_conflicts` |
| `createOutboxRecordingRepository(raw, outbox, isEnabled)` | împachetează `RecordRepository` — aceeași interfață, `save`/`remove` scriu și în outbox |
| `createChangeSink({ outbox, isEnabled })` | portul `ChangeSink` (injectat în `runRevisionTransaction` și în modulele cu depozit propriu) |
| `createSyncDeviceRepository(file)` | citește o dată `sync.json`, expune `read`/`write`/`clear` |
| `createSyncHttpClient({ serverUrl, token, fetch })` | clientul către `sync-server/`: pair, status, branches, changes, snapshot, events |
| `createChangeApplier({ rawRecordRepository, attendanceRepository, syncState, auditTrail })` | aplică o modificare primită de pe server (pull sau capul după un push „superseded”) prin depozitul brut, niciodată prin cel cu outbox |
| `createSyncAttendanceWriter(database)` | scrie prezența primită de pe server direct pe `attendance`, fără tranzacție proprie și fără `onChange` |
| `createSyncEngine({ ... })` | motorul unei filiale: `start/stop/syncNow/status/noteLocalChange` — push, pull, aplicare, backoff la offline, oprire la 401 |
| `deriveSyncMode(status)` | starea pură a cardului 14a (`{ mode }`), din obiectul de stare al motorului |

## Dependențe

| Import | De ce |
| --- | --- |
| `#core/server/files/json-file.mjs` | scriere atomică pentru `sync.json` |
| `#core/server/database/schema.mjs` | doar în test: aceeași schemă ca aplicația |
| `#shared/contracts/persistence.d.mts`, `#shared/contracts/change-sink.d.mts` | tipuri (porturile pe care le implementează acest feature) |

## Consumatori

Composition root-ul serverului (`src/app/server/create-application.mjs`, `create-branch-context.mjs`) construiește repository-urile, împachetează depozitul de înregistrări și trece un `onChange` la `attendance`. Niciun alt feature nu importă `sync`.

## Structură

```
sync/
├── README.md
├── sync.types.d.mts
├── index.server.mjs
├── domain/
│   ├── change-coalescing.mjs      # ce rămâne dintr-un rând pending suprascris de o a doua modificare
│   ├── change-coalescing.test.mjs
│   ├── sync-status.mjs            # deriveSyncMode — starea cardului 14a, pură
│   └── sync-status.test.mjs
└── server/
    ├── sync-outbox.repository.mjs
    ├── sync-outbox.repository.test.mjs
    ├── sync-state.repository.mjs
    ├── sync-state.repository.test.mjs
    ├── sync-conflicts.repository.mjs
    ├── sync-conflicts.repository.test.mjs
    ├── outbox-recording-repository.mjs
    ├── outbox-recording-repository.test.mjs
    ├── sync-device.repository.mjs
    ├── sync-device.repository.test.mjs
    ├── sync-http-client.mjs
    ├── sync-http-client.test.mjs
    ├── change-applier.mjs             # createChangeApplier + createSyncAttendanceWriter
    ├── change-applier.test.mjs
    ├── sync-engine.service.mjs        # createSyncEngine — push, pull, apply, status, timere
    ├── sync-engine.service.test.mjs
    └── sync-engine.service.integration.test.mjs   # împotriva sync-server/ real, pe port 0
```

## Decizii

- **Outbox capturat prin împachetarea repository-ului, nu prin trigger SQL sau evenimente.** `createOutboxRecordingRepository` are exact interfața lui `createRecordRepository`; `runRevisionTransaction` scrie deja în interiorul unui `BEGIN IMMEDIATE`, deci scrierea în `sync_outbox` e atomică cu scrierea înregistrării, fără cod nou în tranzacție.
- **Un singur rând pending per `(kind,id)`** (`sync_outbox_record`, index unic condiționat de `status='pending'`): o a doua modificare, încă netrimisă, actualizează payload-ul rândului existent și păstrează prima `base_revision` (`domain/change-coalescing.mjs`) — acesta e numărul „N modificări” din 14a.
- **`isEnabled()` = `sync.json` există.** O instalare neconectată nu scrie niciun rând în outbox și nu pornește niciun timer — comportament identic cu astăzi. Primul upload e un snapshot (Faza 5), nu outbox-ul.
- **`sync.json` corupt oprește pornirea**, cu același tratament ca `filiale.json`: nu se poate reconstrui în tăcere fără să rișcăm un token deja emis de server.
- **Clientul HTTP refuză `http://` spre orice adresă care nu e loopback** — datele sunt ale copiilor; `https://` e obligatoriu în afara dezvoltării locale.
- **Modificările primite de pe server (pull, sau capul după un push „superseded”/conflict rezolvat) se aplică mereu prin depozitul brut** (`change-applier.mjs`), niciodată prin `createOutboxRecordingRepository` — altfel o modificare venită de pe alt calculator s-ar întoarce în propria coadă de trimis. Prezența primită de pe server nu trece prin `attendance.repository.mjs` (acel depozit își gestionează singur `BEGIN IMMEDIATE` per lot, ceea ce nu se poate imbrica în tranzacția motorului) — `createSyncAttendanceWriter` scrie direct pe tabel.
- **Motorul serializează `syncNow()`**: un al doilea apel cât timp unul rulează deja doar marchează „mai rulează o dată”, nu pornește un al doilea ciclu în paralel. O eroare de rețea trece în `offline` cu backoff (5 s → 60 s, dublat la fiecare eșec); un 401 trece în `revoked` și oprește toate timerele (SSE, polling, backoff) — Faza 5 reconstruiește motorul la reconectare.
- **`start()`/`stop()` sunt singurele care pornesc timere reale** (polling, SSE); `syncNow()` apelat direct (rute locale, teste) nu programează niciun backoff dacă motorul nu a fost pornit — evită timere „fantomă” într-un motor construit dar niciodată pornit.

## Teste

```
node --test "src/features/sync/**/*.test.mjs"
```

- Repository-urile: SQLite `:memory:` cu schema reală.
- `outbox-recording-repository`: cu un `RecordRepository` real, nu un fals — comportamentul „scrie mereu, coadă doar dacă diferă” se verifică pe date reale.
- Clientul HTTP: cu un `fetch` fals, fără server real (serverul e construit concurent, în `sync-server/`).
