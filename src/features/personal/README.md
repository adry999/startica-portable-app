# personal

Modulul „Personal” (spec `docs/design/screens/24-personal.md`): echipa, pontajul, concediile
și — cu PIN — salariile și avansurile, comune ambelor filiale. Planul complet:
`docs/superpowers/plans/2026-09-27-personal-bazin.md`.

Datele lui trăiesc în baza comună a instalării (`<home>\Comun\Startica_Date\startica.db`,
`createCommonContext` din `src/app/server/create-common-context.mjs`), nu în baza vreunei
filiale — un `departments`/`roles`/`staff`/`timesheet`/`leaves`/`salaries`/`advances`/
`salary_payments` e văzut identic din orice filială deschisă. Kind-urile trec prin
`createKindRepository` (`src/core/server/persistence/kind-repository.mjs`), nu prin
`createRecordRepository`/`TYPES` — nu apar în `/api/state`, nu au revizie globală.

## Public API

### `index.server.mjs` / `index.web.mjs`

| Export | Rol |
| --- | --- |
| `PERSONAL_KINDS`, `normalizePersonalRecord(kind, input)` | validare per kind, whitelist de câmpuri |
| `TIMESHEET_CODES`, `nextTimesheetCode(code)` | ciclul 23b: gol → CO → CM → A → gol |
| `isStaffInBranch(staff, branchId)`, `worksAtAllBranches(staff, branchIds)` | filtrarea pe filiala activă |
| `DEFAULT_PERSONAL_SETTINGS`, `seedDepartments()`, `seedRoles()` | semințele scrise o singură dată la baza comună goală |
| `workingDatesFor(staff, month)`, `summarizeTimesheetMonth({ staff, month, rows, todayStr, upTo })` | grila pontajului 23b/23k |
| `leaveWorkingDays`, `leaveDaysRemaining`, `timesheetRowsForLeave`, `overlappingLeavesInGroup` | concediile 23f |

Rutele (`GET/POST /api/personal/*`, `createPersonalRoutes` din `server/personal.routes.mjs`) și
repository-ul comun (`server/personal.repository.mjs`, `server/leaves.service.mjs`,
`server/salaries.routes.mjs`) sunt implementate.

## Dependențe

`#shared/domain/calendar-month.mjs` (`monthDates`, `dateOK`, `monthOK`, `shiftDays`),
`#shared/domain/holidays-md.mjs` (`isWorkingDay`), `#shared/domain/record-schema.mjs`
(`requireThat`, `requireAmount` — reguli comune, nu `TYPES`/`normalizeRecord`). Niciun import
din alt feature; Bazin (viitor `src/features/pool/`) va primi `readCoachPayForMonth` ca port
injectat de `src/app/server/create-branch-context.mjs`, nu printr-un import direct.

## Structură

```
personal/
├── README.md
├── personal.types.d.mts
├── index.server.mjs
├── index.web.mjs
├── domain/
│   ├── personal-schema.mjs (+ .test.mjs)     # normalizare, ciclul pontajului, filtrare filiale
│   ├── personal-seeds.mjs                    # departamente/roluri implicite
│   ├── timesheet-month.mjs (+ .test.mjs)     # grila lunii pontajului
│   └── leave-days.mjs (+ .test.mjs)          # zile de concediu, suprapuneri în grupă
└── test-support/
    └── personal-fixtures.mjs
```

## Decizii

Vezi decizia 1–13 din `docs/superpowers/plans/2026-09-27-personal-bazin.md`. Rezumat:
baza comună e un fișier separat, deschis o singură dată per proces (§1); kind-urile sunt
JSON, nu `records`/`TYPES` (§2); `Group.team` rămâne în `records` al filialei (§3, vezi
`src/shared/domain/record-schema.mjs`); PIN-ul e o cortină, nu securitate (§8); pontajul
implicit = lucrat (§12); `monthDates` a fost mutat în `#shared/domain/calendar-month.mjs`,
`attendance` îl reexportă neschimbat.

## Teste

```
node --test "src/features/personal/**/*.test.mjs"
```
