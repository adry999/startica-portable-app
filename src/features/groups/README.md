# groups

Ecranul „Grupe”: cardurile cu grupele de copii, capacitatea, educatorul și atribuirea copiilor. Ștergerea unei grupe e blocată cât timp mai are copii atribuiți, arhivați sau nu.

Modul **independent**: nu depinde de alt feature, nu publică și nu consumă evenimente.

## Public API

### `index.server.mjs`

| Export | Rol |
| --- | --- |
| `createGroupsRoutes({ recordRepository, auditTrail, runRevisionTransaction })` | `POST /api/group-delete`, cu corpul neschimbat: `{ id, revision, requestId }` |

### `index.web.mjs`

| Export | Rol |
| --- | --- |
| `createGroupsController({ elements, readRecords, submitMutation, showNotice })` | întoarce `{ render }`; leagă formularul de creare și clic-urile din grilă o singură dată, la construire |

## Dependențe

| Import | De ce |
| --- | --- |
| `#core/server/errors/domain-error.mjs` | `fail()` pentru grupă inexistentă sau ocupată |
| `#shared/contracts/persistence.mjs`, `#shared/contracts/audit-trail.mjs`, `#shared/contracts/record-types.mjs` | tipuri |
| `#shared/format/html-escape.mjs`, `#shared/format/date-format.mjs` | randare (vârste, escapare) |
| `#shared/ui/child-picker.mjs` | atribuirea unui copil neasociat unei grupe |

## Structură

```
groups/
├── README.md
├── groups.types.d.mts
├── index.server.mjs
├── index.web.mjs
├── server/
│   └── groups.routes.mjs               # ★ ștergere cu verificarea copiilor atribuiți
└── web/
    ├── groups.controller.mjs           # ★ stare (grupe extinse), formular, delegare de clic
    └── groups.view.mjs                 # ★ cardurile grupelor (groupCard)
```

## Decizii

- **Fără dependință de `expenses`.** Categoriile de cheltuieli sunt un feature separat; nimic din domeniul lor nu se atinge de grupe.
- **`expandedGroupIds` e stare de controller,** nu variabilă la nivel de modul — mai multe instanțe ale ecranului nu și-ar mai împărți accidental starea de extindere.
- Contractul HTTP al `/api/group-delete` rămâne neschimbat la migrare.

## Teste

```
node --test "src/features/groups/**/*.test.mjs"
```

- Rută: `groups.routes.integration.test.mjs`, pornește serverul real prin `#test-support/start-test-application.mjs`.
