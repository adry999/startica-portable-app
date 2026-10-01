# §5.1 — PeriodFilter cu presetări — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `PROMPT-CLAUDE-CODE-8.md` §5.1 trimite la `PROMPT-CLAUDE-CODE-7.md` §2, „neschimbat”: `PeriodFilter` (`webapp/src/shared/ui/PeriodFilter.tsx`) capătă cele 6 presetări din spec (`luna`, `luna-trecuta`, `30z`, `an-scolar`, `tot`, `interval`), cu model `{ preset, from, to }` pe zi (`YYYY-MM-DD`), nu pe lună. Ordinea din spec: componenta întâi, apoi Achitări (`PaymentsTable`), apoi Cheltuieli.

**Spec:** `docs/design/arhiva/PROMPT-CLAUDE-CODE-7.md` §2 (textul original), `docs/design/COMPONENTE.md` §27e rândul `PeriodFilter` **nou** (anatomia exactă: presetări + „Interval…” cu 2 `DateInput`, înlocuiește `<input type=month>` din Achitări — tratat ca autoritar, COMPONENTE.md > PROMPT-7 la conflict), `docs/design/screens/05-achitari.md` (`<Dropdown>Perioadă: oricând ▾</Dropdown>`), `docs/design/INTREBARI.md` §„⏳ §3 — PeriodFilter” (gol confirmat, nu o întrebare nouă).

## Stare curentă (verificat în cod, nu presupus)

- `PeriodFilter.tsx` azi: 2 `<input type="month">`, model `from`/`to` = `YYYY-MM`. Singurul apelant: `PaymentsTable.tsx`, prin `data.monthFrom`/`data.monthTo`/`data.setMonthFrom`/`data.setMonthTo` din `usePayments.ts`, filtrate acolo cu `payment.date.slice(0, 7) >= monthFrom`.
- Cheltuieli (`ExpensesPage.tsx`) nu are `PeriodFilter`: are un `MonthStepper` propriu, independent (decizia E-1 — „Cheltuieli are propria lună, independentă de MonthPicker-ul global”), care alimentează atât cardurile KPI (`monthTotal`, `categorySummary`) cât și — azi — și tabelul (`monthExpenses` filtrează deja pe `monthKey` înainte de `ExpensesFilters`). `ExpensesFilters.tsx` are un dropdown propriu peste `Popover` (`ArchiveFilterDropdown`) — același tipar pe care îl refolosim pentru meniul de presetări.
- `schoolYearStartOf`/`schoolYearMonths`/`schoolYearLabel` trăiesc azi în `src/features/billing/domain/school-year-evaluation.mjs`, exportate prin `index.web.mjs`. `PeriodFilter` e în `webapp/src/shared/ui/` — conform convenției proiectului (`shared/` nu importă `features/`), nu poate importa direct din `#features/billing`, deși `tests/architecture/import-boundaries.test.mjs` nu scanează `webapp/` (verificat — nicio mențiune „webapp” în fișier), deci nu există un test care să blocheze asta azi. Totuși `webapp/src/shared/ui/*` importă deja liber din `#shared/domain/*` (`DayStepper.tsx` → `shiftDays`, `RateCalendar.tsx` → `buildMonthGrid`), deci soluția naturală e să mutăm logica pură acolo.
- `#shared/domain/calendar-month.mjs` are deja `today()`, `shiftDays()`, `monthDates()` — bazele de care are nevoie `30z`/`an-scolar`. `@shared/format/month-shift.ts` (webapp) are `shiftMonth(monthKey, delta)`, deja folosit de `MonthStepper`/`DayStepper`.
- `COMPONENTE.md` cere un buton-declanșator + `Popover` cu listă de opțiuni (tiparul `ArchiveFilterDropdown`/`FilterMenu`), nu un `<select>` HTML brut — respectă regula „fără `<select>` brut în features”, iar `PeriodFilter` stă în `shared/ui`, deci poate folosi `Button`+`Popover`+`DateInput` direct.

## Decizii

