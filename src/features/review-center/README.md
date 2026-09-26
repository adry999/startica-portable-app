# review-center

„De verificat” adună fișele și achitările cu probleme — taxă sau grupă lipsă, achitări fără copil, posibile dubluri, sume provizorii sau potriviri automate de import — grupate pe înregistrare, filtrabile și căutabile.

Modul **independent**: nu depinde de alt feature, nu publică și nu consumă evenimente. Primește instantaneul de date (`RecordsSnapshot`) prin parametru, nu prin `session` globală.

## Public API

### `index.server.mjs`

| Export | Rol |
| --- | --- |
| `findRecordIssues(records)` | regulile de verificare, pe fișă și pe achitare (pur) |

### `index.web.mjs`

| Export | Rol |
| --- | --- |
| `buildReviewCenter(records)` | grupează problemele pe înregistrare, cu progresul verificărilor de import |
| `findRecordIssues(records)` | ca mai sus |

## Dependențe

| Import | De ce |
| --- | --- |
| `#shared/domain/money.mjs`, `#shared/domain/payment-allocations.mjs`, `#shared/domain/record-schema.mjs` | reguli de verificare (`cents`, `allocations`, `STATUS_HISTORY_VALUES`) |
| `#shared/domain/record-labels.mjs` | `childNameOf`, `groupNameOf` — etichetele afișate pe rând |
| `#shared/ui/record-actions.mjs` | `recordActionButton` — butoanele „Editează” / „Confirmă asocierea” |
| `#shared/ui/pagination.mjs` | `paginateRows` — paginarea listei |
| `#shared/format/html-escape.mjs`, `#shared/format/money-format.mjs`, `#shared/format/date-format.mjs` | randare |

## Structură

```
review-center/
├── README.md
├── review-center.types.d.mts       # RecordIssue, ReviewItem, ReviewCenter, ReviewFilter
├── index.server.mjs
├── index.web.mjs
└── domain/
    ├── record-issues.mjs           # findRecordIssues
    ├── record-issues.test.mjs
    ├── review-center.mjs           # buildReviewCenter, filterReviewItems, REVIEW_FILTERS
    └── review-center.test.mjs
```

## Decizii

- **`buildReviewCenter` se calculează o singură dată pe ciclu de randare** și se transmite atât view-ului de aici, cât și cardurilor din Dashboard, ca ambele să vadă aceleași date fără să recalculeze.
- **Randarea păstrează structura `<div id="reviewPager">...</div><div id="reviewRows">...</div>`**, ca CSS-ul și testul de fum din browser să rămână valabile.

## Teste

```
node --test "src/features/review-center/**/*.test.mjs"
```

- Domain: funcții pure, fără mock-uri.
