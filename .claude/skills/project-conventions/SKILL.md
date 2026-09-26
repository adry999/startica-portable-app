---
name: project-conventions
description: Convențiile Startica pentru arhitectură, importuri, erori, testare, configurare, nume, comentarii și commit-uri. Stack-ul este Node 22, node:sqlite și ESM vanilla, fără build. Se aplică la orice modificare în acest repo (feature nou, bug fix, refactorizare, test, review, commit) și la întrebări de tipul „unde stă” sau „cum se numește” ceva.
---

# Startica: convenții de proiect

## Scop

Fiecare modificare apropie codul de arhitectura țintă din `docs/arhitectura/README.md` fără să strice livrarea. Livrarea înseamnă o aplicație locală, offline, instalată cu `Startica_Setup_<v>.exe` (Inno Setup, per utilizator), fără pas de build; datele în `%LOCALAPPDATA%\Startica`.

## Triggers

- Orice editare în `server/`, `shared/`, `web/`, `src/`, `tests/` sau `scripts/`.
- Feature nou, mutare de fișiere sau un pas din planul de migrare.
- Review, commit, PR.

## Reguli

### Stack (se schimbă doar prin decizie explicită)

- JavaScript ESM `.mjs`, cu Node 22.17 inclus în pachet (`runtime\node.exe` lângă `Startica.exe`, în `%LOCALAPPDATA%\Programs\Startica`), `node:sqlite` și UI vanilla în fereastră Chrome/Edge.
- Zero dependențe runtime. SheetJS rămâne vendorizat. Ca devDependencies sunt permise doar `prettier` și `typescript` (numai pentru `tsc --noEmit`).
- Fără framework, bundler sau transpilare: ce e în repo rulează exact așa la client.

**Excepție (din 2026-09-23, vezi Decision log): `webapp/`.** Stratul de interfață web e în redesign pe React+Vite+TypeScript, pe branch `redesign/react-vite` — vezi `docs/superpowers/specs/2026-09-23-ui-redesign-react-migration-design.md`. Doar `webapp/` poate folosi React, Vite, TypeScript real, TanStack Query, Vitest, React Testing Library, react-router-dom ca dependințe. Restul stack-ului de mai sus (backend, `server/`, `domain/`, teste backend) rămâne neschimbat.

Convențiile vizuale pentru orice UI din `webapp/` sunt în `DESIGN.md` din acest folder (culoare, suprafețe, tipografie, interacțiuni) — vezi și `docs/design/`.

### Stadiul migrării

- Planul din `docs/arhitectura/README.md` (§6, pașii 0–12) e aplicat integral. Codul nou intră direct în structura țintă.
- Tot codul aplicației e în `src/`; stilurile sunt în `web/styles/`. Scripturile și testele importă feature-urile doar prin `index.server.mjs`/`index.web.mjs`, niciodată prin căile lor interne.
- `docs/arhitectura/referinta/` e codul de referință din care au pornit `audit-log` și `payment-assignment`; nu se modifică separat.

### Structură și granițe

- `src/features/<feature>/` conține:
  - `README.md`;
  - `<feature>.types.d.mts`;
  - `index.server.mjs` și/sau `index.web.mjs`;
  - `domain/` (pur);
  - `server/` (`*.repository`, `*.service`, `*.routes`);
  - `web/` (`*.api`, `*.controller`, `*.view`);
  - `test-support/`.
- `src/shared/` cuprinde contracte, shared kernel (reguli folosite de cel puțin două feature-uri), formatare și UI de bază. E izomorf: fără `node:*` și fără DOM, cu excepția `shared/ui/`.
- `src/core/` e infrastructură fără domeniu: SQLite, HTTP, tranzacția cu revizie, api client, event bus, `view-state`.
- `src/app/` e composition root-ul și **singurul** loc care importă mai multe feature-uri.
- Interdicții, impuse de `tests/architecture/import-boundaries.test.mjs`:
  - un feature nu importă alt feature;
  - `web/` nu importă `server/`;
  - `shared/` nu importă `core/`, `features/` sau `app/`;
  - `core/` nu importă `features/` sau `app/`.
