# sync

Sincronizarea datelor între calculatoarele aceleiași grădinițe, prin serverul mic de reconciliere din `sync-server/` (`18-sincronizare.md`). Acest README descrie doar ce e construit până acum — **Fazele 1-2** ale `docs/superpowers/plans/2026-09-27-sincronizare.md`: tabelele de sincronizare din baza fiecărei filiale, capturarea coadei de modificări (outbox), identitatea de dispozitiv și clientul HTTP. Motorul de sincronizare, rutele locale, cardul din meniu și ecranul de conflicte sunt Fazele 3+, nu sunt construite încă.

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
    └── sync-http-client.test.mjs
```

## Decizii

- **Outbox capturat prin împachetarea repository-ului, nu prin trigger SQL sau evenimente.** `createOutboxRecordingRepository` are exact interfața lui `createRecordRepository`; `runRevisionTransaction` scrie deja în interiorul unui `BEGIN IMMEDIATE`, deci scrierea în `sync_outbox` e atomică cu scrierea înregistrării, fără cod nou în tranzacție.
- **Un singur rând pending per `(kind,id)`** (`sync_outbox_record`, index unic condiționat de `status='pending'`): o a doua modificare, încă netrimisă, actualizează payload-ul rândului existent și păstrează prima `base_revision` (`domain/change-coalescing.mjs`) — acesta e numărul „N modificări” din 14a.
- **`isEnabled()` = `sync.json` există.** O instalare neconectată nu scrie niciun rând în outbox și nu pornește niciun timer — comportament identic cu astăzi. Primul upload e un snapshot (Faza 5), nu outbox-ul.
- **`sync.json` corupt oprește pornirea**, cu același tratament ca `filiale.json`: nu se poate reconstrui în tăcere fără să rișcăm un token deja emis de server.
- **Clientul HTTP refuză `http://` spre orice adresă care nu e loopback** — datele sunt ale copiilor; `https://` e obligatoriu în afara dezvoltării locale.

## Teste

```
node --test "src/features/sync/**/*.test.mjs"
```

- Repository-urile: SQLite `:memory:` cu schema reală.
- `outbox-recording-repository`: cu un `RecordRepository` real, nu un fals — comportamentul „scrie mereu, coadă doar dacă diferă” se verifică pe date reale.
- Clientul HTTP: cu un `fetch` fals, fără server real (serverul e construit concurent, în `sync-server/`).
