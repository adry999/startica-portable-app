# 24 — Personal

> **Actualizat 29.09.2026:** Pontaj, Concedii, Salarii: vezi ALINIERE A3f (celule-pastilă, CO #e0b400, coloana CM, zile viitoare CO/CM, concedii pe zile, stepper + Blochează la Salarii). Unde textul de mai jos contrazice `DECIZII.md` sau `ALINIERE-DESIGN.md`, acelea au prioritate.

**Referință:** `Personal.dc.html#23a`–`#23l`. **Nou.** Acces: doar administratorul. Salariile cer PIN.

## Date
- `departments` (`id`, `name`, `order`) — implicit Administrație, Educatori, Bucătărie, Altele. Comun ambelor filiale.
- `roles` (`id`, `name`, `departmentId`, `order`) — Director, Administrator, Educator, Asistent educator, Bucătar, Menajeră, Antrenor bazin. Editabile (23e); nu se șterg dacă au angajați.
- `staff` (`name`, `roleId`, `branches` ['bu','bo'] — unul sau ambele, `phone`, `birth`, `idnp`, `address`, `since`, `archivedAt?`, `notes[]`).
- `group_staff` (`groupId`, `staffId`, `role` 'principal'|'asistent'|'inlocuitor', `days?`). Un singur principal pe grupă.
- `timesheet` (`staffId`, `date`, `code` 'CO'|'CM'|'A'|'I'|'FP'). Lipsa rândului în zi lucrătoare = lucrat 8 h.
- `leaves` (`staffId`, `from`, `to`, `type` 'CO'|'CM'|'FP', `planned` bool) — scrie și în `timesheet`.
- `salaries` (`staffId`, `mode` 'fix'|'zi'|'bazin', `amount`, `validFrom`) — istoric pe luni.
- `advances` (`staffId`, `date`, `amount`, `method`, `month`, `deductedAt?`).
- `candidates` (`id`, `name`, `position`, `age?` int, `experience`, `city`, `phone`, `notes`, `createdAt`, `updatedAt`). Tabel separat de `staff`, **comun ambelor filiale** (ca `departments`), sincronizat ca restul. `position` e text liber, nu `roleId`.
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
- **23l Candidați:** a cincea filă, după „Salarii · admin”. O listă simplă de persoane pe care le poți suna (angajare, înlocuiri, vară, colaborări). **Fără etape, filtre, stări sau legare de Echipă**, la cererea utilizatorului.
  - Antet: comutatorul de file + „+ Candidat” (buton principal).
  - Sub antet: `SearchInput` 360px (caută în nume, poziție, localitate, telefon și notițe; la căutare apare „3 din 8”) și, la dreapta, „8 persoane”.
  - `DataTable` cu coloanele: Nume, prenume (avatar cu inițiale 30px + bold) · Poziție · Vârstă · Experiență · Unde locuiește · Telefon (bold, cifre tabulare) · Notițe (un rând, ellipsis; gol = „—” gri). Sortare alfabetică după nume, fără altă sortare.
  - Clic pe rând sau „+ Candidat” deschide `Drawer`-ul de 480px: Nume, prenume (obligatoriu, focus automat) · Poziție + Vârstă (110px) · Experiență · Unde locuiește + Telefon · Notițe (textarea, 5 rânduri). Subsol: „Șterge” (doar la editare, `ConfirmDeleteDialog`) · Anulează · Salvează (gri până se completează numele).
  - Lista goală folosește `EmptyState` „Niciun candidat încă” + „+ Candidat”; o căutare fără rezultate arată „Nimeni nu se potrivește căutării.”
  - Nu cere PIN (nu conține salarii). Modificările intră în Administrare → Istoric.

## Legături
- Plata salariului → Cheltuieli (Salarii), minus avansurile lunii. Avansul → Cheltuieli în ziua dării; nu se dublează.
- Antrenorii de bazin: salariul vine din 23-bazin.

## Criterii de acceptare
- [ ] Filiala activă filtrează tot; „ambele” apar la ambele
- [ ] Concediul adăugat apare în pontaj și scade din zilele rămase
- [ ] Avansul se scade o singură dată
- [ ] Tipărirea încape pe A4 orizontal fără tăiere
- [ ] Salariile nu se văd fără PIN
- [ ] Candidați: se adaugă, se editează și se șterg; căutarea găsește după telefon și notițe; lista e aceeași pe ambele filiale
