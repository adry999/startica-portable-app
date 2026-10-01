# Verificare val 2 — pe design system

Al doilea val de migrare (`PROMPT-CLAUDE-CODE-5.md` §2) acoperă cele 15 module, în ordinea din prompt. Fiecare rând de mai jos are propriul document de verificare, cu starea la intrare, ce s-a schimbat, ce a rămas neschimbat (cu motiv) și dovada de regresie financiară acolo unde modulul atinge bani.

| # | Modul | Document | Financiar | Captură |
|---|---|---|---|---|
| 08 | Dashboard | [08-dashboard.md](08-dashboard.md) | — | [08-dashboard.png](08-dashboard.png) |
| 02 | Copii | [02-copii.md](02-copii.md) | — | [02-copii.png](02-copii.png) |
| 05 | Achitări | [05-achitari.md](05-achitari.md) | da | [05-achitari.png](05-achitari.png) |
| 19 | Prezența | [19-prezenta.md](19-prezenta.md) | — | [19-prezenta.png](19-prezenta.png) |
| 03 | Grupe | [03-grupe.md](03-grupe.md) | — | [03-grupe.png](03-grupe.png) |
| 06 | Cheltuieli | [06-cheltuieli.md](06-cheltuieli.md) | da | [06-cheltuieli.png](06-cheltuieli.png) |
| 07 | Situația plăților | [07-situatia.md](07-situatia.md) | da | [07-situatia.png](07-situatia.png) |
| 10 | De notificat | [10-de-notificat.md](10-de-notificat.md) | — | [10-de-notificat.png](10-de-notificat.png) |
| 11 | De rezolvat — Taxe | [11-de-rezolvat-taxe.md](11-de-rezolvat-taxe.md) | da | [11-de-rezolvat-taxe.png](11-de-rezolvat-taxe.png) |
| 11 | De rezolvat — Verificat | [11-de-rezolvat-verificat.md](11-de-rezolvat-verificat.md) | — | [11-de-rezolvat-verificat.png](11-de-rezolvat-verificat.png) |
| 11 | De rezolvat — Asociere | [11-de-rezolvat-asociere.md](11-de-rezolvat-asociere.md) | da | [11-de-rezolvat-asociere.png](11-de-rezolvat-asociere.png) |
| 04 | Vizite | [04-vizite.md](04-vizite.md) | — | [04-vizite.png](04-vizite.png) |
| 24 | Personal — Salarii | [24-personal-salarii.md](24-personal-salarii.md) | da | [24-personal-salarii.png](24-personal-salarii.png) |
| 24 | Personal — Echipa | [24-personal-echipa.md](24-personal-echipa.md) | — | [24-personal-echipa.png](24-personal-echipa.png) |
| 23 | Bazin | [23-bazin.md](23-bazin.md) | da | [23-bazin.png](23-bazin.png) |
| 20 | Raport contabil | [20-raport-contabil.md](20-raport-contabil.md) | da | [20-raport-contabil.png](20-raport-contabil.png) |
| 14 | Mesaje SMS și Notificări | [14-sms-notificari.md](14-sms-notificari.md) | — | [14-sms-notificari.png](14-sms-notificari.png) |
| 12 | Administrare | [12-administrare.md](12-administrare.md) | — | [12-administrare.png](12-administrare.png) |

Toate cele 15 module din §2 sunt migrate și comise (`git log --grep='val 2'`). `npm run check` verde după fiecare, și din nou la finalul lui §3.

## Captură 1440×900 vs. artboard

Efectuată 01.10 pentru toate cele 18 module (§3, `scripts/design-capture.mjs`) — serverul a rulat exclusiv pe o copie izolată a datelor (`npm run dev:copy` / `scripts/dev-data-copy.mjs`), niciodată pe `Startica_Date/` reală. Fiecare PNG compune artboard-ul (stânga) și aplicația reală (dreapta) la 1440×900; linkurile sunt în coloana „Captură” a tabelului de mai sus. Diferențele găsite sunt aproape toate date-driven (date de test, lună curentă fără date, interacțiune neexecutată într-o captură automată dintr-un context nou, fără localStorage) — documentate individual în fiecare `<NN>-*.md`. Două module au diferențe structurale marcate „de verificat” (nu modificate fără clarificare): `03-grupe.md` (cardul „Fără grupă”) și `12-administrare.md` (panoul „Copii de siguranță”).

## §3 — închiderea alowlist-urilor din `architecture.test.ts`

La finalul lui §2, `architecture.test.ts` mai avea, pe lângă cele 15 module, și câteva fișiere rămase din valuri anterioare de migrare (Dashboard, Copii, Achitări) niciodată curățate complet. §3 a golit ce s-a putut goli mecanic și a reparat ce s-a putut repara fără risc:

