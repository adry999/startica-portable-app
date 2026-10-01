# 24 — Personal · Salarii/Avansuri/Pontaj — val 2, pe design system

**Referință:** `docs/design/screens/24-personal.md` (23c/23d Salarii, 23g Avansuri, 23h Istoric, 23b/23k Pontaj), `Personal.dc.html#23b–#23k`.

## Stare la intrare în val 2

Fișierele de payroll (`SalariesView.tsx`, `AdvancesTab.tsx`, `AdvanceFormDrawer.tsx`, `SalaryFormDrawer.tsx`, `SalaryHistoryDrawer.tsx`, `TimesheetView.tsx`, `TimesheetPrint.tsx`, `TimesheetPrintDialog.tsx`, `PinGate.tsx`) erau deja substanțial construite pe `@shared/ui` (`Card`, `Badge`, `Checkbox`, `RowMenu`, `SegmentedControl`, `FilterPills`, `LockedContent` etc.) — alocarea de lucru era îngustă: un `<input type="month">` brut, un `formatDayMonth` local cu `toLocaleDateString`, două dialoguri modale construite manual (`overlay`/`div role="dialog"`) în loc de componenta `Dialog` (nou apărută în `@shared/ui` în acest val), plus câteva `border-radius`/hex literale în CSS, unele deja documentate, altele nu.

## Ce s-a schimbat în această trecere

- **`SalaryFormDrawer.tsx` — câmpul „Valabil din luna”**: `<label><input type="month"></label>` brut → `Field` + `MonthInput` (componentă nouă din `@shared/ui`, apărută în acest val — comentariul vechi care spunea că nu există încă a fost scos). `SalaryFormDrawer.module.css`: clasele `.field`/`.field input`, devenite moarte, au fost șterse.
- **`SalariesView.tsx` — dialogul de confirmare a plății**: `overlay`/`div role="dialog"` brut (cu `rgba(58,71,80,0.35)` propriu) → `Dialog` din `@shared/ui` (`title="Confirmă plata"`, `shouldBlockClose={() => paying}`, footer cu `Button variant="outline"` + `Button` primar). Vezi decizia tehnică din `INTREBARI.md` despre titlul dinamic pierdut („Plătește N salarii” → titlu static, sumă/număr rămân vizibile în corp și pe butonul de confirmare).
- **`SalariesView.tsx` — pastila „Plătit ⋯”**: `formatDayMonth` local (`new Date(iso).toLocaleDateString('ro-RO', {...})`, R7) → `formatDayMonthNumeric` nou, exportat din `#shared/format/date-format.mjs`.
- **`TimesheetPrintDialog.tsx` — dialogul „Ce tipăresc?”**: `overlay`/`div role="dialog"` brut (`rgba(58,71,80,0.35)` + `z-index: 20` literal) → `Dialog` din `@shared/ui`, cu același titlu/footer text („Tipărește pontajul”, „Anulează”/„Tipărește”) ca să nu rupă `TimesheetView.test.tsx`. `TimesheetPrintDialog.module.css`: `.overlay`/`.dialog`/`.title`/`.actions` șterse (Dialog le înlocuiește), rămân doar `.form`/`.field`/`.fieldLabel`.
- **`SalariesView.module.css`**: `border-radius: 12px` (nota galbenă de sub tabel) → `var(--radius-input)` (potrivire exactă); comentariile care conțineau literalmente `#23c`/`#5b666e` (fals-pozitiv R2, regex-ul de hex nu deosebește culoare de referință de ecran) reformulate fără `#`.
- **`TimesheetPrint.module.css`**: toate culorile de tipar (`#000`, `#333`, `#ccc`) → tokenii dedicați `var(--print-ink)`/`var(--print-muted)`/`var(--print-rule)` (existau deja în `tokens.css`, pur și simplu neadoptați aici).
- **`TimesheetView.module.css`**: `.cell`/`.legendSquare` `border-radius: 5px` → `var(--radius-5)` (potrivire exactă cu spec-ul, „radius 5”, ALINIERE-DESIGN A8); comentariile cu `#23b` reformulate (fals-pozitiv R2); adăugate comentarii explicative pentru `.departmentSquare` (3px) și `.todayPill` (6px), care rămân literale — niciun token exact, iar `--radius-5` pe o cutie de 8px ar schimba forma vizibil.
- **`SalaryHistoryDrawer.module.css`**: adăugat comentariu explicativ pentru `.bar { border-radius: 4px 4px 0 0; }` (rămâne literal, `--radius-5` e cel mai apropiat dar nu identic).

## Ce a rămas neschimbat, cu motiv

