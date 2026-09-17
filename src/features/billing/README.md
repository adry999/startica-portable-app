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
| `createPaymentStatusView({ elements, readToday, requestRender })` | întoarce `renderPaymentStatus({ month, evaluations })` |
| `createNotifyListView({ elements, readRecords, readToday, requestRender, renderNotifyCount })` | întoarce `renderNotifyList({ month, evaluations, unassignedPaymentHintsByChild })` |

## Cum rămâne decuplat

| Nevoie | Mecanism | Nu |
| --- | --- | --- |
| Obligația lunară, indexul de încasări | `#shared/domain/tuition-obligation.mjs`, `#shared/domain/payment-allocations.mjs` | recalcul propriu al regulilor de facturare |
| Numărul de contract, numele grupei | `#shared/domain/record-labels.mjs` | acces direct la alt feature |
| Contactele părinților | `#shared/format/parent-contacts-format.mjs` | `import … from '#features/children/…'` |
| Semnalul de achitare neasociată | parametrul `unassignedPaymentHintsByChild` (calculat de apelant cu `payment-assignment`) | `import … from '#features/payment-assignment/…'` |
| Contorul din navigație | `renderNotifyCount` injectat | `setNavCount` apelat direct de aici |
| Ziua curentă, instantaneul de date | selectori injectați: `readToday`, `readRecords` | citire din `session` global |

## Structură

```
billing/
├── README.md
├── index.web.mjs
├── domain/
│   ├── month-evaluation.mjs        # evaluateChildrenForMonth
│   └── month-evaluation.test.mjs
└── web/
    ├── payment-status.view.mjs     # ★ „Situația plăților”
    └── notify-list.view.mjs        # ★ „De notificat”
```

## Decizii

- **`evaluateChildrenForMonth` calculează obligația fiecărui copil** din `allChildren` cu un `paymentIndex` + `obligation()` per copil.
- **Randarea păstrează id-urile de tabel** (`statusHead`/`statusPager`, `notifyHead`), pentru ca sortarea și paginarea existente să continue să funcționeze neschimbate.
- Tabelul de notificat nu se paginează — doar „Situația plăților” foloseşte `paginateRows`.

## Teste

```
node --test "src/features/billing/**/*.test.mjs"
```

- Domeniu: `evaluateChildrenForMonth` — toți copiii evaluați, inclusiv arhivați; obligația reflectă achitările existente.