**Reparat efectiv (nu doar scos din listă):**
- `children/ChildAttendanceSection.tsx` — „Nicio absență motivată luna aceasta.” → `EmptyState` cu cheia `fisa.absences` (catalog, parametrizată cu luna).
- `children/ChildProfileView.tsx` — „Nicio notă încă.” → `EmptyState` cu cheia `fisa.notes` (catalog).
- `personal/TeamView.tsx` — „Niciun angajat găsit.” → `DataTable.empty="personal.first"` + `onEmptyAction` (prop nou `onAddStaff`, threadeuit din `PersonalPage.tsx`) + `hasActiveFilters`/`activeFilterLabels`/`onClearFilters`.
- `children/ChildFormDrawer.tsx` — cele două câmpuri `<input type="month">` (Taxa aplicabilă din lună, Statut aplicabil din lună) → `MonthInput` (acum existent în `@shared/ui`, adoptat prima dată în Personal/`SalaryFormDrawer.tsx`); cardurile de tarif preset (`<button>` brut) → `ChoiceCards`; cele două linkuri text (+ Adaugă încă un părinte / + Adaugă persoană de ridicare) → `Button variant="link"`.
- `payments/PaymentFormDrawer.tsx` — 5 linkuri text (`Schimbă`, `Împarte pe metode`, `Repartizează manual`, `Se repartizează automat`, `+ Adaugă observație`) → `Button variant="link"`; scurtăturile de sumă (1/2/3 luni + „restul lunii”) → `ChipSelect`; rândul „Luna” din repartizarea manuală (`<input type="month">`) → `Field` + `MonthInput`. Fișierul a ieșit complet curat din R1 (0 taguri brute).
- `payments/PaymentFormDrawer.tsx` (R7) — `.toFixed(2)` rămas, dar acum documentat inline: e valoarea internă a unui câmp editabil (repartizare), nu text afișat — `formatMoney` i-ar strica formatul de input controlat.

**Rafinat structural (regula însăși, nu o listă de fișiere):**
- R1 exclude acum fișierele `.test.tsx` (mock-uri de componente, ca la R3/R7/R9) și `<input type="file" hidden>` (file-picker nativ, fără echivalent `@shared/ui`), oriunde apar.
- R2 exclude acum comentariile CSS (`/* ... */`) înainte de scanare — eliminat doi fals-pozitivi: `children/ChildFormDrawer.module.css` (`#15a`, un id de artboard citat într-un comentariu, nu o culoare) și `payments/PaymentFormDrawer.module.css` (`#e0b400`/`#e9527c` citate într-un comentariu ca să explice de ce nu au token exact). Ambele fișiere au ieșit complet curate din R2.
- R9 (text) exclude acum fișierele `.test.tsx` și liniile din comentarii de cod (`stripComments`, deja folosit de R3) — elimina un fals-pozitiv găsit în `children/BirthdaysPage.tsx` (litera „Nicio” apărea doar într-un comentariu explicativ, nu în text randat).

**Rămas cu excepție permanentă, documentată în comentariu (nu „datorie”, ci decizie de arhitectură):**
- R1 (15 fișiere): hit-area pe rând/placă întreagă (`ChildTile`, `GroupTile`, `AssignPage`, `NotifyPage`, `ReviewPage`, `ConflictsPage`, `DashboardPage`, `GroupTeamPicker`, `LeavesView`, `StaffFormDrawer`, `VisitsPage` — celula de calendar), tabele de tipărit (`TimesheetPrint`, `ReportPrintSummary`, `WeekView`), și grupul „Grupă” din `ChildFormDrawer.tsx` (pastilă cu tooltip nativ de capacitate + nuanță de ton, fără echivalent în `FilterPills`/`ChipSelect`).
- R2 (21 fișiere `.module.css`): culori exacte din spec fără token identic (CO `#e0b400`, antet `#5b666e`), `border-radius`/`box-shadow` off-scale față de tokeni, `font-family: monospace` fără token dedicat — fiecare cu comentariul motivului chiar în fișierul CSS.
- R3 (1 fișier): `attendance/WeeklySheet.tsx` — „✓” e text de legendă pe o foaie tipărită (explică ce simbol se scrie de mână), nu o iconiță de UI.
- R7 (1 fișier): `payments/PaymentFormDrawer.tsx` — vezi mai sus.

Niciuna dintre aceste excepții rămase nu poate ajunge la zero fără fie o schimbare de comportament (pierderea tooltip-ului de capacitate, a culorii de ton moștenite, a paginării la tipărire), fie inventarea de tokeni noi de design (decizie TOKENS.md, în afara sferei unei curățenii de allowlist). Alowlist-urile din `architecture.test.ts` nu mai sunt „datorie de migrare cunoscută” (cum erau pe parcursul lui §2) — fiecare intrare rămasă e o decizie de arhitectură permanentă, cu justificarea în comentariul de lângă ea, în fișierul sursă.
