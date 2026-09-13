# review-center

„De verificat” adună fișele și achitările cu probleme — taxă sau grupă lipsă, achitări fără copil, posibile dubluri, sume provizorii sau potriviri automate de import — grupate pe înregistrare, filtrabile și căutabile.

Modul **independent**: nu depinde de alt feature, nu publică și nu consumă evenimente. Primește instantaneul de date (`RecordsSnapshot`) prin parametru, nu prin `session` globală.

## Public API

### `index.server.mjs`

| Export | Rol |
| --- | --- |
| `findRecordIssues(records)` | regulile de verificare, pe fișă și pe achitare (pur) |
| `buildReviewCenter(records)` | grupează problemele pe înregistrare, cu progresul verificărilor de import |

### `index.web.mjs`

| Export | Rol |
| --- | --- |
| `REVIEW_FILTERS` | lista `[valoare, etichetă]` pentru selectul de filtru |
| `buildReviewCenter(records)` | ca mai sus |
| `filterReviewItems(center, filter, search)` | filtrează itemii centrului după categorie și text |
| `findRecordIssues(records)` | ca mai sus |
| `createReviewCenterView({ elements, readRecords })` | întoarce `renderReviewCenter(center)` |

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
├── domain/
│   ├── record-issues.mjs           # findRecordIssues (fost issues(), din shared/domain.mjs)
│   ├── record-issues.test.mjs
│   ├── review-center.mjs           # buildReviewCenter, filterReviewItems, REVIEW_FILTERS
│   └── review-center.test.mjs      # din tests/review-center.test.mjs
└── web/
    └── review-center.view.mjs      # portat din web/ui/review.mjs
```

## Decizii

- **Mutare fără schimbare de logică.** `findRecordIssues` este exact `issues(s)` din `shared/domain.mjs`, iar `buildReviewCenter`/`filterReviewItems` sunt `reviewCenter`/`filteredReviewItems` din `shared/review-center.mjs`, doar redenumite și cu parametrul de stare primit explicit în loc de citit din `session`.
- **Până la pasul 10**, `render()` din legacy calculează centrul o singură dată pe ciclu de randare și îl transmite atât view-ului de aici, cât și cardurilor din Dashboard, ca ambele să vadă aceleași date fără să recalculeze `buildReviewCenter`.
- **Randarea rămâne identică** cu `renderReview`/`reviewRow` de dinainte, byte cu byte, inclusiv structura `<div id="reviewPager">...</div><div id="reviewRows">...</div>`, pentru ca CSS-ul și testul de fum din browser să nu observe migrarea.

## Teste

```
node --test "src/features/review-center/**/*.test.mjs"
```

- Domain: funcții pure, fără mock-uri.
