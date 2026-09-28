# expenses

Cheltuielile administrației: lista, editorul și categoriile. Fiecare categorie e o
înregistrare reală (`categories`), nu doar o sugestie de completare — poate fi
redenumită sau ștearsă din managerul de categorii al ecranului. „General” e categoria
de rezervă: semănată o singură dată per filială, nu poate fi ștearsă sau redenumită și
e destinația cheltuielilor rămase fără categorie (implicitul unei cheltuieli noi și
locul unde ajung cheltuielile unei categorii șterse).

Modul **independent**: nu depinde de alt feature, nu publică și nu consumă evenimente.

## Public API

### `index.server.mjs`

| Export | Rol |
| --- | --- |
| `createExpenseCategoriesRoutes(dependencies)` | `POST /api/category-delete`, `POST /api/category-rename`; seamănă categoriile implicite la construcție |

## Dependențe

| Import | De ce |
| --- | --- |
| `#core/server/errors/domain-error.mjs` | `fail()` pentru categorie inexistentă, „General” protejată |
| `#shared/domain/record-integrity.mjs` | `assertUniqueName()` la redenumire |
| `#shared/domain/expense-categories.mjs` | `GENERAL_CATEGORY_ID`/`GENERAL_CATEGORY_NAME`, semințele implicite — trăiesc în shared, nu aici, ca `upgradeSnapshot()` (import, restaurare) să le poată aplica fără să încalce granița „shared nu importă features” |
| `#shared/contracts/persistence.mjs`, `#shared/contracts/audit-trail.mjs`, `#shared/contracts/record-types.mjs` | tipuri |

## Structură

```
expenses/
├── README.md
├── expenses.types.d.mts
├── index.server.mjs
├── domain/
│   ├── expense-category-names.mjs      # listExpenseCategoryNames() (re-exportă GENERAL_* din shared)
│   ├── expense-category-names.test.mjs
│   ├── canonical-category-name.mjs     # potrivire fără diacritice la scrierea unei categorii
│   └── canonical-category-name.test.mjs
└── server/
    ├── expense-categories.routes.mjs         # ★ ștergere + mutare la General, redenumire + propagare
    ├── expense-categories.routes.integration.test.mjs
    ├── expense-category-seeding.mjs          # seamănă implicitele + migrează numele doar-pe-cheltuieli
    └── expense-category-seeding.test.mjs
```

Semințele propriu-zise (`DEFAULT_EXPENSE_CATEGORY_SEEDS`, `missingDefaultCategorySeeds`,
`missingExpenseOnlyCategorySeeds`) stau în `#shared/domain/expense-categories.mjs` — vezi
README-ul de acolo pentru motiv.

## Decizii

- **Toate categoriile sunt înregistrări reale.** `expense-category-seeding.mjs` seamănă
  cele 7 categorii implicite (Chirie, Utilități, Salarii, Materiale educaționale,
  Alimente, Reparații și întreținere, Altele) + „General” la construcția rutelor
  (echivalent cu prima deschidere a filialei), cu id-uri fixe (`CAT-chirie`, …,
  `CAT-general`) — două calculatoare care le seamănă independent, înainte de prima
  sincronizare, scriu exact aceeași înregistrare. Semințele implicite se scriu o
  singură dată (cât timp „General” nu există deja): o categorie implicită ștearsă de
  operator nu reapare. O cheltuială cu o categorie fără înregistrare corespunzătoare
  (perioada în care categoria era doar text) primește o categorie nouă de fiecare dată
  — asta rulează mereu, nu doar o dată, ca nimic să nu rămână „în aer”.
- **„General” nu poate fi ștearsă sau redenumită.** Server-ul refuză ambele cu un mesaj
  clar; UI-ul (`ExpensesCategoryManager`) nici nu-i arată butonul de ștergere. Alternativa
  respinsă: a permite redenumirea și a ține rolul de rezervă legat doar de id — mai
  complex de urmărit în UI (utilizatorul ar vedea „General” dispărut, dar rolul activ),
  fără beneficiu real.
- **Ștergerea unei categorii mută cheltuielile ei la „General”, în aceeași tranzacție**
  (`backupBefore: true` — poate rescrie multe înregistrări). Fiecare cheltuială mutată
  are propria intrare în istoric (`action: 'mutare la General'`), separată de ștergerea
  categoriei — la fel cum face `replaceAllRecords` cu diferențele unui import: un rând
  de audit per înregistrare schimbată, nu un rezumat.
- **Redenumirea unei categorii (`/api/category-rename`) propagă noul nume la cheltuielile
  ei, în aceeași tranzacție**, cu aceeași siguranță (backup înainte). Calea generică
  `/api/record` refuză `mode: 'update'` pentru `categories` (vezi `record-editing`), ca
  să nu existe o a doua cale de redenumire care nu propagă nimic.
- **Fără dependință de `groups`.** Cele două ecrane nu au nimic în comun în domeniu.
- Contractul HTTP al `/api/category-delete` rămâne neschimbat la migrare; `/api/category-rename` e nou.

## Teste

```
node --test "src/features/expenses/**/*.test.mjs"
```

- Domeniu: `expense-category-names.test.mjs`, `canonical-category-name.test.mjs` — funcții pure.
- Server: `expense-category-seeding.test.mjs` — seedarea, pe o bază SQLite în memorie.
- Rută: `expense-categories.routes.integration.test.mjs`, pornește serverul real prin `#test-support/start-test-application.mjs`.