- Între feature-uri se comunică prin porturi injectate de `app/`, prin evenimente din `#shared/contracts/domain-events.mjs` sau prin reguli mutate în `#shared/domain/`.

### Importuri, tipuri, servire

- Aliasuri: `#app/`, `#config/`, `#core/`, `#shared/`, `#features/`, `#test-support/`, definite în `package.json#imports` și în import map-ul din `web/index.html`. Importurile relative sunt permise doar în același feature, cu cel mult un `../`.
- Import map-ul e un script inline acceptat prin hash-ul din CSP, calculat la pornire. Nu se adaugă alte scripturi inline.
- Serverul servește module doar din lista albă: `app/web`, `core/web`, `shared`, `features/*/{domain,web}` și `index.web.mjs`. Nu servește niciodată `server/`, `*.test.mjs`, `test-support/` sau căi cu `..`.
- Tipurile se scriu în JSDoc și în fișiere `*.d.mts`, importate **cu extensia `.mjs`**, de exemplu `/** @typedef {import('../audit-log.types.mjs').AuditEntry} AuditEntry */`. Fără extensie, `tsc` (`nodenext`) nu rezolvă importul.
- `fail()` e o declarație `function` cu `@returns {never}`, ca `tsc` să restrângă tipul după apel.
- Validarea runtime rămâne în `#shared/domain/record-schema.mjs`, aceeași în browser și pe server. Tipurile nu o înlocuiesc.

### Erori și stări

- **Server:** `fail(message, status)` din `#core/server/errors/domain-error.mjs`. Codurile sunt: 400 input invalid, 403 gardă (Host, Origin, token), 404 rută inexistentă, 409 conflict (revizie, înregistrare schimbată sau ștearsă), 413 corp prea mare. Există un singur `catch`, în route dispatcher. Un `catch` local, într-o rută sau într-un serviciu, e permis doar când traduce o eroare de sistem (fs, rețea, SQLite) într-un mesaj pe care operatorul poate acționa, de exemplu `readRestoreSnapshot` din `backup.routes.mjs` și rutele Telegram; nu are voie să înghită eroarea în tăcere.
- **Client:** `ApiError` are `kind` cu trei valori:
  - `network`: stare necunoscută; operația rămâne pending și se reia cu același `requestId`;
  - `rejected`;
  - `unexpected-response`.
- Controller-ele de ecran expun `ViewStatus` (`loading | ready | empty | failed`) și `failure: { message, retryable }`. View-ul doar randează starea primită.
- Fiecare ecran se randează prin `renderGuarded`. Un abonat al event bus-ului care eșuează nu îi oprește pe ceilalți.
- Scrierile trec prin `runRevisionTransaction`, care asigură revizie, `requestId` și backup înainte pentru operațiile ireversibile. Verificările care depind de starea curentă stau în tranzacție.
- La refactorizare, contractele HTTP rămân neschimbate, cu excepția cazului în care pasul din plan cere explicit altceva.

### Testare

- Testul unitar stă lângă cod: `x.test.mjs` lângă `x.mjs`. Integrarea cu SQLite sau HTTP real se numește `x.integration.test.mjs`. E2E-urile stau în `tests/e2e/`.
- Fake-urile reutilizabile stau în `tests/support/`. Fixture-urile unui feature stau în `<feature>/test-support/`, ca funcții care întorc date noi la fiecare apel.
- Nu se face mock de module: dependențele vin prin parametri. Pentru cereri controlate în timp se folosește `Promise.withResolvers()`.
- Numele testului descrie comportamentul, în română. Fără comentarii de narațiune în teste.
- Fiecare garanție se testează în stratul ei: tranzacția și idempotența în `core`, regulile în `domain`, orchestrarea în controller.
- Înainte de commit: `npm run check` (format, `tsc`, teste) și, pentru UI sau lansator, `npm run test:e2e`. Până la pasul 0 se folosesc `npm test` și `npm run test:browser`. Dacă se schimbă ceva la livrare, se face o instalare de probă cu instalerul (actualizare și dezinstalare cu Startica pornită, vezi `scripts/pachet-client/GHID-LIVRARE.md`).

