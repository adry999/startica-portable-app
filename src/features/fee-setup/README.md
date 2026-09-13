# fee-setup

Ecranul „Taxe și grupe”: completarea în masă a taxei, grupei și statutului pentru copiii importați fără fișă completă. Fără ea, un copil rămâne „De verificat” la nesfârșit — nicio obligație nu i se poate calcula și nu apare pe lista de notificat.

Modul **independent**: nu importă alt feature. Depinde de `groups` doar prin datele din `RecordsSnapshot` (lista de grupe vine cu restul înregistrărilor), nu printr-un import direct al feature-ului `groups`.

## Public API

### `index.server.mjs`

| Export | Rol |
| --- | --- |
| `applyChildFeeSetup(child, setup)` | regula pură: scrie taxa/grupa/statutul în istoric pe luna dată |
| `createFeeSetupRoutes({ recordRepository, auditTrail, runRevisionTransaction })` | `POST /api/children-setup`, cu corpul neschimbat: `{ updates: [{ id, from, fee?, groupId?, status? }], revision, requestId }` |

### `index.web.mjs`

| Export | Rol |
| --- | --- |
| `hasMissingFee(child)` | copilul nu are niciun istoric de taxă |
| `createFeeSetupController({ elements, readRecords, readToday, submitMutation, showNotice, renderMissingFeeCount })` | întoarce `{ render }`; leagă filtrul, completarea în masă și salvarea la crearea sa |

## Cum rămâne decuplat

| Nevoie | Mecanism | Nu |
| --- | --- | --- |
| Scriere în istoric | port `AuditTrail`, injectat de `app/` și implementat de `audit-log` | `import … from '#features/audit-log/…'` |
| Revizie, idempotență, backup înainte | port `RunRevisionTransaction` din `core` | acces direct la SQLite |
| Lista de grupe pentru select | vine cu `RecordsSnapshot`, citit prin `readRecords` | `import … from '#features/groups/…'` |
| Datele curente și ziua curentă | selectori injectați: `readRecords`, `readToday` | citire din `session` global |
| Anunț de succes/eroare | `showNotice` injectat | apel direct la un banner global |

## Structură

```
fee-setup/
├── README.md
├── index.server.mjs
├── index.web.mjs
├── domain/
│   ├── child-fee-setup.mjs                       # applyChildFeeSetup, hasMissingFee, defaultSetupMonth
│   └── child-fee-setup.test.mjs
├── server/
│   ├── fee-setup.routes.mjs                      # ★ validare și scriere în tranzacție
│   └── fee-setup.routes.integration.test.mjs     # din tests/fixes.test.mjs
└── web/
    ├── fee-setup.view.mjs                        # portat din web/ui/fees.mjs (rânduri, opțiuni de grupă)
    └── fee-setup.controller.mjs                  # ★ filtrare, completare în masă, salvare
```

Până la rewire-ul din `web/app.js` și `server/routes.mjs`, ruta `/api/children-setup` rămâne servită de `server/routes.mjs`, care apelează încă `applyChildSetup` din `shared/domain.mjs`.

## Garanții

- Verificarea formei listei (`updates` gol, prea mare sau ne-array) se face **înainte** de tranzacție (400). Verificările pe fiecare fișă, inclusiv duplicatele, rulează **în tranzacție**.
- Un id inexistent oprește toată operațiunea: nimic nu se scrie pe jumătate (409).
- O singură revizie acoperă toate fișele dintr-o cerere, cu backup înainte (acțiunea `completare-taxe`) și câte o intrare de audit (`completare taxe și grupe`) per fișă.
- Un câmp netrimis într-o completare nu suprascrie valoarea existentă a fișei.

## Teste

```
node --test "src/features/fee-setup/**/*.test.mjs"
```

- Domeniu: reguli pure pentru `applyChildFeeSetup`, `hasMissingFee`, `defaultSetupMonth`.
- Integrare: `startTestApplication`, server real, aceleași asigurări ca înainte de mutare.
