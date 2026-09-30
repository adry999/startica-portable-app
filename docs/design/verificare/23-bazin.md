# 23 — Bazin (programări, prezență, încasări, salariu antrenor) — val 2, pe design system

**Referință:** `docs/design/screens/23-bazin.md`, `Bazin.dc.html#22a`–`#22d`.

## Stare la intrare în val 2

Modulul era deja substanțial construit, pe `Card`, `Button`, `Drawer`, `ChipSelect`, `ChoiceCards`, `SearchSelect`, `Select`, `DateInput`, `Field`, `ConfirmDeleteDialog`, `RowMenu`, `Badge`, `ThermalBlock`/`ThermalRule`, `SegmentedControl`, `MonthStepper` — alocarea de excepții era deja îngustă (`WeekView.tsx` pentru R1, `MonthView.module.css`/`WeekView.module.css`/`PoolReceiptLabel.module.css` pentru R2, `MonthView.tsx` pentru R7/R9). Rămăseseră: un `new Date(...).toLocaleString('ro-RO')` direct în `MonthView.tsx` (R7) și un text de stare goală hardcodat „Nicio programare în luna asta.” (R9), plus radius-uri px de 18 fără token exact, deja acceptate ca datorie documentată.

## Ce s-a schimbat în această trecere

- **`MonthView.tsx` — data „Închisă la …” a lunii**: `new Date(closing.closedAt).toLocaleString('ro-RO')` → `formatDateTime(closing.closedAt)` din `#shared/format/date-format.mjs` (funcție deja existentă, folosită la fel în `backup/BackupPage.tsx`, `notifications/NotificationsPage.tsx`, `attendance/WeeklySheet.tsx` etc. — niciun export nou adăugat).
- **`MonthView.tsx` — tabelul „Pe copii” golit**: `<div className={styles.empty}>Nicio programare în luna asta.</div>` → `EmptyState variant="period"` cu cheia de catalog `bazin.month.period` (`resolveEmptyStateTitle`/`resolveEmptyStateText`, cu `{ luna: monthLabel }`), exact același tipar ca `status/PaymentHeatmap.tsx` (`situatia.year.period`). Clasa CSS `.empty`, rămasă neutilizată, a fost ștearsă din `MonthView.module.css`.
- **`WeekView.module.css`**: adăugat un comentariu care documentează `border-radius: 18px` pe `.statCard` (fără token exact — 16 `--radius-md-lg` dedesubt, 20 `--radius-lg` deasupra), în stilul deja folosit în `assign/AssignPage.module.css` și în comentariul similar deja existent în `pool/MonthView.module.css`. Nicio schimbare de valoare — doar documentare, valoarea rămâne cea din artboard (22a/22c).
- **`architecture.test.ts`**: vezi lista de mai jos.

## Ce a rămas neschimbat, cu motiv

