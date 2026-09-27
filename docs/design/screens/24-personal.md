# 24 — Personal

**Referință:** `Personal.dc.html#23a`–`#23k`. **Nou.** Acces: doar administratorul. Salariile cer PIN.

## Date
- `departments` (`id`, `name`, `order`) — implicit Administrație, Educatori, Bucătărie, Altele. Comun ambelor filiale.
- `roles` (`id`, `name`, `departmentId`, `order`) — Director, Administrator, Educator, Asistent educator, Bucătar, Menajeră, Antrenor bazin. Editabile (23e); nu se șterg dacă au angajați.
- `staff` (`name`, `roleId`, `branches` ['bu','bo'] — unul sau ambele, `phone`, `birth`, `idnp`, `address`, `since`, `archivedAt?`, `notes[]`).
- `group_staff` (`groupId`, `staffId`, `role` 'principal'|'asistent'|'inlocuitor', `days?`). Un singur principal pe grupă.
- `timesheet` (`staffId`, `date`, `code` 'CO'|'CM'|'A'|'I'|'FP'). Lipsa rândului în zi lucrătoare = lucrat 8 h.
- `leaves` (`staffId`, `from`, `to`, `type` 'CO'|'CM'|'FP', `planned` bool) — scrie și în `timesheet`.
- `salaries` (`staffId`, `mode` 'fix'|'zi'|'bazin', `amount`, `validFrom`) — istoric pe luni.
- `advances` (`staffId`, `date`, `amount`, `method`, `month`, `deductedAt?`).
- Setări (de confirmat): `annualLeaveDays` (implicit 28), `deductOnlyUnexcused` (implicit true = salariul fix scade doar pentru A).

## Vizibilitate pe filiale
- Echipa, Pontaj, Concedii, Salarii arată doar angajații cu filiala activă în `branches`. Cei cu ambele primesc eticheta „ambele filiale”.

## Ecrane
- **23a Echipa:** tabel pe toată lățimea; filtru departamente; sortare din antetul coloanelor (Angajat / Funcția / Grupa și rolul); implicit grupat pe departamente. Rând → 23j.
- **23j Fișa angajatului:** pagină proprie `/personal/:id` (ca fișa copilului). Bandă sus, stânga date/grupe/note, dreapta zile lucrate, concediu rămas, salariu (PIN), pontajul lunii, concediile anului.
- **23b Pontaj:** grilă lună, aceleași pastile departamente ca 23a, grupat pe departamente. Coduri CO/CM/A. Clic pe celulă ciclează.
- **23k Pontaj tipărit:** A4 orizontal, alb-negru, `@media print`. Antet firmă + filială, coloane zile, totaluri Zile/Ore/CO/CM/A, legenda codurilor, 3 semnături. >14 rânduri → pagina 2 cu antet repetat. Dialog: ce tipăresc (toți / departament / un angajat), afișare „8” sau „P”.
- **23f Concedii:** an pe un rând per angajat; bare CO/CM/planificat; zile rămase; avertizare la suprapunere în aceeași grupă.
- **23c/23d Salarii (PIN):** lista lunii; **23g Avansuri** = filă cu istoric; **23h** = istoricul unui angajat (grafic + listă).
- **23i Echipa grupei:** în Grupe și în fișă.

## Legături
- Plata salariului → Cheltuieli (Salarii), minus avansurile lunii. Avansul → Cheltuieli în ziua dării; nu se dublează.
- Antrenorii de bazin: salariul vine din 23-bazin.

## Criterii de acceptare
- [x] Filiala activă filtrează tot; „ambele” apar la ambele — `GET /api/personal/state` filtrează pe `staffForBranch(branchId)` (backend); webapp arată eticheta „ambele filiale” (`TeamView.test.tsx`). Neverificat manual într-o pornire reală a aplicației.
- [x] Concediul adăugat apare în pontaj și scade din zilele rămase — `leaves.service.mjs` scrie rândurile de pontaj cu `leaveId` în aceeași tranzacție; webapp portă exact același calcul de zile rămase (`leave-days.ts`) și avertizarea de suprapunere (`LeavesView.test.tsx`).
- [x] Avansul se scade o singură dată — `salaries.service.mjs` (backend) scade avansul o singură dată prin `deductedAt`/`deductedBy`; webapp arată starea „Scăzut”/„De scăzut” fără să dubleze cererea (`AdvancesTab.test.tsx`).
- [x] Tipărirea încape pe A4 orizontal fără tăiere — `TimesheetPrint.tsx` + test (`@page A4 landscape`, antet repetat, ≤14 rânduri/pagină).
- [x] Salariile nu se văd fără PIN — `PinGate.tsx` + test (fără PIN corect, nimic din Salarii nu se randează; un 403 de la server pune `useSalaries` pe „locked”).

Verificarea de mai sus e pe bază de teste automate (webapp + backend, separat); nu s-a făcut o verificare manuală end-to-end cu serverul și webapp-ul pornite împreună.
