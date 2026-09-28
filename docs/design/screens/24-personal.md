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
- [x] Avansul se scade o singură dată — `salaries.service.mjs` (backend) scade avansul o singură dată prin `deductedAt`/`deductedBy`; webapp arată starea „Scăzut”/„De scăzut” fără să dubleze cererea (`AdvancesTab.test.tsx`). Audit B, lot 1 (2026-09-28): fixate și cele două excepții găsite de audit — rândul de după plată arăta brutul, nu netul plătit (M1), iar un avans dat pentru o lună deja plătită rămânea scăzut la nesfârșit fără cheltuială (M11); acum se mută automat pe luna următoare (`salaries.service.test.mjs`, testele M1/M11).
- [x] Tipărirea încape pe A4 orizontal fără tăiere — `TimesheetPrint.tsx` + test (`@page A4 landscape`, antet repetat, ≤14 rânduri/pagină).
- [ ] Salariile nu se văd fără PIN — rutele Personal sunt protejate (`PinGate.tsx`, 403 → „locked”), dar sumele scapă de cortină prin Cheltuieli/Istoric: cheltuiala plății/avansului e o înregistrare `expenses` obișnuită, cerută să existe pentru ca `Cheltuieli` și rapoartele să fie corecte (decizia 7/8 din plan). Audit B, lot 1 (2026-09-28) — fix proporțional aplicat în `salaries.service.mjs`: descrierea cheltuielii nu mai poartă numele angajatului („Salariu 2026-09”, nu „Salariu 2026-09 · Ana Popescu”), iar acțiunea de audit dedicată `personal: plată salariu` nu mai scrie suma. Rămâne o scurgere reziduală, nefixabilă proporțional fără o schimbare arhitecturală (orice scriere de cheltuială e auditată integral, cu suma ei, indiferent de categorie): cine are acces la Istoric poate vedea suma cheltuielii `EXP-salariu-<staffId>-<lună>` și, corelând `staffId` cu lista angajaților (neprotejată de PIN), poate afla cine a fost plătit cât. PIN-ul rămâne o cortină pentru o privire în trecere pe ecran, nu o garanție — de menționat explicit dacă acest criteriu ajunge din nou bifat.

Verificarea de mai sus e pe bază de teste automate (webapp + backend, separat); nu s-a făcut o verificare manuală end-to-end cu serverul și webapp-ul pornite împreună.
