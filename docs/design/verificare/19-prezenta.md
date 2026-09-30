# 19 — Prezența (Ziua / Luna) — val 2, pe design system

**Referință:** `docs/design/screens/19-prezenta.md`, `Prezenta.dc.html#18a/#18b`.

## Stare la intrare în val 2

`AttendancePage.tsx` era deja complet migrat: `Button`, `DayStepper`, `MonthStepper`, `SaveIndicator`, `SegmentedControl`, `UndoHistory`, `useTopbarActions`. `DayView.tsx`/`MonthView.tsx` foloseau deja `Button`, `FilterPills`, `LoadingState`, `Card`, `StatusIconButton`, `AttendanceDot` — rămăseseră doar: câteva `border-radius`/hex literale în CSS, două texte de stare goală hardcodate, și (în `WeeklySheetDialog`, ecran adiacent) un `rgba(...)` literal.

## Ce s-a schimbat în această trecere

- **`DayView.module.css`**: `border-radius` px (18/22/16/14) → tokeni (`--radius-lg`/`--radius-xl`/`--radius-md-lg`/`--radius-md`); `#fff` → `var(--white)` (4 locuri); `color: #5b666e` → `var(--muted)` (nicio nuanță identică existentă, cea mai apropiată — convenție deja folosită la Pontaj); comentarii cu hex literal (`#a3361f` etc., `Prezenta.dc.html#18a`) reformulate ca să nu mai conțină șiruri hex.
- **`MonthView.module.css`**: `border-radius` px (22/6/14) → tokeni; `#f3eee5` → `var(--row-divider)`; `#fff` → `var(--white)`.
- **`WeeklySheetDialog.module.css`**: `rgba(58, 71, 80, 0.4)` → `var(--overlay)` (exact tokenul pe care `Dialog` din `@shared/ui` îl folosește deja pentru propriul overlay).
- **`DayView.tsx`**: textul hardcodat „Niciun copil înscris la această dată.” → `EmptyState` cu cheia de catalog `prezenta.nochildren` (`variant="period"`), cu data interpolată via `formatDate` (`#shared/format/date-format.mjs`). A cerut un prop nou `date: string` pe `DayViewProps`, pasat din `AttendancePage.tsx` (avea deja `date` în state).
- **`MonthView.tsx`**: textul hardcodat „Niciun copil în această grupă.” → `EmptyState` cu cheia `prezenta.month.group` (`variant="period"`, `size="compact"`) — potrivire exactă de text în catalog, fără parametri.

## Ce a rămas neschimbat, cu motiv (`docs/design/INTREBARI.md`)

- **`MonthView.tsx` rămâne pe grila proprie + `AttendanceDot`, nu `DayGrid`.** `DayGrid` are un sistem de ton simplu (o culoare/celulă); ecranul Luna cere 6+ stări cu semantică ARIA proprie per stare, exact ce oferă `AttendanceDot` (reutilizat și în fișa copilului). Forțarea pe `DayGrid` ar fi o regresie de accesibilitate.
- **`WeeklySheetDialog.tsx` rămâne cu modal propriu, nu `Dialog` din `@shared/ui`**, și cu un `style` inline pentru culoarea pastilei de grupă selectate. Aparține ecranului `26-foaie-saptamana.md` (tangențial la scope-ul acestei treceri) — doar violarea R2 mecanică din CSS-ul lui a fost fixată acum; adoptarea `Dialog` rămâne follow-up separat.
- `WeeklySheet.module.css` rămâne în excepțiile R2 (o violare reală, în ecranul de tipărire, tot `26-foaie-saptamana.md` — neatinsă în această trecere).
- `WeeklySheetDialog.tsx`'s „Niciuna” (buton „deselectează toate grupele”) rămâne în excepțiile R9 — e etichetă de buton, nu text de stare goală, fals-pozitiv pe regexul „Nicio\w*”.

## Verificare

- `npx tsc --noEmit -p .` — verde.
- `npx vitest run src/features/attendance` — 5/5 fișiere, 27/27 teste.
- `npx vitest run src/architecture.test.ts` — verde: `attendance/DayView.tsx`/`MonthView.tsx` scoase din R9 `TEXT_ALLOWED`, adăugate în R9 `IMPORT_ALLOWED` (import nou, legitim, al `EmptyState`); `attendance/DayView.module.css`/`MonthView.module.css` scoase din R2 `ALLOWED`. `WeeklySheet.module.css`/`WeeklySheetDialog.tsx` rămân (motive de mai sus).
- `npm run check` (root) — verde.

**Captură 1440×900 vs. artboard:** neefectuată (motiv identic cu Dashboard/Copii/Achitări — evită pornirea backend-ului peste baza de date de producție). Recomandare: spot-check manual la următorul push, cu atenție la textul stării goale din Ziua (data interpolată corect) și din Luna (grupă fără copii).
