# report

Agregările pentru „Raport contabil” (ecran 19a, doar citire) și pentru exportul
pentru contabil (19b): perioada (lună / trimestru / an), totalurile de
încasări/cheltuieli/sold, repartizarea pe metodă și pe categorie, lista
achitărilor cu taxă în EUR și tabelul „Pe zile”.

Modul **independent**: nu importă alt feature. Achitările, cheltuielile și
copiii vin din `RecordsSnapshot`, nu din alt feature.

## Public API

### `index.web.mjs`

| Export | Rol |
| --- | --- |
| `reportPeriodBounds(kind, anchorMonth)` | granițele (`from`/`to`) și eticheta perioadei, pentru `kind` `'month' \| 'quarter' \| 'year'` |
| `buildAccountingReport(records, period)` | toate agregările ecranului, calculate din același `paymentRows`/`expenseRows` care alimentează și exportul Excel — totalurile de pe ecran sunt garantat suma rândurilor din Excel |

## Cum rămâne decuplat

| Nevoie | Mecanism | Nu |
| --- | --- | --- |
| Sumele, cents | `#shared/domain/money.mjs` | rotunjire proprie |
| Tenders/allocations ale unei achitări | `#shared/domain/payment-allocations.mjs` | recitirea `payment.method`/`payment.amount` direct |
| Numele copilului/plătitorului | `#shared/domain/record-labels.mjs` | acces direct la feature-ul `children` |
| Bucketing-ul categoriilor de cheltuieli (cele 5 uzuale) | duplicat local (`CATEGORY_BUCKETS`), documentat în cod | `import … from '#features/expenses/…'` sau din feature-ul de webapp `expenses` (interzis: feature→feature) |
| Culoarea/tonul unei categorii sau metode (UI) | calculat în `webapp/src/features/report` | domeniul nu cunoaște `BadgeTone` |

## Structură

```
report/
├── README.md
├── index.web.mjs
└── domain/
    ├── accounting-report.mjs       # reportPeriodBounds, buildAccountingReport
    └── accounting-report.test.mjs
```

## Teste

```
node --test "src/features/report/**/*.test.mjs"
```

- Totalurile ecranului (`income`, `expense`) sunt suma rândurilor (`paymentRows`, `expenseRows`) folosite și de exportul Excel.
- Achitările arhivate nu intră; cele neasociate (fără copil) intră.
- Suma EUR (`amountEur`) vine din achitare, nu se recalculează cu cursul de azi.
