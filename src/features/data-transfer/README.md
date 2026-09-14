# data-transfer

Import și export complet în Excel (fișierul `.xlsx` cu toate datele, cu fila `Startica_Date` care
permite reimportul exact) și importul istoricului financiar dintr-un export V5 (doar adăugare de
achitări și cheltuieli, fără să atingă fișele copiilor sau operațiunile deja existente).

Modul **dependent de `review-center`**: previzualizarea unui import (local, în browser, și pe server)
are nevoie de `findRecordIssues` pentru avertizările de conținut. Cum feature-urile nu se importă
reciproc, `findRecordIssues` este primit ca parametru de `buildImportReport`, `readWorkbook` și de
rutele/controller-ul de mai jos — composition root-ul îl leagă de `#features/review-center/index.server.mjs`
(server) și `#features/review-center/index.web.mjs` (browser).

## Public API

### `index.server.mjs`

| Export | Rol |
| --- | --- |
| `createDataTransferRoutes({ recordRepository, auditTrail, runRevisionTransaction, replaceAllRecords, readEnvelope, findRecordIssues })` | `POST /api/import-preview`, `POST /api/financial-preview`, `POST /api/financial-import`, `POST /api/import` |
| `readWorkbook(workbook, XLSX, findRecordIssues)` | citește un `.xlsx` (export propriu sau V5), folosit de `scripts/import-v5-history.mjs` |
| `planFinancialHistoryImport(input, currentRecords)` | planul pur de import istoric V5, folosit de `scripts/import-v5-history.mjs` |

Intern, fără export public: `buildImportReport(input, findRecordIssues)` (raportul de previzualizare).

### `index.web.mjs`

| Export | Rol |
| --- | --- |
| `createExcelTransferController({ elements, sessionState, readRecords, requestJson, submitMutation, showNotice, loadXlsx, findRecordIssues })` | leagă butoanele de import/export Excel; întoarce `{}` |
| `loadXLSX` | încarcă la cerere `vendor/xlsx.full.min.js` |

## Dependențe

| Import | De ce |
| --- | --- |
| `#core/server/errors/domain-error.mjs` | `fail()` pentru confirmare lipsă sau greșită |
| `#shared/domain/record-schema.mjs` | `validateState`, `normalizeRecord`, `emptyState`, `CHILD_STATUSES`, `TYPES` |
| `#shared/domain/records-report.mjs` | `summary` pentru raportul de previzualizare |
| `#shared/domain/money.mjs`, `#shared/domain/calendar-month.mjs`, `#shared/domain/payment-allocations.mjs` | totaluri, data curentă pentru numele fișierului exportat, repartizări/metode de plată în fila de export |
| `#shared/format/html-escape.mjs` | randare fără injecție HTML |
| `#shared/ui/records-summary.mjs` | markup-ul comun de rezumat (folosit și la restaurarea unui backup) |
| `#shared/contracts/record-types.mjs`, `#shared/contracts/persistence.mjs`, `#shared/contracts/audit-trail.mjs` | tipuri |
| `node:crypto` (doar `server/financial-history-import.mjs`) | hash-ul care detectează o sursă V5 modificată între reimporturi |
| `web/vendor/xlsx.full.min.js` (vendorizat, încărcat dinamic în browser) | citirea/scrierea fișierelor `.xlsx`; nu e o dependență de pachet, e servit ca fișier static |

## Consumatori

Composition root-ul serverului creează rutele cu `recordRepository`, `auditTrail` și
`runRevisionTransaction`/`replaceAllRecords` din `core`, plus `findRecordIssues` din `review-center`.
Composition root-ul de web creează controller-ul cu elementele DOM ale ecranului de transferuri
(`importButton`, `excelInput`, `importPreview`, `importDialog`, `importConfirm`, `commitImport`,
`exportButton`), `sessionState`-ul comun, `loadXLSX` din `web/xlsx-loader.mjs` și `findRecordIssues`
din `review-center`.

## Structură

```
data-transfer/
├── README.md
├── data-transfer.types.d.mts        # dependențele rutelor și ale controller-ului, ImportReport, FinancialHistoryPlan
├── domain/
│   ├── import-report.mjs            # ★ buildImportReport(input, findRecordIssues) — validare + rezumat + avertizări
│   ├── excel-workbook.mjs           # ★ readWorkbook, exportWorkbook, mapV5ChildStatus
│   └── excel-workbook.test.mjs
├── server/
│   ├── financial-history-import.mjs # ★ planFinancialHistoryImport — plan pur, doar adăugare
│   ├── financial-history-import.test.mjs
│   ├── data-transfer.routes.mjs
│   └── data-transfer.routes.integration.test.mjs
├── web/
│   ├── xlsx-loader.mjs               # încarcă vendor/xlsx.full.min.js la cerere, cu reîncercare la eroare
│   └── excel-transfer.controller.mjs # ★ import/export Excel complet
└── test-support/
    └── financial-history-fixtures.mjs
```

## Decizii

- **`findRecordIssues` e parametru, nu import.** Regulile de graniță interzic un import de la
  `data-transfer` către `review-center`; funcția e injectată de composition root, la fel pe server
  și în browser.
- **Avertizările afișate după import Excel vin din previzualizarea locală, nu din cea de pe server.**
  Serverul revalidează starea primită (`state`), dar controller-ul păstrează `warnings` din
  `readWorkbook` (rulat în browser), pentru că acolo apar și avertizările specifice sursei
  (ID de copil necunoscut, taxă fără dată de aplicare).
- **Importul istoricului financiar nu suprascrie niciodată o operațiune existentă.** O potrivire de
  ID cu digest identic e tratată ca reimport (omisă, idempotent); orice altă coincidență de ID
  oprește tot importul, ca să nu se piardă tăcut o corecție făcută manual.
- **Copilul din sursa V5 se leagă de fișa curentă doar la o potrivire unică** (nume, dată de naștere
  și număr de contract normalizate). Mai multe potriviri sau nicio potrivire opresc importul cu o
  eroare explicită, nu aleg o variantă la întâmplare.

## Teste

```
node --test "src/features/data-transfer/**/*.test.mjs"
```

- `excel-workbook.test.mjs`: export/reimport complet prin XLSX în memorie, refuzul unui export
  necunoscut, fișierul V5 original (dacă există local) și maparea unui statut necunoscut din V5.
  `findRecordIssues` e o funcție-stub (`() => []`) — niciunul dintre aceste teste nu verifică
  avertizările de conținut.
- `financial-history-import.test.mjs`: planul pur — mapare exactă, sume provizorii, reimport
  idempotent, respingerea unei surse modificate sau a unui copil fără corespondență unică.
- `data-transfer.routes.integration.test.mjs`: `startTestApplication`, capătul la capăt HTTP pentru
  importul istoricului financiar (atomic, backup obligatoriu, jurnal, idempotent).