- **R1 — `WeekView.tsx`, placa dintr-o celulă a grilei săptămânii**: rămâne `<button>` brut, hit-area pe toată placa (avatar + nume + etichetă de stare + punct de culoare), la fel ca `ChildTile`/`GroupTile`. Un `Button` ar impune propriul fundal/padding și ar sparge grila oră×zi (`display: contents` pe rânduri) — documentat acum direct în `architecture.test.ts`, lângă intrarea din listă.
- **R1 — `PoolPage.test.tsx`**: fixtura `BookingDrawer` mockuită folosește un `<button>` brut („Salvat (fixture)”) ca să declanșeze direct `onSaved()`, fără să reproducă interacțiunea reală de formular — nu e cod de producție, documentat la fel.
- **R2 — `MonthView.module.css`/`WeekView.module.css`, `border-radius: 18px`**: valoare exactă din artboard (Bazin.dc.html#22a/#22c), fără corespondent în scara de tokeni (16/20) — același caz deja acceptat ca în `assign/AssignPage.module.css`.
- **R2 — `PoolReceiptLabel.module.css`, `#000`/border-radius px**: bonul de bazin e tipar termic 58mm alb-negru (`ThermalBlock`); același caz de datorie deja acceptat pentru `payments/PaymentReceiptThermal.module.css` (raw `#000`/`#fff` pentru contrast maxim la imprimanta termică) — nu s-a migrat la `--print-ink` fiindcă acel token nu e încă folosit nicăieri în `features/**` (doar declarat în `tokens.css`), iar schimbarea ar fi inconsecventă dacă nu se face și pe bonul de plată, în afara scopului acestei treceri.
- **`bazin.first`/`bazin.coach`** (catalog `empty-states.ts`): existau deja ca chei, dar nu corespund niciunui text literal din fișierele `pool/*` din această trecere — `bazin.first` ține de fișa copilului/înscrierea la bazin (alt modul, nu în scop aici) și `bazin.coach` de un caz „niciun antrenor” care nu apare ca text hardcodat în `WeekView.tsx`/`MonthView.tsx` (secțiunea de antrenori pur și simplu nu randează nimic dacă `coaches` e goală, nu există o propoziție „Niciun antrenor” de înlocuit). Nu s-a forțat introducerea lor fără o violare reală de corectat.
- **Formulele de preț din `BookingDrawer.tsx`/`PoolReceiptLabel.tsx`** (`{settings.pricePerSession} lei`, `{monthlyTotal} lei`): rămân interpolare directă, nu `formatMoney` — nu declanșează R7 (regexul prinde doar `.toLocaleDateString`/`.toLocaleString`/`.toFixed`) și `PoolReceiptLabel.tsx` calculează explicit totalul tipărit pe bon (comentariu A-2 din fișier); nu s-a atins, fiind exact zona semnalată ca sensibilă financiar.

Niciun conflict spec-vs-componentă întâlnit — nu a fost nevoie de nicio intrare nouă în `INTREBARI.md`.

## Testul de regresie financiară

`usePool.ts`/`usePool.test.ts` (`shared/pool/`, hook-ul de date pentru sesiuni/plăți de bazin și salariu antrenor) **nu a fost atins** — singurele fișiere modificate în această trecere sunt `pool/MonthView.tsx`, `pool/MonthView.module.css`, `pool/WeekView.module.css` (prezentare) și `architecture.test.ts`. `usePool.test.ts` rulează neschimbat, verde: 2/2 teste (`usePoolWeek`/`usePoolMonth` reîncarcă la schimbarea reviziei sesiunii, B-8).

Calculul financiar tipărit pe bon (`PoolReceiptLabel.tsx`, neatins) rămâne fixat de teste cu valori exacte, nemodificate de această trecere:
- `PoolReceiptLabel.test.tsx`: „3 ședințe × 150 lei = 450 lei” (4 ședințe listate, 1 punctată/anulată → 3 taxabile).
- `PoolReceiptPage.test.tsx`: „4 ședințe × 150 lei = 600 lei” (5 ședințe listate, 1 anulată → 4 taxabile), verificând explicit că bonul nu mai citește `row.amount` (A-2).

## Verificare

- `npx tsc --noEmit -p .` (webapp) — verde.
- `npx vitest run src/features/pool src/shared/pool src/architecture.test.ts` — 7/7 fișiere, 28/28 teste.
- `npx vitest run` (webapp, complet) — 245/249 fișiere, 1348/1352 teste; cele 4 eșecuri (`App.test.tsx`, `design-system.test.tsx`, `notifications/SmsNewMessageDialog.test.tsx`, `visits/VisitsPage.test.tsx`) sunt în fișiere neatinse de această trecere, cu timeout/„multiple elements found” — cauzate de alți agenți care modificau concurent `visits/`, `notifications/`, `report/`, `personal/` în același interval; niciunul în `pool/` sau `architecture.test.ts`.
- `npm run typecheck` (root) — verde.
- `npm test` (root, backend) — 1198/1200 (2 skip preexistente), verde — include `date-format.test.mjs`, neschimbat de mine (o altă trecere concurentă a adăugat acolo `formatDayMonthNumeric`, pentru Personal, fără legătură cu Bazin).
- `npm run format:check` (root) — 3 fișiere semnalate (`personal/CandidatesTab.tsx`, `report/ReportCategoriesPanel.module.css`, `report/ReportExportDrawer.tsx`), toate în afara scopului acestei treceri (module editate concurent de alți agenți); `npx prettier --check` direct pe fișierele atinse aici (`pool/MonthView.tsx`, `pool/MonthView.module.css`, `pool/WeekView.module.css`, `architecture.test.ts`) — curat.
- `architecture.test.ts`: R7 — scos `pool/MonthView.tsx` din `ALLOWED` (fișier acum complet curat pe R7). R9 — mutat `pool/MonthView.tsx` din `TEXT_ALLOWED` în `IMPORT_ALLOWED` (import nou, legitim, al `EmptyState`, pentru cheia `bazin.month.period`). R1 — adăugat comentarii explicative pentru `pool/PoolPage.test.tsx` și `pool/WeekView.tsx` (fără scoatere din listă — ambele rămân excepții legitime documentate). R2 — nicio scoatere din listă (singurele violații rămase, radius 18px / `#000` termic, sunt nefixabile fără token exact sau fără a rupe tiparul monocrom).

**Captură 1440×900 vs. artboard:** neefectuată (motiv identic cu modulele anterioare — evită pornirea backend-ului peste baza de date de producție).