1. **Model nou, pe zi:** `PeriodFilterProps` capătă `preset: PeriodPreset` + `onPresetChange`, iar `from`/`to` devin `YYYY-MM-DD` (nu mai e compatibilitate pe lună — un singur apelant azi, actualizat în același PR). `PeriodFilter` calculează singur `from`/`to` la alegerea unei presetări (funcție pură exportată `periodPresetBounds(preset, todayIso?)`, testabilă cu o dată injectată); la `interval` nu suprascrie `from`/`to` — doar arată 2 `DateInput` pentru alegere manuală.
2. **„Single source” pentru anul școlar:** logica pură (`schoolYearStartOf`, `schoolYearMonths`, `schoolYearLabel`) mutată în `src/shared/domain/school-year.mjs` (+ `schoolYearDayBounds(startYear)` nou, pentru interval pe zi), cu teste proprii. `school-year-evaluation.mjs` (billing) reexportă din noua sursă, neschimbat pentru apelanții existenți (`StatusPage`, `usePaymentReceipt`) — zero risc de regresie acolo.
3. **UI:** `Button variant="outline"` declanșator (`{Perioadă}: {eticheta presetării} ▾`) + `Popover` cu 6 opțiuni (`role="menuitemradio"`, ca `ArchiveFilterDropdown`); la `interval`, popover-ul rămâne deschis și arată 2 `DateInput` sub listă. Fără `<select>` nou, fără hex nou.
4. **Achitări:** `usePayments` capătă `period: { preset, from, to }` (înlocuiește `monthFrom`/`monthTo`), implicit `preset: 'tot'` (ca azi — niciun filtru, și coerent cu mockup-ul „Perioadă: oricând”). Filtrarea trece pe comparație de zi (`payment.date >= from && payment.date <= to`), echivalentă cu azi când `from`/`to` sunt capete de lună.
5. **Cheltuieli:** `ExpensesFilters` capătă propriul `PeriodFilter`, independent de `MonthStepper`-ul din topbar (care rămâne neschimbat — controlează doar cardurile KPI, conform E-1). Presetarea implicită e `'luna'`, calculată din luna curentă a `MonthStepper`-ului la montare, ca tabelul să arate azi exact ce arată acum (luna selectată); schimbarea presetării din `PeriodFilter` filtrează doar tabelul/`DailyExpensesView`, nu cardurile KPI. Documentat ca interpretare rezonabilă în absența unui mockup pixel-exact (vezi INTREBARI.md §3, gol confirmat).
6. **„Ultimele 30 de zile”:** `[shiftDays(today, -29), today]` — 30 de zile inclusiv azi. **„An școlar curent”:** `schoolYearDayBounds(schoolYearStartOf(today.slice(0,7)))`. **„Tot”:** `from: '', to: ''`.

## Pașii

- [x] **1. `src/shared/domain/school-year.mjs`** (nou) + `school-year.test.mjs` — mută `SCHOOL_YEAR_START_MONTH`/`schoolYearStartOf`/`schoolYearMonths`/`schoolYearLabel`, adaugă `schoolYearDayBounds`. `school-year-evaluation.mjs` reexportă; testele pure mutate din `school-year-evaluation.test.mjs`.
- [x] **2. `PeriodFilter.tsx`/`.module.css`** — presetări + interval, conform deciziilor 1 și 3. Export `type PeriodPreset`, `PERIOD_PRESET_OPTIONS` (etichetele din spec), `periodPresetBounds`, `monthDayBounds` (pentru ecrane cu propria lună, ex. Cheltuieli).
- [x] **3. `PeriodFilter.test.tsx`** — câte un caz per presetare (bounds corecte cu o dată fixă), comutare la `interval` arată/ascunde `DateInput`-urile, `onPresetChange`/`onFromChange`/`onToChange` apelate corect. **`PeriodFilter.stories.tsx`** — poveste per presetare + interval.
- [x] **4. Achitări:** `usePayments.ts` (model `period`), `PaymentsTable.tsx` (branșează noul `PeriodFilter`, actualizează `ActiveFilters`/`resetFilters`), `usePayments.test.ts`/`PaymentsTable` teste actualizate.
- [x] **5. Cheltuieli:** `ExpensesFilters.tsx` (adaugă `PeriodFilter`), `ExpensesPage.tsx` (stare `period`, filtrare independentă de `monthKey` pentru tabel), teste actualizate.
- [x] **6. `docs/design/COMPONENTE.md`** — rândul `PeriodFilter` **nou** → fără „**nou**”, scurtă notă „implementat §5.1”.
- [x] **7. Verificare:** `npm run check` (rădăcină, 1242 teste) + `cd webapp && npx tsc --noEmit -p . && npx vitest run` (2072 teste) — toate verzi.

## Global Constraints

- Doar `@shared/ui`/`tokens.css`; fără `<select>`/`<input>` brut în `features/`; iconițe doar `<Icon>`.
- Fără atribuire AI în commit-uri; un commit per pas logic (`§5.1` în mesaj pentru trasabilitate).
- `webapp/src/features/personal/` neatins (alt agent lucrează acolo în paralel).
