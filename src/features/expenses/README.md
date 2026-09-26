# expenses

Cheltuielile administrației: lista, editorul și categoriile folosite ca sugestii la completare. Categoria e doar o etichetă text (fără cheie străină), deci ștergerea unei categorii nu schimbă cheltuielile care o folosesc deja.

Modul **independent**: nu depinde de alt feature, nu publică și nu consumă evenimente.

## Public API

### `index.server.mjs`

| Export | Rol |
| --- | --- |
| `createExpenseCategoriesRoutes(dependencies)` | `POST /api/category-delete` |

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
├── domain/
│   ├── expense-category-names.mjs      # DEFAULT_EXPENSE_CATEGORIES, listExpenseCategoryNames
│   └── expense-category-names.test.mjs
└── server/
    └── expense-categories.routes.mjs   # ★ ștergere, fără verificare de ocupare
```

## Decizii

- **Fără dependință de `groups`.** Cele două ecrane nu au nimic în comun în domeniu.
- Contractul HTTP al `/api/category-delete` rămâne neschimbat la migrare.

## Teste

```
node --test "src/features/expenses/**/*.test.mjs"
```

- Domeniu: `expense-category-names.test.mjs`, funcție pură.
- Rută: `expense-categories.routes.integration.test.mjs`, pornește serverul real prin `#test-support/start-test-application.mjs`.
