# billing

Obligația de plată lunară a fiecărui copil: tabelul „Situația plăților” (toți copiii, inclusiv arhivați) și lista „De notificat” (copiii cu rest de plată, nearhivați).

Modul **independent**: nu importă alt feature. Achitările, grupele și indicii de asociere neasociată vin din `RecordsSnapshot` / parametri, nu din alt feature.

## Public API

### `index.server.mjs`

| Export | Rol |
| --- | --- |
| `evaluateChildrenForMonth(records, month, asOf)` | evaluează obligația fiecărui copil pe o lună, cu indexul de încasări calculat o singură dată; consumat și de rezumatul zilnic Telegram (`src/app/server/telegram-digest.mjs`) |

### `index.web.mjs`

| Export | Rol |
| --- | --- |
| `evaluateChildrenForMonth(records, month, asOf)` | aceeași funcție, reexportată pentru ecranele web |
| `schoolYearStartOf`, `schoolYearMonths`, `schoolYearLabel`, `evaluateChildrenForSchoolYear` | calendarul anului școlar + evaluarea pe 12 luni cu un singur index |
| `toMdlToday`, `summarizeMonthStatus`, `heatCellKind`, `summarizeSchoolYear` | cardurile Situației plăților și celulele hărții |

## Cum rămâne decuplat

| Nevoie | Mecanism | Nu |
| --- | --- | --- |
| Obligația lunară, indexul de încasări | `#shared/domain/tuition-obligation.mjs`, `#shared/domain/payment-allocations.mjs` | recalcul propriu al regulilor de facturare |
| Numărul de contract, numele grupei | `#shared/domain/record-labels.mjs` | acces direct la alt feature |
| Contactele părinților | `#shared/format/parent-contacts-format.mjs` | `import … from '#features/children/…'` |
| Mesajul de reamintire | `#shared/domain/sms-template.mjs` (folosit și de sms-notify) | șablon propriu în billing |
| Semnalul de achitare neasociată | parametrul `unassignedPaymentHintsByChild` (calculat de apelant cu `payment-assignment`) | `import … from '#features/payment-assignment/…'` |
| Contorul din navigație | `renderNotifyCount` injectat | `setNavCount` apelat direct de aici |
| Ziua curentă, instantaneul de date | selectori injectați: `readToday`, `readRecords` | citire din `session` global |

## Structură

```
billing/
├── README.md
├── index.web.mjs
└── domain/
    ├── month-evaluation.mjs        # evaluateChildrenForMonth
    ├── month-evaluation.test.mjs
    ├── school-year-evaluation.mjs  # calendarul anului școlar + evaluarea pe 12 luni
    ├── school-year-evaluation.test.mjs
    ├── status-summary.mjs          # cardurile Situației + heatCellKind
    └── status-summary.test.mjs
```

## Decizii

- **`evaluateChildrenForMonth` calculează obligația fiecărui copil** din `allChildren` cu un `paymentIndex` + `obligation()` per copil.
- Sumele pe mai mulți copii se convertesc în lei la cel mai recent curs (proiecție), per `16-planuri-eur.md` regula 9; un rând de copil rămâne în moneda lui.
- **Randarea păstrează id-urile de tabel** (`statusHead`/`statusPager`, `notifyHead`), pentru ca sortarea și paginarea existente să continue să funcționeze neschimbate.
- Tabelul de notificat nu se paginează — doar „Situația plăților” foloseşte `paginateRows`.

## Teste

```
node --test "src/features/billing/**/*.test.mjs"
```

- Domeniu: `evaluateChildrenForMonth` — toți copiii evaluați, inclusiv arhivați; obligația reflectă achitările existente.
