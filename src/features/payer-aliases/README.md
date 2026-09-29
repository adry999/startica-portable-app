# payer-aliases

Plătitori reținuți (decizia 25 sept. 2026, `docs/design/README.md`): perechea plătitor din extrasul
bancar → copil, salvată din ecranul „Asociere achitări” (checkbox „Ține minte plătitorul”,
`11-de-rezolvat.md` §9c) și afișată/ștearsă din fișa copilului (`09-copii-fisa.md`). Consumată de
`suggestChildren` (`#features/payment-assignment/domain/payment-name-matching.mjs`) ca sursă a
motivului „Plătitor reținut”.

Modul **independent**: nu depinde de alt feature, nu publică și nu consumă evenimente.

## Public API

### `index.server.mjs`

| Export | Rol |
| --- | --- |
| `createPayerAliasesRoutes({ recordRepository, auditTrail, runRevisionTransaction })` | `POST /api/payer-alias-delete`, corp `{ id, revision, requestId }` |

Crearea nu are rută proprie: se face prin `POST /api/record` (`type: 'payerAliases'`, `mode:
'create'`), ca orice alt tip din `TYPES` — `record-editing.routes.mjs` respinge silențios (no-op)
o a doua creare cu exact același `alias`+`childId`, ca bifarea repetată a checkbox-ului să nu
dubleze aliasul.

## Dependențe

| Import | De ce |
| --- | --- |
| `#core/server/errors/domain-error.mjs` | `fail()` pentru alias inexistent |

## Structură

```
payer-aliases/
├── README.md
├── payer-aliases.types.d.mts
├── index.server.mjs
└── server/
    └── payer-aliases.routes.mjs       # ★ ștergere directă, fără arhivare
```

## Decizii

- **Fără arhivare.** Un alias e o comoditate de sugestie, nu o înregistrare financiară — ștergerea
  e definitivă și imediată, la fel ca la `groups`/`categories`.
- **Validarea referinței către copil e permisivă la citire** (`validateState`), strictă la scriere
  (`assertRecordReferencesExist`): un backup vechi cu un alias orfan tot se poate restaura, dar nu
  se poate crea un alias nou pentru un copil inexistent.

## Teste

```
node --test "src/features/payer-aliases/**/*.test.mjs"
```

- Rută: `payer-aliases.routes.integration.test.mjs`, pornește serverul real prin
  `#test-support/start-test-application.mjs`.
