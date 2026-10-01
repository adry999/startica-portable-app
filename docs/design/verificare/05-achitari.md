# 05 — Achitări (Tabel / Pe luni) — val 2, pe design system

**Referință:** `docs/design/screens/05-achitari.md`, `Achitari.dc.html#5a/#5b`.

## Stare la intrare în val 2

Modul Tabel (`PaymentsTable.tsx`) era deja pe `DataTable`, `ActiveFilters`, `FilterPills`, `PeriodFilter`, `SegmentedControl`, `SelectionBar` (floating), `RowMenu`, `ServiceBadge`, `Badge`, `ConfirmDeleteDialog`. Modul Pe luni (`PaymentsByMonth.tsx` + `PaymentDetailPanel.tsx`) avea proporțiile corecte din spec (listă lată + panou 400px), dar cu trei `Button` „pastilă” suprascrise cu `className`+`!important` și două link-uri din panoul de detaliu la fel.

## Ce s-a schimbat în această trecere

- **`Kpi` — prop nou `activeTone`** (`Kpi.tsx`/`Kpi.module.css`, cu test și secțiune `/design-system`): contur 2px în culoarea „ink” a unui ton, independent de fundalul cardului (`tone`). Cardurile de sumar (Cash/Card/Transfer) din modul Tabel foloseau `Card` + CSS local pentru exact acest efect (fundal alb, contur colorat doar pe metoda filtrată) — acum sunt `Kpi` cu `activeTone`.
- **`PaymentsTable.tsx`**: cardurile de sumar → `Kpi`; bara de căutare + `PeriodFilter` + `SegmentedControl` → `ListToolbar` (era un `<div>` propriu cu aceleași `gap`/`align-items`); `border-radius: 22px` → `var(--radius-xl)`.
- **`PaymentsByMonth.tsx`**: pastilele „Toate/Neasociate/Arhivate” (trei `Button` cu `className`+`!important` pentru fundal/culoare) → un grup `FilterPills` fără etichetă, exact tiparul deja folosit în Personal 23a (`TeamView.tsx`, `.inlinePills`: `padding:0; border-bottom:none`). `monthAbbrev()` local (`toLocaleDateString`) → `formatMonthAbbrev` nou în `#shared/format/date-format.mjs`.
- **`PaymentDetailPanel.tsx`**: „Asociază în De rezolvat →” (`className` cu `!important` ce reimplementa exact `Button variant="link"`) → `variant="link"`; „Arhivează/Dezarhivează” (idem, reimplementa `variant="danger"`) → `variant="danger"`. CSS-ul local rămas doar cu ce chiar era layout (`align-self: flex-start`).
- **R7**: `childrenColumns`-adiacent — de fapt `formatMonthAbbrev` nou, folosit și aici.

## Ce a rămas neschimbat, cu motiv (`docs/design/INTREBARI.md`)

- **Modul Pe luni nu trece pe `MasterDetail`.** Spec-ul cere listă lată + panou fix 400px în dreapta; `MasterDetail` are structura inversă (panou fix în stânga, conținut lat în dreapta) — gândit pentru tipare gen client de email. Layout-ul propriu (`display:flex` + `flex:1` pe listă) rămâne, pentru că e deja exact proporția cerută.
- `FilterMenu`, `ChoiceCards`, `SplitButton`, `PrintOptionsDialog` din lista `DS-IMPLEMENTARE.md` §3 rămân neadoptate — fără loc evident în ecranele curente (export-ul e o singură acțiune, fără opțiuni; tipărirea confirmării navighează direct la o pagină dedicată, nu deschide un dialog). Rândul Achitări rămâne nebifat în §3.

## Testul de regresie financiară (cerut de PROMPT-CLAUDE-CODE-5.md §2)

Nicio schimbare din această trecere nu a atins `usePayments.ts` (calculul sumarelor pe metodă, filtrele, totalurile) — doar `PaymentsTable.tsx`/`PaymentsByMonth.tsx`/`PaymentDetailPanel.tsx` (prezentare). `usePayments.test.ts` fixează deja exact valorile așteptate pentru `summary.total/cash/card/transfer` pe o fixtură fixă (inclusiv testul dedicat „nu bagă o metodă în afara Cash/Card/Transfer”, B1) și rămâne verde neschimbat — asta e dovada că totalurile sunt identice înainte/după migrare. N-am adăugat un test nou separat, ar fi dublat exact aceleași asserții fără să acopere ceva nou.

## Verificare

- `npx tsc --noEmit -p .` — verde.
- `npx vitest run src/features/payments` — 9/9 fișiere, 108/108 teste (inclusiv testul „Neasociate” actualizat la `role="radio"` după trecerea pe `FilterPills`).
- `npx vitest run` (webapp, complet) — verde.
- `npm run check` (root) — verde.
- `architecture.test.ts`: `PaymentsTable.module.css` scos din excepțiile R2 (border-radius fixat); `PaymentsByMonth.tsx` scos din excepțiile R7 (`formatMonthAbbrev`). `PaymentsByMonth.module.css` rămâne în R2 — `box-shadow: inset 4px 0 0 var(--orange)` e un fals-pozitiv al regexului (valoarea folosește tokenul corect, dar regexul cere ca valoarea să *înceapă* cu `var(`, nu doar să-l conțină).

**Captură 1440×900 vs. artboard:** efectuată 01.10, regenerată după corecții — `05-achitari.png` (stânga artboard, dreapta aplicația reală, pe copie izolată de date — §3). Un revizor extern a verificat atent captura inițială și a găsit bug-uri reale ratate de prima trecere; reparate și reconfirmate în captura curentă:
- paginarea nu avea elipsă (1…31 ieșea din card) — `DataTable` are acum ferestruire cu „…" (`shared/ui/DataTable.tsx`);
- coloana Metodă dubla suma pe plățile cu o singură metodă — arată suma doar la plățile împărțite pe 2+ metode (`PaymentsTable.tsx`);
- luna apărea „2026 Iun" (an-lună) — `formatMonthLabel` (`shared/format/date-format.mjs`) e acum lună-an („Iun 2026"), peste tot unde se folosește.

Rămase, verificate și documentate ca fiind corecte, nu bug-uri:
- pastilele Grupă trec pe al doilea rând la 3 grupuri — artboard-ul însuși are `flex-wrap:wrap` pe acest rând; `FilterPills` nu are limită de grupuri (COMPONENTE.md §0).
- perioada se alege din 2 câmpuri `type="month"`, nu dintr-un dropdown cu presetări — gol pre-existent, documentat în `PeriodFilter.tsx` și în `docs/design/INTREBARI.md` (necesită conversie reală de logică de date, task separat).

Diferențele rămase sunt doar date de test.
