# pool

Modulul „Bazin” (spec `docs/design/screens/23-bazin.md`): program săptămânal, prezența la
ședințe, sumele lunare per copil, plata antrenorului și „Închide luna”. Planul complet:
`docs/superpowers/plans/2026-09-27-personal-bazin.md` (Fazele 5-6).

Programările și ședințele sunt per filială, în tabele proprii ale bazei de date a filialei
(`pool_bookings`, `pool_sessions`, `pool_closings` — decizia 11), nu în `records(kind,id,payload)`:
sesiunile sunt copii × săptămâni și n-au ce căuta în `/api/state`. Suma taxată fiecărui copil intră
în obligația lunii ca o înregistrare `charges` (kind partajat cu `#shared/domain`, decizia 4), scrisă
o singură dată per copil/lună la închidere — id determinist, reînchiderea recalculează și
suprascrie, nu dublează (decizia 5). Antrenorii vin din modulul `personal` (rolul „Antrenor bazin”)
prin porturi injectate (`listCoaches`, `payCoach`) în `src/app/server/create-branch-context.mjs` —
`pool` nu importă `#features/personal` direct (nicio feature nu importă altă feature).

## Public API

### `index.server.mjs`

| Export | Rol |
| --- | --- |
| `createPoolRepository(database)` | CRUD pe `pool_bookings`/`pool_sessions`/`pool_closings` |
| `createPoolRoutes({...})` | rutele `/api/pool/*` |
| `createPoolClosingService({...})` | „Închide luna” — idempotent, scrie `charges` + salariile |
| `coachPayForMonth`, `parsePoolSettings`, `POOL_SETTINGS_KEY` | folosite de `personal` (cardul de salariu) și de wiring-ul din `create-branch-context.mjs` |

### `index.web.mjs`

Setările (`POOL_SETTINGS_KEY`, `POOL_SETTINGS_SEED`, `COACH_PAY_MODES`, `slotTimes`,
`validatePoolSettings`) și calculele pure (`childMonth`, `coachPayForMonth`, `monthTotals`,
`weekOf`, `weekdayOf`, `expandBooking`, `seatsTaken`) — folosite de `webapp/src/features/pool/`
și de `webapp/src/features/backup/PoolSettings.tsx` (22d).