### Configurare

- Doar `#config/environment.mjs` citește `process.env` (`STARTICA_PROFILE`, `STARTICA_PORT`, `STARTICA_NO_BROWSER`, `STARTICA_HOME`).
- Profilurile sunt `development`, `test` și `production`. Nu există staging: verificarea de dinainte de livrare este instalarea de probă cu instalerul.
- `Startica_Date`, `Startica_Backup` și `Jurnale` sunt relative la `STARTICA_HOME` când e setat (lansatorul), altfel la folderul aplicației (dezvoltare). Testele le primesc prin opțiuni, în directoare temporare.

### Nume și comentarii

- Identificatorii sunt în engleză și specifici domeniului: `assignPaymentsToChildren`, `readPage({ beforeEntryId })`, `selectedChildIdByPaymentId`.
- Nume interzise: `b`, `r`, `s`, `o`, `fn`, `data`, `item`, `handler`, `util`, `helpers`, `parts`, `views`.
- Fișierele se numesc `<subiect>.<rol>.mjs`, cu rolurile `.repository`, `.service`, `.routes`, `.api`, `.controller`, `.view`, `.types.d.mts`.
- Textele pentru utilizator și comentariile sunt în română, cu diacritice.
- Un comentariu există doar pentru un DE CE neevident (regulă de business, caz limită, performanță) și are 1–2 linii. Nu povestește codul.

### Git

- Conventional Commits: `type(scope): subject`, la imperativ, scurt, în engleză.
- `scope` e numele feature-ului sau al stratului: `audit-log`, `payment-assignment`, `children`, `billing`, `core`, `shared`, `config`, `app`, `packaging`, `docs`.
- Mesajele nu menționează AI sau agenți și nu au trailer `Co-Authored-By`.
- Un pas din plan înseamnă un commit sau un PR, cu testele verzi.

## Exemplu minimal

Un feature nou, `attendance-report`, după pasul 1:

```
src/features/attendance-report/
├── README.md
├── attendance-report.types.d.mts
├── index.web.mjs
├── domain/monthly-attendance.mjs (+ .test.mjs)
└── web/
    ├── attendance-report.controller.mjs (+ .test.mjs)
    └── attendance-report.view.mjs
```

```js
// src/features/attendance-report/domain/monthly-attendance.mjs
import { obligation } from '#shared/domain/tuition-obligation.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */

/**
 * @param {RecordsSnapshot} records
 * @param {string} month
 */
export function countChildrenWithObligation(records, month) {
  return records.children.filter(child => !child.archived && obligation(child, month, records.payments).expected > 0)
    .length;
}
```

```js
// src/app/web/compose-features.mjs (fragment)
const attendanceReport = createAttendanceReportController({
  readRecords: sessionStore.readRecords,
  readSelectedMonth: monthPicker.readSelectedMonth,
  eventBus,
  renderAttendanceReport: createAttendanceReportView({ container: byId('attendanceReport') }),
});
```

```
feat(attendance-report): add monthly attendance summary
```

## Decision log

- **2026-09-23 — React+Vite doar pentru `webapp/`.** Motiv: redesign complet (14 ecrane, din handoff claude.ai/design) expune o problemă recurentă — componente reimplementate diferit de fiecare dată (tabele, sortare/filtrare), agravată de faptul că implementarea se face în sesiuni/agenți diferiți, unde o convenție scrisă e ușor de ocolit. O graniță de componente (import obligatoriu) rezolvă structural, nu doar prin disciplină. Respins explicit: Nuxt/Supabase (proiect separat, deja abandonat 2026-09-22). Detalii: `docs/superpowers/specs/2026-09-23-ui-redesign-react-migration-design.md`.
- **2026-09-24 — `react-router-dom` adăugat în `webapp/`.** Motiv: aplicația rula pe o singură cale (URL nu reflecta modulul curent), deci F5/back-forward/deep-link nu funcționau. Fiecare modul are acum o cale reală (`app/shell/routes.ts`); fișa unui copil și formularul unei achitări sunt rute imbricate (`/copii/:childId`, `/achitari/:paymentId`, `/achitari/nou`), nu stare locală.