- **`TimesheetPrint.tsx`** rămâne pe `<table>`/`<thead>`/`<tbody>`/`<tr>`/`<td>`/`<th>` bruți — foaia tipărită A4 orizontală (23k) are nevoie de un tabel semantic real, cu antet repetat la 14 rânduri/pagină prin `break-after: page`; `DataTable` e o componentă interactivă (sortare, densitate, rânduri clickabile), nepotrivită pentru `window.print()` — exact același caz, deja acceptat, ca `report/ReportPrintSummary.tsx`. Comentariul din `architecture.test.ts` a fost extins să explice asta explicit (nu doar o intrare goală).
- **CO `#e0b400` și antetul departamentului `#5b666e`** din `TimesheetView.module.css` rămân literale — culori exacte cerute de `DECIZII.md #17`/ALINIERE-DESIGN A8, fără corespondent identic în `tokens.css`.
- **`.departmentSquare` (3px) / `.todayPill` (6px)** din `TimesheetView.module.css` și **`.bar` (4px 4px 0 0)** din `SalaryHistoryDrawer.module.css` rămân literale — nu există token exact, iar rotunjirea la cel mai apropiat (`--radius-5`, 5px) ar schimba vizibil forma unor elemente mici (pătrat 8px aproape de cerc, respectiv o diferență minoră dar nedocumentabilă ca „identică”).
- **Titlul dinamic „Plătește N salarii”** din vechiul dialog de plată nu a fost recreat peste `Dialog` (care are un singur `title`, folosit și ca `aria-label`) — decizie tehnică documentată în `INTREBARI.md`, ca să nu rupă testul existent (`getByRole('dialog', { name: 'Confirmă plata' })`).

## Testul de regresie financiară

Niciun hook de calcul (`useSalaries.ts`, `useTimesheet.ts`, `usePersonal.ts`) nu a fost atins în această trecere — doar fișierele de prezentare din lista de mai sus. Confirmat prin:

- `git status` pe repo: `useSalaries.ts`, `useTimesheet.ts`, `usePersonal.ts` nu apar ca modificate.
- `npx vitest run src/features/personal/useSalaries.test.ts src/features/personal/useTimesheet.test.ts` — **6/6 verde**, neschimbat.
- `npx vitest run src/features/personal src/architecture.test.ts` — **15 fișiere / 49 teste, toate verzi**, inclusiv `SalariesView.test.tsx` (dialogul de plată cu totalul `10.000,00 lei`, plata cu `postedPay[0]).toMatchObject({ staffIds: ['STF-1'], method: 'Card' })`, avansul care reîncarcă automat cardul „Avansuri date”), `TimesheetView.test.tsx` (dialogul „Tipărește pontajul”) și `TimesheetPrint.test.tsx` (A4 orizontal, 2 pagini, antet repetat).

## Verificare

- `npx tsc --noEmit -p .` (webapp) — verde.
- `npx vitest run src/features/personal src/architecture.test.ts` — 15/15 fișiere, 49/49 teste.
- `npx vitest run src/features/personal/useSalaries.test.ts src/features/personal/useTimesheet.test.ts` — 2/2 fișiere, 6/6 teste (hook-urile de payroll, neatinse).
- `node --test src/shared/format/date-format.test.mjs` (repo root) — 14/14, inclusiv cele două teste noi pentru `formatDayMonthNumeric`.
- `npm run typecheck` (root) — verde.
- `npm test` (root, `node --test`) — **1198/1200 verde, 2 skip preexistente** (nelegate de Personal).
- `npm run check` (root) — **neconcludent**: `prettier --check` a picat doar pe `webapp/src/features/personal/CandidatesTab.tsx`, fișier din afara scope-ului acestei treceri (rest-ul modulului Personal, lucrat concurent de alt subagent, în lucru la momentul verificării) — nu a fost atins aici. `typecheck`+`test` rulate separat (vezi mai sus) confirmă că partea de Salarii/Pontaj e verde.
- `architecture.test.ts`: vezi secțiunea de mai jos pentru excepțiile scoase/adăugate.

### Modificări în `architecture.test.ts`

- R1: scos `'personal/SalaryFormDrawer.tsx'` (complet curat după adoptarea `MonthInput`). Comentariu adăugat la `'personal/TimesheetPrint.tsx'` (rămas, explicând paralela cu `report/ReportPrintSummary.tsx`).
- R2: scos `'personal/SalariesView.module.css'` (rgba eliminat odată cu `Dialog`, plus fix `border-radius`/comentarii), scos `'personal/TimesheetPrint.module.css'` (hex → tokenii `--print-*`), scos `'personal/TimesheetPrintDialog.module.css'` (overlay/dialog propriu eliminat odată cu `Dialog`). Comentarii adăugate la `'personal/SalaryHistoryDrawer.module.css'` și `'personal/TimesheetView.module.css'` (rămase, cu explicația exactă a fiecărei valori literale nefixabile).
- R7: scos `'personal/SalariesView.tsx'` (formatorul local mutat în `#shared/format/date-format.mjs`).

**Captură 1440×900 vs. artboard:** efectuată 01.10 — `24-personal-salarii.png` (stânga artboard, dreapta aplicația reală, pe copie izolată de date — §3). Diferențe vizuale: captura automată, fără PIN introdus, arată ecranul de blocare PIN al modulului Salarii — acesta e comportamentul corect (corespunde artboard-ului `23d`, nu `23c`), nu o lipsă. Dialogul de confirmare a plății și dialogul „Ce tipăresc?” din Pontaj nu pot fi verificate vizual fără a debloca ecranul; rămân de verificat manual la nevoie.
