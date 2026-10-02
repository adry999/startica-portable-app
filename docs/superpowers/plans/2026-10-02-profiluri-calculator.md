# Plan scurt — §5.3 Profiluri de calculator (PROMPT-7 §4, PROMPT-8 §5.3)

Spec: `docs/design/screens/31-profiluri-calculator.md`, artboard `Profiluri calculator.dc.html#36a…36h`.
Protocolul de sincronizare existent (`sync-server/`, `src/features/sync/`) NU se redesenează — profilul e
un strat de filtrare/permisiune adăugat peste el.

## Module canonice (14, derivate din matricea 36b)

`dashboard, children, groups, attendance, visits, personal, pool, payments, expenses, status, notify,
report, resolve (taxe+deverificat+asociere+conflicte), admin (istoric+notificari+backup-setari+sincronizare,
mereu doar Complet)`. Nivel acces per modul: `0 Nu vede · 1 Vede · 2 Modifică`.

Interpretări (de notat în INTREBARI.md): rândul „Mesaje SMS” din matricea 36b nu are rută proprie în
cod — eliminat; „De rezolvat” grupează și `conflicts` (sync), nu doar cele 3 din text.

## Server (sync-server/, separat, nu importă din src/)

1. `devices.profile_json` (+ `pairing_codes.profile_json`) — profil ales la generarea codului / la
   cheia de instalare (mereu Complet pentru primul calculator).
2. `GET /v1/devices/me`, `POST /v1/devices/:id/profile` (doar de pe un dispozitiv Complet, clamp pe
   modulele blocate la Personalizat).
3. Filtrare `pull`/`readSnapshot` pe `kind` după modul permis (≥1 = citește); push respins per rând
   (status `rejected`, nu avortează lotul) dacă modulul cere `Modifică` (2) și dispozitivul are mai puțin;
   dispozitiv `blocked` → totul respins. `children`: `healthNotes`/`feeHistory` tăiate dacă `payments`=0.
4. `audit_log`: kind nou, append-only (orice reluare cu `baseRevision>0` respinsă), toate dispozitivele
   îl trimit, doar profilul Complet îl primește la pull.

## Aplicația locală (`src/`)

1. `src/shared/domain/computer-profile.mjs` — modele pure (preseturi, clamp, acces), oglindă parțială în
   `sync-server/src/profile-policy.mjs`, verificată de `tests/sync-shared-constants.test.mjs`.
2. `src/features/sync`: `sync.json` ține profilul curent, reîmprospătat la fiecare ciclu de sincronizare
   din `/v1/devices/me`.
3. `/api/session` expune profilul; gardă genercă pe `route-dispatcher.mjs` (`route-modules.mjs`: hartă
   cale→modul, cu rezolvare dinamică pentru `/api/record`, `/api/record-delete`, `/api/undo` după tipul
   înregistrării) — 403 pe orice cerere către un modul nepermis sau cu nivel insuficient.
4. `audit_log` (SQLite local): coloane noi `device_id`/`device_name`, completate din profilul curent la
   fiecare `recordChange`; sincronizat ca orice alt tip (outbox) ca să ajungă pe calculatoarele Complet.
5. PIN per modul: generalizare minimă a `pin.service.mjs` (parametru `settingKey`), nu o reimplementare —
   un singur PIN de calculator, aplicat modulelor marcate `pinRequired` în profil.

## Client (`webapp/`)

`ModuleGuard` în `App.tsx` (un singur punct, citește `session.state.profile`), meniu filtrat în
`nav-items`/`Sidebar`, stare goală `profil.blocked` (36f), fișă copil doar-citire pe profiluri restrânse,
filtrul „Calculator” + coloana „cine” în Istoric (36g, doar Complet), ecran minim de administrare
calculatoare (profil + matrice Personalizat) în Backup și setări → Sincronizare.

## Scop explicit lăsat în afară (INTREBARI.md)

Redesfășurarea reală a `sync-server/` în producție; ștergerea datelor locale deja prezente la restrângerea
profilului (risc de pierdere ireversibilă fără backup confirmat); 43a/43b (TodayPage pe profil Bazin/
Educator — 43a e deja „în pauză” în PROMPT-8); fidelitate pixel-perfect pe ecranele de administrare noi.
