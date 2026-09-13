# expenses

Cheltuielile administrației: lista, editorul și categoriile folosite ca sugestii la completare. Categoria e doar o etichetă text (fără cheie străină), deci ștergerea unei categorii nu schimbă cheltuielile care o folosesc deja.

Modul **independent**: nu depinde de alt feature, nu publică și nu consumă evenimente.

> Migrare în doi pași: acest README acoperă doar partea de categorii, portată acum. Lista de cheltuieli și câmpurile din editor (`web/ui/expenses.mjs`, `web/ui/editor.mjs`) se mută la pasul următor din plan.

## Public API

### `index.server.mjs`

| Export | Rol |
| --- | --- |
| `createExpenseCategoriesRoutes({ recordRepository, auditTrail, runRevisionTransaction })` | `POST /api/category-delete`, cu corpul neschimbat: `{ id, revision, requestId }` |

### `index.web.mjs`

| Export | Rol |
| --- | --- |
| `createExpenseCategoriesController({ elements, readRecords, submitMutation, showNotice })` | întoarce `{ render }`; randează chip-urile de categorii și opțiunile filtrului de cheltuieli |
| `listExpenseCategoryNames(records)` | sugestii implicite + categorii proprii + nume folosite deja de cheltuieli, deduplicate și sortate `ro` |

## Dependențe

| Import | De ce |
| --- | --- |
| `#core/server/errors/domain-error.mjs` | `fail()` pentru categorie inexistentă |
| `#shared/contracts/persistence.mjs`, `#shared/contracts/audit-trail.mjs`, `#shared/contracts/record-types.mjs` | tipuri |
| `#shared/format/html-escape.mjs` | randare |

## Structură

```
expenses/
├── README.md
├── expenses.types.d.mts
├── index.server.mjs
├── index.web.mjs
├── domain/
│   ├── expense-category-names.mjs      # DEFAULT_EXPENSE_CATEGORIES, listExpenseCategoryNames (fost expenseCategories)
│   └── expense-category-names.test.mjs
├── server/
│   └── expense-categories.routes.mjs   # ★ ștergere, fără verificare de ocupare
└── web/
    └── expense-categories.controller.mjs   # ★ portat din renderCategories/bindCategories
```

## Decizii

- **Fără dependință de `groups`.** Cele două ecrane porneau din același fișier legacy (`web/ui/groups-categories.mjs`), dar nu au nimic în comun în domeniu.
- Contractul HTTP al `/api/category-delete` rămâne neschimbat la migrare.

## Teste

```
node --test "src/features/expenses/**/*.test.mjs"
```

- Domeniu: `expense-category-names.test.mjs`, funcție pură.
- Rută: `expense-categories.routes.integration.test.mjs`, pornește serverul real prin `#test-support/start-test-application.mjs`.
