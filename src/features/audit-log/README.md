# audit-log

Istoricul modificărilor. Fiecare scriere lasă o intrare cu starea dinainte și de după. Ecranul „Istoric” le afișează paginat, cu cele mai noi primele.

Modul **independent**: nu depinde de alt feature, nu publică și nu consumă evenimente.

## Public API

### `index.server.mjs`

| Export | Rol |
| --- | --- |
| `createAuditLogRepository(database)` | `recordChange(change)` implementează portul `AuditTrail`; `readPage({ beforeEntryId })` întoarce `{ entries, nextBeforeEntryId }` |
| `createAuditLogRoutes({ auditLogRepository })` | `GET /api/audit?beforeEntryId=<id>` |

## Dependențe

| Import | De ce |
| --- | --- |
| `#core/server/errors/domain-error.mjs` | `fail()` pentru cursor și acțiune invalide |
| `#core/server/database/schema.mjs` | doar în test: aceeași schemă ca aplicația |
| `#core/web/view-state.mjs` | `ViewStatus`, `describeFailure` |
| `#shared/contracts/record-types.mjs`, `#shared/contracts/audit-trail.mjs` | tipuri |
| `#shared/format/html-escape.mjs`, `#shared/format/date-format.mjs` | randare |

## Consumatori

Composition root-ul serverului (`src/app/server/create-application.mjs`) creează un singur repository și îl injectează ca `auditTrail` în feature-urile care scriu date, de exemplu `payment-assignment`. Feature-urile acelea nu importă `audit-log`.

## Structură

```
audit-log/
├── README.md
├── audit-log.types.d.mts          # AuditEntry, AuditPage, AuditFieldChange
├── index.server.mjs
├── domain/
│   ├── audit-change-diff.mjs      # câmpurile schimbate între before și after (pur)
│   └── audit-change-diff.test.mjs
└── server/
    ├── audit-log.repository.mjs   # ★ acces la date
    ├── audit-log.repository.test.mjs
    └── audit-log.routes.mjs
```

## Decizii

- **Cursor după id, nu `OFFSET`.** O salvare făcută între două pagini nu deplasează rândurile deja afișate și nu produce dubluri. Un rând peste pagină arată dacă mai urmează ceva, fără `COUNT`.
- **Contractul e `?beforeEntryId` cu `{ entries, nextBeforeEntryId }`, deja deserializate** — nu `?offset` cu rânduri brute.
- **View-ul adaugă doar intrările noi,** ca detaliile deja deschise să rămână deschise la „Mai multe”.
- Tabelul `audit_changes` rămâne neschimbat, iar schema aparține lui `core`.

## Teste

```
node --test "src/features/audit-log/**/*.test.mjs"
```

- Repository: SQLite `:memory:` cu schema reală.
- Diff: funcție pură.
