# payments

Achitările copiilor: lista „Achitări” (filtre, totaluri pe metode, arhivare în masă), câmpurile achitării în editorul generic din `record-editing` și repartizarea pe luni.

Modul **independent**: nu importă alt feature. Copiii vin din `RecordsSnapshot`; câmpurile din editor implementează structural interfața `RecordEditorFields` și sunt injectate de `src/app/web/main.mjs`.

## Public API

### `index.web.mjs`

| Export | Rol |
| --- | --- |
| `createPaymentsListView({ elements, readRecords, submitMutation, showNotice })` | lista „Achitări”; `render()` reface și opțiunile filtrului de copil, filtrele și sortarea redesenează doar rândurile |
| `paymentEditorFields` | `{ idPrefix: 'PAY', title, markup, bind, read }` pentru dialogul generic de editare |

Intern: `web/allocation-rows.mjs` (`addAllocationRow`, `readAllocationRows`, `renderAllocationBalance`), folosit de câmpurile din editor.

## Structură

```
payments/
├── README.md
├── index.web.mjs
└── web/
    ├── payments-list.view.mjs      # ★ lista „Achitări”
    ├── payment-editor-fields.mjs   # ★ câmpurile achitării în editor
    └── allocation-rows.mjs         # repartizarea pe luni: rânduri, sold, +Lună
```

## Dependențe

| Import | De ce |
| --- | --- |
| `#shared/domain/record-schema.mjs` | `normalizeRecord('payments', …)` |
| `#shared/domain/{money,payment-allocations,tuition-obligation,record-labels}.mjs` | sume, repartizări, metode de plată, prima lună neachitată, numele copilului |
| `#shared/format/*` | randare (bani, date, metode de plată, căutare fără diacritice) |
| `#shared/ui/{form-fields,child-picker,record-actions,pagination,bulk-selection,record-list-*}.mjs` | markup comun, liste și selecție |

## Teste

Mecanica listei (sortare, căutare, totaluri pe metode, selecția în masă) are teste în `src/shared/ui/*.test.mjs`. Salvarea achitărilor e acoperită de `record-editing.routes.integration.test.mjs`, iar ecranul, de browser smoke.
